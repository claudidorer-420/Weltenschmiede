// Bestiarium: Kompendium aller SRD-Monster (deutsch, mit Bildern), die eigenen Statblocks der Kampagne und
// „Meine Kreaturen“ – die Bibliothek der Spielleitung über alle Kampagnen (core/monsterlib.js), jeweils nach Genre.
// Monster lassen sich kopieren, in den Kampf schicken, als Notiz ablegen, per KI illustrieren und als Datei
// austauschen; fehlende Monster eines Genres (Namenslisten der SL) erstellt der Encounter-Generator per KI.
import { html, useState, useEffect, useMemo } from '../lib/preact.js';
import { useStore } from '../core/store.js';
import { app, col } from '../core/app.js';
import { db } from '../core/db.js';
import { openView } from '../core/workspace.js';
import { addToCombat, combatantsFromMonsters } from '../core/combat.js';
import { generateImage } from '../core/ai.js';
import { normalizeMonster } from '../ui/statblock.js';
import { useCol } from '../core/hooks.js';
import { ViewFrame } from '../ui/frame.js';
import { Icon, Btn, IconBtn, Statblock, ViewToggle, toast, confirmDialog, Empty, useMedia, openModal, openMenu, pickFiles, AutoTextarea } from '../ui/components.js';
import { MonsterArt, PortraitArt, creatureType } from '../ui/art.js';
import { CREATURE_TYPES } from '../data/artmap.js';
import { crToNumber } from '../data/rules5e.js';
import { ORIGINS, DND, originColor, originOf, originShort, namesFor, matchNames, hasNameList } from '../data/origins.js';
import { monsterToNote } from './encounter.js';
import {
  ensureMonsterLib, libState, saveToLibrary, removeFromLibrary, updateInLibrary, copyToCampaign, exportMonsters, readMonsterFile, importMonsters,
  exportNameLists, readNameFile, saveNameList, removeNameList,
} from '../core/monsterlib.js';
import { now } from '../lib/util.js';

const CR_BANDS = [['', 'Alle HG'], ['0-1', 'HG 0–1'], ['2-4', 'HG 2–4'], ['5-10', 'HG 5–10'], ['11-16', 'HG 11–16'], ['17-30', 'HG 17+']];

// KI-Bilder verkleinern (Firestore-Dokumente bleiben klein)
async function shrink(dataUrl, max = 448) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * k);
  cv.height = Math.round(img.height * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/webp', 0.82);
}

function MonsterDetail({ m, src, busy, onCopy, onLib, onExport, onCombat, onNote, onPaint, onDelete, onOrigin }) {
  const t = creatureType(m.type);
  return html`<div class="best-detail stack">
    <div class="best-hero" style=${{ '--mc': t.color }}>
      <${PortraitArt} m=${m} w=${132} cr=${true} />
      <div class="stack sm" style="min-width:0">
        <h2>${m.name}</h2>
        <div class="muted small">${[m.size, m.type].filter(Boolean).join(' ')}${m.alignment ? `, ${m.alignment}` : ''}</div>
        <div class="chips"><span class="badge gold">HG ${m.cr || '?'}</span><span class="badge">RK ${m.ac}</span><span class="badge">TP ${m.hp}</span>${m.speed ? html`<span class="badge">${m.speed}</span>` : null}</div>
        ${src !== 'srd' ? html`<label class="row small nowrap" style="gap:6px"><span class="muted">Genre</span>
          <input class="input sm" style="width:auto;max-width:100%" list="ws-genres-best" value=${originOf(m)} placeholder="Genre / Kategorie"
            onChange=${(e) => onOrigin(e.target.value.trim())} />
          <datalist id="ws-genres-best">${ORIGINS.map((o) => html`<option key=${o} value=${o}></option>`)}</datalist>
        </label>` : null}
        <div class="btn-row">
          <${Btn} size="sm" kind="primary" icon="sword" onClick=${onCombat}>In den Kampf<//>
          ${src === 'srd' ? html`<${Btn} size="sm" icon="plus" onClick=${onCopy}>Ins Bestiarium<//>` : null}
          ${src === 'lib' ? html`<${Btn} size="sm" icon="plus" onClick=${onCopy}>In diese Kampagne<//>` : null}
          ${src === 'own' ? html`<${Btn} size="sm" icon="archive" onClick=${onLib} title="Kampagnenübergreifend speichern – in jeder Kampagne wieder abrufbar">${m.libId ? 'In „Meine Kreaturen“ aktualisieren' : 'In „Meine Kreaturen“'}<//>` : null}
          <${Btn} size="sm" icon="file-text" onClick=${onNote}>Als Notiz<//>
          <${Btn} size="sm" icon="image" loading=${busy === 'img'} onClick=${onPaint} title="Porträt mit dem eingerichteten Bildmodell erzeugen">KI-Porträt<//>
          <${Btn} size="sm" kind="ghost" icon="download" onClick=${onExport} title="Als Datei exportieren">Export<//>
          ${src !== 'srd' ? html`<${Btn} size="sm" kind="ghost" icon="trash" onClick=${onDelete}>Löschen<//>` : null}
        </div>
      </div>
    </div>
    <${Statblock} monster=${m} />
    ${src === 'srd' ? html`<div class="tiny faint">Aus dem System Reference Document 5.1 (deutsch) von Wizards of the Coast, CC-BY-4.0.</div>` : null}
  </div>`;
}

// Namenslisten je Genre: Vorschläge im Encounter-Generator und „noch nicht vorhanden“ im Bestiarium.
// Im Textfeld steht ein Name pro Zeile, „# Überschrift“ beginnt eine Gruppe.
const listToText = (groups) => groups.map(([g, names]) => `${g ? `# ${g}\n` : ''}${names.join('\n')}`).join('\n\n');
function textToGroups(t) {
  const groups = [];
  let cur = ['', []];
  for (const line of String(t).split('\n')) {
    const s = line.trim();
    if (!s) continue;
    if (s.startsWith('#')) { if (cur[1].length || cur[0]) groups.push(cur); cur = [s.replace(/^#+\s*/, ''), []]; } else cur[1].push(s);
  }
  if (cur[1].length) groups.push(cur);
  return groups.filter(([, n]) => n.length);
}
function NameLists() {
  const lists = useStore(libState, (s) => s.lists);
  const [edit, setEdit] = useState(null); // { id?, genre, name, text }
  const save = async () => {
    const groups = textToGroups(edit.text);
    if (!edit.genre.trim() || !groups.length) { toast('Genre und mindestens einen Namen eintragen.', 'error'); return; }
    await saveNameList({ id: edit.id, genre: edit.genre.trim(), name: edit.name.trim() || edit.genre.trim(), groups });
    setEdit(null);
    toast('Namensliste gespeichert', 'success');
  };
  const imp = async () => {
    for (const f of await pickFiles({ accept: '.json,application/json', multiple: true })) {
      try {
        const ls = readNameFile(await f.text());
        for (const l of ls) await saveNameList(l);
        toast(`${ls.length} Namensliste${ls.length === 1 ? '' : 'n'} importiert`, 'success');
      } catch (e) { toast(`${f.name}: ${e.message || e}`, 'error'); }
    }
  };
  if (edit) {
    return html`<div class="modal-body stack">
      <div class="row" style="gap:8px"><input class="input grow" list="ws-genres-nl" placeholder="Genre, z. B. Nordische Sagen" value=${edit.genre} onInput=${(e) => setEdit({ ...edit, genre: e.target.value })} />
        <datalist id="ws-genres-nl">${ORIGINS.map((o) => html`<option key=${o} value=${o}></option>`)}</datalist>
        <input class="input grow" placeholder="Name der Liste (optional)" value=${edit.name} onInput=${(e) => setEdit({ ...edit, name: e.target.value })} /></div>
      <${AutoTextarea} minRows=${12} value=${edit.text} placeholder=${'Ein Name pro Zeile\n# Überschrift beginnt eine Gruppe (z. B. # Untote)'} onInput=${(e) => setEdit({ ...edit, text: e.target.value })} />
      <div class="small muted">${textToGroups(edit.text).reduce((t, [, n]) => t + n.length, 0)} Namen · Nur Namen eintragen, die du nutzen darfst.</div>
      <div class="modal-foot"><${Btn} onClick=${() => setEdit(null)}>Zurück<//><${Btn} kind="primary" icon="save" onClick=${save}>Speichern<//></div>
    </div>`;
  }
  return html`<div class="modal-body stack">
    <div class="small muted">Namenslisten liefern Vorschläge im Encounter-Generator und zeigen im Bestiarium, welche Kreaturen eines Genres dir noch fehlen. Sie gehören zu deinem Konto und gelten in allen Kampagnen.</div>
    <div class="row" style="gap:6px"><${Btn} kind="primary" icon="plus" onClick=${() => setEdit({ genre: '', name: '', text: '' })}>Neue Liste<//><${Btn} icon="upload" onClick=${imp}>Importieren<//>
      ${lists.length ? html`<${Btn} icon="download" onClick=${() => exportNameLists(lists)}>Alle exportieren<//>` : null}</div>
    ${lists.length ? html`<div class="stack sm">${lists.map((l) => html`<div class="row nl-row" key=${l.id}>
      <span class="bc-origin" style=${{ '--c': originColor(l.genre) }}><span class="od" />${originShort(l.genre)}</span>
      <b class="grow">${l.name}</b><span class="small muted">${l.count} Namen</span>
      <${IconBtn} icon="pencil" title="Bearbeiten" onClick=${() => setEdit({ id: l.id, genre: l.genre, name: l.name, text: listToText(l.groups) })} />
      <${IconBtn} icon="download" title="Exportieren" onClick=${() => exportNameLists([l], l.name)} />
      <${IconBtn} icon="trash" title="Löschen" onClick=${async () => { if (await confirmDialog(`Namensliste „${l.name}“ löschen?`, { danger: true, ok: 'Löschen' })) removeNameList(l.id); }} />
    </div>`)}</div>` : html`<div class="small faint">Noch keine Namenslisten.</div>`}
  </div>`;
}
export function openNameLists() {
  ensureMonsterLib();
  openModal(() => html`<${NameLists} />`, { title: 'Namenslisten je Genre', icon: 'list', size: 'lg' });
}

// Spielerfassung: nur besiegte Monster, ohne Bearbeiten
function KillBestiary({ tabId }) {
  const cid = useStore(app, (s) => s.cid);
  const kills = useCol(cid ? col('kills') : null, { where: [['visibility', '==', 'players']] });
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const wide = useMedia('(min-width: 1000px)');
  const [srd, setSrd] = useState(null);
  useEffect(() => { import('../data/monsters-srd.js').then((m) => setSrd(m.MONSTERS)); }, []);
  const liste = (kills || []).filter((k) => !q || k.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b2) => crToNumber(a.cr) - crToNumber(b2.cr) || a.name.localeCompare(b2.name, 'de'));
  const voll = (k) => (k.srdId && srd ? srd.find((m) => m.id === k.srdId) : null) || { ...k, id: k.srdId || k.key };
  const current = sel ? liste.find((k) => k.key === sel) : null;
  const detail = (k) => html`<div class="best-detail stack">
    <div class="best-hero" style=${{ '--mc': creatureType(k.type).color }}>
      <${PortraitArt} m=${voll(k)} w=${132} cr=${true} />
      <div class="stack sm" style="min-width:0">
        <h2>${k.name}</h2>
        <div class="muted small">${[k.size, k.type].filter(Boolean).join(' ')}</div>
        <div class="chips"><span class="badge gold">HG ${k.cr || '?'}</span><span class="badge">${k.count || 1}× besiegt</span></div>
      </div>
    </div>
    ${voll(k)?.actions ? html`<${Statblock} monster=${voll(k)} />` : html`<div class="small muted">Von dieser Kreatur kennt ihr bisher nur das Aussehen.</div>`}
  </div>`;
  const waehlen = (k) => {
    setSel(k.key);
    if (!wide) openModal(() => html`<div class="modal-body">${detail(k)}</div>`, { title: k.name, icon: 'ghost', size: 'lg' });
  };
  return html`<${ViewFrame} tabId=${tabId} title="Bestiarium">
    <div class="page wide">
      <div class="page-head"><h1><${Icon} name="ghost" size=${24} />Euer Bestiarium</h1>
        <span class="sub">Jede Kreatur, die eure Gruppe besiegt hat – mit Bild und allem, was ihr über sie gelernt habt.</span></div>
      <div class=${`best-layout${current && wide ? ' with-detail' : ''}`}>
        <div class="stack">
          <div class="search-box" style="margin:0"><${Icon} name="search" size=${15} class="i" /><input class="input" placeholder="Suchen …" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
          ${!kills ? html`<div class="empty"><span class="spinner lg" /></div>`
            : !liste.length ? html`<${Empty} icon="ghost" title="Noch nichts erlegt">Sobald ihr eine Kreatur besiegt, taucht sie hier mit Bild und Werten auf.<//>`
            : html`<div class="best-grid">${liste.map((k) => html`<button type="button" key=${k.key} class=${`best-card${k.key === sel ? ' on' : ''}`} onClick=${() => waehlen(k)}>
                <${MonsterArt} m=${voll(k)} size=${54} cr=${true} />
                <span class="bc-main"><b>${k.name}</b><small>${[k.size, k.type].filter(Boolean).join(' ')}</small><small>${k.count || 1}× besiegt</small></span>
              </button>`)}</div>`}
        </div>
        ${current && wide ? html`<aside class="best-side">${detail(current)}</aside>` : null}
      </div>
    </div>
  <//>`;
}

export function BestiaryView(props) {
  const gm = useStore(app, (s) => s.role === 'gm' && !s.viewAsPlayer);
  return gm ? html`<${GmBestiary} ...${props} />` : html`<${KillBestiary} ...${props} />`;
}

function GmBestiary({ tabId }) {
  const cid = useStore(app, (s) => s.cid);
  const own = useCol(cid ? col('monsters') : null);
  useEffect(() => { ensureMonsterLib(); }, []);
  const lib = useStore(libState, (s) => s.monsters);
  const nameRev = useStore(libState, (s) => s.rev);
  const [srd, setSrd] = useState(null);
  const [src, setSrcRaw] = useState(() => localStorage.getItem('ws.bestSrc') || 'srd');
  const [world, setWorldRaw] = useState(() => localStorage.getItem('ws.bestWorld') || '');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [cr, setCr] = useState('');
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState('');
  const [names, setNames] = useState(null);
  const wide = useMedia('(min-width: 1000px)');
  useEffect(() => { import('../data/monsters-srd.js').then((m) => setSrd(m.MONSTERS)); }, []);
  const setSrc = (v) => { setSrcRaw(v); localStorage.setItem('ws.bestSrc', v); };
  const setWorld = (v) => { setWorldRaw(v); localStorage.setItem('ws.bestWorld', v); setSel(null); };
  // Namensliste der gewählten Welt (für „noch nicht im Bestiarium“)
  useEffect(() => {
    let alive = true;
    setNames(null);
    if (src !== 'srd' && hasNameList(world)) namesFor(world).then((l) => alive && setNames(l)).catch(() => alive && setNames([]));
    return () => { alive = false; };
  }, [src, world, nameRev]);
  const mine = src === 'lib' ? lib : own;
  const counts = useMemo(() => {
    const c = {};
    for (const m of mine || []) {
      const o = originOf(m) || '';
      c[o] = (c[o] || 0) + 1;
    }
    return c;
  }, [mine]);
  // Genre-Filter entstehen erst durch die Monster im Bestiarium – keine voreingestellten Welten
  const genres = useMemo(() => Object.keys(counts).filter(Boolean).sort((a, b) => (counts[b] - counts[a]) || a.localeCompare(b, 'de')), [counts]);
  const list = src === 'srd' ? srd : mine ? mine.filter((m) => !world || (originOf(m) || '-') === world) : null;
  const filtered = useMemo(() => (list || []).filter((m) => {
    if (q && !`${m.name} ${m.type || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (type && !CREATURE_TYPES.find((t) => t.name === type)?.re.test(m.type || '')) return false;
    if (cr) {
      const [a, b] = cr.split('-').map(Number);
      const v = crToNumber(m.cr);
      if (v < a || v > b) return false;
    }
    return true;
  }).sort((a, b) => crToNumber(a.cr) - crToNumber(b.cr) || a.name.localeCompare(b.name, 'de')), [list, q, type, cr]);
  const missing = useMemo(() => {
    if (src === 'srd' || !names) return [];
    const have = new Set([...(own || []), ...(lib || [])].map((m) => m.name.toLowerCase()));
    return matchNames(names.filter((n) => !have.has(n.name.toLowerCase())), q, 90);
  }, [names, own, lib, q, src]);
  const current = sel ? (list || []).find((m) => m.id === sel) || null : null;

  const copyToOwn = async (m) => {
    const { qty, ...rest } = normalizeMonster(m);
    const id = await db.add(col('monsters'), { ...rest, ...(m.image ? { image: m.image } : {}), srdId: m.id, origin: DND, createdAt: now() });
    toast(`„${m.name}“ ist jetzt in deinem Bestiarium`, 'success');
    return id;
  };
  const toLib = async (m) => { await saveToLibrary(m); };
  const fromLib = async (m) => {
    const id = await copyToCampaign(m);
    toast(`„${m.name}“ ist jetzt im Bestiarium dieser Kampagne`, 'success');
    setSrc('own');
    setSel(id);
  };
  const toCombat = async (m) => {
    await addToCombat(combatantsFromMonsters([m]));
    toast('Im Kampf-Tracker', 'success', { action: { label: 'Zur Kampfkarte', onClick: () => import('./maps.js').then((x) => x.openBattle()) } });
  };
  const paint = async (m, from) => {
    setBusy('img');
    try {
      const t = creatureType(m.type);
      const lore = m.description ? `. ${String(m.description).replace(/\s+/g, ' ').slice(0, 300)}` : '';
      const world2 = originOf(m) && originOf(m) !== DND ? ` aus der Welt von ${originOf(m)}` : '';
      const prompt = `Fantasy-Monsterporträt im Stil klassischer Rollenspiel-Illustrationen, gemalt, dramatisches Licht, dunkler stimmungsvoller Hintergrund, Kopf-und-Schulter-Ansicht, keine Schrift, kein Rahmen. Kreatur: ${m.name}${world2} (${[m.size, m.type || t.name].filter(Boolean).join(' ')})${lore}`;
      const r = await generateImage({ prompt, aspect: '1:1' });
      const image = await shrink(r.dataUrl);
      let id = m.id;
      if (from === 'srd') {
        id = await copyToOwn(m);
        setSrc('own');
      }
      if (from === 'lib') await updateInLibrary(id, { image });
      else await db.update(col('monsters'), id, { image });
      setSel(id);
      toast('Porträt erstellt', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const remove = async (m, from = src) => {
    const where = from === 'lib' ? '„Meine Kreaturen“ (in allen Kampagnen)' : 'dem Bestiarium dieser Kampagne';
    if (!(await confirmDialog(`„${m.name}“ aus ${where} löschen?`, { danger: true, ok: 'Löschen' }))) return;
    if (from === 'lib') await removeFromLibrary(m.id);
    else await db.remove(col('monsters'), m.id);
    setSel(null);
  };
  const setOrigin = (m, from, o) => (from === 'lib' ? updateInLibrary(m.id, { origin: o }) : db.update(col('monsters'), m.id, { origin: o }))
    .then(() => toast(o ? `Jetzt unter „${originShort(o)}“` : 'Ohne Genre', 'success'));
  const detail = (m, from = src) => html`<${MonsterDetail} m=${m} src=${from} busy=${busy}
    onCopy=${() => (from === 'lib' ? fromLib(m) : copyToOwn(m).then((id) => { setSrc('own'); setSel(id); }))}
    onLib=${() => toLib(m)} onExport=${() => exportMonsters([m], m.name)}
    onCombat=${() => toCombat(m)} onNote=${() => monsterToNote(m)} onPaint=${() => paint(m, from)} onDelete=${() => remove(m, from)}
    onOrigin=${(o) => setOrigin(m, from, o)} />`;
  // Import: Kreaturen- oder Namenslisten-Datei
  const doImport = async () => {
    const files = await pickFiles({ accept: '.json,application/json', multiple: true });
    for (const f of files) {
      const text = await f.text();
      let monsters = null;
      let lists = null;
      try { monsters = readMonsterFile(text); } catch { try { lists = readNameFile(text); } catch (e) { toast(`${f.name}: weder Kreaturen noch Namenslisten erkannt`, 'error'); continue; } }
      if (monsters) {
        const target = await openModal(({ close }) => html`<div class="modal-body stack">
          <div>${monsters.length} Kreatur${monsters.length === 1 ? '' : 'en'} in „${f.name}“: <span class="small muted">${monsters.slice(0, 12).map((m) => m.name).join(', ')}${monsters.length > 12 ? ' …' : ''}</span></div>
          <div class="small muted">Nur Kreaturen importieren, die du nutzen darfst.</div>
          <div class="modal-foot"><${Btn} onClick=${() => close(null)}>Abbrechen<//>${cid ? html`<${Btn} onClick=${() => close('camp')}>Nur in diese Kampagne<//>` : null}<${Btn} kind="primary" icon="archive" onClick=${() => close('lib')}>In „Meine Kreaturen“<//></div>
        </div>`, { title: 'Kreaturen importieren', icon: 'upload', size: 'sm' });
        if (!target) continue;
        await importMonsters(monsters, target);
        setSrc(target === 'camp' ? 'own' : 'lib');
        toast(`${monsters.length} Kreatur${monsters.length === 1 ? '' : 'en'} importiert`, 'success');
      } else if (lists) {
        for (const l of lists) await saveNameList(l);
        toast(`${lists.length} Namensliste${lists.length === 1 ? '' : 'n'} importiert (${lists.map((l) => l.genre).join(', ')})`, 'success');
      }
    }
  };
  const exportMenu = (e) => openMenu(e, [
    { label: `Aktuelle Ansicht exportieren (${filtered.length})`, icon: 'download', onClick: () => exportMonsters(filtered, src === 'lib' ? 'Meine Kreaturen' : src === 'own' ? 'Bestiarium' : 'Kompendium') },
    own?.length ? { label: `Bestiarium der Kampagne (${own.length})`, icon: 'ghost', onClick: () => exportMonsters(own, 'Bestiarium') } : null,
    lib?.length ? { label: `Meine Kreaturen (${lib.length})`, icon: 'archive', onClick: () => exportMonsters(lib, 'Meine Kreaturen') } : null,
    libState.get().lists.length ? { label: 'Alle Namenslisten', icon: 'list', onClick: () => exportNameLists(libState.get().lists) } : null,
  ].filter(Boolean));
  const select = (m, from = src) => {
    setSel(m.id);
    if (!wide) openModal(() => html`<div class="modal-body">${detail(m, from)}</div>`, { title: m.name, icon: 'ghost', size: 'lg' });
  };
  // Fehlendes Monster: SRD-Statblock öffnen oder im Encounter-Generator per KI erstellen
  const fromName = (n) => {
    if (n.srd) {
      const m = (srd || []).find((x) => x.id === n.srd);
      setSrc('srd');
      if (m) select(m, 'srd');
      return;
    }
    openView('encounter', { preset: { name: n.name, origin: world, ts: Date.now() } });
  };

  return html`<${ViewFrame} tabId=${tabId} title="Bestiarium">
    <div class="page wide">
      <div class="page-head head-tools"><h1><${Icon} name="ghost" size=${24} />Bestiarium</h1>
        <span class="sub">Alle Monster des SRD auf Deutsch plus deine eigenen Statblocks – mit Bild, bereit für Kampf-Tracker und Kampfkarte.</span>
        <div class="head-tools-btns">
          <${IconBtn} icon="upload" title="Importieren (Kreaturen oder Namenslisten)" onClick=${doImport} />
          <${IconBtn} icon="download" title="Exportieren" onClick=${exportMenu} />
          <${IconBtn} icon="list" title="Namenslisten je Genre" onClick=${() => openNameLists()} />
          <${ViewToggle} value="bestiary" options=${[{ value: 'bestiary', label: 'Bestiarium', icon: 'ghost', view: 'bestiary' }, { value: 'encounter', label: 'Encounter-Generator', icon: 'swords', view: 'encounter' }]} /></div></div>
      <div class=${`best-layout${current && wide ? ' with-detail' : ''}`}>
        <div class="stack">
          <div class="sm-tabs">
            <button type="button" class=${`sm-tab${src === 'srd' ? ' active' : ''}`} onClick=${() => { setSrc('srd'); setSel(null); }}>Kompendium (SRD) <span class="faint">${srd?.length || ''}</span></button>
            <button type="button" class=${`sm-tab${src === 'own' ? ' active' : ''}`} onClick=${() => { setSrc('own'); setSel(null); }} title="Statblocks dieser Kampagne">Kampagne <span class="faint">${own?.length || 0}</span></button>
            <button type="button" class=${`sm-tab${src === 'lib' ? ' active' : ''}`} onClick=${() => { setSrc('lib'); setSel(null); }} title="Deine Bibliothek – in allen Kampagnen verfügbar">Meine Kreaturen <span class="faint">${lib?.length ?? ''}</span></button>
          </div>
          ${src !== 'srd' ? html`<div class="world-chips">
            <button type="button" class=${`world-chip${!world ? ' on' : ''}`} onClick=${() => setWorld('')}>Alle Genres <small>${mine?.length || 0}</small></button>
            ${genres.map((o) => html`<button type="button" class=${`world-chip${world === o ? ' on' : ''}`} style=${{ '--c': originColor(o) }} title=${o} onClick=${() => setWorld(o)}><span class="od" />${originShort(o)} <small>${counts[o] || 0}</small></button>`)}
            ${counts[''] ? html`<button type="button" class=${`world-chip${world === '-' ? ' on' : ''}`} onClick=${() => setWorld('-')}>Ohne Genre <small>${counts['']}</small></button>` : null}
          </div>` : null}
          <div class="row">
            <div class="search-box grow" style="margin:0"><${Icon} name="search" size=${15} class="i" /><input class="input" placeholder="Suchen: Goblin, Drache, Untoter …" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
            <select class="select sm" style="width:auto" value=${type} onChange=${(e) => setType(e.target.value)}>
              <option value="">Alle Typen</option>${CREATURE_TYPES.map((t) => html`<option value=${t.name}>${t.name}</option>`)}
            </select>
            <select class="select sm" style="width:auto" value=${cr} onChange=${(e) => setCr(e.target.value)}>${CR_BANDS.map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select>
          </div>
          ${!list ? html`<div class="empty"><span class="spinner lg" /></div>`
            : !filtered.length ? html`<${Empty} icon="ghost" title=${src !== 'srd' ? (world && world !== '-' ? `Noch keine Monster aus ${originShort(world)}` : 'Noch leer') : 'Nichts gefunden'}>${src === 'lib' ? 'Hier landen Kreaturen, die du kampagnenübergreifend speicherst – über „In „Meine Kreaturen““, beim Speichern im Encounter-Generator oder per Import.' : src === 'own' ? (hasNameList(world) ? 'Unten stehen bekannte Namen dieses Genres – antippen, und der Encounter-Generator erstellt den Statblock.' : 'Kopiere Monster aus dem Kompendium oder aus „Meine Kreaturen“, oder speichere Statblocks aus dem Encounter-Generator.') : 'Andere Suche oder Filter probieren.'}<//>`
            : html`<div class="best-grid">${filtered.slice(0, 240).map((m) => {
                const o = src !== 'srd' && !world ? originOf(m) : '';
                return html`<button type="button" key=${m.id} class=${`best-card${m.id === sel ? ' on' : ''}`} onClick=${() => select(m)}>
                  <${MonsterArt} m=${m} size=${54} cr=${true} />
                  <span class="bc-main"><b>${m.name}</b><small>${[m.size, m.type].filter(Boolean).join(' ')}</small>
                    <small>RK ${m.ac} · TP ${m.hp}${o ? html` · <span class="bc-origin" style=${{ '--c': originColor(o) }}><span class="od" />${originShort(o)}</span>` : null}</small></span>
                </button>`;
              })}</div>`}
          ${filtered.length > 240 ? html`<div class="small faint">${filtered.length - 240} weitere – Suche oder Filter nutzen.</div>` : null}
          ${src !== 'srd' && hasNameList(world) ? html`<div class="card stack sm">
            <div class="row"><b class="grow">Aus ${originShort(world)}: noch nicht vorhanden</b><span class="small faint">${names ? `${missing.length}${missing.length >= 90 ? '+' : ''} Namen` : ''}</span></div>
            <div class="small muted">${originOf({ origin: world }) === DND ? 'SRD-Monster öffnen den Statblock aus dem Kompendium; Namen aus deinen Namenslisten erstellt der Encounter-Generator per KI.' : 'Antippen → der Encounter-Generator erstellt das Monster als 5E-Statblock; danach speichern.'}</div>
            ${!names ? html`<div class="empty"><span class="spinner" /></div>`
              : missing.length ? html`<div class="name-chips">${missing.map((n) => html`<button type="button" class="name-chip" title=${n.meta || ''} onClick=${() => fromName(n)}>${n.srd ? html`<span class="badge gold">SRD</span>` : html`<${Icon} name="sparkles" size=${12} />`}${n.name}</button>`)}</div>`
              : html`<div class="small faint">${q ? 'Kein Treffer – die Suche filtert auch diese Liste.' : 'Alles da!'}</div>`}
          </div>` : null}
          <div class="tiny faint">Kompendium: SRD 5.1 (deutsch), CC-BY-4.0 · Symbole: game-icons.net (CC BY 3.0) · Namenslisten: deine eigenen (Symbol „Liste“ oben)</div>
        </div>
        ${current && wide ? html`<aside class="best-side">${detail(current)}</aside>` : null}
      </div>
    </div>
  <//>`;
}

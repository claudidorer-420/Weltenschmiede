// NPC-Sammlung: das Gegenstück zum Bestiarium, aber für Nichtspielerfiguren.
// Von Hand angelegt (NPC-Assistent), aus der NPC-Schmiede übernommen oder aus einer Notiz erzeugt.
import { html, useState, useMemo } from '../lib/preact.js';
import { useStore } from '../core/store.js';
import { app, col, noteById } from '../core/app.js';
import { db } from '../core/db.js';
import { openNote } from '../core/workspace.js';
import { useCol } from '../core/hooks.js';
import { generateImage } from '../core/ai.js';
import { ViewFrame } from '../ui/frame.js';
import { Icon, Btn, Statblock, Empty, ViewToggle, toast, confirmDialog, useMedia, openModal } from '../ui/components.js';
import { npcStat, NPC_MODES } from '../data/npcstat.js';
import { openNpcEditor, npcToCombat, NpcRow } from './npcedit.js';
import { now } from '../lib/util.js';

// Porträt klein halten – Firestore-Dokumente sollen leicht bleiben
async function shrink(dataUrl, max = 448) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * k);
  cv.height = Math.round(img.height * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/webp', 0.82);
}

function NpcDetail({ npc, busy, onEdit, onCombat, onNote, onPaint, onDelete }) {
  const stat = npcStat(npc);
  const note = npc.noteId ? noteById(npc.noteId) : null;
  const modus = NPC_MODES.find((m) => m.value === (npc.statMode || 'none'))?.label || 'Keine Spielwerte';
  return html`<div class="best-detail stack">
    <div class="best-hero" style=${{ '--mc': '#c9a227' }}>
      ${npc.image ? html`<img class="npc-hero-img" src=${npc.image} alt="" />` : html`<span class="npc-hero-img ph"><${Icon} name="mask" size=${44} /></span>`}
      <div class="stack sm" style="min-width:0">
        <h2>${npc.name}</h2>
        <div class="muted small">${[npc.species, npc.role].filter(Boolean).join(' · ') || 'Nichtspielerfigur'}${npc.alignment ? `, ${npc.alignment}` : ''}</div>
        <div class="chips"><span class="badge gold">${modus}</span><span class="badge">RK ${stat.ac}</span><span class="badge">TP ${stat.hp}</span>${npc.relation && npc.relation !== 'neutral' ? html`<span class="badge">${npc.relation}</span>` : null}</div>
        <div class="btn-row">
          <${Btn} size="sm" kind="primary" icon="sword" onClick=${onCombat}>In den Kampf<//>
          <${Btn} size="sm" icon="pencil" onClick=${onEdit}>Bearbeiten<//>
          <${Btn} size="sm" icon="file-text" onClick=${onNote}>${note ? 'Notiz öffnen' : 'Als Notiz'}<//>
          <${Btn} size="sm" icon="image" loading=${busy === 'img'} onClick=${onPaint}>KI-Porträt<//>
          <${Btn} size="sm" kind="ghost" icon="trash" onClick=${onDelete}>Löschen<//>
        </div>
      </div>
    </div>
    ${npc.look || npc.quirk || npc.motive ? html`<ul class="small" style="margin:0;padding-left:18px;line-height:1.7">
      ${npc.look ? html`<li><b>Aussehen:</b> ${npc.look}</li>` : null}
      ${npc.quirk ? html`<li><b>Marotte:</b> ${npc.quirk}</li>` : null}
      ${npc.motive ? html`<li><b>Motivation:</b> ${npc.motive}</li>` : null}
      ${npc.secret ? html`<li><b>Geheimnis (SL):</b> ${npc.secret}</li>` : null}
    </ul>` : null}
    <${Statblock} monster=${stat} />
    ${(npc.statMode || 'none') === 'none' ? html`<div class="tiny faint">Ohne eigene Werte greift im Kampf der <b>Gemeine</b> aus dem SRD: alle Attribute 10, Rüstungsklasse 10, 4 Trefferpunkte, Knüppel für 1W4.</div>` : null}
  </div>`;
}

export function NpcLibView({ tabId }) {
  const cid = useStore(app, (s) => s.cid);
  const list = useCol(cid ? col('npcs') : null);
  const [q, setQ] = useState('');
  const [modus, setModus] = useState('');
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState('');
  const wide = useMedia('(min-width: 1000px)');

  const gefiltert = useMemo(() => (list || []).filter((n) => {
    if (modus && (n.statMode || 'none') !== modus) return false;
    if (q && !`${n.name} ${n.role || ''} ${n.species || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name, 'de')), [list, q, modus]);
  const current = sel ? (list || []).find((n) => n.id === sel) || null : null;

  const neu = async () => {
    const r = await openNpcEditor(null);
    if (r?.id) setSel(r.id);
  };
  const bearbeiten = async (npc) => { await openNpcEditor(npc); };
  const zurNotiz = async (npc) => {
    if (npc.noteId && noteById(npc.noteId)) { openNote(npc.noteId); return; }
    const { npcMarkdown } = await import('./npcedit.js');
    const { createNote, npcFolder } = await import('../core/app.js');
    const n = await createNote({ title: npc.name, folder: npcFolder(), body: `---\ntyp: npc\ntags: [npc]\n---\n${npcMarkdown(npc, npc.stats)}\n` });
    await db.update(col('npcs'), npc.id, { noteId: n.id });
    openNote(n.id);
  };
  const malen = async (npc) => {
    setBusy('img');
    try {
      const teile = [npc.species, npc.role, npc.look].filter(Boolean).join(', ');
      const r = await generateImage({ prompt: `Fantasy-Charakterporträt im Hochformat: ${npc.name}${teile ? ` – ${teile}` : ''}. Kopf und Oberkörper, gemalt wie eine Buchillustration, dramatisches Licht, dunkler stimmungsvoller Hintergrund, keine Schrift.`, aspect: '2:3' });
      await db.update(col('npcs'), npc.id, { image: await shrink(r.dataUrl), updatedAt: now() });
      toast('Porträt erstellt', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const loeschen = async (npc) => {
    if (!(await confirmDialog(`„${npc.name}“ aus der NPC-Sammlung löschen?`, { danger: true, ok: 'Löschen' }))) return;
    await db.remove(col('npcs'), npc.id);
    setSel(null);
  };

  const detail = (npc) => html`<${NpcDetail} npc=${npc} busy=${busy} onEdit=${() => bearbeiten(npc)} onCombat=${() => npcToCombat(npc)}
    onNote=${() => zurNotiz(npc)} onPaint=${() => malen(npc)} onDelete=${() => loeschen(npc)} />`;
  const waehlen = (npc) => {
    setSel(npc.id);
    if (!wide) openModal(() => html`<div class="modal-body">${detail(npc)}</div>`, { title: npc.name, icon: 'mask', size: 'lg' });
  };

  const zaehler = useMemo(() => {
    const c = {};
    for (const n of list || []) c[n.statMode || 'none'] = (c[n.statMode || 'none'] || 0) + 1;
    return c;
  }, [list]);

  return html`<${ViewFrame} tabId=${tabId} title="NPC-Sammlung">
    <div class="page wide">
      <div class="page-head head-tools"><h1><${Icon} name="mask" size=${24} />NPC-Sammlung</h1>
        <span class="sub">Alle Nichtspielerfiguren der Kampagne – mit oder ohne Spielwerte, jederzeit in den Kampf zu schicken.</span>
        <div class="head-tools-btns">
          <${ViewToggle} value="npclib" options=${[{ value: 'npc', label: 'NPC-Schmiede', icon: 'sparkles', view: 'npc' }, { value: 'npclib', label: 'NPC-Sammlung', icon: 'users', view: 'npclib' }]} />
          <${Btn} size="sm" kind="primary" icon="plus" onClick=${neu}>NPC anlegen<//>
        </div>
      </div>
      <div class=${`best-layout${current && wide ? ' with-detail' : ''}`}>
        <div class="stack">
          <div class="world-chips">
            <button type="button" class=${`world-chip${!modus ? ' on' : ''}`} onClick=${() => setModus('')}>Alle <small>${list?.length || 0}</small></button>
            ${NPC_MODES.map((m) => html`<button key=${m.value} type="button" class=${`world-chip${modus === m.value ? ' on' : ''}`} onClick=${() => setModus(m.value)}>${m.label} <small>${zaehler[m.value] || 0}</small></button>`)}
          </div>
          <div class="search-box" style="margin:0"><${Icon} name="search" size=${15} class="i" /><input class="input" placeholder="Suchen: Name, Beruf, Volk …" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
          ${!list ? html`<div class="empty"><span class="spinner lg" /></div>`
            : !gefiltert.length ? html`<${Empty} icon="mask" title=${q || modus ? 'Nichts gefunden' : 'Noch keine NPC'} action=${html`<${Btn} kind="primary" icon="plus" onClick=${neu}>NPC anlegen<//>`}>
                Lege Figuren von Hand an oder lass sie in der NPC-Schmiede entstehen – gespeicherte NPC lassen sich wie Monster auf die Kampfkarte setzen.<//>`
            : html`<div class="best-grid">${gefiltert.map((n) => html`<${NpcRow} key=${n.id} npc=${n} on=${n.id === sel} onClick=${() => waehlen(n)} />`)}</div>`}
        </div>
        ${current && wide ? html`<aside class="best-side">${detail(current)}</aside>` : null}
      </div>
    </div>
  <//>`;
}

// NPC-Werkzeuge für eine Notiz im NPC-Ordner: ein Fenster mit allem, was die NPC-Schmiede
// für genau diese Figur anbietet – Spielwerte, Porträt, in den Kampf, Dossier ausarbeiten.
import { html, useState, useEffect } from '../lib/preact.js';
import { col, noteById, updateNote, isNpcFolder } from '../core/app.js';
import { db } from '../core/db.js';
import { openView } from '../core/workspace.js';
import { generateImage } from '../core/ai.js';
import { Icon, Btn, Statblock, openModal, toast, Empty } from '../ui/components.js';
import { npcStat, NPC_MODES } from '../data/npcstat.js';
import { openNpcEditor, npcToCombat, npcMarkdown } from './npcedit.js';
import { now } from '../lib/util.js';

// Gehört die Notiz zu einer Figur? (Ordner „NPC“/„NPCs“ oder typ: npc im Frontmatter)
export const isNpcNote = (n) => !!n && (isNpcFolder(n.folder || '') || /^\s*typ:\s*npc\s*$/mi.test(String(n.body || '').slice(0, 400)));

// Den zur Notiz gehörenden Eintrag der NPC-Sammlung finden (über noteId oder den Namen)
export async function npcForNote(n) {
  const alle = await db.list(col('npcs')).catch(() => []);
  return alle.find((x) => x.noteId === n.id) || alle.find((x) => x.name.trim().toLowerCase() === n.title.trim().toLowerCase()) || null;
}

// Kurzes Bild aus dem Notiztext ziehen (für die Porträt-Eingabe)
const zeile = (body, feld) => (new RegExp(`\\*\\*${feld}:?\\*\\*\\s*(.+)`, 'i').exec(String(body || ''))?.[1] || '').trim();

async function shrink(dataUrl, max = 448) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * k);
  cv.height = Math.round(img.height * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/webp', 0.82);
}

function NpcNoteBody({ close, note }) {
  const [npc, setNpc] = useState(undefined);       // undefined = wird gesucht, null = keiner da
  const [busy, setBusy] = useState('');
  useEffect(() => { npcForNote(note).then(setNpc); }, [note.id]);

  const anlegen = async () => {
    const start = {
      name: note.title,
      noteId: note.id,
      species: zeile(note.body, 'Volk'),
      role: zeile(note.body, 'Beruf') || zeile(note.body, 'Beruf/Rolle'),
      look: zeile(note.body, 'Aussehen'),
      quirk: zeile(note.body, 'Marotte'),
      motive: zeile(note.body, 'Motivation'),
    };
    const r = await openNpcEditor({ ...start, ...(npc || {}) });
    if (r) setNpc(r);
  };
  const malen = async () => {
    if (!npc) { toast('Lege zuerst die Spielwerte an – dann gehört das Bild zur Figur.', 'info'); return; }
    setBusy('img');
    try {
      const teile = [npc.species, npc.role, npc.look].filter(Boolean).join(', ');
      const r = await generateImage({ prompt: `Fantasy-Charakterporträt im Hochformat: ${npc.name}${teile ? ` – ${teile}` : ''}. Kopf und Oberkörper, gemalt wie eine Buchillustration, dramatisches Licht, dunkler Hintergrund, keine Schrift.`, aspect: '2:3' });
      const image = await shrink(r.dataUrl);
      await db.update(col('npcs'), npc.id, { image, updatedAt: now() });
      setNpc({ ...npc, image });
      toast('Porträt erstellt', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally { setBusy(''); }
  };
  const textErneuern = async () => {
    if (!npc) return;
    const kopf = /^---[\s\S]*?---\n/.exec(note.body || '')?.[0] || '---\ntyp: npc\ntags: [npc]\n---\n';
    await updateNote(note.id, { body: `${kopf}${npcMarkdown(npc, npc.stats)}\n` });
    toast('Notiz aus den NPC-Daten neu geschrieben', 'success');
  };

  const stat = npc ? npcStat(npc) : null;
  const modus = npc ? NPC_MODES.find((m) => m.value === (npc.statMode || 'none'))?.label : null;
  return html`<div class="modal-body stack">
    ${npc === undefined ? html`<div class="empty"><span class="spinner lg" /></div>` : null}
    ${npc === null ? html`<${Empty} icon="mask" title="Noch keine Spielwerte" action=${html`<${Btn} kind="primary" icon="plus" onClick=${anlegen}>NPC-Daten anlegen<//>`}>
      Diese Notiz gehört zum NPC-Ordner. Lege Spielwerte an, dann lässt sich die Figur wie ein Monster in den Kampf setzen.<//>` : null}
    ${npc ? html`
      <div class="row top">
        ${npc.image ? html`<img class="npc-hero-img" src=${npc.image} alt="" />` : html`<span class="npc-hero-img ph"><${Icon} name="mask" size=${40} /></span>`}
        <div class="stack sm" style="min-width:0">
          <b style="font-size:18px">${npc.name}</b>
          <div class="muted small">${[npc.species, npc.role].filter(Boolean).join(' · ') || 'Nichtspielerfigur'}</div>
          <div class="chips"><span class="badge gold">${modus}</span><span class="badge">RK ${stat.ac}</span><span class="badge">TP ${stat.hp}</span></div>
        </div>
      </div>
      <div class="btn-row">
        <${Btn} size="sm" kind="primary" icon="sword" onClick=${() => { npcToCombat(npc); close(true); }}>In den Kampf<//>
        <${Btn} size="sm" icon="pencil" onClick=${anlegen}>Spielwerte bearbeiten<//>
        <${Btn} size="sm" icon="image" loading=${busy === 'img'} onClick=${malen}>KI-Porträt<//>
        <${Btn} size="sm" icon="refresh" onClick=${textErneuern}>Notiztext erneuern<//>
        <${Btn} size="sm" kind="ghost" icon="users" onClick=${() => { openView('npclib'); close(true); }}>NPC-Sammlung<//>
        <${Btn} size="sm" kind="ghost" icon="sparkles" onClick=${() => { openView('npc'); close(true); }}>In der NPC-Schmiede ausarbeiten<//>
      </div>
      <${Statblock} monster=${stat} />` : null}
  </div>`;
}

export const openNpcNoteTools = (note) => openModal(({ close }) => html`<${NpcNoteBody} close=${close} note=${note} />`,
  { title: `NPC: ${note.title}`, icon: 'mask', size: 'md' });

// Für Menüs: der Eintrag erscheint nur bei Notizen im NPC-Ordner
export const npcMenuItem = (n) => (isNpcNote(n)
  ? { label: 'NPC-Werkzeuge …', icon: 'mask', hint: 'Spielwerte, Porträt, in den Kampf', onClick: () => openNpcNoteTools(noteById(n.id) || n) }
  : null);

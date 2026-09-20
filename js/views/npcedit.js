// NPC von Hand anlegen – der kleine Bruder des Charakter-Assistenten.
// Wird von der NPC-Schmiede, der NPC-Sammlung und dem Dateiexplorer (NPC-Ordner) geöffnet.
import { html, useState, useMemo } from '../lib/preact.js';
import { col, createNote, noteById, updateNote, npcFolder, rulesEdition } from '../core/app.js';
import { db } from '../core/db.js';
import { openNote } from '../core/workspace.js';
import { addToCombat, combatantsFromMonsters } from '../core/combat.js';
import { Icon, Btn, Field, Select, Segmented, Statblock, openModal, toast } from '../ui/components.js';
import { classesFor } from '../data/chargen.js';
import { SPECIES, ALIGNMENTS } from '../data/rules5e.js';
import { NPC_MODES, buildStat, npcStat } from '../data/npcstat.js';
import { now } from '../lib/util.js';

const LEER = {
  name: '', species: '', gender: '', age: '', role: '', alignment: '', relation: 'neutral',
  look: '', quirk: '', motive: '', secret: '',
  statMode: 'none', cls: 'kaempfer', level: 1,
};

export const RELATIONS = ['neutral', 'Verbündeter', 'Auftraggeber', 'Rivale', 'Feind', 'Informant', 'Händler', 'Liebesinteresse'];

// Aus den Feldern wird der Notiztext – damit ein NPC überall gleich aussieht
export function npcMarkdown(f, stat) {
  const z = [];
  if (f.species) z.push(`- **Volk:** ${f.species}`);
  if (f.role) z.push(`- **Beruf/Rolle:** ${f.role}`);
  if (f.gender || f.age) z.push(`- **Geschlecht/Alter:** ${[f.gender, f.age].filter(Boolean).join(', ')}`);
  if (f.alignment) z.push(`- **Gesinnung:** ${f.alignment}`);
  if (f.relation && f.relation !== 'neutral') z.push(`- **Beziehung zur Gruppe:** ${f.relation}`);
  if (f.look) z.push(`- **Aussehen:** ${f.look}`);
  if (f.quirk) z.push(`- **Marotte:** ${f.quirk}`);
  if (f.motive) z.push(`- **Motivation:** ${f.motive}`);
  let t = z.join('\n');
  if (f.secret) t += `\n\n> [!gm] Geheimnis\n> ${f.secret}`;
  if (stat) t += `\n\n## Spielwerte\n- **Rüstungsklasse:** ${stat.ac}${stat.acNote ? ` (${stat.acNote})` : ''}\n- **Trefferpunkte:** ${stat.hp}\n- **Herausforderungsgrad:** ${stat.cr}\n${stat.actions.map((a) => `- **${a.name}.** ${a.desc}`).join('\n')}`;
  return t;
}

function NpcForm({ close, start }) {
  const ed = rulesEdition();
  const [f, setF] = useState({ ...LEER, ...(start || {}) });
  const [schritt, setSchritt] = useState(0);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const klassen = useMemo(() => classesFor(ed), [ed]);
  const stat = useMemo(() => buildStat(f), [f.statMode, f.cls, f.level, f.name, f.species, f.role, f.alignment]);
  const vorschau = stat || npcStat({ ...f, statMode: 'none' });

  const [busy, setBusy] = useState(false);
  const speichern = async (auchNotiz) => {
    if (!f.name.trim()) { toast('Der NPC braucht einen Namen.', 'error'); setSchritt(0); return; }
    if (busy) return;
    setBusy(true);
    // Firestore mag kein undefined – und ein Fehler muss sichtbar werden, sonst passiert scheinbar nichts
    const sauber = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== undefined && k !== 'id'));
    const doc = { ...sauber, name: f.name.trim(), stats: stat || null, origin: 'NPC', visibility: 'gm', updatedAt: now() };
    try {
      let id = f.id;
      if (id) await db.update(col('npcs'), id, doc);
      else id = await db.add(col('npcs'), { ...doc, createdAt: now() });
      if (auchNotiz) {
        const body = `---\ntyp: npc\ntags: [npc]\n---\n${npcMarkdown(f, stat)}\n`;
        if (f.noteId && noteById(f.noteId)) await updateNote(f.noteId, { body });
        else {
          const n = await createNote({ title: f.name.trim(), folder: npcFolder(), body });
          await db.update(col('npcs'), id, { noteId: n.id });
          openNote(n.id);
        }
      }
      toast(`„${f.name.trim()}“ gespeichert`, 'success');
      close({ ...doc, id });
    } catch (e) {
      toast(`Speichern fehlgeschlagen: ${e.message}`, 'error');
      setBusy(false);
    }
  };

  const SCHRITTE = ['Person', 'Charakter', 'Spielwerte'];
  return html`<div class="modal-body stack">
    <div class="sm-tabs">${SCHRITTE.map((s, i) => html`<button key=${s} type="button" class=${`sm-tab${schritt === i ? ' active' : ''}`} onClick=${() => setSchritt(i)}>${i + 1}. ${s}</button>`)}</div>

    ${schritt === 0 ? html`<div class="stack">
      <div class="grid two" style="gap:10px">
        <${Field} label="Name"><input class="input" value=${f.name} onInput=${(e) => set({ name: e.target.value })} autoFocus placeholder="z. B. Mira Falkenhand" /><//>
        <${Field} label="Volk"><input class="input" list="ws-species-npc" value=${f.species} onInput=${(e) => set({ species: e.target.value })} placeholder="z. B. Halbelfe" />
          <datalist id="ws-species-npc">${SPECIES.map((s) => html`<option key=${s} value=${s} />`)}</datalist><//>
        <${Field} label="Beruf / Rolle"><input class="input" value=${f.role} onInput=${(e) => set({ role: e.target.value })} placeholder="z. B. Hafenmeisterin" /><//>
        <${Field} label="Alter & Geschlecht"><div class="input-group">
          <input class="input" value=${f.age} onInput=${(e) => set({ age: e.target.value })} placeholder="Alter" />
          <input class="input" value=${f.gender} onInput=${(e) => set({ gender: e.target.value })} placeholder="Geschlecht" /></div><//>
        <${Field} label="Gesinnung"><${Select} value=${f.alignment} onChange=${(v) => set({ alignment: v })} options=${[{ value: '', label: '– offen –' }, ...ALIGNMENTS]} /><//>
        <${Field} label="Beziehung zur Gruppe"><${Select} value=${f.relation} onChange=${(v) => set({ relation: v })} options=${RELATIONS} /><//>
      </div>
    </div>` : null}

    ${schritt === 1 ? html`<div class="stack">
      <${Field} label="Aussehen"><input class="input" value=${f.look} onInput=${(e) => set({ look: e.target.value })} placeholder="Was fällt sofort auf?" /><//>
      <${Field} label="Marotte"><input class="input" value=${f.quirk} onInput=${(e) => set({ quirk: e.target.value })} placeholder="Eine Angewohnheit am Spieltisch" /><//>
      <${Field} label="Motivation"><input class="input" value=${f.motive} onInput=${(e) => set({ motive: e.target.value })} placeholder="Was will die Figur?" /><//>
      <${Field} label="Geheimnis (nur für die Spielleitung)"><input class="input" value=${f.secret} onInput=${(e) => set({ secret: e.target.value })} placeholder="Was verschweigt sie?" /><//>
    </div>` : null}

    ${schritt === 2 ? html`<div class="stack">
      <${Segmented} full value=${f.statMode} onChange=${(v) => set({ statMode: v })} options=${NPC_MODES} />
      ${f.statMode === 'none' ? html`<div class="card tight small muted">Ohne eigene Werte nutzt der Kampf den <b>Gemeinen</b> aus dem SRD: alle Attribute 10, Rüstungsklasse 10, 4 Trefferpunkte, Knüppel für 1W4. Reicht für Passanten, Wirte und alle, die nicht kämpfen sollen.</div>` : null}
      ${f.statMode === 'short' ? html`<${Field} label="Stufe" hint="Kurzwerte: Rüstungsklasse, Trefferpunkte und ein Angriff, passend zur Stufe.">
        <input class="input" type="number" min="1" max="20" value=${f.level} onInput=${(e) => set({ level: Number(e.target.value) || 1 })} /><//>` : null}
      ${f.statMode === 'full' ? html`<div class="grid two" style="gap:10px">
        <${Field} label="Klasse"><${Select} value=${f.cls} onChange=${(v) => set({ cls: v })} options=${klassen.map((c) => ({ value: c.key, label: c.name }))} /><//>
        <${Field} label="Stufe"><input class="input" type="number" min="1" max="20" value=${f.level} onInput=${(e) => set({ level: Number(e.target.value) || 1 })} /><//>
      </div>` : null}
      <div class="npc-preview"><${Statblock} monster=${vorschau} /></div>
    </div>` : null}

    <div class="modal-foot" style="padding:0;border:0;background:none">
      ${schritt > 0 ? html`<${Btn} kind="ghost" icon="chevron-left" onClick=${() => setSchritt(schritt - 1)}>Zurück<//>` : html`<${Btn} kind="ghost" onClick=${() => close(null)}>Abbrechen<//>`}
      <span class="grow"></span>
      ${schritt < 2 ? html`<${Btn} kind="primary" icon="chevron-right" onClick=${() => setSchritt(schritt + 1)}>Weiter<//>`
        : html`<${Btn} kind="ghost" icon="file-text" loading=${busy} onClick=${() => speichern(true)}>Speichern + Notiz<//><${Btn} kind="primary" icon="check" loading=${busy} onClick=${() => speichern(false)}>Speichern<//>`}
    </div>
  </div>`;
}

// npc: vorhandener Eintrag zum Bearbeiten, sonst Vorbelegung (z. B. aus einer Notiz)
export const openNpcEditor = (npc) => openModal(({ close }) => html`<${NpcForm} close=${close} start=${npc} />`,
  { title: npc?.id ? `NPC bearbeiten: ${npc.name}` : 'NPC anlegen', icon: 'mask', size: 'lg' });

// Einen gespeicherten NPC in den Kampf schicken – ohne Werte greift der Standard-NPC
export async function npcToCombat(npc) {
  const stat = npcStat(npc);
  await addToCombat(combatantsFromMonsters([{ ...stat, id: npc.id, src: 'npc' }]));
  toast(`${npc.name} ist im Kampf`, 'success', { action: { label: 'Zur Kampfkarte', onClick: () => import('./maps.js').then((m) => m.openBattle()) } });
}

// Kleine Karte für Listen
export const NpcRow = ({ npc, on, onClick }) => html`<button type="button" class=${`best-card${on ? ' on' : ''}`} onClick=${onClick}>
  ${npc.image ? html`<img class="npc-thumb" src=${npc.image} alt="" loading="lazy" />` : html`<span class="npc-thumb ph"><${Icon} name="mask" size=${22} /></span>`}
  <span class="bc-main"><b>${npc.name}</b><small>${[npc.species, npc.role].filter(Boolean).join(' · ') || 'NPC'}</small>
    <small>${npc.statMode === 'none' ? 'Standard-Werte' : `RK ${npc.stats?.ac} · TP ${npc.stats?.hp}`}</small></span>
</button>`;

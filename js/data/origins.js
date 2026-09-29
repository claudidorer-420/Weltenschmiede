// Genres für Monster – freie Kategorien im Encounter-Generator und im Bestiarium. Die Vorschläge sind bewusst
// markenfrei; Namenslisten zu Genres bringt jede Spielleitung selbst mit (users/{uid}/namelists, Import und Export
// über core/monsterlib.js). Das Genre-Feld bleibt frei beschreibbar.
export const DND = 'Klassische Fantasy (5E)'; // Grundbestand: die SRD-Monster gehören hierher (Name historisch)
// Ältere Einträge hießen anders – beim Lesen umdeuten, gespeichert bleibt, was die SL eingetragen hat
const LEGACY = { 'Standard D&D (5e)': DND };
export const normOrigin = (o) => LEGACY[o] || o || '';
export const ORIGINS = [DND, 'Dunkle Fantasy', 'Hohe Fantasy', 'Nordische Sagen', 'Slawische Sagen', 'Östliche Mythen', 'Wüstenreiche', 'Grimdark-Krieg', 'Höllenmächte', 'Feenreich', 'Tiefsee & Küste', 'Eigene Kreation', 'Sonstiges'];
export const ORIGIN_COLORS = {
  [DND]: '#e0584a', 'Dunkle Fantasy': '#8a6bb8', 'Hohe Fantasy': '#5b8def', 'Nordische Sagen': '#8aa4c8', 'Slawische Sagen': '#c9a227', 'Östliche Mythen': '#d0583a',
  'Wüstenreiche': '#d9a441', 'Grimdark-Krieg': '#b0413e', 'Höllenmächte': '#c0392b', Feenreich: '#7fae5a', 'Tiefsee & Küste': '#2ec7c9', 'Eigene Kreation': '#b07cff', Sonstiges: '#8a8f98',
};
export const originShort = (o) => (normOrigin(o) === DND ? 'Klassisch (5E)' : normOrigin(o) || 'Ohne Welt');

// Welt eines gespeicherten Monsters (ältere Einträge ohne Angabe: SRD-Kopien zählen zum Grundbestand)
export const originOf = (m) => normOrigin(m?.origin || (m?.srdId ? DND : ''));

// Namenslisten der Spielleitung: [{ genre, name, groups: [[Gruppe, [Namen]]] }] – setzt core/monsterlib.js
let USER_LISTS = [];
export function setUserNameLists(lists) { USER_LISTS = Array.isArray(lists) ? lists : []; }
const listsFor = (o) => USER_LISTS.filter((l) => normOrigin(l.genre) === normOrigin(o));
export const hasNameList = (o) => !!o && (normOrigin(o) === DND || listsFor(o).length > 0);

let srdMod = null;
const loadSrd = () => (srdMod ||= import('./monsters-srd.js'));

// Vorschläge für ein Genre: [{ name, meta, srd? }]
export async function namesFor(origin) {
  const o = normOrigin(origin);
  const out = [];
  if (o === DND) {
    const { MONSTERS } = await loadSrd();
    out.push(...MONSTERS.map((m) => ({ name: m.name, meta: `HG ${m.cr} · ${m.type}`, srd: m.id })));
  }
  const seen = new Set(out.map((x) => x.name.toLowerCase()));
  for (const l of listsFor(o)) {
    for (const [group, names] of l.groups || []) {
      for (const name of names || []) {
        const k = String(name).toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ name: String(name), meta: group || l.name || '' });
      }
    }
  }
  return out;
}

// Treffer sortieren: Wortanfang vor Teiltreffer, dann alphabetisch
export function matchNames(list, q, limit = 60) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return list.slice(0, limit);
  const out = [];
  for (const it of list) {
    const n = it.name.toLowerCase();
    const alt = (it.alt || '').toLowerCase();
    const score = n.startsWith(s) ? 3 : n.split(/[\s-]/).some((w) => w.startsWith(s)) ? 2 : n.includes(s) ? 1 : alt.includes(s) ? 0.5 : 0;
    if (score) out.push([score, it]);
  }
  return out.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name, 'de')).slice(0, limit).map((x) => x[1]);
}

// Farbe für ein Genre: feste Farben für die Vorschläge, für eigene Genres aus dem Namen abgeleitet
export function originColor(o) {
  const n = normOrigin(o);
  if (!n) return '#8a8f98';
  if (ORIGIN_COLORS[n]) return ORIGIN_COLORS[n];
  let h = 0;
  for (let i = 0; i < n.length; i += 1) h = (h * 31 + n.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 58%)`;
}

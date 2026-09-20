// Spielzeit der Kampagne: Stand + Automatik („alle 15 echte Minuten vergeht 1 Spielstunde“).
// Liegt in campaigns/{cid}.clock und läuft dadurch bei allen gleich – ohne Ticken in der Datenbank.
export const CLOCK_DEF = { min: 8 * 60, since: 0, run: false, every: 15, add: 60 };

export function clockOf(campaign) {
  const c = { ...CLOCK_DEF, ...(campaign?.clock || {}) };
  c.every = Math.max(1, Number(c.every) || 15);
  c.add = Math.max(1, Number(c.add) || 60);
  c.min = Math.max(0, Math.round(Number(c.min) || 0));
  c.since = Number(c.since) || 0;
  c.run = !!c.run;
  return c;
}

// Spielminuten, die seit dem letzten Stellen durch die Automatik dazugekommen sind
export function elapsed(c, jetzt = Date.now()) {
  if (!c.run || !c.since) return 0;
  const schritte = Math.floor((jetzt - c.since) / (c.every * 60000));
  return schritte > 0 ? schritte * c.add : 0;
}

export const nowMin = (campaign, jetzt = Date.now()) => {
  const c = clockOf(campaign);
  return c.min + elapsed(c, jetzt);
};

export const dayOf = (min) => Math.floor(min / 1440) + 1;
export const hhmm = (min) => {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
export const clockText = (min) => `Tag ${dayOf(min)} · ${hhmm(min)}`;

// Tageszeit – bestimmt Symbol und Farbe der Anzeige
export function phaseOf(min) {
  const h = Math.floor((((Math.round(min) % 1440) + 1440) % 1440) / 60);
  if (h < 5) return { key: 'nacht', label: 'Nacht', icon: 'moon' };
  if (h < 8) return { key: 'morgen', label: 'Morgengrauen', icon: 'sun' };
  if (h < 18) return { key: 'tag', label: 'Tag', icon: 'sun' };
  if (h < 21) return { key: 'abend', label: 'Abenddämmerung', icon: 'sun' };
  return { key: 'nacht', label: 'Nacht', icon: 'moon' };
}

// Wie lange dauert es noch bis zum nächsten Sprung? (Millisekunden, 0 = Automatik aus)
export function nextStepMs(c, jetzt = Date.now()) {
  if (!c.run || !c.since) return 0;
  const p = c.every * 60000;
  const rest = p - ((jetzt - c.since) % p);
  return rest <= 0 ? p : rest;
}

// Stand festschreiben (z. B. vor dem Stoppen oder beim Ändern der Automatik)
export const freeze = (c, jetzt = Date.now()) => ({ ...c, min: c.min + elapsed(c, jetzt), since: jetzt });

// Zeit verschieben; lässt die laufende Automatik weiterlaufen
export const shift = (c, minuten, jetzt = Date.now()) => {
  const f = freeze(c, jetzt);
  return { ...f, min: Math.max(0, f.min + Math.round(minuten)) };
};

// Feste Uhrzeit setzen (Tag ab 1)
export const setTo = (c, tag, stunde, minute, jetzt = Date.now()) => {
  const f = freeze(c, jetzt);
  return { ...f, min: Math.max(0, (Math.max(1, Math.round(tag)) - 1) * 1440 + Math.round(stunde) * 60 + Math.round(minute)) };
};

// Rasten und andere übliche Sprünge
export const JUMPS = [
  { label: '+10 Min', min: 10 },
  { label: '+1 Std', min: 60 },
  { label: 'Kurze Rast (1 Std)', min: 60 },
  { label: 'Lange Rast (8 Std)', min: 480 },
  { label: '+1 Tag', min: 1440 },
];

// Fertige Automatiken zum Anklicken
export const PRESETS = [
  { label: '1 Spielstunde je 15 Min', every: 15, add: 60 },
  { label: '1 Spielstunde je 30 Min', every: 30, add: 60 },
  { label: '10 Spielminuten je 1 Min', every: 1, add: 10 },
  { label: '1 Spieltag je Stunde', every: 60, add: 1440 },
];

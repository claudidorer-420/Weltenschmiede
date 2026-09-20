// Zauberschriftrollen: zu jedem Zauber gibt es eine Rolle. Sie wird beim Wirken verbraucht.
// Preise und Rettungswurf-SG folgen dem SRD (Schriftrolle eines Zauberspruchs).
// DOM-frei – auch im MCP-Server nutzbar.

// Grad → { gp: Marktwert, dc: SG des Zauberrettungswurfs, atk: Bonus auf Zauberangriffe, check: SG der Probe für fremde Grade }
export const SCROLL_TIERS = {
  0: { gp: 25, dc: 13, atk: 5, check: 10, rar: 'Gewöhnlich' },
  1: { gp: 60, dc: 13, atk: 5, check: 11, rar: 'Gewöhnlich' },
  2: { gp: 250, dc: 13, atk: 5, check: 12, rar: 'Ungewöhnlich' },
  3: { gp: 500, dc: 15, atk: 7, check: 13, rar: 'Ungewöhnlich' },
  4: { gp: 2500, dc: 15, atk: 7, check: 14, rar: 'Selten' },
  5: { gp: 5000, dc: 17, atk: 9, check: 15, rar: 'Selten' },
  6: { gp: 15000, dc: 17, atk: 9, check: 16, rar: 'Sehr selten' },
  7: { gp: 25000, dc: 18, atk: 10, check: 17, rar: 'Sehr selten' },
  8: { gp: 50000, dc: 18, atk: 10, check: 18, rar: 'Sehr selten' },
  9: { gp: 250000, dc: 19, atk: 11, check: 19, rar: 'Legendär' },
};

export const tierOf = (level) => SCROLL_TIERS[Math.max(0, Math.min(9, Number(level) || 0))];
export const scrollName = (sp) => `Schriftrolle: ${sp?.name || 'Zauber'}`;
// Wird ein Gegenstand als Schriftrolle erkannt? Entweder am Feld `scroll` oder am Namen.
export const scrollRef = (it) => it?.scroll || (/^schriftrolle\s*[:(]\s*(.+?)\)?$/i.exec(String(it?.name || ''))?.[1] || '').trim() || null;
export const isScroll = (it) => !!scrollRef(it);

// Gegenstand zu einem Zauber
export function scrollItem(sp, qty = 1) {
  const t = tierOf(sp.level);
  return {
    name: scrollName(sp),
    scroll: sp.id,
    scrollLevel: sp.level,
    qty,
    kg: 0,
    gp: t.gp,
    rarity: t.rar,
    magic: true,
    desc: `Einmal verwendbar. Wirkt ${sp.name}${sp.level ? ` (Grad ${sp.level})` : ' (Zaubertrick)'} ohne Zauberplatz und ohne materielle Komponenten; die Rolle zerfällt danach zu Staub.`
      + ` Rettungswurf-SG ${t.dc}, ${t.atk >= 0 ? '+' : ''}${t.atk} auf Zauberangriffe, wenn der Zauber nicht auf der eigenen Liste steht.`
      + (sp.level ? ` Steht der Zauber nicht auf der eigenen Klassenliste, ist zuerst eine Intelligenzprobe (Arkane Kunde) gegen SG ${t.check} nötig – bei Misserfolg verpufft die Rolle.` : ''),
  };
}

// Katalogzeile für Händler und Beutelisten
export const scrollCatalogEntry = (sp) => {
  const t = tierOf(sp.level);
  return { key: `scroll:${sp.id}`, name: scrollName(sp), cat: 'magie', gp: t.gp, kg: 0, scroll: sp.id, level: sp.level, rarity: t.rar };
};

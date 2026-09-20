// Die Spielzeit-Uhr: kleine Anzeige in der Statusleiste (unten) bzw. in der Kopfzeile (mobil).
// Die SL stellt sie über einen Dialog, alle anderen sehen nur die Zeit.
import { html, useState, useEffect } from '../lib/preact.js';
import { app, updateCampaign } from '../core/app.js';
import { useStore } from '../core/store.js';
import { Icon, Btn, Field, Toggle, openModal, toast } from './components.js';
import { clockOf, nowMin, clockText, hhmm, dayOf, phaseOf, nextStepMs, freeze, shift, setTo, JUMPS, PRESETS } from '../core/clock.js';

// Jede halbe Minute neu zeichnen reicht – die Automatik springt nie feiner als eine Minute
function useTick(ms = 20000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

function ClockBody({ close, campaign }) {
  const c0 = clockOf(campaign);
  const start = c0.min + (c0.run && c0.since ? Math.floor((Date.now() - c0.since) / (c0.every * 60000)) * c0.add : 0);
  const [tag, setTag] = useState(dayOf(start));
  const [zeit, setZeit] = useState(hhmm(start));
  const [every, setEvery] = useState(c0.every);
  const [add, setAdd] = useState(c0.add);
  const [run, setRun] = useState(c0.run);

  const speichern = async () => {
    const [h, m] = String(zeit).split(':').map((x) => Number(x) || 0);
    let c = setTo({ ...c0, every: Math.max(1, Number(every) || 1), add: Math.max(1, Number(add) || 1) }, Number(tag) || 1, h, m);
    c = { ...c, run, since: Date.now() };
    await updateCampaign({ clock: c });
    close(true);
  };

  const springen = async (min) => {
    await updateCampaign({ clock: shift(clockOf(app.get().campaign), min) });
    const neu = nowMin(app.get().campaign);
    setTag(dayOf(neu));
    setZeit(hhmm(neu));
    toast(`Spielzeit: ${clockText(neu)}`, 'info');
  };

  return html`<div class="modal-body stack">
    <div class="clock-big"><${Icon} name=${phaseOf(start).icon} size=${20} /> ${clockText(start)}<small>${phaseOf(start).label}</small></div>
    <div class="grid two" style="gap:10px">
      <${Field} label="Tag"><input class="input" type="number" min="1" value=${tag} onInput=${(e) => setTag(e.target.value)} /><//>
      <${Field} label="Uhrzeit"><input class="input" type="time" value=${zeit} onInput=${(e) => setZeit(e.target.value)} /><//>
    </div>
    <${Field} label="Zeit vorspulen">
      <div class="clock-jumps">${JUMPS.map((j) => html`<${Btn} key=${j.label} size="sm" kind="ghost" onClick=${() => springen(j.min)}>${j.label}<//>`)}</div>
    <//>
    <div class="clock-auto">
      <${Toggle} checked=${run} onChange=${setRun} label="Automatik: die Zeit läuft von selbst weiter" />
      <div class="row small" style="gap:6px;flex-wrap:wrap;align-items:center">
        <span class="faint">Alle</span>
        <input class="input sm" style="width:70px" type="number" min="1" value=${every} onInput=${(e) => setEvery(e.target.value)} />
        <span class="faint">echte Minuten vergehen</span>
        <input class="input sm" style="width:80px" type="number" min="1" value=${add} onInput=${(e) => setAdd(e.target.value)} />
        <span class="faint">Spielminuten.</span>
      </div>
      <div class="clock-jumps">${PRESETS.map((p) => html`<button key=${p.label} type="button" class=${`chip suggest${Number(every) === p.every && Number(add) === p.add ? ' selected' : ''}`}
        onClick=${() => { setEvery(p.every); setAdd(p.add); }}>${p.label}</button>`)}</div>
      <div class="small faint">Die Automatik läuft auf allen Geräten gleich – sie wird nicht mitgezählt, sondern aus dem Startzeitpunkt gerechnet. Stoppen hält die Zeit sofort an.</div>
    </div>
    <div class="modal-foot" style="padding:0;border:0;background:none">
      <${Btn} kind="ghost" onClick=${() => close(false)}>Abbrechen<//>
      <${Btn} kind="primary" icon="check" onClick=${speichern}>Übernehmen<//>
    </div>
  </div>`;
}

export function openClockDialog() {
  return openModal(({ close }) => html`<${ClockBody} close=${close} campaign=${app.get().campaign} />`, { title: 'Spielzeit', size: 'sm' });
}

// Anzeige. compact = Kopfzeile auf dem Handy (nur Uhrzeit)
export function GameClock({ compact }) {
  const s = useStore(app, (x) => ({ cid: x.cid, clock: x.campaign?.clock, role: x.role, asPlayer: x.viewAsPlayer }));
  useTick(20000);
  if (!s.cid) return null;
  const c = clockOf({ clock: s.clock });
  const min = nowMin({ clock: s.clock });
  const ph = phaseOf(min);
  const gm = s.role === 'gm' && !s.asPlayer;
  const rest = nextStepMs(c);
  const titel = `${clockText(min)} – ${ph.label}${c.run ? ` · Automatik: alle ${c.every} Min +${c.add} Spielminuten (nächster Sprung in ${Math.ceil(rest / 60000)} Min)` : ''}${gm ? '\nKlicken zum Stellen' : ''}`;
  const inhalt = html`<${Icon} name=${ph.icon} size=${13} />
    <span class="gc-t">${compact ? hhmm(min) : clockText(min)}</span>
    ${c.run ? html`<span class="gc-run" aria-label="Automatik läuft"></span>` : null}`;
  const cls = `game-clock ph-${ph.key}${compact ? ' compact' : ''}`;
  return gm
    ? html`<button type="button" class=${cls} title=${titel} onClick=${openClockDialog}>${inhalt}</button>`
    : html`<span class=${cls} title=${titel}>${inhalt}</span>`;
}

// Schnellschalter für die SL: Automatik an/aus, ohne den Dialog
export async function toggleClock() {
  const c = clockOf(app.get().campaign);
  await updateCampaign({ clock: { ...freeze(c), run: !c.run } });
}

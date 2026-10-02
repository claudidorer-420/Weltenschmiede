// Wetter über Karten: Wolken (mit Schatten), Nebel, Regen, Gewitter, Schnee, Sandsturm – animiert in Windrichtung.
// Eine eigene Zeichenfläche über der Karte (klickt nicht mit). Wolken und Nebel hängen an der Karte (wandern beim
// Verschieben mit), Regen, Schnee und Staub fallen vor der „Kamera“. Positionen rechnen sich aus der Uhrzeit und
// einem Startwert je Karte – dadurch sehen alle Mitspieler dasselbe Wetter, ohne dass etwas gespeichert wird.
// map.weather = { kind, dir (Grad, wohin der Wind weht: 0 = nach rechts, 90 = nach unten), speed 1–3, amount 1–3 }
import { html, useEffect, useRef, useState } from '../lib/preact.js';
import { Btn, Field, Segmented, Select } from './components.js';

export const WEATHER_KINDS = [
  { value: '', label: 'Klar', icon: 'sun' },
  { value: 'wolken', label: 'Wolken', icon: 'cloud' },
  { value: 'nebel', label: 'Nebel', icon: 'eye-off' },
  { value: 'regen', label: 'Regen', icon: 'cloud' },
  { value: 'gewitter', label: 'Gewitter', icon: 'zap' },
  { value: 'schnee', label: 'Schnee', icon: 'feather' },
  { value: 'sandsturm', label: 'Sandsturm', icon: 'compass' },
];
export const WIND_DIRS = [
  { value: 0, label: '→ Osten' }, { value: 45, label: '↘ Südosten' }, { value: 90, label: '↓ Süden' }, { value: 135, label: '↙ Südwesten' },
  { value: 180, label: '← Westen' }, { value: 225, label: '↖ Nordwesten' }, { value: 270, label: '↑ Norden' }, { value: 315, label: '↗ Nordosten' },
];
// Passende Sichtweite für Kampfkarten (Meter, siehe SIGHT_LIMITS in core/sight.js)
export const WEATHER_SIGHT = { '': 0, wolken: 0, nebel: 90, regen: 1600, gewitter: 30, schnee: 30, sandsturm: 30 };

// ───────── kleine Hilfen ─────────
function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  s = s || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const sprites = new Map();
// Wolke: viele weiche Kreise übereinander, unten leicht grau – als Bild vorbereitet (oder ihr Schatten)
// Aufbau von unten nach oben: breite, blasse Grundlage → dichte Mitte → kleine helle Kuppen oben links (Licht),
// dunklere Unterseite unten rechts. Alles bleibt mit Abstand im Bild, ein leichter Weichzeichner nimmt die Kanten.
const TONES = {
  weiss: { hi: [255, 255, 255], mid: [244, 247, 252], lo: [196, 206, 222] },
  grau: { hi: [226, 229, 235], mid: [196, 200, 210], lo: [140, 146, 160] },
  dunkel: { hi: [140, 145, 158], mid: [104, 109, 124], lo: [60, 64, 78] },
  sand: { hi: [232, 198, 148], mid: [206, 166, 112], lo: [164, 124, 80] },
};
function puff(c, x, y, rad, rgb, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.45, `rgba(${rgb},${a * 0.75})`);
  g.addColorStop(0.8, `rgba(${rgb},${a * 0.22})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, rad, 0, Math.PI * 2);
  c.fill();
}
function cloudSprite(i, tone, shadow) {
  const key = `${i}|${tone}|${shadow ? 1 : 0}`;
  if (sprites.has(key)) return sprites.get(key);
  const W = 512;
  const H = 352;
  const raw = document.createElement('canvas');
  raw.width = W;
  raw.height = H;
  const c = raw.getContext('2d');
  const r = rng(`wolke${i}`);
  const T = TONES[tone] || TONES.weiss;
  // Grundform: eine gestreckte Ellipse aus Kuppen, Zufall je Wolke
  const cx = W / 2;
  const cy = H / 2;
  const ax = W * (0.27 + r() * 0.12);
  const ay = H * (0.13 + r() * 0.1);
  const spots = Array.from({ length: 34 + Math.floor(r() * 16) }, () => {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.7);
    return { x: cx + Math.cos(a) * d * ax, y: cy + Math.sin(a) * d * ay, s: 0.5 + r() * 0.5 };
  });
  const lim = (x, y, rad) => Math.min(rad, x - 6, W - 6 - x, y - 6, H - 6 - y);
  if (shadow) {
    for (const p of spots) { const rad = lim(p.x, p.y, W * 0.11 * (0.7 + p.s)); if (rad > 4) puff(c, p.x, p.y, rad, '0,0,0', 0.42); }
  } else {
    for (const p of spots) { const rad = lim(p.x, p.y, W * 0.13 * (0.7 + p.s)); if (rad > 4) puff(c, p.x, p.y, rad, T.lo, 0.5); }
    for (const p of spots) { const rad = lim(p.x - W * 0.012, p.y - H * 0.03, W * 0.1 * (0.6 + p.s)); if (rad > 4) puff(c, p.x - W * 0.012, p.y - H * 0.03, rad, T.mid, 0.62); }
    for (const p of spots.slice(0, Math.ceil(spots.length * 0.6))) { const rad = lim(p.x - W * 0.025, p.y - H * 0.06, W * 0.065 * (0.6 + p.s)); if (rad > 4) puff(c, p.x - W * 0.025, p.y - H * 0.06, rad, T.hi, 0.55); }
  }
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const o = cv.getContext('2d');
  o.filter = shadow ? 'blur(10px)' : 'blur(3px)';
  o.drawImage(raw, 0, 0);
  o.filter = 'none';
  sprites.set(key, cv);
  return cv;
}

// Was genau zu sehen ist, je Wetterart
function profile(w) {
  const a = Math.max(1, Math.min(3, Number(w.amount) || 2));
  switch (w.kind) {
    case 'wolken': return { clouds: [4, 7, 11][a - 1], tone: 'weiss', cloudAlpha: 0.85, shadow: 0.32, haze: 0 };
    case 'nebel': return { fog: [6, 10, 15][a - 1], haze: [0.12, 0.22, 0.34][a - 1], hazeColor: '205,210,216' };
    case 'regen': return { clouds: [5, 8, 12][a - 1], tone: 'grau', cloudAlpha: 0.75, shadow: 0.28, rain: [140, 260, 420][a - 1], haze: [0.08, 0.13, 0.18][a - 1], hazeColor: '40,52,70' };
    case 'gewitter': return { clouds: [9, 12, 16][a - 1], tone: 'dunkel', cloudAlpha: 0.8, shadow: 0.35, rain: [320, 480, 650][a - 1], haze: [0.18, 0.24, 0.3][a - 1], hazeColor: '20,24,40', lightning: [0.05, 0.09, 0.14][a - 1] };
    case 'schnee': return { clouds: [3, 5, 8][a - 1], tone: 'grau', cloudAlpha: 0.6, shadow: 0.2, snow: [120, 240, 420][a - 1], haze: [0.08, 0.14, 0.22][a - 1], hazeColor: '230,236,245' };
    case 'sandsturm': return { dust: [160, 300, 480][a - 1], haze: [0.16, 0.26, 0.38][a - 1], hazeColor: '196,150,92', fog: [3, 5, 8][a - 1], fogTone: 'sand' };
    default: return {};
  }
}

// view() → { x, y, k } (Bildschirm = x + Kartenkoordinate · k), size = { w, h } in Kartenkoordinaten
export function WeatherLayer({ weather, view, size, seed = 'karte', active = true }) {
  const ref = useRef();
  const live = useRef({});
  live.current = { weather, view, size };
  useEffect(() => {
    if (!active || !weather?.kind) return undefined;
    const cv = ref.current;
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    let raf = 0;
    let flash = 0;
    let nextBolt = 0;
    const r = rng(seed);
    // feste Startwerte je Karte (Wolken/Nebel in Kartenanteilen, Teilchen in Bildschirmanteilen)
    const blobs = Array.from({ length: 24 }, (_, i) => ({ i, fx: r(), fy: r(), sc: 0.6 + r() * 1.1, sp: 0.85 + r() * 0.3, sprite: Math.floor(r() * 6) }));
    const parts = Array.from({ length: 700 }, () => ({ fx: r(), fy: r(), z: 0.5 + r() * 0.8, ph: r() * 6.28 }));
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const { weather: w, view: vf, size: sz } = live.current;
      if (!w?.kind) return;
      const rect = cv.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      const pw = Math.round(rect.width * dpr);
      const ph = Math.round(rect.height * dpr);
      if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      const v = vf();
      const P = profile(w);
      const t = Date.now() / 1000;
      const ang = ((Number(w.dir) || 0) * Math.PI) / 180;
      const ux = Math.cos(ang);
      const uy = Math.sin(ang);
      const spd = [0.006, 0.012, 0.026][Math.max(1, Math.min(3, Number(w.speed) || 2)) - 1];
      const M = Math.max(sz.w, sz.h);
      // Wolken bzw. Nebelbänke wandern über die Karte und kommen auf der anderen Seite wieder herein
      const field = (n, scale, drawOne) => {
        const ext = { w: sz.w + M * 0.6, h: sz.h + M * 0.6 };
        for (let j = 0; j < Math.min(n, blobs.length); j++) {
          const b = blobs[j];
          const mx = (((b.fx * ext.w + ux * spd * M * b.sp * t) % ext.w) + ext.w) % ext.w - M * 0.3;
          const my = (((b.fy * ext.h + uy * spd * M * b.sp * t) % ext.h) + ext.h) % ext.h - M * 0.3;
          const s = M * scale * b.sc * v.k;
          drawOne(b, v.x + mx * v.k, v.y + my * v.k, s);
        }
      };
      if (P.haze) { ctx.fillStyle = `rgba(${P.hazeColor},${P.haze})`; ctx.fillRect(0, 0, rect.width, rect.height); }
      if (P.clouds) {
        // erst alle Schatten (versetzt, als fiele das Licht von oben links), dann die Wolken
        field(P.clouds, 0.22, (b, x, y, s) => {
          ctx.globalAlpha = P.shadow;
          ctx.drawImage(cloudSprite(b.sprite, P.tone, true), x - s / 2 + s * 0.18, y - s * 0.34 + s * 0.24, s, s * 0.69);
        });
        field(P.clouds, 0.22, (b, x, y, s) => {
          ctx.globalAlpha = P.cloudAlpha;
          ctx.drawImage(cloudSprite(b.sprite, P.tone, false), x - s / 2, y - s * 0.34, s, s * 0.69);
        });
      }
      if (P.fog) {
        field(P.fog, 0.32, (b, x, y, s) => {
          ctx.globalAlpha = P.fogTone === 'sand' ? 0.35 : 0.42;
          ctx.drawImage(cloudSprite(b.sprite, P.fogTone === 'sand' ? 'sand' : 'grau', false), x - s / 2, y - s * 0.34, s, s * 0.69);
        });
      }
      ctx.globalAlpha = 1;
      const W = rect.width;
      const H = rect.height;
      // Regen: schräge Striche in Windrichtung, dazu fallend
      if (P.rain) {
        const dx = ux * 0.35;
        const dy = 1;
        const n = Math.hypot(dx, dy);
        ctx.strokeStyle = w.kind === 'gewitter' ? 'rgba(200,214,235,.42)' : 'rgba(190,206,228,.36)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let j = 0; j < P.rain; j++) {
          const p = parts[j];
          const sp = 900 * p.z;
          const x = (((p.fx * W + (dx / n) * sp * t) % W) + W) % W;
          const y = (((p.fy * H + (dy / n) * sp * t) % H) + H) % H;
          const L = 10 + 12 * p.z;
          ctx.moveTo(x, y);
          ctx.lineTo(x - (dx / n) * L, y - (dy / n) * L);
        }
        ctx.stroke();
      }
      // Schnee: Flocken treiben mit dem Wind und schaukeln
      if (P.snow) {
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        for (let j = 0; j < P.snow; j++) {
          const p = parts[j];
          const sp = 40 * p.z;
          const wob = Math.sin(t * 1.3 + p.ph) * 14;
          const x = (((p.fx * W + ux * sp * 1.6 * t + wob) % W) + W) % W;
          const y = (((p.fy * H + (uy * 1.6 + 1) * sp * t) % H) + H) % H;
          ctx.beginPath();
          ctx.arc(x, y, 0.8 + p.z * 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Sandsturm: schnelle Staubschlieren in Windrichtung
      if (P.dust) {
        ctx.strokeStyle = 'rgba(214,170,110,.32)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let j = 0; j < P.dust; j++) {
          const p = parts[j];
          const sp = 520 * p.z;
          const x = (((p.fx * W + ux * sp * t) % W) + W) % W;
          const y = (((p.fy * H + uy * sp * t + Math.sin(t + p.ph) * 6) % H) + H) % H;
          const L = 14 + 26 * p.z;
          ctx.moveTo(x, y);
          ctx.lineTo(x - ux * L, y - uy * L);
        }
        ctx.stroke();
      }
      // Blitze: kurzes, flackerndes Aufleuchten
      if (P.lightning) {
        const now = performance.now();
        if (now > nextBolt) { flash = 1; nextBolt = now + 2500 + Math.random() * (9000 / (P.lightning * 10)); }
        if (flash > 0.01) {
          ctx.fillStyle = `rgba(235,240,255,${(flash * (0.55 + Math.random() * 0.35)).toFixed(3)})`;
          ctx.fillRect(0, 0, W, H);
          flash *= 0.86;
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, cv.width, cv.height); };
  }, [active, weather?.kind, seed]);
  if (!weather?.kind) return null;
  return html`<canvas ref=${ref} class="map-weather" aria-hidden="true"></canvas>`;
}

// Einstellungen (SL): Art, Windrichtung, Tempo, Stärke – optional die Sichtweite der Karte mitsetzen
export function WeatherForm({ close, weather, withSight = false }) {
  const [f, setF] = useState({ kind: '', dir: 0, speed: 2, amount: 2, ...(weather || {}) });
  const [sight, setSight] = useState(withSight);
  return html`<div class="modal-body stack">
    <div class="wx-kinds">${WEATHER_KINDS.map((k) => html`<button type="button" key=${k.value} class=${f.kind === k.value ? 'on' : ''} onClick=${() => setF({ ...f, kind: k.value })}>${k.label}</button>`)}</div>
    ${f.kind ? html`
      <${Field} label="Wind weht nach"><${Select} value=${String(f.dir)} options=${WIND_DIRS.map((d) => ({ value: String(d.value), label: d.label }))} onChange=${(v) => setF({ ...f, dir: Number(v) })} /><//>
      <${Field} label="Tempo"><${Segmented} value=${f.speed} onChange=${(v) => setF({ ...f, speed: v })} options=${[{ value: 1, label: 'gemächlich' }, { value: 2, label: 'mittel' }, { value: 3, label: 'stürmisch' }]} /><//>
      <${Field} label="Stärke"><${Segmented} value=${f.amount} onChange=${(v) => setF({ ...f, amount: v })} options=${[{ value: 1, label: 'leicht' }, { value: 2, label: 'mittel' }, { value: 3, label: 'stark' }]} /><//>` : null}
    ${withSight ? html`<label class="check small"><input type="checkbox" checked=${sight} onChange=${(e) => setSight(e.target.checked)} /> Sichtweite der Figuren passend einstellen (z. B. Nebel 90 m, Sturm 30 m)</label>` : null}
    <div class="tiny faint">Alle sehen dasselbe Wetter – Wolken ziehen mit ihren Schatten über die Karte, Regen und Schnee fallen davor.</div>
    <div class="btn-row"><span class="grow"></span><${Btn} kind="ghost" onClick=${() => close(null)}>Abbrechen<//><${Btn} kind="primary" icon="check" onClick=${() => close({ weather: f.kind ? f : null, sight })}>Übernehmen<//></div>
  </div>`;
}

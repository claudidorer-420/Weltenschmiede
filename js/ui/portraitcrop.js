// Porträt für Charakterbögen: Das Bild wird im Hochformat (3:4) abgelegt – so, wie es auf dem Bogen
// und in der Initiativleiste erscheint. Zusätzlich wählt man den quadratischen Ausschnitt,
// der als Token auf der Kampfkarte liegt.
import { html, useState, useEffect, useRef } from '../lib/preact.js';
import { Btn, Field, Segmented, openModal, toast } from './components.js';

const HOCH_W = 480;
const HOCH_H = 640;
const QUAD = 256;

// Bild in ein 3:4-Feld einpassen (füllend, mittig) – das ist das gespeicherte Porträt
function toPortrait(img) {
  const cv = document.createElement('canvas');
  cv.width = HOCH_W;
  cv.height = HOCH_H;
  const ctx = cv.getContext('2d');
  const k = Math.max(HOCH_W / img.width, HOCH_H / img.height);
  const w = img.width * k;
  const h = img.height * k;
  ctx.drawImage(img, (HOCH_W - w) / 2, (HOCH_H - h) / 2, w, h);
  return cv;
}

function CropBody({ close, src, look0 = 'right' }) {
  const [img, setImg] = useState(null);
  // Wohin schaut die Figur im Bild? Danach spiegelt die Karte den Token, damit er in seine Blickrichtung schaut
  const [look, setLook] = useState(look0 === 'left' ? 'left' : 'right');
  const [box, setBox] = useState({ x: 0, y: 0, s: HOCH_W });   // im Koordinatenraum des Hochformats
  const wrapRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => {
      setImg(i);
      // Startvorschlag: oberes Drittel, volle Breite – da sitzt bei Porträts der Kopf
      setBox({ x: 0, y: Math.round(HOCH_H * 0.06), s: HOCH_W });
    };
    i.onerror = () => toast('Das Bild konnte nicht gelesen werden.', 'error');
    i.src = src;
  }, [src]);

  const hoch = img ? toPortrait(img) : null;
  const hochUrl = hoch ? hoch.toDataURL('image/webp', 0.86) : null;

  const clampBox = (b) => {
    const s = Math.max(80, Math.min(HOCH_W, Math.round(b.s)));
    return { s, x: Math.max(0, Math.min(HOCH_W - s, Math.round(b.x))), y: Math.max(0, Math.min(HOCH_H - s, Math.round(b.y))) };
  };
  const faktor = () => (wrapRef.current ? HOCH_W / wrapRef.current.clientWidth : 1);
  const onDown = (e) => {
    e.preventDefault();
    drag.current = { mx: e.clientX, my: e.clientY, x: box.x, y: box.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const f = faktor();
    setBox(clampBox({ ...box, x: drag.current.x + (e.clientX - drag.current.mx) * f, y: drag.current.y + (e.clientY - drag.current.my) * f }));
  };
  const onUp = () => { drag.current = null; };

  const fertig = () => {
    if (!hoch) return;
    const cv = document.createElement('canvas');
    cv.width = QUAD;
    cv.height = QUAD;
    cv.getContext('2d').drawImage(hoch, box.x, box.y, box.s, box.s, 0, 0, QUAD, QUAD);
    close({ portrait: hochUrl, portraitCrop: cv.toDataURL('image/webp', 0.86), portraitLook: look });
  };

  const pct = (v, ganz) => `${(v / ganz) * 100}%`;
  return html`<div class="modal-body stack">
    <div class="small muted">Das Bild liegt im Hochformat auf dem Bogen. Schiebe den Rahmen auf den Ausschnitt, der im Kampf als Spielfigur auf der Karte liegen soll.</div>
    ${!hochUrl ? html`<div class="empty"><span class="spinner lg" /></div>` : html`
      <div class="pc-wrap" ref=${wrapRef} style=${{ backgroundImage: `url(${hochUrl})` }}>
        <div class="pc-box" style=${{ left: pct(box.x, HOCH_W), top: pct(box.y, HOCH_H), width: pct(box.s, HOCH_W), height: pct(box.s, HOCH_H) }}
          onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp}></div>
      </div>
      <${Field} label="Größe des Ausschnitts">
        <input type="range" style="width:100%;accent-color:var(--accent)" min="80" max=${HOCH_W} step="4" value=${box.s} onInput=${(e) => setBox(clampBox({ ...box, s: Number(e.target.value) }))} />
      <//>
      <${Field} label="Im Bild schaut die Figur eher nach …" hint="Auf der Karte dreht sich der Token in seine Blickrichtung – so weiß die App, wie herum das Bild gemeint ist.">
        <${Segmented} value=${look} onChange=${setLook} options=${[{ value: 'left', label: '← Links' }, { value: 'right', label: 'Rechts →' }]} />
      <//>`}
    <div class="modal-foot" style="padding:0;border:0;background:none">
      <${Btn} kind="ghost" onClick=${() => close(null)}>Abbrechen<//>
      <${Btn} kind="primary" icon="check" disabled=${!hochUrl} onClick=${fertig}>Übernehmen<//>
    </div>
  </div>`;
}

// file: File/Blob aus pickFiles. Liefert { portrait, portraitCrop, portraitLook } oder null
export async function openPortraitDialog(file, { look = 'right' } = {}) {
  const src = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  return openModal(({ close }) => html`<${CropBody} close=${close} src=${src} look0=${look} />`, { title: 'Porträt zuschneiden', icon: 'image', size: 'sm' });
}

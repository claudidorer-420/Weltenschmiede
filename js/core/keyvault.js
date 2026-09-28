// Schlüsseltresor: KI-Schlüssel liegen nie im Klartext in der Cloud.
// - Auf dem Gerät stehen sie im Einstellungsspeicher (wie bisher) und gehen direkt an den Anbieter.
// - Zum Abgleich zwischen Geräten liegt unter users/{uid}/private/vault nur Geheimtext (AES-GCM).
//   Der Schlüssel dazu entsteht aus dem Geheimwort (PBKDF2) und bleibt als nicht exportierbarer
//   CryptoKey in einer eigenen IndexedDB auf dem Gerät. Ohne Geheimwort (Spielleitung, Mitspieler,
//   KI-Werkzeuge über MCP, Betreiber der Datenbank) ist der Tresor nicht lesbar.
import { createStore } from './store.js';
import { settings, updateSettings } from './settings.js';
import { db } from './db.js';
import { debounce } from '../lib/util.js';

const ITER = 600000;
const IDB = 'ws-vault';
const COL = (uid) => `users/${uid}/private`;
const DOC = 'vault';

// status: offline | off (nur Gerät, gewollt) | locked (Geheimwort nötig) | synced | error
export const vault = createStore({ status: 'offline', error: '' });

const fresh = (uid = null) => ({ uid, key: null, salt: null, unsub: null, applying: false, lastJson: '', first: true, pushed: 0, remote: 0 });
let cur = fresh();
const stampKey = (uid) => `ws.vaultStamp.${uid}`;
const enc = new TextEncoder();
const dec = new TextDecoder();

// ── Gerätespeicher für den CryptoKey ──
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('keys');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbDo(mode, fn) {
  const d = await idb();
  try {
    return await new Promise((res, rej) => {
      const tx = d.transaction('keys', mode);
      const r = fn(tx.objectStore('keys'));
      tx.oncomplete = () => res(r?.result);
      tx.onerror = () => rej(tx.error);
    });
  } finally {
    d.close();
  }
}
const deviceGet = (uid) => idbDo('readonly', (s) => s.get(uid)).catch(() => null);
const deviceSet = (uid, v) => idbDo('readwrite', (s) => s.put(v, uid));
const deviceDel = (uid) => idbDo('readwrite', (s) => s.delete(uid)).catch(() => {});

// ── Kryptografie ──
const b64 = (u8) => btoa(String.fromCharCode(...new Uint8Array(u8)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(secret, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}
async function open(key, doc) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(doc.iv) }, key, unb64(doc.ct));
  return JSON.parse(dec.decode(pt));
}

// ── Schlüssel im Einstellungsspeicher ──
export function keysOf(s = settings.get()) {
  return Object.fromEntries(Object.entries(s.ai?.providers || {}).map(([id, p]) => [id, p?.key || '']).filter(([, k]) => k));
}
function applyKeys(keys) {
  const providers = {};
  for (const id of Object.keys(settings.get().ai.providers)) providers[id] = { key: keys[id] || '' };
  cur.applying = true;
  try { updateSettings({ ai: { providers } }); } finally { cur.applying = false; }
  cur.lastJson = JSON.stringify(keysOf());
}
const syncWanted = () => settings.get().ai?.syncKeys !== false;

// ── Abgleich ──
async function pushNow() {
  const { uid, key, salt } = cur;
  if (!uid || !key || !syncWanted()) return;
  // immer größer als alles bisher Gesehene – schief gehende Uhren anderer Geräte stören so nicht
  const stamp = Math.max(Date.now(), cur.remote + 1, (Number(localStorage.getItem(stampKey(uid))) || 0) + 1);
  cur.pushed = stamp;
  try {
    await db.set(COL(uid), DOC, { v: 1, iter: ITER, salt: b64(salt), ...(await seal(key, keysOf())), stamp });
    localStorage.setItem(stampKey(uid), String(stamp));
  } catch (e) {
    console.warn('[vault] push', e);
  }
}
const push = debounce(pushNow, 800);

async function onRemote(doc) {
  const { uid, key } = cur;
  if (!uid) return;
  if (!syncWanted()) return vault.set({ status: 'off', error: '' });
  if (!key) return vault.set({ status: 'locked', error: '' });
  if (!doc) {
    vault.set({ status: 'synced', error: '' });
    if (Object.keys(keysOf()).length) push();
    return;
  }
  cur.remote = Math.max(cur.remote, doc.stamp || 0);
  // eigener Schreibvorgang kommt zurück
  if (doc.stamp && doc.stamp === cur.pushed) {
    localStorage.setItem(stampKey(uid), String(doc.stamp));
    cur.first = false;
    return vault.set({ status: 'synced', error: '' });
  }
  const seen = Number(localStorage.getItem(stampKey(uid))) || 0;
  if (doc.stamp && doc.stamp === seen && !cur.first) return vault.set({ status: 'synced', error: '' });
  const lockOut = (error) => {
    // Geräteschlüssel passt nicht mehr (Geheimwort anderswo geändert) → nichts mehr hochladen, neu entsperren
    push.cancel();
    cur.key = null; cur.salt = null;
    forgetDevice(uid);
    vault.set({ status: 'locked', error });
  };
  if (doc.salt !== b64(cur.salt)) return lockOut('Dein Geheimwort wurde geändert – bitte hier einmal eingeben.');
  let remote;
  try {
    remote = await open(key, doc);
  } catch {
    return lockOut('Der Tresor ließ sich nicht öffnen – bitte Geheimwort eingeben.');
  }
  const stamp = doc.stamp || 0;
  if (cur.first && !seen) {
    // Erster Abgleich auf diesem Gerät: Tresor gewinnt, lokale Schlüssel füllen Lücken
    const merged = { ...keysOf(), ...remote };
    applyKeys(merged);
    if (JSON.stringify(merged) !== JSON.stringify(remote)) push();
    else localStorage.setItem(stampKey(uid), String(stamp));
  } else if (cur.first && stamp < seen) {
    push(); // Tresor ist älter als dieses Gerät (z. B. offline geändert) → Gerät gewinnt
  } else if (cur.first || stamp > seen) {
    applyKeys(remote); // neuerer Stand von einem anderen Gerät – auch Löschungen
    localStorage.setItem(stampKey(uid), String(doc.stamp || 0));
  }
  cur.first = false;
  vault.set({ status: 'synced', error: '' });
}

settings.subscribe((s) => {
  if (!cur.uid || cur.applying) return;
  const json = JSON.stringify(keysOf(s));
  if (json === cur.lastJson) return;
  cur.lastJson = json;
  if (cur.key && syncWanted()) push();
});

// Beim Anmelden (mit Geheimwort) bzw. beim Start einer gespeicherten Sitzung (ohne).
export async function startVault(uid, secret = null) {
  stopVault();
  cur = { ...fresh(uid), lastJson: JSON.stringify(keysOf()) };
  vault.set({ status: syncWanted() ? 'locked' : 'off', error: '' });
  if (secret && syncWanted()) {
    try { await unlockWith(uid, secret, { trusted: true }); } catch (e) { console.warn('[vault] unlock', e); }
  } else {
    const dev = await deviceGet(uid);
    if (cur.uid !== uid) return;
    if (dev?.key && dev?.salt) { cur.key = dev.key; cur.salt = dev.salt; }
  }
  if (cur.uid !== uid) return;
  cur.unsub = db.watchDoc(COL(uid), DOC, (d) => { onRemote(d).catch((e) => console.warn('[vault]', e)); }, () => vault.set({ status: 'error', error: 'Tresor nicht erreichbar.' }));
}

// Geheimwort → Geräteschlüssel. trusted = gerade erst mit Firebase geprüft (Anmeldung).
async function unlockWith(uid, secret, { trusted = false } = {}) {
  let doc = null;
  try { doc = await db.get(COL(uid), DOC); } catch { /* offline */ }
  if (doc?.salt && doc?.ct) {
    const salt = unb64(doc.salt);
    const key = await derive(secret, salt);
    try {
      await open(key, doc);
      cur.key = key; cur.salt = salt;
      await deviceSet(uid, { key, salt });
      localStorage.removeItem(stampKey(uid)); // erster Abgleich: zusammenführen
      cur.first = true;
      return;
    } catch {
      if (!trusted) throw new Error('Das Geheimwort passt nicht.');
      // Anmeldung war gültig, der Tresor stammt aber von einem alten Geheimwort → neu anlegen
    }
  } else if (!trusted) {
    await db.cloud.verifySecret(secret);
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  cur.key = await derive(secret, salt);
  cur.salt = salt;
  await deviceSet(uid, { key: cur.key, salt });
  localStorage.removeItem(stampKey(uid));
  cur.first = true;
  if (doc?.ct) push();
}

// Aus der Einstellungsseite: Tresor auf diesem Gerät entsperren
export async function unlockVault(secret) {
  const uid = cur.uid;
  if (!uid) throw new Error('Nicht angemeldet.');
  await unlockWith(uid, secret);
  const d = await db.get(COL(uid), DOC).catch(() => null);
  await onRemote(d);
}

// Nach „Geheimwort ändern“: neu verschlüsseln, andere Geräte müssen einmal entsperren
export async function rekeyVault(newSecret) {
  const uid = cur.uid;
  if (!uid || !syncWanted()) return;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  cur.key = await derive(newSecret, salt);
  cur.salt = salt;
  await deviceSet(uid, { key: cur.key, salt });
  push.cancel();
  await pushNow();
}

// Abgleich ein- oder ausschalten. Aus = Tresor in der Cloud löschen, Schlüssel bleiben auf dem Gerät.
export async function setVaultSync(on) {
  updateSettings({ ai: { syncKeys: !!on } });
  const uid = cur.uid;
  if (!uid) return;
  if (!on) {
    push.cancel();
    await db.remove(COL(uid), DOC).catch(() => {});
    await deviceDel(uid);
    localStorage.removeItem(stampKey(uid));
    cur.key = null; cur.salt = null;
    vault.set({ status: 'off', error: '' });
  } else {
    vault.set({ status: 'locked', error: '' });
  }
}

export function stopVault({ forget = false } = {}) {
  push.cancel();
  cur.unsub?.();
  const uid = cur.uid;
  cur = fresh();
  vault.set({ status: 'offline', error: '' });
  if (forget && uid) {
    deviceDel(uid);
    localStorage.removeItem(stampKey(uid));
  }
}

// Kontowechsel/Gerät bereinigen: Geräteschlüssel eines Kontos entfernen
export function forgetDevice(uid) {
  if (!uid) return;
  deviceDel(uid);
  localStorage.removeItem(stampKey(uid));
}
export function wipeVaultDevice() {
  return new Promise((res) => {
    const r = indexedDB.deleteDatabase(IDB);
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
}

// Alte Versionen legten die Schlüssel im Klartext in users/{uid}/private/settings ab
export function hasPlainKeys(remoteData) {
  return Object.values(remoteData?.ai?.providers || {}).some((p) => p && typeof p.key === 'string' && p.key);
}

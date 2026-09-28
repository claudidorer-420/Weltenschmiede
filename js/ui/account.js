// Konto: Avatar-Menü, Abmelden (optional mit Gerätebereinigung), Rolle wechseln, Geheimwort, Einstellungen als Dialog.
import { html, useState, useEffect } from '../lib/preact.js';
import { app, enterLobby, signOut, setAccountKind, isGmAccount, weakSecret, MIN_SECRET } from '../core/app.js';
import { rekeyVault } from '../core/keyvault.js';
import { db } from '../core/db.js';
import { openView } from '../core/workspace.js';
import { authErrorMessage } from '../core/db-cloud.js';
import { openMenu, openModal, confirmDialog, toast, Btn, Field } from './components.js';

export function openSettingsModal(section) {
  openModal(() => {
    const [Comp, setComp] = useState(null);
    useEffect(() => { import('../views/settings.js').then((m) => setComp(() => m.SettingsPanel)); }, []);
    return html`<div class="modal-body">${Comp ? html`<${Comp} section=${section} />` : html`<div class="empty"><span class="spinner" /></div>`}</div>`;
  }, { title: 'Einstellungen', icon: 'settings', size: 'xl' });
}

// In einer Kampagne als Tab, in der Übersicht als Dialog
export function openSettings(section) {
  if (app.get().cid) openView('settings', section ? { section } : {});
  else openSettingsModal(section);
}

// Altes Geheimwort bestätigen, neues zweimal eingeben; danach wird der Schlüsseltresor neu verschlüsselt.
function SecretForm({ close }) {
  const [f, setF] = useState({ old: '', a: '', b: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const weak = weakSecret(f.a, app.get().user?.name);
    if (weak) return setErr(weak);
    if (f.a !== f.b) return setErr('Die beiden neuen Geheimwörter stimmen nicht überein.');
    setBusy(true);
    try {
      await db.cloud.verifySecret(f.old);
      await db.cloud.changeSecret(f.a);
      await rekeyVault(f.a).catch((x) => console.warn('[vault] rekey', x));
      close(true);
    } catch (x) {
      setErr(authErrorMessage(x));
      setBusy(false);
    }
  };
  const inp = (k, auto) => html`<input class="input" type="password" value=${f[k]} onInput=${set(k)} autocomplete=${auto} />`;
  return html`<form onSubmit=${submit}><div class="modal-body stack">
    <${Field} label="Bisheriges Geheimwort">${inp('old', 'current-password')}<//>
    <${Field} label="Neues Geheimwort" hint=${`Mindestens ${MIN_SECRET} Zeichen, am besten ein kurzer Satz.`}>${inp('a', 'new-password')}<//>
    <${Field} label="Neues Geheimwort wiederholen">${inp('b', 'new-password')}<//>
    ${err ? html`<div class="callout callout-red small" style="margin:0">${err}</div>` : null}
    <div class="small muted">Andere Geräte werden dabei abgemeldet. Deine KI-Schlüssel werden mit dem neuen Geheimwort neu verschlüsselt.</div>
  </div><div class="modal-foot"><${Btn} onClick=${() => close(false)}>Abbrechen<//><${Btn} type="submit" kind="primary" loading=${busy}>Ändern<//></div></form>`;
}

export async function changeSecretDialog() {
  const ok = await openModal(({ close }) => html`<${SecretForm} close=${close} />`, { title: 'Geheimwort ändern', icon: 'key', size: 'sm' });
  if (ok) toast('Geheimwort geändert', 'success');
}

export async function switchKind(kind) {
  await setAccountKind(kind);
  enterLobby();
  toast(kind === 'gm' ? 'Du arbeitest jetzt als Spielleitung.' : 'Du spielst jetzt als Spieler.', 'success');
}

export async function signOutDialog(wipe = false) {
  if (app.get().mode !== 'cloud') {
    await signOut();
    return;
  }
  const ok = wipe
    ? await confirmDialog('Abmelden und alle Daten der Weltenschmiede von diesem Gerät entfernen – Offline-Kopie, Einstellungen, KI-Schlüssel und Würfelverlauf? Deine Kampagnen bleiben sicher in der Cloud; du kannst dich jederzeit wieder anmelden.', { title: 'Gerät bereinigen', ok: 'Abmelden & bereinigen', danger: true })
    : await confirmDialog('Von diesem Gerät abmelden? Deine Kampagnen bleiben in der Cloud, deine KI-Schlüssel werden von diesem Gerät entfernt.', { title: 'Abmelden', ok: 'Abmelden' });
  if (!ok) return;
  await signOut({ wipe });
  if (!wipe) toast('Abgemeldet', 'success');
}

export function accountMenu(e) {
  const { user, cid, mode } = app.get();
  const gm = isGmAccount();
  const cloud = mode === 'cloud';
  openMenu(e, [
    { header: true, label: `${user?.name || 'Konto'} · ${gm ? 'Spielleitung' : 'Spieler'}` },
    cid ? { label: 'Übersicht: alle Kampagnen', icon: 'home', onClick: enterLobby } : null,
    { label: 'Einstellungen', icon: 'settings', onClick: () => openSettings() },
    cloud ? { label: gm ? 'Als Spieler weiterspielen' : 'Als Spielleitung arbeiten', icon: gm ? 'user' : 'crown', onClick: () => switchKind(gm ? 'player' : 'gm') } : null,
    cloud ? { label: 'Geheimwort ändern …', icon: 'key', onClick: changeSecretDialog } : null,
    { divider: true },
    { label: cloud ? 'Abmelden' : 'Offline-Modus beenden', icon: 'log-out', onClick: () => signOutDialog(false) },
    cloud ? { label: 'Abmelden & Gerät bereinigen …', icon: 'trash', danger: true, onClick: () => signOutDialog(true) } : null,
  ]);
}

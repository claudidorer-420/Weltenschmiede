// Fallback, falls ES-Module / Import-Maps nicht unterstützt werden (sehr alte Browser)
setTimeout(function () {
  if (!window.__WS_BOOTED) {
    var el = document.querySelector('.boot-sub');
    if (el) el.textContent = 'Lädt ungewöhnlich lange … Prüfe die Internetverbindung (beim ersten Start nötig) oder aktualisiere den Browser.';
  }
}, 9000);

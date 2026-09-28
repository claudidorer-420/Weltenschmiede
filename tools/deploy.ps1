<#
  Weltenschmiede – App bei Cloudflare veröffentlichen
  ---------------------------------------------------
  Aufruf im Projektordner (tools\publish.ps1 ruft es nach dem Push selbst auf):
      powershell -ExecutionPolicy Bypass -File tools\deploy.ps1

  Baut .deploy aus dem letzten Commit – nur die Dateien, die die App braucht (keine Werkzeuge,
  kein MCP-Server, keine lokalen Modelle) – und lädt ihn als Cloudflare Worker mit statischen
  Dateien hoch (wrangler.jsonc). Adresse: https://weltenschmiede.claudidorer.workers.dev
#>
$ErrorActionPreference = "Continue"  # Wrangler schreibt Hinweise nach stderr; Fehler über $LASTEXITCODE
Set-Location (Split-Path -Parent $PSScriptRoot)

$out = '.deploy'
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory $out | Out-Null
$paths = @('index.html', 'sw.js', 'manifest.webmanifest', '_headers', 'LIZENZEN.md', 'css', 'js', 'assets', 'icons')
$paths = $paths | Where-Object { git ls-files $_ }
git archive --format=tar -o "$out/app.tar" HEAD $paths
if ($LASTEXITCODE -ne 0) { throw "git archive fehlgeschlagen." }
tar -xf "$out/app.tar" -C $out
Remove-Item "$out/app.tar"

$log = (npx --yes wrangler@4 deploy 2>&1) -join "`n"
Write-Host $log
if ($LASTEXITCODE -ne 0) { throw "Veröffentlichen bei Cloudflare fehlgeschlagen." }
$url = [regex]::Match($log, 'https://[a-z0-9.-]+\.workers\.dev').Value
Write-Host "Live: $url" -ForegroundColor Green

# Alle SDXL-Objekte im gemalten Stil neu erzeugen (Runde 18), Ausgabe in out-mal/ (danach sichten, import.py).
# Aufruf (losgelöst, aus tools/sdxl): Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File lauf-alle-mal.ps1' -WindowStyle Hidden
Set-Location $PSScriptRoot
& .\.venv\Scripts\python.exe gen.py --jobs jobs-alle.json --out out-mal --steps 50 --cands 10 --hires 1536 --stil maler > run-alle-mal.log 2> run-alle-mal.err

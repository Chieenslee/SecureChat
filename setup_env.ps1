$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "Cleaning Python cache..."
Get-ChildItem -Path . -Directory -Recurse -Filter "__pycache__" | Remove-Item -Recurse -Force
Get-ChildItem -Path . -File -Recurse -Include "*.pyc", "*.pyo" | Remove-Item -Force

if (!(Test-Path ".\.venv\Scripts\python.exe")) {
    Write-Host "Creating virtual environment..."
    python -m venv .venv
}

Write-Host "Installing dependencies..."
. .\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

if (Test-Path ".\package.json") {
    Write-Host "Installing frontend crypto dependency..."
    npm install
}

Write-Host "Environment is ready. Run .\start.ps1 to start the app."

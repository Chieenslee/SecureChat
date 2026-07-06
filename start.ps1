param(
    [int]$Port = 8010
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "Checking port $Port..."
$listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
    $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $pids) {
        try {
            $process = Get-Process -Id $processId -ErrorAction Stop
            Write-Host "Killing process on port ${Port}: PID=$processId Name=$($process.ProcessName)"
            Stop-Process -Id $processId -Force -ErrorAction Stop
        } catch {
            Write-Warning "Could not kill PID=${processId}: $($_.Exception.Message)"
        }
    }
    Start-Sleep -Seconds 1
}

$uvicornProcesses = @(Get-CimInstance Win32_Process -Filter "name = 'python.exe' OR name = 'pythonw.exe'" |
    Where-Object {
        $_.CommandLine -and
        $_.CommandLine -match "uvicorn" -and
        $_.CommandLine -match "server\.main:app"
    })

foreach ($process in $uvicornProcesses) {
    try {
        Write-Host "Killing old Uvicorn process: PID=$($process.ProcessId)"
        Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    } catch {
        Write-Warning "Could not kill old Uvicorn PID=$($process.ProcessId): $($_.Exception.Message)"
    }
}

Start-Sleep -Milliseconds 500

if (!(Test-Path ".\.venv\Scripts\python.exe")) {
    Write-Host "Virtual environment not found. Running setup..."
    powershell -ExecutionPolicy Bypass -File ".\setup_env.ps1"
}

if ((Test-Path ".\package.json") -and !(Test-Path ".\node_modules\react")) {
    Write-Host "Frontend dependencies missing. Running npm install..."
    npm install
}

if (Test-Path ".\frontend\index.html") {
    Write-Host "Building React frontend..."
    npm run build
}

. .\.venv\Scripts\Activate.ps1

Write-Host "Preparing demo admin account..."
python .\scripts\ensure_demo_admin.py

Write-Host "Starting Secure Chat App..."
Write-Host "Open http://127.0.0.1:$Port/"
Write-Host "Demo logs: watch this CMD window for public keys, encrypted AES keys, IV/cipher/hash/signature, relay and ACK/NACK."
Write-Host "Admin log API: login as username ADMIN, then call GET /api/security-events with Bearer token."
uvicorn server.main:app --host 127.0.0.1 --port $Port --reload

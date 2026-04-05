# PowerShell script to start the auction system reliably on Windows

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ListeningPids {
    param([int]$Port)

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $listeners) {
        return @()
    }

    return @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
}

function Test-PortInUse {
    param([int]$Port)
    return (Get-ListeningPids -Port $Port).Count -gt 0
}

function Free-Port {
    param([int]$Port, [string]$Name)

    $pids = Get-ListeningPids -Port $Port
    if (-not $pids -or $pids.Count -eq 0) {
        return
    }

    foreach ($owningPid in $pids) {
        if ($owningPid -eq $PID) {
            continue
        }

        try {
            $process = Get-Process -Id $owningPid -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "Killing process '$($process.ProcessName)' (PID: $owningPid) using $Name" -ForegroundColor Yellow
                Stop-Process -Id $owningPid -Force -ErrorAction Stop
            }
        }
        catch {
            Write-Host "Could not kill PID $owningPid on $Name: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

function Wait-ForPortState {
    param(
        [int]$Port,
        [bool]$ShouldBeInUse,
        [int]$TimeoutSeconds = 20
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if ((Test-PortInUse -Port $Port) -eq $ShouldBeInUse) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }

    return $false
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

Write-Host "Checking port availability..." -ForegroundColor Yellow

$targets = @(
    @{ Port = 5000; Name = "Backend (5000)" },
    @{ Port = 3000; Name = "Dashboard (3000)" },
    @{ Port = 3001; Name = "Auctioneer (3001)" }
)

foreach ($target in $targets) {
    $port = [int]$target.Port
    $name = [string]$target.Name

    if (Test-PortInUse -Port $port) {
        Write-Host "WARNING: $name is in use. Attempting to free it..." -ForegroundColor Red
        Free-Port -Port $port -Name $name

        if (-not (Wait-ForPortState -Port $port -ShouldBeInUse $false -TimeoutSeconds 15)) {
            Write-Host "Failed to free $name. Please close the process manually and retry." -ForegroundColor Red
            exit 1
        }

        Write-Host "$name is now free" -ForegroundColor Green
    }
    else {
        Write-Host "$name is available" -ForegroundColor Green
    }
}

Write-Host "All required ports are ready. Starting auction services..." -ForegroundColor Green

Write-Host "Starting backend on port 5000..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$backendDir`" && node server.js" -WindowStyle Minimized

if (-not (Wait-ForPortState -Port 5000 -ShouldBeInUse $true -TimeoutSeconds 20)) {
    Write-Host "Backend did not start on port 5000 in time." -ForegroundColor Red
    exit 1
}

Write-Host "Starting dashboard on port 3000..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$frontendDir`" && set REACT_APP_MODE=dashboard && set PORT=3000 && set BROWSER=none && npm start" -WindowStyle Minimized

Write-Host "Starting auctioneer panel on port 3001..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$frontendDir`" && set REACT_APP_MODE=auctioneer && set PORT=3001 && set BROWSER=none && npm start" -WindowStyle Minimized

Write-Host "Waiting for frontend ports..." -ForegroundColor Yellow
$dashboardReady = Wait-ForPortState -Port 3000 -ShouldBeInUse $true -TimeoutSeconds 45
$auctioneerReady = Wait-ForPortState -Port 3001 -ShouldBeInUse $true -TimeoutSeconds 45

if (-not $dashboardReady) {
    Write-Host "Dashboard did not start on port 3000 in time." -ForegroundColor Red
}
if (-not $auctioneerReady) {
    Write-Host "Auctioneer did not start on port 3001 in time." -ForegroundColor Red
}

Write-Host "Startup command completed." -ForegroundColor Green
Write-Host "Backend: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Dashboard: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Auctioneer: http://localhost:3001" -ForegroundColor Cyan

if ($dashboardReady) {
    Start-Process "http://localhost:3000"
}
if ($auctioneerReady) {
    Start-Process "http://localhost:3001"
}
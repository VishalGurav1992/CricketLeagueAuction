# PowerShell script to start the auction system
# Run this script from the SPLAuction directory

function Test-Port {
    param([int]$Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
    return $connection.TcpTestSucceeded
}

function Free-Port {
    param([int]$Port, [string]$Name)
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($connections) {
            $processId = $connections[0].OwningProcess
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "Killing process '$($process.ProcessName)' (PID: $processId) using $Name" -ForegroundColor Yellow
                Stop-Process -Id $processId -Force
                Start-Sleep -Seconds 1
            }
        }
    } catch {
        Write-Host "Could not free $Name automatically" -ForegroundColor Red
    }
}

Write-Host "Checking port availability..." -ForegroundColor Yellow

$ports = @(5000, 3000, 3001)
$portNames = @("Backend (5000)", "Dashboard (3000)", "Auctioneer (3001)")

for ($i = 0; $i -lt $ports.Length; $i++) {
    $port = $ports[$i]
    $name = $portNames[$i]
    if (Test-Port -Port $port) {
        Write-Host "WARNING: $name is in use. Attempting to free it..." -ForegroundColor Red
        Free-Port -Port $port -Name $name
        if (Test-Port -Port $port) {
            Write-Host "Failed to free $name. Please free it manually." -ForegroundColor Red
            exit 1
        } else {
            Write-Host "$name is now free" -ForegroundColor Green
        }
    } else {
        Write-Host "$name is available" -ForegroundColor Green
    }
}

Write-Host "All ports are free. Starting Auction System..." -ForegroundColor Green

# Start backend server
Write-Host "Starting backend server..." -ForegroundColor Yellow
Set-Location ".\backend"
Start-Process -FilePath "cmd" -ArgumentList "/c node server.js" -NoNewWindow
Set-Location ".."

# Wait for backend to start
Start-Sleep -Seconds 3

# Start dashboard
Write-Host "Starting dashboard..." -ForegroundColor Yellow
Set-Location ".\frontend"
$env:REACT_APP_MODE = "dashboard"
$env:PORT = "3000"
$env:BROWSER = "none"  # Prevent React from opening browser
Start-Process -FilePath "cmd" -ArgumentList "/c npm start" -NoNewWindow
Set-Location ".."

# Start auctioneer
Write-Host "Starting auctioneer panel..." -ForegroundColor Yellow
Set-Location ".\frontend"
$env:REACT_APP_MODE = "auctioneer"
$env:PORT = "3001"
$env:BROWSER = "none"  # Prevent React from opening browser
Start-Process -FilePath "cmd" -ArgumentList "/c npm start" -NoNewWindow
Set-Location ".."

Write-Host "All services started!" -ForegroundColor Green
Write-Host "Dashboard: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Auctioneer: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:5000" -ForegroundColor Cyan

# Open browser tabs
Write-Host "Opening browser tabs..." -ForegroundColor Yellow
Start-Process "http://localhost:3000"
Start-Process "http://localhost:3001"

Write-Host "Services are running. Press Ctrl+C to exit." -ForegroundColor Green

# Keep the script running
while ($true) {
    Start-Sleep -Seconds 1
}
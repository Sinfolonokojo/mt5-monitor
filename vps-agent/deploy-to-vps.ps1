# VPS Auto-Reconnection Deployment Script
# This script helps deploy the auto-reconnection fixes to VPS2-10

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("VPS2", "VPS3", "VPS4", "VPS5", "VPS6", "VPS7", "VPS8", "VPS9", "VPS10")]
    [string]$VPSName,

    [Parameter(Mandatory=$true)]
    [string]$VPSAddress,

    [switch]$SkipBackup,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Step { param($Message) Write-Host "`n[STEP] $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "  ✅ $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "  ⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "  ❌ $Message" -ForegroundColor Red }

Write-Host @"
════════════════════════════════════════════════════════════
  VPS Auto-Reconnection Deployment Script
  Target: $VPSName ($VPSAddress)
  Dry Run: $DryRun
════════════════════════════════════════════════════════════
"@ -ForegroundColor Yellow

# Define source files
$SourceDir = $PSScriptRoot
$FilesToDeploy = @{
    "App Files" = @(
        "app/main.py",
        "app/mt5_service.py",
        "app/models.py",
        "app/config.py",
        "app/utils.py",
        "app/__init__.py"
    )
    "Root Files" = @(
        "launcher.py",
        "view_logs.py",
        "requirements.txt"
    )
}

# Check if config file exists
$ConfigFile = "agents-$($VPSName.ToLower()).json"
$ConfigPath = Join-Path $SourceDir $ConfigFile

Write-Step "Pre-deployment Checks"

# Verify all source files exist
$AllFilesExist = $true
foreach ($Category in $FilesToDeploy.Keys) {
    foreach ($File in $FilesToDeploy[$Category]) {
        $FilePath = Join-Path $SourceDir $File
        if (Test-Path $FilePath) {
            Write-Success "$File exists"
        } else {
            Write-Error "$File NOT FOUND"
            $AllFilesExist = $false
        }
    }
}

# Check config file
if (Test-Path $ConfigPath) {
    Write-Success "Config file $ConfigFile exists"

    # Validate JSON
    try {
        $ConfigContent = Get-Content $ConfigPath -Raw | ConvertFrom-Json
        $AgentCount = $ConfigContent.agents.Count
        Write-Success "Config is valid JSON with $AgentCount agent(s)"
    } catch {
        Write-Error "Config file is not valid JSON: $_"
        $AllFilesExist = $false
    }
} else {
    Write-Warning "Config file $ConfigFile NOT FOUND - You'll need to create it on the VPS"
}

if (-not $AllFilesExist) {
    Write-Error "Some files are missing. Cannot proceed."
    exit 1
}

if ($DryRun) {
    Write-Host "`n[DRY RUN] Would deploy the following files to $VPSAddress" -ForegroundColor Yellow
    foreach ($Category in $FilesToDeploy.Keys) {
        Write-Host "`n$Category`:" -ForegroundColor Cyan
        foreach ($File in $FilesToDeploy[$Category]) {
            Write-Host "  - $File" -ForegroundColor Gray
        }
    }
    if (Test-Path $ConfigPath) {
        Write-Host "`nConfiguration:" -ForegroundColor Cyan
        Write-Host "  - $ConfigFile -> agents.json" -ForegroundColor Gray
    }
    Write-Host "`n[DRY RUN] Deployment simulation complete." -ForegroundColor Yellow
    exit 0
}

# Interactive deployment steps
Write-Step "Deployment Instructions for $VPSName"

Write-Host @"

This script has verified all files are ready. Follow these steps to deploy:

1️⃣  CONNECT TO VPS
   - RDP to: $VPSAddress
   - Login as: Administrator

2️⃣  BACKUP CURRENT FILES (if not using -SkipBackup)
   Run on VPS:
   ```powershell
   cd C:\Users\Administrator\Desktop\vps-agent
   `$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
   mkdir "backup-`$timestamp"
   Copy-Item .\app\*.py ".\backup-`$timestamp\"
   Copy-Item .\launcher.py ".\backup-`$timestamp\"
   Copy-Item .\agents.json ".\backup-`$timestamp\"
   ```

3️⃣  STOP CURRENT LAUNCHER
   Run on VPS:
   ```powershell
   # Press Ctrl+C if launcher is running in a window
   # OR force kill all Python processes:
   taskkill /F /IM python.exe
   ```

4️⃣  COPY NEW FILES
   Use your preferred method (RDP copy/paste, WinSCP, etc.) to copy:

   FROM your dev machine ($SourceDir):
"@ -ForegroundColor White

foreach ($Category in $FilesToDeploy.Keys) {
    Write-Host "   $Category`:" -ForegroundColor Cyan
    foreach ($File in $FilesToDeploy[$Category]) {
        $SourcePath = Join-Path $SourceDir $File
        Write-Host "     📁 $SourcePath" -ForegroundColor Gray
    }
}

if (Test-Path $ConfigPath) {
    Write-Host "`n   Configuration:" -ForegroundColor Cyan
    Write-Host "     📁 $ConfigPath" -ForegroundColor Gray
}

Write-Host @"

   TO VPS directory:
     C:\Users\Administrator\Desktop\vps-agent\

   ⚠️  IMPORTANT: Rename $ConfigFile to agents.json on the VPS

5️⃣  INSTALL DEPENDENCIES
   Run on VPS:
   ```powershell
   cd C:\Users\Administrator\Desktop\vps-agent
   pip install -r requirements.txt
   ```

6️⃣  VERIFY CONFIGURATION
   Run on VPS:
   ```powershell
   # Check agents.json is valid
   Get-Content agents.json | ConvertFrom-Json

   # Verify MT5 terminal paths exist
   Test-Path "C:/Program Files/FundedNext MT5 Terminal/terminal64.exe"
   Test-Path "C:/Program Files/Five Percent Online MetaTrader 5/terminal64.exe"
   ```

7️⃣  START LAUNCHER
   Run on VPS:
   ```powershell
   python launcher.py
   ```

   Expected output:
   🚀 Starting X agent process(es)...
   ============================================================
     Starting $VPSName-FundedNext on port 8000...
       ✅ Started (PID: XXXX)
   ...

8️⃣  VERIFY HEALTH CHECKS (Wait 60-90 seconds)
   Run on VPS in another PowerShell window:
   ```powershell
   python view_logs.py $VPSName-FundedNext
   ```

   Should see every 60 seconds:
   INFO: Running periodic health check for $VPSName-FundedNext

9️⃣  TEST ENDPOINTS
   Run on VPS:
   ```powershell
   Invoke-RestMethod -Uri http://localhost:8000/health
   Invoke-RestMethod -Uri http://localhost:8001/health
   Invoke-RestMethod -Uri http://localhost:8000/accounts
   Invoke-RestMethod -Uri http://localhost:8001/accounts
   ```

🔟 SETUP AUTO-START (Optional but Recommended)
   Run on VPS:
   ```powershell
   schtasks /create /tn "MT5Launcher" /tr "python C:\Users\Administrator\Desktop\vps-agent\launcher.py" /sc onstart /ru Administrator /rl HIGHEST /f
   ```

"@ -ForegroundColor White

Write-Host @"
════════════════════════════════════════════════════════════
  📋 Deployment Checklist for $VPSName
════════════════════════════════════════════════════════════
  [ ] Connected to VPS via RDP
  [ ] Backed up current files
  [ ] Stopped current launcher
  [ ] Copied all new files
  [ ] Renamed config to agents.json
  [ ] Installed dependencies
  [ ] Verified configuration
  [ ] Started launcher successfully
  [ ] Health checks appearing in logs
  [ ] All endpoints responding
  [ ] Auto-start task created
════════════════════════════════════════════════════════════

"@ -ForegroundColor Yellow

# Offer to open the source directory
$OpenDir = Read-Host "Open source directory for easy file copying? (Y/N)"
if ($OpenDir -eq 'Y' -or $OpenDir -eq 'y') {
    explorer $SourceDir
}

Write-Host "`n✅ Pre-deployment checks complete. Ready to deploy to $VPSName!`n" -ForegroundColor Green

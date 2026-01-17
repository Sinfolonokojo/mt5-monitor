# VPS Configuration File Generator
# Creates agents-vpsX.json configuration files for VPS5-10

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("VPS5", "VPS6", "VPS7", "VPS8", "VPS9", "VPS10")]
    [string]$VPSName,

    [Parameter(Mandatory=$false)]
    [string]$FundedNextAccount = "",

    [Parameter(Mandatory=$false)]
    [string]$FivePercentAccount = "",

    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-Step { param($Message) Write-Host "`n[STEP] $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "  ✅ $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "  ⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "  ❌ $Message" -ForegroundColor Red }

Write-Host @"
════════════════════════════════════════════════════════════
  VPS Configuration File Generator
  Creating: agents-$($VPSName.ToLower()).json
════════════════════════════════════════════════════════════
"@ -ForegroundColor Yellow

$OutputFile = Join-Path $PSScriptRoot "agents-$($VPSName.ToLower()).json"

# Check if file already exists
if ((Test-Path $OutputFile) -and -not $Force) {
    Write-Error "File $OutputFile already exists. Use -Force to overwrite."
    exit 1
}

Write-Step "Gathering Account Information"

# Prompt for account numbers if not provided
if ([string]::IsNullOrWhiteSpace($FundedNextAccount)) {
    $FundedNextAccount = Read-Host "Enter FundedNext account number for $VPSName (or press Enter to skip)"
}

if ([string]::IsNullOrWhiteSpace($FivePercentAccount)) {
    $FivePercentAccount = Read-Host "Enter Five Percent account number for $VPSName (or press Enter to skip)"
}

# Build agents array
$Agents = @()

if (-not [string]::IsNullOrWhiteSpace($FundedNextAccount)) {
    Write-Success "Adding FundedNext agent with account: $FundedNextAccount"
    $Agents += @{
        name = "$VPSName-FundedNext"
        port = 8000
        terminal_path = "C:/Program Files/FundedNext MT5 Terminal/terminal64.exe"
        display_name = "FundedNext ($FundedNextAccount)"
    }
}

if (-not [string]::IsNullOrWhiteSpace($FivePercentAccount)) {
    Write-Success "Adding Five Percent agent with account: $FivePercentAccount"
    $Port = if ($Agents.Count -eq 0) { 8000 } else { 8001 }
    $Agents += @{
        name = "$VPSName-FivePercent"
        port = $Port
        terminal_path = "C:/Program Files/Five Percent Online MetaTrader 5/terminal64.exe"
        display_name = "Five Percent Online ($FivePercentAccount)"
    }
}

if ($Agents.Count -eq 0) {
    Write-Error "No agents configured. At least one account number is required."
    exit 1
}

# Create configuration object
$Config = @{
    agents = $Agents
}

Write-Step "Creating Configuration File"

# Convert to JSON and save
$JsonContent = $Config | ConvertTo-Json -Depth 10
$JsonContent | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Success "Created: $OutputFile"

# Display the configuration
Write-Host "`n📄 Configuration Preview:" -ForegroundColor Cyan
Write-Host $JsonContent -ForegroundColor Gray

Write-Host @"

════════════════════════════════════════════════════════════
  Next Steps:
════════════════════════════════════════════════════════════
  1. Review the configuration file: $OutputFile
  2. Deploy to $VPSName using:
     .\deploy-to-vps.ps1 -VPSName $VPSName -VPSAddress <IP>

  Optional: Add extended metadata (account_holder, prop_firm, etc.)
  Edit the file manually to add these fields if needed.
════════════════════════════════════════════════════════════

"@ -ForegroundColor Yellow

Write-Success "Configuration file created successfully!"

# VPS Configuration File Generator
# Creates agents.json configuration file for VPS deployment

param(
    [Parameter(Mandatory=$false)]
    [string]$VPSName = "",

    [Parameter(Mandatory=$false)]
    [string]$AccountHolder = "",

    [Parameter(Mandatory=$false)]
    [string]$FundedNextAccount = "",

    [Parameter(Mandatory=$false)]
    [string]$FivePercentAccount = "",

    [Parameter(Mandatory=$false)]
    [string]$FTMOAccount = "",

    [Parameter(Mandatory=$false)]
    [double]$InitialBalance = 100000.0,

    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-Step { param($Message) Write-Host "`n[STEP] $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "  ✅ $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "  ⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "  ❌ $Message" -ForegroundColor Red }

Write-Host @"
════════════════════════════════════════════════════════════
  🔧 Generador de Configuración para VPS Agent
  Crea el archivo: agents.json
════════════════════════════════════════════════════════════
"@ -ForegroundColor Yellow

$OutputFile = Join-Path $PSScriptRoot "agents.json"

# Check if file already exists
if ((Test-Path $OutputFile) -and -not $Force) {
    Write-Warning "El archivo agents.json ya existe."
    $Overwrite = Read-Host "¿Deseas sobrescribirlo? (Y/N)"
    if ($Overwrite -ne 'Y' -and $Overwrite -ne 'y') {
        Write-Host "`nOperación cancelada." -ForegroundColor Yellow
        exit 0
    }
}

Write-Step "Información del VPS"

# Prompt for VPS name if not provided
if ([string]::IsNullOrWhiteSpace($VPSName)) {
    $VPSName = Read-Host "Nombre del VPS (ej: VPS5, VPS6, etc.)"
    if ([string]::IsNullOrWhiteSpace($VPSName)) {
        Write-Error "El nombre del VPS es requerido."
        exit 1
    }
}

Write-Success "Nombre del VPS: $VPSName"

# Prompt for Account Holder if not provided
if ([string]::IsNullOrWhiteSpace($AccountHolder)) {
    $AccountHolder = Read-Host "Nombre del titular de las cuentas (ej: Yojan Forero)"
    if ([string]::IsNullOrWhiteSpace($AccountHolder)) {
        Write-Error "El nombre del titular es requerido."
        exit 1
    }
}

Write-Success "Titular: $AccountHolder"

Write-Step "Números de Cuenta MT5"
Write-Host "  Ingresa los números de cuenta para cada broker`n  (Presiona Enter para omitir cualquier cuenta que no tengas)`n" -ForegroundColor Gray

# Prompt for account numbers if not provided
if ([string]::IsNullOrWhiteSpace($FundedNextAccount)) {
    $FundedNextAccount = Read-Host "  Cuenta FundedNext [Enter para omitir]"
    $FundedNextAccount = $FundedNextAccount.Trim()
}

if ([string]::IsNullOrWhiteSpace($FivePercentAccount)) {
    $FivePercentAccount = Read-Host "  Cuenta Five Percent [Enter para omitir]"
    $FivePercentAccount = $FivePercentAccount.Trim()
}

if ([string]::IsNullOrWhiteSpace($FTMOAccount)) {
    $FTMOAccount = Read-Host "  Cuenta FTMO [Enter para omitir]"
    $FTMOAccount = $FTMOAccount.Trim()
}

# Build agents array
$Agents = @()
$NextPort = 8000

if (-not [string]::IsNullOrWhiteSpace($FundedNextAccount)) {
    Write-Success "Agregando agente FundedNext: $FundedNextAccount (Puerto $NextPort)"
    $Agents += @{
        name = "$VPSName-FundedNext"
        port = $NextPort
        terminal_path = "C:/Program Files/FundedNext MT5 Terminal/terminal64.exe"
        display_name = $FundedNextAccount
        account_holder = $AccountHolder
        prop_firm = "FN"
        initial_balance = $InitialBalance
    }
    $NextPort++
}

if (-not [string]::IsNullOrWhiteSpace($FivePercentAccount)) {
    Write-Success "Agregando agente Five Percent: $FivePercentAccount (Puerto $NextPort)"
    $Agents += @{
        name = "$VPSName-FivePercent"
        port = $NextPort
        terminal_path = "C:/Program Files/Five Percent Online MetaTrader 5/terminal64.exe"
        display_name = $FivePercentAccount
        account_holder = $AccountHolder
        prop_firm = "T5"
        initial_balance = $InitialBalance
    }
    $NextPort++
}

if (-not [string]::IsNullOrWhiteSpace($FTMOAccount)) {
    Write-Success "Agregando agente FTMO: $FTMOAccount (Puerto $NextPort)"
    $Agents += @{
        name = "$VPSName-FTMO"
        port = $NextPort
        terminal_path = "C:/Program Files/FTMO Global Markets MT5 Terminal/terminal64.exe"
        display_name = $FTMOAccount
        account_holder = $AccountHolder
        prop_firm = "FTMO"
        initial_balance = $InitialBalance
    }
    $NextPort++
}

if ($Agents.Count -eq 0) {
    Write-Error "No se configuraron agentes. Debes ingresar al menos un número de cuenta."
    exit 1
}

# Create configuration object
$Config = @{
    agents = $Agents
}

Write-Step "Creando Archivo de Configuración"

# Convert to JSON and save
$JsonContent = $Config | ConvertTo-Json -Depth 10
$JsonContent | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Success "Archivo creado: $OutputFile"

# Display the configuration
Write-Host "`n📄 Vista Previa de la Configuración:" -ForegroundColor Cyan
Write-Host $JsonContent -ForegroundColor Gray

Write-Host @"

════════════════════════════════════════════════════════════
  ✅ Configuración Completada
════════════════════════════════════════════════════════════
  📁 Archivo: agents.json
  🔢 Agentes configurados: $($Agents.Count)
  🔌 Puertos usados: 8000-$($NextPort - 1)

  Siguiente Paso:
  1. Copia toda la carpeta vps-agent al VPS
  2. Sigue los pasos del DEPLOYMENT_CHECKLIST.md
════════════════════════════════════════════════════════════

"@ -ForegroundColor Green

Write-Success "¡Listo para deployment!"

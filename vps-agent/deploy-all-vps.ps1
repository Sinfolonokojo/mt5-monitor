# Batch Deployment Script for All VPS
# Helps deploy auto-reconnection fixes to multiple VPS instances

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("VPS2", "VPS3", "VPS4", "VPS5", "VPS6", "VPS7", "VPS8", "VPS9", "VPS10", "ALL", "STAGE1", "STAGE2", "STAGE3")]
    [string]$Target = "STAGE1",

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Header { param($Message) Write-Host "`n$('='*70)`n  $Message`n$('='*70)" -ForegroundColor Yellow }
function Write-Step { param($Message) Write-Host "`n[STEP] $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "  ✅ $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "  ⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "  ❌ $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "  ℹ️  $Message" -ForegroundColor Blue }

Write-Header "VPS Auto-Reconnection Batch Deployment"

# Load VPS addresses
$AddressFile = Join-Path $PSScriptRoot "vps-addresses.json"
if (-not (Test-Path $AddressFile)) {
    Write-Error "VPS addresses file not found: $AddressFile"
    exit 1
}

try {
    $VPSData = Get-Content $AddressFile -Raw | ConvertFrom-Json
    $VPSMapping = $VPSData.vps_mapping
} catch {
    Write-Error "Failed to parse VPS addresses file: $_"
    exit 1
}

# Define deployment stages
$DeploymentStages = @{
    "STAGE1" = @("VPS2")  # Test deployment
    "STAGE2" = @("VPS3", "VPS4")  # Small batch
    "STAGE3" = @("VPS5", "VPS6", "VPS7", "VPS8", "VPS9")  # Remaining (excluding VPS10 if IP missing)
    "ALL" = @("VPS2", "VPS3", "VPS4", "VPS5", "VPS6", "VPS7", "VPS8", "VPS9", "VPS10")
}

# Determine which VPS to deploy
$VPSToDeploy = @()
if ($Target -in @("STAGE1", "STAGE2", "STAGE3", "ALL")) {
    $VPSToDeploy = $DeploymentStages[$Target]
    Write-Info "Deploying $Target: $($VPSToDeploy -join ', ')"
} else {
    $VPSToDeploy = @($Target)
    Write-Info "Deploying single VPS: $Target"
}

Write-Header "Pre-Deployment Checks"

# Check if deployment script exists
$DeployScript = Join-Path $PSScriptRoot "deploy-to-vps.ps1"
if (-not (Test-Path $DeployScript)) {
    Write-Error "Deployment script not found: $DeployScript"
    exit 1
}
Write-Success "Deployment script found"

# Check VPS addresses
$MissingAddresses = @()
$ValidVPS = @()

foreach ($VPS in $VPSToDeploy) {
    $Address = $VPSMapping.$VPS
    if ([string]::IsNullOrWhiteSpace($Address) -or $Address -eq "MISSING_IP_ADDRESS") {
        $MissingAddresses += $VPS
        Write-Warning "$VPS has no IP address configured"
    } else {
        $ValidVPS += @{VPS = $VPS; Address = $Address}
        Write-Success "$VPS -> $Address"
    }
}

if ($MissingAddresses.Count -gt 0) {
    Write-Warning "The following VPS have missing IP addresses:"
    foreach ($VPS in $MissingAddresses) {
        Write-Host "    - $VPS" -ForegroundColor Yellow
    }
    Write-Host "`nUpdate vps-addresses.json with the correct IPs before deploying these VPS.`n" -ForegroundColor Yellow
}

if ($ValidVPS.Count -eq 0) {
    Write-Error "No valid VPS to deploy. Exiting."
    exit 1
}

# Check for missing config files (VPS5-10)
Write-Step "Checking Configuration Files"
$MissingConfigs = @()
foreach ($VPSInfo in $ValidVPS) {
    $VPS = $VPSInfo.VPS
    $ConfigFile = "agents-$($VPS.ToLower()).json"
    $ConfigPath = Join-Path $PSScriptRoot $ConfigFile

    if (Test-Path $ConfigPath) {
        Write-Success "$ConfigFile exists"
    } else {
        $MissingConfigs += $VPS
        Write-Warning "$ConfigFile NOT FOUND - needs to be created"
    }
}

if ($MissingConfigs.Count -gt 0) {
    Write-Host "`n⚠️  Missing Configuration Files" -ForegroundColor Yellow
    Write-Host "The following VPS need config files created:`n" -ForegroundColor Yellow
    foreach ($VPS in $MissingConfigs) {
        Write-Host "  $VPS - Run: .\create-vps-config.ps1 -VPSName $VPS -FundedNextAccount <NUM> -FivePercentAccount <NUM>" -ForegroundColor Gray
    }

    $Continue = Read-Host "`nDo you want to continue without these VPS? (Y/N)"
    if ($Continue -ne 'Y' -and $Continue -ne 'y') {
        Write-Host "Deployment cancelled. Create the missing configs and try again." -ForegroundColor Yellow
        exit 0
    }

    # Remove VPS with missing configs from deployment list
    $ValidVPS = $ValidVPS | Where-Object { $_.VPS -notin $MissingConfigs }
    Write-Info "Proceeding with $($ValidVPS.Count) VPS (excluded VPS with missing configs)"
}

if ($DryRun) {
    Write-Header "DRY RUN - Deployment Plan"
    Write-Host "Would deploy to the following VPS:`n" -ForegroundColor Yellow

    foreach ($VPSInfo in $ValidVPS) {
        Write-Host "  📦 $($VPSInfo.VPS) - $($VPSInfo.Address)" -ForegroundColor Cyan
    }

    Write-Host "`nTo execute actual deployment, remove -DryRun flag.`n" -ForegroundColor Yellow
    exit 0
}

Write-Header "Deployment Summary"

Write-Host @"

📋 Deployment Plan:
   Total VPS: $($ValidVPS.Count)
   Stage: $Target

   VPS List:
"@ -ForegroundColor White

foreach ($VPSInfo in $ValidVPS) {
    Write-Host "   - $($VPSInfo.VPS) -> $($VPSInfo.Address)" -ForegroundColor Cyan
}

Write-Host @"

⏱️  Estimated Time: $($ValidVPS.Count * 10)-$($ValidVPS.Count * 15) minutes
   (~10-15 minutes per VPS)

📝 Important Notes:
   1. You will need RDP access to each VPS
   2. Each deployment runs the interactive deploy-to-vps.ps1 script
   3. Follow the on-screen instructions for each VPS
   4. Backups are created automatically
   5. Rollback is available if needed

"@ -ForegroundColor White

$Confirm = Read-Host "Ready to begin deployment? (Y/N)"
if ($Confirm -ne 'Y' -and $Confirm -ne 'y') {
    Write-Host "Deployment cancelled by user." -ForegroundColor Yellow
    exit 0
}

Write-Header "Starting Deployments"

$DeploymentResults = @()

foreach ($VPSInfo in $ValidVPS) {
    $VPS = $VPSInfo.VPS
    $Address = $VPSInfo.Address

    Write-Host "`n$('─'*70)" -ForegroundColor Gray
    Write-Host "  Deploying to: $VPS ($Address)" -ForegroundColor Cyan
    Write-Host "$('─'*70)`n" -ForegroundColor Gray

    try {
        # Run deployment script for this VPS
        & $DeployScript -VPSName $VPS -VPSAddress $Address

        $Result = Read-Host "`nWas deployment to $VPS successful? (Y/N/S to skip remaining)"

        if ($Result -eq 'S' -or $Result -eq 's') {
            Write-Warning "Stopping deployment process as requested"
            $DeploymentResults += @{VPS = $VPS; Status = "Skipped"; Address = $Address}
            break
        } elseif ($Result -eq 'Y' -or $Result -eq 'y') {
            $DeploymentResults += @{VPS = $VPS; Status = "Success"; Address = $Address}
            Write-Success "$VPS deployed successfully!"
        } else {
            $DeploymentResults += @{VPS = $VPS; Status = "Failed"; Address = $Address}
            Write-Error "$VPS deployment failed"

            $ContinueOnFail = Read-Host "Continue with remaining VPS? (Y/N)"
            if ($ContinueOnFail -ne 'Y' -and $ContinueOnFail -ne 'y') {
                Write-Warning "Stopping deployment process"
                break
            }
        }

    } catch {
        Write-Error "Exception during $VPS deployment: $_"
        $DeploymentResults += @{VPS = $VPS; Status = "Error"; Address = $Address}

        $ContinueOnError = Read-Host "Continue with remaining VPS? (Y/N)"
        if ($ContinueOnError -ne 'Y' -and $ContinueOnError -ne 'y') {
            Write-Warning "Stopping deployment process"
            break
        }
    }

    # Pause between deployments
    if ($VPSInfo -ne $ValidVPS[-1]) {
        Write-Host "`n⏸️  Pausing before next deployment..." -ForegroundColor Yellow
        Read-Host "Press Enter to continue to next VPS"
    }
}

Write-Header "Deployment Results"

# Summary table
Write-Host "`n📊 Deployment Summary:`n" -ForegroundColor Cyan

$SuccessCount = ($DeploymentResults | Where-Object { $_.Status -eq "Success" }).Count
$FailCount = ($DeploymentResults | Where-Object { $_.Status -in @("Failed", "Error") }).Count
$SkipCount = ($DeploymentResults | Where-Object { $_.Status -eq "Skipped" }).Count

foreach ($Result in $DeploymentResults) {
    $Icon = switch ($Result.Status) {
        "Success" { "✅" }
        "Failed"  { "❌" }
        "Error"   { "❌" }
        "Skipped" { "⏭️" }
        default   { "❓" }
    }

    $Color = switch ($Result.Status) {
        "Success" { "Green" }
        "Failed"  { "Red" }
        "Error"   { "Red" }
        "Skipped" { "Yellow" }
        default   { "Gray" }
    }

    Write-Host "  $Icon $($Result.VPS) - $($Result.Address) - $($Result.Status)" -ForegroundColor $Color
}

Write-Host @"

📈 Statistics:
   ✅ Successful: $SuccessCount
   ❌ Failed: $FailCount
   ⏭️  Skipped: $SkipCount
   📦 Total Attempted: $($DeploymentResults.Count)

"@ -ForegroundColor White

if ($SuccessCount -gt 0) {
    Write-Host "🎉 Next Steps:" -ForegroundColor Green
    Write-Host "  1. Monitor all deployed VPS for 24 hours" -ForegroundColor White
    Write-Host "  2. Check health check logs every 60 seconds" -ForegroundColor White
    Write-Host "  3. Verify backend fetches from all agents" -ForegroundColor White
    Write-Host "  4. Test auto-reconnection on one VPS" -ForegroundColor White
}

if ($FailCount -gt 0) {
    Write-Host "`n⚠️  Some deployments failed. Check the logs and consider:" -ForegroundColor Yellow
    Write-Host "  - Reviewing the deployment steps" -ForegroundColor White
    Write-Host "  - Running rollback if needed" -ForegroundColor White
    Write-Host "  - Re-attempting failed deployments individually" -ForegroundColor White
}

# Ask if user wants to proceed to next stage
if ($Target -eq "STAGE1" -and $SuccessCount -gt 0) {
    Write-Host "`n💡 STAGE1 deployment complete!" -ForegroundColor Green
    Write-Host "   Recommendation: Monitor VPS2 for 24 hours before deploying STAGE2" -ForegroundColor Yellow
    Write-Host "   When ready, run: .\deploy-all-vps.ps1 -Target STAGE2" -ForegroundColor Gray
} elseif ($Target -eq "STAGE2" -and $SuccessCount -gt 0) {
    Write-Host "`n💡 STAGE2 deployment complete!" -ForegroundColor Green
    Write-Host "   Recommendation: Monitor VPS3-4 for 24 hours before deploying STAGE3" -ForegroundColor Yellow
    Write-Host "   When ready, run: .\deploy-all-vps.ps1 -Target STAGE3" -ForegroundColor Gray
} elseif ($Target -eq "STAGE3" -and $SuccessCount -gt 0) {
    Write-Host "`n💡 STAGE3 deployment complete!" -ForegroundColor Green
    Write-Host "   All VPS deployments finished. Don't forget to update the backend!" -ForegroundColor Yellow
    Write-Host "   See DEPLOYMENT_CHECKLIST.md for backend update steps" -ForegroundColor Gray
}

Write-Host "`n✅ Batch deployment script completed!`n" -ForegroundColor Green

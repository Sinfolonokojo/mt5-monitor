# Enable WinRM for Ansible Management
# Run this script as Administrator on each VPS via RDP
# Copy and paste into PowerShell (Run as Administrator)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Enabling WinRM for Ansible Management" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Enable WinRM service
Write-Host "[1/6] Enabling WinRM service..." -ForegroundColor Yellow
winrm quickconfig -force

# 2. Allow unencrypted traffic (required for basic auth over HTTP)
Write-Host "[2/6] Configuring AllowUnencrypted..." -ForegroundColor Yellow
winrm set winrm/config/service '@{AllowUnencrypted="true"}'

# 3. Enable Basic authentication
Write-Host "[3/6] Enabling Basic authentication..." -ForegroundColor Yellow
winrm set winrm/config/service/auth '@{Basic="true"}'

# 4. Set MaxMemoryPerShellMB (prevents memory issues)
Write-Host "[4/6] Setting MaxMemoryPerShellMB..." -ForegroundColor Yellow
winrm set winrm/config/winrs '@{MaxMemoryPerShellMB="1024"}'

# 5. Open firewall port 5985
Write-Host "[5/6] Opening firewall port 5985..." -ForegroundColor Yellow
netsh advfirewall firewall add rule name="WinRM HTTP" dir=in action=allow protocol=TCP localport=5985

# 6. Ensure WinRM service starts automatically
Write-Host "[6/6] Setting WinRM to auto-start..." -ForegroundColor Yellow
Set-Service -Name WinRM -StartupType Automatic
Start-Service -Name WinRM

# Verify configuration
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Verification" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "WinRM Service Status:" -ForegroundColor Cyan
Get-Service WinRM | Format-Table Name, Status, StartType

Write-Host "WinRM Listeners:" -ForegroundColor Cyan
winrm enumerate winrm/config/listener

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " WinRM Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "This VPS should now be accessible via Ansible WinRM." -ForegroundColor White
Write-Host ""

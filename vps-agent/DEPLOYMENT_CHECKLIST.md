# Lista de Verificación de Despliegue VPS

## 📦 Preparación y Configuración

### Paso 0: Descargar y Copiar Archivos

1. **Descargar carpeta vps-agent desde Google Drive**
   - Descarga la carpeta completa `vps-agent` a tu computadora
   - Verifica que contenga todos los archivos necesarios

2. **Conectar al VPS y limpiar instalación anterior (si existe)**
   - Conecta por RDP al VPS
   - **IMPORTANTE:** Si existe una carpeta `vps-agent` vieja en `C:\Users\Administrator\Desktop\vps-agent`:
     ```powershell
     # Detener procesos primero
     taskkill /F /IM python.exe

     # Borrar carpeta vieja completa
     cd C:\Users\Administrator\Desktop
     Remove-Item -Recurse -Force vps-agent
     ```

3. **Copiar carpeta nueva al VPS**
   - Copia toda la carpeta `vps-agent` descargada de Google Drive
   - Destino: `C:\Users\Administrator\Desktop\vps-agent`

4. **Crear archivo de configuración agents.json**

   Abre PowerShell **en el VPS** y ejecuta:
   ```powershell
   cd C:\Users\Administrator\Desktop\vps-agent
   .\create-vps-config.ps1
   ```

   El script te preguntará:
   - **Nombre del VPS**: Ejemplo: `VPS5`, `VPS6`, `VPS7`, etc.
   - **Cuenta FundedNext**: Número de cuenta o presiona Enter para omitir
   - **Cuenta Five Percent**: Número de cuenta o presiona Enter para omitir
   - **Cuenta FTMO**: Número de cuenta o presiona Enter para omitir

   **Ejemplo de uso:**
   ```
   Nombre del VPS (ej: VPS5, VPS6, etc.): VPS5
   ✅ Nombre del VPS: VPS5

   Cuenta FundedNext: 123456
   Cuenta Five Percent: 789012
   Cuenta FTMO: 345678

   ✅ Agregando agente FundedNext: 123456 (Puerto 8000)
   ✅ Agregando agente Five Percent: 789012 (Puerto 8001)
   ✅ Agregando agente FTMO: 345678 (Puerto 8002)
   ```

   - [ ] Carpeta vps-agent descargada de Google Drive
   - [ ] Carpeta vieja borrada del VPS (si existía)
   - [ ] Carpeta nueva copiada al VPS en `C:\Users\Administrator\Desktop\vps-agent`
   - [ ] Script `create-vps-config.ps1` ejecutado exitosamente
   - [ ] Archivo `agents.json` creado con las cuentas correctas

---

## 🚀 Despliegue e Inicio del Sistema

### Lista de Verificación por VPS

**VPS: __________ | IP: __________ | Fecha: __________**

#### Instalar Dependencias (Paso 1)
```powershell
cd C:\Users\Administrator\Desktop\vps-agent
python -m pip install -r requirements.txt
```
- [ ] Dependencias instaladas exitosamente
- [ ] Sin mensajes de error

#### Verificar Configuración (Paso 2)
```powershell
# Validar JSON
Get-Content agents.json | ConvertFrom-Json

# Verificar rutas de MT5
Test-Path "C:/Program Files/FundedNext MT5 Terminal/terminal64.exe"
Test-Path "C:/Program Files/Five Percent Online MetaTrader 5/terminal64.exe"
Test-Path "C:\Program Files\FTMO Global Markets MT5 Terminal\terminal64.exe"
```
- [ ] JSON es válido
- [ ] Las rutas de terminal MT5 existen (FundedNext, Five Percent, FTMO)
- [ ] El conteo de agentes coincide con lo esperado: __________

#### Crear Reglas de Firewall (Paso 3)
```powershell
# Crear reglas de entrada para cada puerto (ajustar puertos según tu configuración)
New-NetFirewallRule -DisplayName "VPS Agent Port 8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "VPS Agent Port 8001" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "VPS Agent Port 8002" -Direction Inbound -LocalPort 8002 -Protocol TCP -Action Allow
```
- [ ] Reglas de firewall creadas para todos los puertos
- [ ] Reglas verificadas en la configuración del Firewall de Windows

#### Verificar que los Puertos Estén Libres (Paso 4)
```powershell
# Verificar si los puertos están en uso
netstat -ano | findstr ":8000"
netstat -ano | findstr ":8001"
netstat -ano | findstr ":8002"

# Si algún puerto está en uso, matar el proceso (usar PID de la salida de netstat)
# taskkill /F /PID <NUMERO_PID>
```
- [ ] Todos los puertos requeridos están libres
- [ ] No se encontraron procesos en conflicto

#### Iniciar Launcher (Paso 5)
```powershell
python launcher.py
```
**Salida esperada:**
```
🚀 Starting X agent process(es)...
============================================================
  Starting VPSX-FundedNext on port 8000...
    ✅ Started (PID: XXXX)
  Starting VPSX-FivePercent on port 8001...
    ✅ Started (PID: YYYY)
  Starting VPSX-FTMO on port 8002...
    ✅ Started (PID: ZZZZ)
============================================================
```
- [ ] Launcher iniciado exitosamente
- [ ] Todos los agentes iniciados (PIDs anotados: __________)
- [ ] Sin bucles de crash o mensajes de error
- [ ] Sin errores de "puerto ya en uso" (Error 10048)

#### Esperar 60-90 Segundos para las Verificaciones de Salud

#### Verificar Chequeos de Salud (Paso 6)
```powershell
# Abrir otra ventana de PowerShell
cd C:\Users\Administrator\Desktop\vps-agent
python view_logs.py VPSX-FundedNext
```
**Buscar (cada 60 segundos):**
```
INFO: Running periodic health check for VPSX-FundedNext
INFO: Health check passed for [account]
```
- [ ] Chequeos de salud apareciendo cada 60 segundos
- [ ] Chequeos de salud pasando para todas las cuentas
- [ ] Sin errores de conexión

#### Probar Endpoints (Paso 7)
```powershell
Invoke-RestMethod -Uri http://localhost:8000/health
Invoke-RestMethod -Uri http://localhost:8001/health
Invoke-RestMethod -Uri http://localhost:8002/health
Invoke-RestMethod -Uri http://localhost:8000/accounts
Invoke-RestMethod -Uri http://localhost:8001/accounts
Invoke-RestMethod -Uri http://localhost:8002/accounts
```
- [ ] Endpoint /health responde (todos los puertos)
- [ ] Endpoint /accounts retorna datos (todos los puertos)
- [ ] Los datos de respuesta se ven correctos

#### Configurar Auto-Inicio (Paso 8)
```powershell
schtasks /create /tn "MT5Launcher" /tr "python C:\Users\Administrator\Desktop\vps-agent\launcher.py" /sc onstart /ru Administrator /rl HIGHEST /f
```
#### Verificación Post-Despliegue
- [ ] Launcher corriendo en ventana en primer plano
- [ ] Los chequeos de salud continúan cada 60 segundos
- [ ] Sin mensajes de error en los logs


---

## 📝 Notas Importantes

### Flujo de Deployment:

**Siempre sigue este orden:**
1. Descarga la carpeta `vps-agent` nueva de Google Drive
2. **Borra la carpeta vieja completa del VPS** (si existe)
3. Copia la carpeta nueva al VPS
4. Ejecuta `create-vps-config.ps1` para crear `agents.json`
5. Sigue los pasos 1-8 del deployment

### Solución de Problemas Comunes:

**Error 10048 - Puerto ya en uso:**
```powershell
# Ver qué está usando el puerto
netstat -ano | findstr ":8000"

# Matar proceso específico
taskkill /F /PID <NUMERO_PID>

# O matar todos los procesos Python
taskkill /F /IM python.exe
```

**Script create-vps-config.ps1 no se ejecuta:**
```powershell
# Habilitar ejecución de scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Luego volver a intentar
.\create-vps-config.ps1
```

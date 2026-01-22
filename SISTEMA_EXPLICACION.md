# Sistema de Monitoreo de Cuentas MT5

## ¿Qué es este sistema?

Este es un sistema de monitoreo en tiempo real que permite vigilar y gestionar múltiples cuentas de trading de MetaTrader 5 (MT5) distribuidas en diferentes servidores. Funciona como un panel de control centralizado donde puedes ver todas tus cuentas de trading en un solo lugar.

## ¿Qué problema resuelve?

Imagina que tienes múltiples cuentas de trading repartidas en 23 servidores VPS diferentes. Normalmente tendrías que:
- Conectarte manualmente a cada servidor
- Abrir cada terminal de MT5 individualmente
- Revisar cada cuenta una por una
- Anotar los balances y estados en una hoja de cálculo

**Esto toma mucho tiempo y es propenso a errores.**

Este sistema resuelve ese problema automatizando todo el proceso. Con solo abrir una página web, puedes ver todas tus cuentas, sus balances, estados de conexión, y mucho más.

---

## Componentes del Sistema

El sistema está formado por 3 partes principales:

### 1. Interfaz Web (Lo que ves en tu navegador)

Es la página web donde visualizas toda la información. Es como el tablero de un coche que te muestra la velocidad, combustible, etc.

**Lo que puedes hacer aquí:**
- Ver todas tus cuentas en una tabla organizada
- Buscar cuentas específicas por nombre, firma o número
- Ordenar las cuentas por balance, ganancias/pérdidas, titular, etc.
- Editar información como la fase de la cuenta (F1, F2, etc.)
- Ver el historial de operaciones de cada cuenta
- Exportar los datos a Excel
- Sincronizar todo con Google Sheets
- Usar el sistema desde tu celular o computadora

**Características visuales:**
- **Colores:** Las cuentas con ganancias se ven en verde, las que tienen pérdidas en rojo
- **Estado de conexión:** Un indicador muestra si cada cuenta está conectada o desconectada
- **Diseño adaptable:** Se ve bien tanto en computadora como en celular
- **Actualización automática:** Los datos se refrescan solos cada 10 minutos

---

### 2. Servidor Central (El cerebro del sistema)

Es el componente que se encarga de recopilar información de todos los servidores VPS y organizarla para que la veas en la interfaz web. Este servidor está alojado en **VPS1**, el mismo servidor que también ejecuta un agente de monitoreo.

**¿Qué hace?**
- Recoge datos de los 23 servidores VPS simultáneamente
- Combina toda la información en un solo lugar
- Guarda temporalmente los datos para que carguen más rápido (60 segundos)
- Gestiona las fases de las cuentas (F1, F2, WIN, etc.)
- Organiza las cuentas en grupos VS (Virtual Stop)
- Se conecta con Google Sheets para exportar datos
- Guarda el historial de operaciones de forma eficiente

**Información que gestiona:**
- Balance actual de cada cuenta
- Estado de conexión
- Días operando
- Ganancias o pérdidas (P/L)
- Fase de la cuenta
- Grupo VS asignado
- Firma de prop (FundedNext, The5ers, FTMO, etc.)
- Nombre del titular de la cuenta

---

### 3. Agentes VPS (Los recolectores de datos)

Son pequeños programas instalados en cada uno de los 23 servidores VPS. Cada servidor tiene una terminal de MT5 con cuentas de trading ya conectadas.

**Nota importante:** VPS1 tiene una función dual - aloja tanto el servidor central como un agente de monitoreo para sus propias cuentas MT5.

**¿Qué hacen?**
- Monitorean constantemente la terminal MT5 en su servidor
- Obtienen información en tiempo real: balance, estado, operaciones abiertas
- Calculan cuántos días ha estado operando cada cuenta
- Detectan si hay operaciones abiertas
- Recuperan el historial de operaciones cerradas
- Se reconectan automáticamente si pierden la conexión
- Envían todos estos datos al servidor central

**Características especiales:**
- **Auto-recuperación:** Si se desconectan, intentan reconectarse automáticamente
- **Verificación constante:** Revisan el estado cada 60 segundos
- **Sin interrupciones:** No interfieren con las operaciones de trading

---

### Arquitectura Especial de VPS1

VPS1 tiene un rol único y especial en el sistema:

**Función Dual:**
1. **Aloja el Servidor Central (Backend)**: Es el cerebro que coordina todo el sistema
2. **Ejecuta un Agente de Monitoreo**: También monitorea sus propias cuentas MT5 locales

**¿Por qué esta configuración?**
- **Eficiencia**: No necesita enviar datos a través de la red para sus propias cuentas
- **Optimización de recursos**: Un solo servidor cumple dos funciones
- **Centralización**: Todo el sistema se coordina desde un punto central

**En la práctica:**
Cuando el backend en VPS1 solicita datos de todas las cuentas, hace 23 llamadas en paralelo:
- 22 llamadas a VPS remotos (VPS2 a VPS23)
- 1 llamada local a su propio agente (sin salir de VPS1)

Esto hace el sistema más rápido y eficiente.

---

## ¿Cómo fluye la información?

Vamos a explicarlo como si fuera una cadena de restaurantes donde el cliente hace un pedido:

### Paso 1: El usuario solicita información
Abres tu navegador y entras a la página web del sistema. Al cargar la página, automáticamente se hace una solicitud de datos.

### Paso 2: El servidor central coordina
El servidor central recibe tu solicitud y se pregunta: "¿Tengo esta información reciente?"
- Si la tiene (menos de 60 segundos): Te la muestra de inmediato
- Si no la tiene o está desactualizada: Va a buscarla

### Paso 3: Se contactan los 23 servidores VPS simultáneamente
El servidor central (ubicado en VPS1) no espera uno por uno, sino que contacta a todos los VPS **al mismo tiempo** (como hacer 23 llamadas telefónicas a la vez). Esto incluye su propio agente local en VPS1.

### Paso 4: Cada VPS responde con sus datos
Cada agente VPS:
1. Revisa su terminal MT5
2. Obtiene la información de la cuenta (balance, estado, etc.)
3. Cuenta cuántos días ha estado operando
4. Verifica si hay operaciones abiertas
5. Envía toda esta información de vuelta al servidor central

### Paso 5: El servidor central organiza la información
Una vez que recibe datos de todos los VPS:
- Combina toda la información en una lista
- Añade datos adicionales como la fase (F1, F2, etc.)
- Añade los grupos VS
- Calcula las ganancias/pérdidas en porcentaje
- Guarda una copia para futuras solicitudes (60 segundos)

### Paso 6: La información llega a tu pantalla
El servidor central envía todos los datos organizados a tu navegador, donde se muestran en una tabla bonita y fácil de leer.

**Todo este proceso toma solo unos segundos.**

---

## Funcionalidades Principales

### 1. Monitoreo de Cuentas en Tiempo Real

**¿Qué ves?**
- **Balance actual** de cada cuenta
- **Estado de conexión** (conectada/desconectada)
- **Días operando**: Cuántos días ha estado activa la cuenta
- **Ganancias/Pérdidas (P/L)**: Cuánto has ganado o perdido
- **Porcentaje de P/L**: El rendimiento en porcentaje
- **Posiciones abiertas**: Si tiene operaciones activas
- **Titular**: Quién maneja la cuenta
- **Firma**: Con qué empresa de prop trading (FundedNext, The5ers, FTMO, etc.)

**Características especiales:**
- **Colores inteligentes**: Verde para ganancias, rojo para pérdidas
- **Indicadores de estado**: Símbolos que muestran si está conectada
- **Búsqueda rápida**: Busca por firma, titular o número de cuenta
- **Filtros**: Muestra solo cuentas con operaciones abiertas o cerradas

---

### 2. Gestión de Fases

Las fases son etiquetas que te ayudan a identificar en qué estado está cada cuenta.

**Fases disponibles:**
- **F1**: Fase 1 (primera etapa de evaluación)
- **F2**: Fase 2 (segunda etapa de evaluación)
- **R**: Recuperación (cuenta que está en drawdown)
- **WIN**: Ganadora (cuenta que está generando ganancias)
- **Números personalizados**: Cualquier otro valor que necesites

**¿Cómo funciona?**
1. Activas el "Modo de edición" con un botón
2. Haces clic en la fase de cualquier cuenta
3. Seleccionas la nueva fase
4. Los cambios se guardan automáticamente
5. Todas tus cuentas se actualizan con la nueva información

**Persistencia:**
Los datos de fases se guardan en un archivo llamado `phases.json`, así que nunca se pierden aunque reinicies el sistema.

---

### 3. Grupos VS (Virtual Stop)

Los grupos VS te permiten organizar las cuentas en grupos de máximo 2 cuentas. Esto es útil para gestionar el riesgo conjunto de cuentas relacionadas.

**¿Cómo funcionan?**
- **Agrupación automática**: El sistema calcula automáticamente grupos basándose en el balance
- **Agrupación manual**: Puedes asignar grupos manualmente si lo prefieres
- **Límite de 2 cuentas**: Cada grupo VS puede tener máximo 2 cuentas
- **Prioridad manual**: Si asignas un grupo manualmente, ese tiene prioridad sobre el automático

**Ejemplo:**
- Cuenta A (VS-1) y Cuenta B (VS-1) están en el mismo grupo
- Si una pierde mucho, puedes cerrar ambas para limitar pérdidas
- El sistema te muestra ambos valores: VS auto y VS manual

**Persistencia:**
Los grupos VS se guardan en `vs_data.json` y nunca se pierden.

---

### 4. Historial de Operaciones

Puedes ver todas las operaciones cerradas de cualquier cuenta.

**Información que muestra:**
- **Símbolo**: Par de divisas (EUR/USD, GBP/JPY, etc.)
- **Tipo**: Compra (BUY) o Venta (SELL)
- **Lotes**: Tamaño de la operación
- **Precio de entrada**: A qué precio abriste
- **Precio de salida**: A qué precio cerraste
- **Pips**: Cuántos pips ganaste o perdiste
- **Comisión**: Costo de la operación
- **Ganancia/Pérdida**: Resultado final en dinero
- **Fechas**: Cuándo abriste y cerraste la operación

**Sistema inteligente de caché:**
- **Primera vez**: Carga las operaciones de los últimos 30 días
- **Siguientes veces**: Solo carga las operaciones nuevas desde la última vez
- Esto hace que sea muy rápido y no sobrecargue los servidores

---

### 5. Integración con Google Sheets

Puedes exportar toda la información a una hoja de cálculo de Google Sheets con un solo clic.

**¿Qué se exporta?**
- Todos los datos de todas las cuentas
- El historial de operaciones
- Formato bonito con colores (verde=ganancias, rojo=pérdidas)
- Encabezados con fondo oscuro
- Fecha y hora de la última sincronización

**Ventajas:**
- Puedes compartir el enlace con tu equipo
- Se actualiza cada vez que sincronizas
- Puedes hacer análisis adicionales en Excel/Sheets
- Los datos están siempre disponibles en la nube

---

### 6. Búsqueda y Filtros

El sistema tiene herramientas poderosas para encontrar lo que necesitas rápidamente.

**Búsqueda:**
Escribe en la barra de búsqueda para filtrar por:
- Nombre de la firma (FundedNext, The5ers, FTMO)
- Nombre del titular (Yojan, Leandro, etc.)
- Número de cuenta

**Ordenamiento:**
Puedes ordenar las cuentas por:
- **Mayor P/L**: Las cuentas más rentables primero
- **Menor P/L**: Las cuentas con más pérdidas primero
- **Grupos VS**: Agrupadas por VS
- **Titular A-Z**: Alfabéticamente por titular

**Filtro de operaciones abiertas:**
- **Todas**: Muestra todas las cuentas
- **Con operaciones abiertas**: Solo las que tienen trades activos
- **Sin operaciones abiertas**: Solo las que no tienen trades activos

---

### 7. Diseño Móvil

El sistema se adapta perfectamente a cualquier dispositivo.

**En computadora:**
- Tabla completa con todas las columnas
- Fácil de editar y navegar
- Espacio para mostrar toda la información

**En celular:**
- Vista de tarjetas (cards)
- Información organizada verticalmente
- Botones grandes y fáciles de tocar
- Todos los filtros y búsquedas disponibles

---

## Sistema de Actualización

### Actualización Manual
Hay un botón de "Refrescar" que puedes presionar en cualquier momento para obtener los datos más recientes.

### Actualización Automática Silenciosa
Cada 10 minutos, el sistema actualiza los datos automáticamente en segundo plano sin que te des cuenta. Esto mantiene la información fresca sin que tengas que hacer nada.

### Caché Inteligente
Para que la página cargue rápido, el servidor guarda los datos durante 60 segundos. Si dos personas abren la página al mismo tiempo, ambas ven los mismos datos sin tener que consultar todos los VPS dos veces.

---

## Sistema de Recuperación Automática

### Reconexión de VPS Agents
Si un agente VPS pierde la conexión con su terminal MT5:
1. Lo detecta automáticamente
2. Espera 2 segundos y lo intenta de nuevo
3. Si falla de nuevo, espera 4 segundos
4. Si falla de nuevo, espera 8 segundos
5. Después de 3 intentos fallidos, marca la cuenta como "desconectada"

### Monitoreo de Salud
Cada 60 segundos, cada agente VPS verifica que todo esté funcionando correctamente. Si detecta un problema, intenta solucionarlo solo.

---

## Seguridad y Privacidad

### Credenciales Protegidas
- Las contraseñas y claves de acceso están en archivos separados que **nunca** se suben a internet
- El archivo `.gitignore` asegura que datos sensibles no se compartan accidentalmente
- Las credenciales de Google Sheets están protegidas y no se exponen

### Acceso Controlado
- Solo personas autorizadas pueden acceder al sistema
- Los servidores VPS requieren autenticación
- El servidor central valida todas las solicitudes

---

## Arquitectura del Sistema (Simplificada)

```
[Tu Navegador]
    ↓ (Solicita datos)
[Servidor Central alojado en VPS1]
    ↓ (Pregunta a todos los VPS en paralelo)
[23 Servidores VPS respondiendo simultáneamente]
    VPS-1 → [Backend Central + Agente] → Terminal MT5 → Cuenta(s)
    VPS-2 → Agente → Terminal MT5 → Cuenta(s)
    VPS-3 → Agente → Terminal MT5 → Cuenta(s)
    VPS-4 → Agente → Terminal MT5 → Cuenta(s)
    ... (hasta VPS-23)
    ↓ (Todos responden al mismo tiempo)
[Servidor Central en VPS1 combina datos]
    ↓ (Envía datos organizados)
[Tu Navegador muestra la información]
```

**Nota:** VPS1 tiene un rol especial porque aloja tanto el backend central (cerebro del sistema) como un agente de monitoreo para sus propias cuentas MT5.

---

## Flujo de Trabajo Típico

### Escenario 1: Ver todas las cuentas

1. Abres el navegador y entras a la página
2. La página carga y muestra todas las cuentas en 2-3 segundos
3. Ves balances, estados, y P/L de todas las cuentas
4. Identificas rápidamente cuáles van bien (verde) y cuáles van mal (rojo)

### Escenario 2: Actualizar la fase de una cuenta

1. Activas el "Modo de edición"
2. Haces clic en la fase actual de una cuenta (ej: "F1")
3. Seleccionas la nueva fase (ej: "F2")
4. El cambio se guarda automáticamente
5. Desactivas el modo de edición
6. La próxima vez que abras la página, el cambio seguirá ahí

### Escenario 3: Ver historial de operaciones

1. Haces clic en una cuenta
2. Se abre un modal con detalles de la cuenta
3. Haces clic en "Ver Operaciones"
4. Se abre otra ventana mostrando todas las operaciones cerradas
5. Puedes ver ganancias, pérdidas, pips, fechas, etc.
6. Cierras la ventana cuando termines

### Escenario 4: Exportar a Google Sheets

1. Haces clic en el botón "Sync to Google Sheets"
2. El sistema envía todos los datos a Google Sheets
3. Aparece un mensaje de éxito con un enlace
4. Haces clic en el enlace para ver la hoja de cálculo
5. Compartes el enlace con tu equipo si quieres

### Escenario 5: Buscar una cuenta específica

1. Escribes "FundedNext" en la barra de búsqueda
2. La tabla se filtra automáticamente
3. Solo ves las cuentas de FundedNext
4. Borras la búsqueda para ver todas de nuevo

---

## Mantenimiento y Configuración

### Archivos de Datos Importantes

1. **`phases.json`**: Guarda las fases de cada cuenta
2. **`vs_data.json`**: Guarda los grupos VS manuales
3. **`trade_cache.json`**: Guarda el historial de operaciones
4. **`.env`**: Configuración del servidor (contraseñas, URLs, etc.)
5. **`credentials.json`**: Credenciales de Google Sheets

### ¿Qué pasa si se reinicia el servidor?

**No hay problema.** Todos los datos importantes están guardados en archivos:
- Las fases se mantienen
- Los grupos VS se mantienen
- El historial de operaciones se mantiene
- Solo se pierde el caché temporal de 60 segundos (que no es crítico)

---

## Ventajas del Sistema

1. **Ahorro de tiempo**: Ver 21 cuentas en segundos en lugar de horas
2. **Centralización**: Todo en un solo lugar
3. **Tiempo real**: Datos actualizados constantemente
4. **Acceso desde cualquier lugar**: Solo necesitas internet
5. **Dispositivo flexible**: Funciona en computadora, tablet y celular
6. **Gestión inteligente**: Fases, grupos VS, búsquedas, filtros
7. **Exportación fácil**: Excel y Google Sheets con un clic
8. **Historial completo**: Todas tus operaciones guardadas
9. **Auto-recuperación**: Si algo falla, se arregla solo
10. **Persistencia**: Tus datos nunca se pierden

---

## Limitaciones y Consideraciones

### Límites del Sistema

1. **Caché de 60 segundos**: Los datos pueden tener hasta 1 minuto de retraso (a menos que refresques manualmente)
2. **Requiere conexión**: Los VPS y el servidor central deben estar conectados a internet
3. **Dependencia de MT5**: Si MT5 falla, el sistema no puede obtener datos
4. **Máximo 2 por grupo VS**: No puedes tener más de 2 cuentas en un grupo VS

### Cosas que Considerar

1. **Costos de servidores**: Los 23 servidores VPS tienen costos mensuales (VPS1 aloja tanto el backend central como un agente)
2. **Mantenimiento ocasional**: Puede requerir actualizaciones de seguridad
3. **Configuración inicial**: Necesita configurarse correctamente al inicio
4. **Credenciales de Google**: Requiere configurar la integración con Google Sheets

---

## Soporte y Recursos

### Archivos de Documentación

- **`GOOGLE_SHEETS_SETUP.md`**: Cómo configurar Google Sheets
- **`README.md`**: Información general del proyecto
- **Archivos `.md` adicionales**: Guías técnicas para desarrolladores

### Contacto y Ayuda

Si algo no funciona o tienes preguntas, puedes:
1. Revisar los logs del servidor central
2. Verificar el estado de los VPS agents
3. Consultar la documentación técnica
4. Contactar al administrador del sistema

---

## Conclusión

Este sistema es una **solución completa y automatizada** para monitorear múltiples cuentas de trading desde un solo lugar. Combina:

- **Interfaz web intuitiva** → Fácil de usar
- **Servidor central inteligente (VPS1)** → Organiza y gestiona todo desde un servidor dedicado
- **23 Agentes VPS distribuidos** → Recopilan datos en tiempo real de todas las cuentas
- **Arquitectura híbrida** → VPS1 ejecuta tanto el backend central como un agente de monitoreo
- **Persistencia de datos** → Nunca pierdes información
- **Auto-recuperación** → Se mantiene funcionando solo
- **Integración con Google Sheets** → Exporta y comparte fácilmente

Con este sistema, puedes gestionar eficientemente todas tus cuentas de prop trading distribuidas en 23 servidores VPS sin tener que abrir múltiples terminales o revisar cada cuenta manualmente. Todo está a solo un clic de distancia.

# ReKestMe — Gestión de solicitudes de software en aulas

TFG 2º DAW · Aplicación web MVC en PHP puro + API REST + Frontend JS vanilla

---

## Stack tecnológico

| Capa       | Tecnología                       |
|------------|----------------------------------|
| Backend    | PHP 8+, PDO                      |
| Base de datos | MySQL 8                       |
| Frontend   | HTML5, CSS3, Bootstrap 5, JS ES6 |
| Librerías CDN | Chart.js, Day.js, Flatpickr, Sortable.js, jsPDF + AutoTable, SheetJS |
| API        | REST JSON                        |

---

## Estructura de carpetas

```
rekestme/
├── backend/
│   ├── config/Database.php         # Conexión PDO (Singleton)
│   ├── config/ApiKeys.php          # Clave API Gemini — NO subir a git (ver .gitignore)
│   ├── config/ApiKeys.example.php  # Plantilla vacía para el repo
│   ├── controllers/                # AuthController, SolicitudController, AulaController,
│   │                               # SoftwareController, AsignacionController, UserController,
│   │                               # ComentarioController, NotificacionController,
│   │                               # EstadisticaController, ChatController, ChatbotController,
│   │                               # OrdenadorController
│   ├── models/                     # User, Solicitud, Aula, Software,
│   │                               # HistorialEstado, Comentario, Notificacion, ChatMensaje,
│   │                               # Ordenador
│   ├── middleware/Auth.php         # JWT (Bearer) + sesión PHP como fallback
│   ├── helpers/Response.php        # Respuestas JSON estandarizadas
│   ├── helpers/JWT.php             # JWT HS256 sin librerías externas
│   ├── helpers/AIClient.php        # Proxy IA → Google Gemini vía cURL
│   └── index.php                   # Router principal
├── frontend/
│   ├── css/styles.css
│   ├── js/api.js                   # Módulo fetch centralizado (JWT en localStorage)
│   ├── js/auth.js                  # Login / registro
│   ├── js/profesor.js              # Dashboard profesor (notificaciones + edición perfil + mapa PCs)
│   ├── js/tic.js                   # Dashboard TIC (notificaciones + Chart.js + chat + edición perfil + mapa PCs)
│   ├── js/tic-chat.js              # Chat privado 1 a 1 estilo WhatsApp (polling 5s)
│   ├── js/chatbot.js               # Chatbot IA flotante (Google Gemini, capa gratuita)
│   ├── js/aula-mapa.js             # Mapa visual de PCs por aula (gestión TIC + selección profesor)
│   └── pages/                      # HTML de cada vista
└── database/
    ├── schema.sql                   # Tablas y relaciones
    ├── seed.sql                     # Datos de prueba
    └── migration_ordenadores.sql    # Migración: mapa de PCs (ejecutar sobre BD existente)
```

---

## Instalación

### 1. Base de datos

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

### 2. Servidor web (XAMPP / WAMP)

Copia la carpeta `rekestme/` dentro de `htdocs/` (XAMPP) o `www/` (WAMP).

### 3. Configurar la conexión

Edita `backend/config/Database.php` con tus credenciales MySQL:

```php
private static string $host   = 'localhost';
private static string $dbName = 'rekestme';
private static string $user   = 'root';
private static string $pass   = '';
```

### 4. Ejecutar migración de Google Auth

```sql
SOURCE database/migration_google_auth.sql
```

### 5. Configurar claves externas

Copia la plantilla y rellena las claves en `backend/config/ApiKeys.php`:

```bash
cp backend/config/ApiKeys.example.php backend/config/ApiKeys.php
```

| Constante | Descripción |
|---|---|
| `GEMINI_API_KEY` | Google Gemini (chatbot IA) — [aistudio.google.com](https://aistudio.google.com) |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID — [console.cloud.google.com](https://console.cloud.google.com) |
| `SMTP_USER` / `SMTP_PASS` | Cuenta Gmail + App Password para envío de emails |

También reemplaza `GOOGLE_CLIENT_ID_PLACEHOLDER` en `frontend/pages/login.html` por el Client ID real.

### 6. Acceso

Abre `http://localhost/rekestme/frontend/pages/login.html`

---

---

## Usuarios de prueba

| Email                          | Contraseña   | Rol     |
|--------------------------------|--------------|---------|
| ana.garcia@instituto.es        | password | Profesor|
| carlos.martinez@instituto.es   | password | Profesor|
| david.lopez@instituto.es       | password | TIC     |
| admin@instituto.es             | password | Admin   |

---

## Endpoints de la API

```
POST   /api/auth/login                          # Devuelve usuario + JWT token
POST   /api/auth/google                         # Login con Google (ID token GIS); solo si el email ya existe en BD
POST   /api/auth/forgot-password                # Genera nueva contraseña aleatoria y la envía por email
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/solicitudes
GET    /api/solicitudes/{id}
POST   /api/solicitudes
PUT    /api/solicitudes/{id}
PUT    /api/solicitudes/{id}/estado             # Registra historial + notifica profesor
DELETE /api/solicitudes/{id}
GET    /api/solicitudes/{id}/comentarios
POST   /api/solicitudes/{id}/comentarios        # { mensaje, es_interno? }

GET    /api/aulas
POST   /api/aulas
PUT    /api/aulas/{id}
DELETE /api/aulas/{id}
GET    /api/aulas/{id}/ordenadores          # PCs del aula con software instalado
POST   /api/aulas/{id}/ordenadores          # Crear PC(s): lote { cantidad, columnas } o individual { nombre, fila, columna }
PUT    /api/ordenadores/{id}                # Actualizar nombre/estado del PC (solo TIC/admin)
DELETE /api/ordenadores/{id}               # Eliminar PC (solo TIC/admin)

GET    /api/software
POST   /api/software
PUT    /api/software/{id}
DELETE /api/software/{id}

POST   /api/asignaciones
PUT    /api/asignaciones/{id}/completar

GET    /api/users                               # Solo admin
POST   /api/users                               # Crear usuario (solo admin); genera contraseña y envía email
PUT    /api/users/{id}
GET    /api/users/me                            # Perfil propio (todos los roles)
PUT    /api/users/me                            # Actualizar nombre/apellidos/email
PUT    /api/users/me/password                   # Cambiar contraseña

GET    /api/notificaciones                      # { notificaciones[], no_leidas }
PUT    /api/notificaciones/{id}/leer
PUT    /api/notificaciones/leer-todas
DELETE /api/notificaciones/{id}                 # Eliminar notificación propia
DELETE /api/notificaciones                      # Eliminar todas las notificaciones del usuario

GET    /api/estadisticas                        # Solo TIC/admin

GET    /api/chat/usuarios                       # Contactos TIC/admin con último mensaje
GET    /api/chat/{id}/mensajes?desde_id=N       # Mensajes de conversación (incremental)
POST   /api/chat/{id}/mensajes                  # Enviar mensaje privado
PUT    /api/chat/{id}/leer                      # Marcar conversación como leída
GET    /api/chat/no-leidos                      # Total no leídos (badge navbar)
```

Todas las respuestas tienen el formato:
```json
{
  "success": true,
  "data": { },
  "message": "Descripción",
  "errors": []
}
```

## Autenticación

La API acepta dos métodos en paralelo:

1. **Sesión PHP** (cookie) — activa por defecto con `credentials: 'include'`
2. **JWT** — enviado como `Authorization: Bearer {token}`; el token se obtiene en `/api/auth/login` y se guarda en `localStorage`

## Despliegue en AWS (producción)

| Recurso | Valor |
|---|---|
| **URL de la app** | http://rekestme.duckdns.org/rekestme/frontend/pages/login.html |
| **EC2** | t2.micro, Ubuntu 22.04, us-east-1 |
| **RDS** | db.t3.micro, MySQL 8.0, sin IP pública |
| **Elastic IP** | 34.231.84.48 (fija, no cambia entre reinicios) |
| **RDS Endpoint** | rekestme-db.cjmyatmgtofr.us-east-1.rds.amazonaws.com |

> El despliegue usa AWS Academy Learner Lab. Para encender/apagar: "Start Lab" / "End Lab". Los datos se conservan entre sesiones.

---

## Funcionalidades destacadas

| Funcionalidad | Descripción |
|---|---|
| Historial de estados | Cada cambio de estado queda registrado en `historial_estados` con usuario y fecha |
| Comentarios | Hilo de comentarios por solicitud; TIC puede marcarlos como internos (invisibles para profesores) |
| Notificaciones | Badge en tiempo real en el navbar; polling cada 30 s; panel con botón × por notificación y "Borrar todas"; endpoints DELETE en la API |
| Estadísticas Chart.js | Tab exclusivo TIC/admin: donut por estado, top 5 software, evolución mensual, top 5 aulas |
| Chat privado TIC | Mensajería 1 a 1 estilo WhatsApp entre personal TIC/admin; sidebar de contactos + polling 5 s incremental |
| Edición de perfil | Cualquier usuario puede editar su nombre, apellidos, email y contraseña desde el modal de perfil |
| JWT HS256 | Implementación manual en `backend/helpers/JWT.php` sin librerías externas; dual auth con sesión PHP |
| Mapa de PCs por aula | Cuadrícula visual de ordenadores por aula; TIC gestiona nombre/estado; profesor selecciona PCs al crear solicitud |
| Software instalado por PC | Al completar una solicitud, el software se registra automáticamente en los PCs asociados (`ordenador_software`) |
| Solicitudes inmutables para el profesor | Una vez enviada, el profesor no puede editar ni eliminar su solicitud; se muestra modal de confirmación Bootstrap antes del envío |
| Kanban de solicitudes (TIC) | Las solicitudes activas se muestran en un tablero Kanban de 4 columnas simétricas (Pendiente, En revisión, Aprobada, En instalación); buscador en tiempo real; click en tarjeta abre gestión; las tarjetas muestran "Solicitante:", "Técnico:" (si asignado) y "Límite:" |
| Flujo secuencial de estados | Al gestionar una solicitud, solo se muestran los estados válidos siguientes (estilo Odoo): Pendiente→En revisión→Aprobada→En instalación→Completada; no se puede saltar pasos; el técnico encargado se asigna obligatoriamente al pasar de Aprobada a En instalación (en otros estados el selector está oculto) |
| Kanban con drag & drop (TIC) | Las tarjetas del kanban se pueden arrastrar entre columnas con Sortable.js; las transiciones inválidas revierten automáticamente con un aviso; la transición Aprobada→En instalación abre el modal de gestión para obligar la asignación de técnico |
| Historial de solicitudes (TIC) | Botón engranaje junto al título abre un modal con todas las solicitudes completadas y rechazadas; filtro por estado y buscador de texto; permite ver detalle o eliminar con aviso de pérdida permanente |
| Exportar a PDF | Botón "Exportar PDF" en la pestaña Estadísticas genera un informe con KPIs, solicitudes por estado y top software (jsPDF + AutoTable) |
| Exportar a Excel | Botón "Exportar Excel" en la pestaña Estadísticas exporta todas las solicitudes con sus datos a un fichero `.xlsx` (SheetJS) |
| Timestamps relativos | Las notificaciones y el sidebar del chat muestran tiempos relativos ("hace 2 min", "ayer") con Day.js; el tooltip muestra la fecha exacta |
| Selector de fecha mejorado | El campo "Fecha necesaria" en el formulario del profesor usa Flatpickr (locale ES, fechas pasadas bloqueadas, formato `d/m/Y` en pantalla y `Y-m-d` en la API) |
| Confirmaciones Bootstrap | Todos los diálogos de confirmación de borrado usan un modal Bootstrap genérico en lugar del `confirm()` del navegador |
| Login/Registro rediseñados | Páginas de autenticación con diseño split-screen (panel izquierdo con gradiente azul + círculos flotantes animados, panel derecho con formulario); sin dependencia de Bootstrap en esas páginas; compatible con `auth.js` |
| Login con Google | Botón Google Identity Services en la página de login; el backend verifica el ID token con la API de Google y comprueba que el email existe en la BD antes de crear la sesión |
| Gestión de usuarios por admin | El registro público está deshabilitado; solo el admin puede crear usuarios desde el panel (tab Usuarios → botón "Crear usuario"); se genera una contraseña aleatoria y se envía al correo del nuevo usuario via SMTP |
| Recuperación de contraseña | El modal "¿Olvidaste tu contraseña?" llama a `POST /api/auth/forgot-password`; genera una nueva contraseña aleatoria, la guarda hasheada en BD y la envía por email (PHPMailer + Gmail SMTP) |
| Campo Planta como desplegable | El campo "Planta" en los formularios de añadir y editar aula es un `<select>` con opciones de Sótano 2 (−2) a Octava (8), evitando valores de texto libre inconsistentes |
| Modales propios en el mapa de PCs | `aula-mapa.js` inyecta sus propios modales Bootstrap para confirmar la eliminación de un PC y para introducir el nombre al añadir uno nuevo; elimina el uso de `confirm()` y `prompt()` nativos del navegador |
| Vista centro en dashboard TIC | El tab "Aulas" incluye dos vistas: "Gestión" (tabla editable) y "Vista centro" (grid de tarjetas igual que ve el profesor); el TIC puede alternar con pills Bootstrap nativos; al hacer click en una tarjeta se abre el mapa en modo TIC editable; el buscador filtra ambas vistas simultáneamente |
| Exportar PDF de PCs por aula | En el modal del mapa de PCs (dashboard TIC), botón "Exportar PDF" despliega un panel con 4 checkboxes de estado (averiado y sin monitor marcados por defecto); genera un PDF A4 con cabecera, datos del aula, filtros aplicados y tabla de PCs (nombre, fila, columna, estado, software instalado) usando jsPDF + AutoTable |
| Inventario de hardware | Al crear una categoría se indica nombre + cantidad → se generan N unidades automáticamente ("Ratón 1", "Ratón 2"…); el stock se calcula automáticamente contando items; se pueden añadir más unidades a una categoría existente continuando la numeración; edición de nombre y estado por unidad individual; layout dos paneles |
| Gestión manual de software en PCs | Desde el panel lateral del mapa de PCs (solo TIC/admin), se puede añadir software del catálogo a cualquier PC, importar software seleccionado de otro PC del mismo aula o eliminar software instalado; cada entrada muestra su origen (Solicitud / Manual / Importado) con colores distintos |

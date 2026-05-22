# Despliegue de ReKestMe

Guía completa para ejecutar ReKestMe en dos entornos: **desarrollo local con XAMPP** y **producción en AWS**.

---

## Índice

1. [Entorno local — XAMPP](#1-entorno-local--xampp)
   - [Requisitos](#11-requisitos)
   - [Instalación paso a paso](#12-instalación-paso-a-paso)
   - [Acceder a la aplicación](#13-acceder-a-la-aplicación)
   - [Usuarios de prueba](#14-usuarios-de-prueba)
2. [Producción — AWS Academy](#2-producción--aws-academy)
   - [Arquitectura](#21-arquitectura-desplegada)
   - [Pasos resumidos](#22-pasos-resumidos)
   - [Encender el Learner Lab](#23-encender-el-learner-lab)
3. [Variables de entorno y claves API](#3-variables-de-entorno-y-claves-api)
4. [Actualizar el código en producción](#4-actualizar-el-código-en-producción)
5. [Diferencias entre entornos](#5-diferencias-entre-entornos)

---

## 1. Entorno local — XAMPP

### 1.1 Requisitos

| Componente | Versión mínima | Incluido en XAMPP |
|---|---|---|
| Apache | 2.4 | ✅ |
| PHP | 8.0+ | ✅ |
| MySQL | 8.0 | ✅ |
| phpMyAdmin | cualquiera | ✅ |
| Navegador moderno | Chrome 100+ / Firefox 100+ | — |

> **XAMPP descarga:** [apachefriends.org](https://www.apachefriends.org) — versión 8.2.x recomendada.

---

### 1.2 Instalación paso a paso

#### Paso 1: Clonar o copiar el proyecto

**Opción A — desde GitHub:**
```bash
cd C:\xampp\htdocs
git clone https://github.com/jimenezsarangowilliam-code/rekestme
```

**Opción B — copia manual:**
Copiar la carpeta `rekestme/` dentro de `C:\xampp\htdocs\`.

La estructura final debe ser:
```
C:\xampp\htdocs\rekestme\
├── backend\
├── frontend\
├── database\
└── ...
```

---

#### Paso 2: Iniciar XAMPP

1. Abrir **XAMPP Control Panel**
2. Iniciar **Apache** → botón `Start`
3. Iniciar **MySQL** → botón `Start`
4. Verificar que ambos aparezcan en verde

---

#### Paso 3: Crear la base de datos

**Opción A — phpMyAdmin (recomendado):**

1. Abrir `http://localhost/phpmyadmin`
2. Clic en **Nueva** (panel izquierdo)
3. Nombre de la BD: `rekestme` → cotejamiento: `utf8mb4_unicode_ci` → **Crear**
4. Seleccionar la BD `rekestme` → pestaña **Importar**
5. Importar `database/schema.sql` → **Continuar**
6. Volver a **Importar** → importar `database/seed.sql` → **Continuar**

**Opción B — línea de comandos:**
```bash
# Abrir terminal en C:\xampp\mysql\bin\
mysql -u root -p -e "CREATE DATABASE rekestme CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p rekestme < C:\xampp\htdocs\rekestme\database\schema.sql
mysql -u root -p rekestme < C:\xampp\htdocs\rekestme\database\seed.sql
```

---

#### Paso 4: Configurar la conexión a la base de datos

Editar `backend/config/Database.php`:

```php
private static string $host   = 'localhost';
private static string $dbName = 'rekestme';
private static string $user   = 'root';
private static string $pass   = '';        // XAMPP no tiene contraseña por defecto
private static string $charset = 'utf8mb4';
```

---

#### Paso 5: Configurar las claves API (opcional en local)

Crear el archivo `backend/config/ApiKeys.php` a partir de la plantilla:

```bash
copy backend\config\ApiKeys.example.php backend\config\ApiKeys.php
```

Editar con tus claves (ver sección §3 para obtenerlas):

```php
<?php
define('GEMINI_API_KEY',     'AIza...');                    // Google AI Studio
define('GEMINI_MODEL',       'gemini-2.5-flash');
define('CHATBOT_MAX_TOKENS', 1024);
define('GOOGLE_CLIENT_ID',   '123....apps.googleusercontent.com');  // Google Cloud Console
define('SMTP_HOST',          'smtp.gmail.com');
define('SMTP_PORT',          587);
define('SMTP_USER',          'tu@gmail.com');
define('SMTP_PASS',          'xxxx xxxx xxxx xxxx');        // App Password Gmail
define('SMTP_FROM',          'tu@gmail.com');
define('SMTP_FROM_NAME',     'ReKestMe');
```

> Sin este archivo, el chatbot IA y el login con Google no funcionarán, pero el resto de la aplicación sí.

---

### 1.3 Acceder a la aplicación

| Vista | URL |
|---|---|
| Login | `http://localhost/rekestme/frontend/pages/login.html` |
| Dashboard (tras login) | redirige automáticamente según rol |
| phpMyAdmin | `http://localhost/phpmyadmin` |

---

### 1.4 Usuarios de prueba

| Email | Contraseña | Rol |
|---|---|---|
| admin@instituto.es | Password123! | Admin |
| david.lopez@instituto.es | Password123! | TIC |
| elena.jimenez@instituto.es | Password123! | TIC |
| ana.garcia@instituto.es | Password123! | Profesor |
| carlos.martin@instituto.es | Password123! | Profesor |

---

## 2. Producción — AWS Academy

### 2.1 Arquitectura desplegada

```
Internet
    │
    ▼
rekestme.duckdns.org  →  34.231.84.48 (Elastic IP fija)
    │
    ▼
EC2 t2.micro — Ubuntu 22.04 LTS — us-east-1b (N. Virginia)
  Apache 2.4 + PHP 8.2 + mod_rewrite
  /var/www/html/rekestme
    │
    │  Puerto 3306 (red privada — sin acceso desde Internet)
    ▼
RDS db.t3.micro — MySQL 8.0
  Endpoint: rekestme-db.cjmyatmgtofr.us-east-1.rds.amazonaws.com
  Base de datos: rekestme
```

| Recurso | Valor |
|---|---|
| URL de acceso | `http://rekestme.duckdns.org/rekestme/frontend/pages/login.html` |
| Elastic IP | 34.231.84.48 |
| Región | us-east-1 (N. Virginia) |
| Tier | Free Tier (AWS Academy Learner Lab) |

---

### 2.2 Pasos resumidos

El proceso completo de despliegue en AWS está documentado en [`docs/DESPLIEGUE-AWS.md`](docs/DESPLIEGUE-AWS.md). Resumen de los pasos:

| Paso | Acción |
|---|---|
| 1 | Iniciar AWS Academy Learner Lab |
| 2 | Crear Security Groups (EC2 + RDS) |
| 3 | Lanzar instancia RDS MySQL 8.0 |
| 4 | Lanzar instancia EC2 Ubuntu 22.04 |
| 5 | Asignar Elastic IP a EC2 |
| 6 | Conectar por SSH → instalar Apache + PHP 8.2 |
| 7 | Configurar Apache (mod_rewrite + VirtualHost) |
| 8 | Clonar repo → `git clone` en `/var/www/html/rekestme` |
| 9 | Importar BD → `schema.sql` + `seed.sql` en RDS |
| 10 | Configurar `Database.php` con endpoint RDS |
| 11 | Crear `ApiKeys.php` con claves Gemini + OAuth + Gmail |
| 12 | Configurar dominio gratuito en DuckDNS |
| 13 | Registrar dominio en Google OAuth Console |

---

### 2.3 Encender el Learner Lab

El Learner Lab de AWS Academy se apaga automáticamente. Para encenderlo:

1. Acceder a **AWS Academy** → curso → **Laboratorio para el alumnado**
2. Clic en **"Start Lab"** y esperar ~2 minutos hasta que el LED **AWS** sea verde
3. Abrir la aplicación: `http://rekestme.duckdns.org/rekestme/frontend/pages/login.html`
4. Al terminar: clic en **"End Lab"** para conservar datos y Elastic IP

> **No detener** las instancias EC2/RDS directamente desde la consola AWS — usar siempre "End Lab".

---

## 3. Variables de entorno y claves API

| Clave | Cómo obtenerla | Coste |
|---|---|---|
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → Create API Key | Gratuito (capa free) |
| `GOOGLE_CLIENT_ID` | [console.cloud.google.com](https://console.cloud.google.com) → APIs → Credenciales → OAuth 2.0 | Gratuito |
| `SMTP_PASS` | Cuenta Google → Seguridad → Contraseñas de aplicación | Gratuito |

El archivo `ApiKeys.php` está excluido del repositorio (`.gitignore`) por seguridad. Nunca subir claves API a git.

---

## 4. Actualizar el código en producción

**En tu PC (local):**
```bash
git add .
git commit -m "descripción del cambio"
git push
```

**En el servidor EC2 (SSH):**
```bash
ssh -i rekestme-key.pem ubuntu@34.231.84.48
cd /var/www/html/rekestme
sudo git pull
```

> Los archivos `Database.php` y `ApiKeys.php` se editan directamente en el servidor y no se ven afectados por `git pull` (están en `.gitignore`).

---

## 5. Diferencias entre entornos

| Aspecto | XAMPP (local) | AWS (producción) |
|---|---|---|
| Sistema operativo | Windows 11 | Ubuntu 22.04 LTS |
| Servidor web | Apache 2.4 (XAMPP) | Apache 2.4 (instalado manualmente) |
| PHP | 8.2 (XAMPP bundle) | 8.2 (PPA ondrej/php) |
| Base de datos | MySQL 8 local (root sin contraseña) | RDS MySQL 8 (usuario + contraseña) |
| Host BD en `Database.php` | `localhost` | endpoint de RDS |
| URL base de la API | `http://localhost/rekestme/backend/api` | `http://rekestme.duckdns.org/rekestme/backend/api` |
| Google OAuth | `http://localhost` como origen autorizado | `http://rekestme.duckdns.org` como origen autorizado |
| HTTPS | No (desarrollo) | No (HTTP, free tier) |
| Coste | 0 € | 0 € (AWS Academy Learner Lab) |

> **Nota importante:** La URL base de la API está definida en `frontend/js/api.js`. Al cambiar de entorno, actualizar esa constante o parametrizarla vía variable de configuración.

---

## Solución de problemas frecuentes

| Error | Causa probable | Solución |
|---|---|---|
| Página en blanco / 500 | `ApiKeys.php` no existe | Copiar desde `ApiKeys.example.php` |
| Error de conexión BD | MySQL no iniciado o credenciales incorrectas | Verificar XAMPP Control Panel; revisar `Database.php` |
| Login con Google no funciona | `GOOGLE_CLIENT_ID` vacío o dominio no autorizado | Revisar Google Cloud Console → Credenciales |
| Chatbot no responde | `GEMINI_API_KEY` vacío o inválido | Obtener nueva clave en aistudio.google.com |
| `git pull` falla en EC2 | `safe.directory` no configurado | `sudo git config --global --add safe.directory /var/www/html/rekestme` |
| Correos no se envían | App Password de Gmail incorrecto | Generar nuevo App Password en cuenta Google |

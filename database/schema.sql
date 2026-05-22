-- ============================================================
-- ReKestMe — Esquema de base de datos
-- Proyecto TFG 2º DAW
-- v3: schema completo unificado (incluye ordenadores, google auth, inventario)
-- ============================================================

CREATE DATABASE IF NOT EXISTS rekestme
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE rekestme;

-- ------------------------------------------------------------
-- Tabla: users
-- Almacena todos los usuarios del sistema (profesores, TIC, admin)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id           INT           NOT NULL AUTO_INCREMENT,
    nombre       VARCHAR(100)  NOT NULL,
    apellidos    VARCHAR(150)  NOT NULL,
    email        VARCHAR(150)  NOT NULL,
    google_id    VARCHAR(100)  NULL,
    password     VARCHAR(255)  NULL,                             -- hash bcrypt; NULL para usuarios solo Google
    rol          ENUM('profesor','tic','admin') NOT NULL DEFAULT 'profesor',
    departamento VARCHAR(100)  NULL,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    INDEX idx_users_rol (rol),
    INDEX idx_users_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: aulas
-- Aulas del centro donde se puede instalar software
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aulas (
    id              INT          NOT NULL AUTO_INCREMENT,
    nombre          VARCHAR(50)  NOT NULL,                       -- ej: "Aula 201"
    edificio        VARCHAR(100) NOT NULL,
    planta          VARCHAR(20)  NOT NULL,
    capacidad       INT          NOT NULL DEFAULT 0,
    tiene_proyector BOOLEAN      NOT NULL DEFAULT FALSE,
    tiene_red       BOOLEAN      NOT NULL DEFAULT FALSE,
    columnas        INT          NOT NULL DEFAULT 4,             -- columnas del mapa de PCs

    PRIMARY KEY (id),
    INDEX idx_aulas_edificio (edificio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: software
-- Catálogo de software que puede solicitarse
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS software (
    id           INT          NOT NULL AUTO_INCREMENT,
    nombre       VARCHAR(150) NOT NULL,
    version      VARCHAR(50)  NOT NULL DEFAULT '1.0',
    tipo         ENUM('gratuito','licencia','open_source') NOT NULL DEFAULT 'gratuito',
    url_descarga VARCHAR(255) NULL,
    requisitos   TEXT         NULL,

    PRIMARY KEY (id),
    INDEX idx_software_tipo  (tipo),
    INDEX idx_software_nombre(nombre)                            -- para consultas de top más solicitado
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: solicitudes
-- Solicitudes de instalación de software en un aula
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitudes (
    id              INT  NOT NULL AUTO_INCREMENT,
    profesor_id     INT  NOT NULL,
    aula_id         INT  NOT NULL,
    software_id     INT  NOT NULL,
    estado          ENUM('pendiente','en_revision','aprobada','rechazada','en_instalacion','completada')
                         NOT NULL DEFAULT 'pendiente',
    prioridad       ENUM('baja','media','alta','urgente')
                         NOT NULL DEFAULT 'media',
    fecha_necesaria DATE NOT NULL,
    motivo          TEXT NOT NULL,
    comentario_tic  TEXT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_solicitudes_profesor FOREIGN KEY (profesor_id) REFERENCES users(id)    ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_solicitudes_aula     FOREIGN KEY (aula_id)     REFERENCES aulas(id)    ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_solicitudes_software FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE RESTRICT ON UPDATE CASCADE,

    -- Índices para filtros frecuentes
    INDEX idx_solicitudes_estado      (estado),
    INDEX idx_solicitudes_prioridad   (prioridad),
    INDEX idx_solicitudes_profesor    (profesor_id),
    INDEX idx_solicitudes_aula        (aula_id),          -- nuevo: top aulas con más solicitudes
    INDEX idx_solicitudes_software    (software_id),      -- nuevo: top software más solicitado
    INDEX idx_solicitudes_created     (created_at),       -- nuevo: solicitudes por mes
    INDEX idx_solicitudes_estado_prof (estado, profesor_id) -- nuevo: compuesto para dashboard profesor
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: asignaciones
-- Asignación de un técnico TIC a una solicitud concreta
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asignaciones (
    id               INT       NOT NULL AUTO_INCREMENT,
    solicitud_id     INT       NOT NULL,
    tecnico_id       INT       NOT NULL,
    fecha_asignacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_completado TIMESTAMP NULL,
    notas            TEXT      NULL,

    PRIMARY KEY (id),
    CONSTRAINT fk_asignaciones_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT fk_asignaciones_tecnico   FOREIGN KEY (tecnico_id)   REFERENCES users(id)       ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_asignaciones_solicitud (solicitud_id),
    INDEX idx_asignaciones_tecnico   (tecnico_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: historial_estados
-- Registro de cada cambio de estado de una solicitud
-- Se inserta automáticamente al cambiar el estado en SolicitudController
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historial_estados (
    id              INT          NOT NULL AUTO_INCREMENT,
    solicitud_id    INT          NOT NULL,
    usuario_id      INT          NOT NULL,                       -- quien hizo el cambio
    estado_anterior ENUM('pendiente','en_revision','aprobada','rechazada','en_instalacion','completada') NULL,
    estado_nuevo    ENUM('pendiente','en_revision','aprobada','rechazada','en_instalacion','completada') NOT NULL,
    comentario      TEXT         NULL,                           -- comentario opcional al cambiar estado
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_historial_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT fk_historial_usuario   FOREIGN KEY (usuario_id)   REFERENCES users(id)       ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_historial_solicitud (solicitud_id),
    INDEX idx_historial_usuario   (usuario_id),
    INDEX idx_historial_created   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: comentarios
-- Hilo de comentarios por solicitud; es_interno solo lo ven TIC/admin
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comentarios (
    id           INT       NOT NULL AUTO_INCREMENT,
    solicitud_id INT       NOT NULL,
    usuario_id   INT       NOT NULL,
    mensaje      TEXT      NOT NULL,
    es_interno   BOOLEAN   NOT NULL DEFAULT FALSE,               -- TRUE = solo visible para TIC/admin
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_comentarios_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT fk_comentarios_usuario   FOREIGN KEY (usuario_id)   REFERENCES users(id)       ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_comentarios_solicitud (solicitud_id),
    INDEX idx_comentarios_usuario   (usuario_id),
    INDEX idx_comentarios_interno   (es_interno)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: notificaciones
-- Notificaciones por usuario; leída = false hasta que el usuario las marca
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones (
    id           INT  NOT NULL AUTO_INCREMENT,
    usuario_id   INT  NOT NULL,                                  -- destinatario
    solicitud_id INT  NULL,                                      -- solicitud relacionada (puede ser NULL)
    tipo         ENUM('estado_cambiado','comentario_nuevo','asignacion') NOT NULL,
    mensaje      VARCHAR(500) NOT NULL,
    leida        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_notificaciones_usuario   FOREIGN KEY (usuario_id)   REFERENCES users(id)       ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT fk_notificaciones_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE  ON UPDATE CASCADE,
    INDEX idx_notificaciones_usuario (usuario_id),
    INDEX idx_notificaciones_leida   (usuario_id, leida),        -- compuesto: muy frecuente en polling
    INDEX idx_notificaciones_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: ordenadores
-- Cada PC físico dentro de un aula, con posición en cuadrícula
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ordenadores (
    id         INT NOT NULL AUTO_INCREMENT,
    aula_id    INT NOT NULL,
    nombre     VARCHAR(50) NOT NULL,
    fila       INT NOT NULL,
    columna    INT NOT NULL,
    estado     ENUM('operativo','averiado','sin_monitor','mantenimiento')
                   NOT NULL DEFAULT 'operativo',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_ordenadores_aula FOREIGN KEY (aula_id)
        REFERENCES aulas(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_ordenadores_aula   (aula_id),
    INDEX idx_ordenadores_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: ordenador_software
-- Relación N:M entre ordenadores y software instalado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ordenador_software (
    ordenador_id      INT NOT NULL,
    software_id       INT NOT NULL,
    fecha_instalacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (ordenador_id, software_id),
    CONSTRAINT fk_ord_sw_ordenador FOREIGN KEY (ordenador_id)
        REFERENCES ordenadores(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ord_sw_software  FOREIGN KEY (software_id)
        REFERENCES software(id)    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: solicitud_ordenadores
-- Relación N:M entre solicitudes y los ordenadores incluidos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitud_ordenadores (
    solicitud_id INT NOT NULL,
    ordenador_id INT NOT NULL,

    PRIMARY KEY (solicitud_id, ordenador_id),
    CONSTRAINT fk_sol_ord_solicitud FOREIGN KEY (solicitud_id)
        REFERENCES solicitudes(id)  ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_sol_ord_ordenador FOREIGN KEY (ordenador_id)
        REFERENCES ordenadores(id)  ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: chat_mensajes
-- Mensajes privados 1 a 1 entre usuarios TIC/admin
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_mensajes (
    id              INT      NOT NULL AUTO_INCREMENT,
    de_usuario_id   INT      NOT NULL,
    para_usuario_id INT      NOT NULL,
    mensaje         TEXT     NOT NULL,
    leido           BOOLEAN  NOT NULL DEFAULT FALSE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_chat_de   FOREIGN KEY (de_usuario_id)   REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_chat_para FOREIGN KEY (para_usuario_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_chat_de   (de_usuario_id),
    INDEX idx_chat_para (para_usuario_id),
    INDEX idx_chat_conv (de_usuario_id, para_usuario_id),
    INDEX idx_chat_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: inventario_categorias
-- Categorías de hardware (ej: Ratones, Teclados)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventario_categorias (
    id          INT          NOT NULL AUTO_INCREMENT,
    nombre      VARCHAR(100) NOT NULL,
    creado_por  INT          NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_inv_cat_user FOREIGN KEY (creado_por)
        REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: inventario_items
-- Unidades individuales de hardware por categoría
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventario_items (
    id           INT          NOT NULL AUTO_INCREMENT,
    categoria_id INT          NOT NULL,
    nombre       VARCHAR(100) NOT NULL,
    estado       ENUM('operativo','averiado','en_reparacion','dado_de_baja') NOT NULL DEFAULT 'operativo',
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_inv_item_cat FOREIGN KEY (categoria_id)
        REFERENCES inventario_categorias(id) ON DELETE CASCADE,
    INDEX idx_inv_item_cat    (categoria_id),
    INDEX idx_inv_item_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ReKestMe — Datos de prueba (seed)
-- Contraseña de todos los usuarios: Password123!
-- Hash bcrypt (cost=12): $2y$12$golQdkM71KmffiCbAUjjqOg/T6qn7U3A73mc2p0iI2YPNrXeX6Xiu
-- v2: añadidos datos para historial_estados, comentarios, notificaciones
-- ============================================================

USE rekestme;

-- ------------------------------------------------------------
-- Limpiar tablas antes de insertar (orden por FK)
-- ------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE notificaciones;
TRUNCATE TABLE comentarios;
TRUNCATE TABLE historial_estados;
TRUNCATE TABLE asignaciones;
TRUNCATE TABLE solicitudes;
TRUNCATE TABLE software;
TRUNCATE TABLE aulas;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- Usuarios: 5 profesores, 2 TIC, 1 admin
-- IDs resultantes: 1-5 profesores | 6-7 TIC | 8 admin
-- ------------------------------------------------------------
INSERT INTO users (nombre, apellidos, email, password, rol, departamento) VALUES
('Ana',    'García López',      'ana.garcia@instituto.es',     '$2y$12$golQdkM71KmffiCbAUjjqOg/T6qn7U3A73mc2p0iI2YPNrXeX6Xiu', 'profesor', 'Informática'),
('Carlos', 'Martínez Ruiz',     'carlos.martinez@instituto.es','$2y$12$golQdkM71KmffiCbAUjjqOg/T6qn7U3A73mc2p0iI2YPNrXeX6Xiu', 'profesor', 'Matemáticas'),
('Laura',  'Sánchez Pérez',     'laura.sanchez@instituto.es',  '$2y$12$golQdkM71KmffiCbAUjjqOg/T6qn7U3A73mc2p0iI2YPNrXeX6Xiu', 'profesor', 'Dibujo Técnico'),
('Miguel', 'Fernández Torres',  'miguel.fernandez@instituto.es','$2y$12$golQdkM71KmffiCbAUjjqOg/T6qn7U3A73mc2p0iI2YPNrXeX6Xiu', 'profesor', 'Física y Química'),
('Sofía',  'Rodríguez Blanco',  'sofia.rodriguez@instituto.es', '$2y$12$golQdkM71KmffiCbAUjjqOg/T6qn7U3A73mc2p0iI2YPNrXeX6Xiu', 'profesor', 'Lengua Castellana'),
('David',  'López Moreno',      'david.lopez@instituto.es',    '$2y$12$golQdkM71KmffiCbAUjjqOg/T6qn7U3A73mc2p0iI2YPNrXeX6Xiu', 'tic',      'Departamento TIC'),
('Elena',  'Jiménez Castro',    'elena.jimenez@instituto.es',  '$2y$12$golQdkM71KmffiCbAUjjqOg/T6qn7U3A73mc2p0iI2YPNrXeX6Xiu', 'tic',      'Departamento TIC'),
('Admin',  'Sistema',           'admin@instituto.es',          '$2y$12$golQdkM71KmffiCbAUjjqOg/T6qn7U3A73mc2p0iI2YPNrXeX6Xiu', 'admin',    NULL);

-- ------------------------------------------------------------
-- Aulas: 10 aulas del centro
-- IDs resultantes: 1-10
-- ------------------------------------------------------------
INSERT INTO aulas (nombre, edificio, planta, capacidad, tiene_proyector, tiene_red) VALUES
('Aula 101',              'Edificio A', 'Baja',    30, TRUE,  TRUE),
('Aula 102',              'Edificio A', 'Baja',    28, TRUE,  TRUE),
('Lab Informática 1',     'Edificio A', 'Primera', 25, TRUE,  TRUE),
('Lab Informática 2',     'Edificio A', 'Primera', 25, TRUE,  TRUE),
('Aula 201',              'Edificio A', 'Segunda', 32, FALSE, TRUE),
('Aula 202',              'Edificio A', 'Segunda', 32, TRUE,  TRUE),
('Aula de Dibujo',        'Edificio B', 'Baja',    20, TRUE,  FALSE),
('Lab Ciencias',          'Edificio B', 'Primera', 22, TRUE,  TRUE),
('Sala de Audiovisuales', 'Edificio B', 'Baja',    40, TRUE,  TRUE),
('Biblioteca',            'Edificio C', 'Baja',    15, FALSE, TRUE);

-- ------------------------------------------------------------
-- Software: 15 aplicaciones del catálogo
-- IDs resultantes: 1-15
-- ------------------------------------------------------------
INSERT INTO software (nombre, version, tipo, url_descarga, requisitos) VALUES
('Visual Studio Code',  '1.89.0',  'gratuito',    'https://code.visualstudio.com', 'Windows 10+, 1 GB RAM'),
('NetBeans IDE',        '21.0',    'open_source', 'https://netbeans.apache.org',   'JDK 17+, 2 GB RAM'),
('XAMPP',               '8.2.12',  'gratuito',    'https://www.apachefriends.org', 'Windows 7+, 512 MB RAM'),
('AutoCAD',             '2025',    'licencia',    NULL,                            '8 GB RAM, GPU dedicada, Windows 10+'),
('Adobe Photoshop',     '25.0',    'licencia',    NULL,                            '8 GB RAM, GPU, Windows 10+'),
('LibreOffice',         '7.6.4',   'open_source', 'https://www.libreoffice.org',   '512 MB RAM, Windows 7+'),
('Python',              '3.12.3',  'open_source', 'https://www.python.org',        'Windows 7+, 512 MB RAM'),
('GeoGebra',            '6.0',     'gratuito',    'https://www.geogebra.org',      'Windows 7+, 512 MB RAM'),
('Scratch',             '3.0',     'gratuito',    'https://scratch.mit.edu',       'Navegador web moderno'),
('MySQL Workbench',     '8.0.36',  'gratuito',    'https://dev.mysql.com',         'Windows 10+, 4 GB RAM'),
('Inkscape',            '1.3.2',   'open_source', 'https://inkscape.org',          'Windows 7+, 1 GB RAM'),
('VirtualBox',          '7.0.14',  'open_source', 'https://www.virtualbox.org',    '4 GB RAM, CPU con VT-x, Windows 10+'),
('Adobe Illustrator',   '28.0',    'licencia',    NULL,                            '8 GB RAM, GPU, Windows 10+'),
('Cisco Packet Tracer', '8.2.2',   'gratuito',    'https://www.netacad.com',       'Windows 10+, 2 GB RAM'),
('Blender',             '4.1.0',   'open_source', 'https://www.blender.org',       '8 GB RAM, GPU, Windows 8.1+');

-- ------------------------------------------------------------
-- Solicitudes: 20 en distintos estados
-- IDs resultantes: 1-20
-- ------------------------------------------------------------
INSERT INTO solicitudes (profesor_id, aula_id, software_id, estado, prioridad, fecha_necesaria, motivo, comentario_tic) VALUES
-- Completadas (1-4)
(1, 3, 1,  'completada',     'alta',    '2026-02-15', 'Necesito VSCode para la unidad de programación web. Los alumnos usarán HTML, CSS y JavaScript.', 'Instalado en todos los equipos del Lab Info 1. Incluidos plugins recomendados.'),
(2, 1, 8,  'completada',     'media',   '2026-02-20', 'GeoGebra para prácticas de geometría analítica en el aula.', 'Instalado correctamente. Versión de escritorio.'),
(3, 7, 11, 'completada',     'media',   '2026-02-28', 'Inkscape para diseño vectorial en la unidad de imagen digital.', 'Instalado. Se ha creado un acceso directo en el escritorio.'),
(5, 6, 6,  'completada',     'baja',    '2026-03-05', 'LibreOffice Writer para ejercicios de procesador de texto con los alumnos de 1º ESO.', 'Preinstalado en todos los equipos. Actualizado a 7.6.4.'),
-- En instalación (5-6)
(1, 4, 10, 'en_instalacion', 'alta',    '2026-04-01', 'MySQL Workbench para la unidad de bases de datos de 2º DAW.', 'Aprobada. Técnico asignado. Instalación programada para el 28/03.'),
(4, 8, 7,  'en_instalacion', 'media',   '2026-04-10', 'Python 3 para experimentos de análisis de datos en Física.', 'En proceso. Se instalarán también pip y numpy.'),
-- Aprobadas (7)
(2, 3, 9,  'aprobada',       'baja',    '2026-04-15', 'Scratch 3 para introducción a la programación con alumnos de 1º ESO.', 'Aprobada. Se coordinará con el Lab Info 1.'),
-- En revisión (8-10)
(3, 7, 4,  'en_revision',    'urgente', '2026-04-05', 'AutoCAD 2025 para el proyecto final de Dibujo Técnico. Es imprescindible antes del 5 de abril.', 'Revisando licencias disponibles. Puede que usemos versión educativa.'),
(1, 4, 12, 'en_revision',    'alta',    '2026-04-20', 'VirtualBox para prácticas de sistemas operativos en el módulo de ASIR.', 'Verificando compatibilidad de hardware con virtualización.'),
(4, 8, 15, 'en_revision',    'media',   '2026-04-30', 'Blender para un proyecto de modelado 3D interdisciplinar con plástica.', NULL),
-- Pendientes (11-15)
(5, 6, 5,  'pendiente',      'alta',    '2026-05-10', 'Adobe Photoshop para el taller de edición fotográfica del club de comunicación del centro.', NULL),
(2, 1, 14, 'pendiente',      'media',   '2026-05-15', 'Cisco Packet Tracer para simulación de redes en la unidad de telecomunicaciones.', NULL),
(3, 7, 13, 'pendiente',      'media',   '2026-05-20', 'Adobe Illustrator para el diseño del anuario del centro (proyecto integrador).', NULL),
(1, 3, 2,  'pendiente',      'alta',    '2026-05-05', 'NetBeans para la unidad de programación orientada a objetos en Java (2º DAW).', NULL),
(4, 8, 3,  'pendiente',      'baja',    '2026-05-25', 'XAMPP para montar un entorno local de desarrollo web PHP en el lab de ciencias.', NULL),
-- Rechazadas (16-17)
(5, 9, 5,  'rechazada',      'media',   '2026-03-10', 'Photoshop para edición de vídeo en el aula de audiovisuales.', 'Rechazada: Photoshop no es software de edición de vídeo. Se recomienda solicitar Adobe Premiere o DaVinci Resolve.'),
(2, 5, 4,  'rechazada',      'alta',    '2026-03-01', 'AutoCAD en aula 201 para práctica de modelado 2D.', 'Rechazada: el Aula 201 no tiene los requisitos de hardware mínimos para AutoCAD. Solicítelo para el Lab Info.'),
-- Más solicitudes (18-20)
(1, 4, 7,  'pendiente',      'urgente', '2026-04-02', 'Python para un taller de IA y machine learning que empieza el 3 de abril. Es urgente.', NULL),
(3, 7, 1,  'en_revision',    'media',   '2026-05-01', 'VSCode para el taller de desarrollo web del Departamento de Dibujo. Trabajaremos CSS y SVG.', 'Revisando si ya hay licencia global.'),
(4, 8, 6,  'pendiente',      'baja',    '2026-06-01', 'LibreOffice Calc para análisis estadístico de datos de laboratorio.', NULL);

-- ------------------------------------------------------------
-- Asignaciones: técnicos asignados a solicitudes completadas/en instalación
-- ------------------------------------------------------------
INSERT INTO asignaciones (solicitud_id, tecnico_id, fecha_asignacion, fecha_completado, notas) VALUES
(1, 6, '2026-02-10 09:00:00', '2026-02-14 17:30:00', 'Instalación limpia en 25 equipos. Sin incidencias.'),
(2, 7, '2026-02-16 10:00:00', '2026-02-19 16:00:00', 'Versión desktop instalada y configurada con idioma español.'),
(3, 6, '2026-02-24 08:30:00', '2026-02-27 15:00:00', 'Instalado en 20 equipos del Aula de Dibujo.'),
(4, 7, '2026-03-01 09:00:00', '2026-03-04 14:00:00', 'Actualización desde versión anterior. Sin problemas.'),
(5, 6, '2026-03-20 08:00:00', NULL,                  'En proceso. Descargando instaladores. Estimado: 28/03.'),
(6, 7, '2026-03-25 09:30:00', NULL,                  'Iniciada instalación. Pendiente configurar entorno virtual.');

-- ------------------------------------------------------------
-- Historial de estados: 5 entradas de ejemplo
-- Refleja los cambios de estado de las solicitudes completadas e instaladas
-- usuario_id 6 y 7 son los TIC que gestionaron los cambios
-- ------------------------------------------------------------
INSERT INTO historial_estados (solicitud_id, usuario_id, estado_anterior, estado_nuevo, comentario, created_at) VALUES
-- Solicitud 1 (VSCode, completada) — recorrido completo
(1, 6, 'pendiente',     'en_revision',    'Solicitud revisada. Hardware compatible.', '2026-02-08 09:15:00'),
(1, 6, 'en_revision',   'aprobada',       'Aprobada. Se procede a la instalación.', '2026-02-09 11:00:00'),
(1, 6, 'aprobada',      'en_instalacion', 'Técnico asignado. Inicio de instalación.', '2026-02-10 09:00:00'),
(1, 6, 'en_instalacion','completada',     'Instalación finalizada sin incidencias.', '2026-02-14 17:30:00'),
-- Solicitud 8 (AutoCAD, urgente en revisión)
(8, 6, 'pendiente',     'en_revision',    'Solicitud urgente. Revisando disponibilidad de licencias educativas.', '2026-03-28 10:00:00');

-- ------------------------------------------------------------
-- Comentarios: 10 comentarios en distintas solicitudes
-- es_interno=TRUE -> solo visible para TIC/admin
-- es_interno=FALSE -> visible para todos (profesor + TIC)
-- ------------------------------------------------------------
INSERT INTO comentarios (solicitud_id, usuario_id, mensaje, es_interno, created_at) VALUES
-- Solicitud 1 (completada, VSCode) — conversación completa
(1, 1, '¿Se pueden instalar también las extensiones de PHP y Live Server?', FALSE, '2026-02-08 10:00:00'),
(1, 6, 'Por supuesto, las añadimos al paquete estándar del departamento.', FALSE, '2026-02-08 11:30:00'),
(1, 6, 'INTERNO: Recordar actualizar el perfil de instalación compartido en el servidor.', TRUE, '2026-02-09 08:00:00'),

-- Solicitud 5 (MySQL Workbench, en instalación)
(5, 1, '¿Necesitáis que deje los equipos encendidos algún día en concreto para la instalación?', FALSE, '2026-03-21 09:00:00'),
(5, 6, 'Sí, por favor deja los equipos encendidos el martes de 8:00 a 10:00.', FALSE, '2026-03-21 10:15:00'),
(5, 6, 'INTERNO: Necesitamos la clave del servidor de licencias antes del martes.', TRUE, '2026-03-21 10:20:00'),

-- Solicitud 8 (AutoCAD, urgente en revisión)
(8, 3, 'Es imprescindible antes del 5 de abril. Si no hay licencia, ¿existe alguna versión gratuita para estudiantes?', FALSE, '2026-03-29 08:30:00'),
(8, 6, 'Estamos consultando con el proveedor la opción educativa de AutoCAD LT. Te informamos en breve.', FALSE, '2026-03-29 12:00:00'),

-- Solicitud 9 (VirtualBox, en revisión)
(9, 1, 'Los equipos del Lab Info 2 tienen procesadores Intel i5 de 10ª gen. ¿Son compatibles con VT-x?', FALSE, '2026-03-30 09:00:00'),
(9, 7, 'Sí, son compatibles. Tenemos que activar la virtualización en la BIOS de cada equipo.', FALSE, '2026-03-30 11:00:00');

-- ------------------------------------------------------------
-- Notificaciones: 8 notificaciones para distintos usuarios
-- Las primeras están sin leer (leida=FALSE), algunas ya leídas
-- ------------------------------------------------------------
INSERT INTO notificaciones (usuario_id, solicitud_id, tipo, mensaje, leida, created_at) VALUES
-- Para profesora Ana (id=1) — notificaciones de sus solicitudes
(1, 1, 'estado_cambiado', 'Tu solicitud de VSCode ha cambiado a estado: En revisión.', TRUE,  '2026-02-08 09:15:00'),
(1, 1, 'estado_cambiado', 'Tu solicitud de VSCode ha cambiado a estado: Aprobada.', TRUE,  '2026-02-09 11:00:00'),
(1, 1, 'estado_cambiado', 'Tu solicitud de VSCode ha cambiado a estado: Completada.', TRUE,  '2026-02-14 17:30:00'),
(1, 5, 'comentario_nuevo','El personal TIC ha comentado en tu solicitud de MySQL Workbench.', FALSE, '2026-03-21 10:15:00'),
(1, 5, 'asignacion',      'Un técnico ha sido asignado a tu solicitud de MySQL Workbench.', FALSE, '2026-03-20 08:00:00'),

-- Para profesora Laura (id=3) — notificación de su solicitud urgente
(3, 8, 'estado_cambiado', 'Tu solicitud de AutoCAD ha cambiado a estado: En revisión.', FALSE, '2026-03-28 10:00:00'),
(3, 8, 'comentario_nuevo','El personal TIC ha comentado en tu solicitud de AutoCAD.', FALSE, '2026-03-29 12:00:00'),

-- Para TIC David (id=6) — notificación de nueva solicitud urgente
(6, 18, 'estado_cambiado', 'Nueva solicitud urgente de Python para IA/ML. Requiere atención inmediata.', FALSE, '2026-03-31 08:00:00');

-- ------------------------------------------------------------
-- Ordenadores: 25 PCs en Lab Informática 1 (aula_id=3) y 25 en Lab Informática 2 (aula_id=4)
-- Distribución en cuadrícula de 4 columnas (fila=floor(i/4), columna=i%4)
-- ------------------------------------------------------------
INSERT INTO ordenadores (aula_id, nombre, fila, columna, estado) VALUES
(3,'PC-01',0,0,'operativo'),(3,'PC-02',0,1,'operativo'),(3,'PC-03',0,2,'operativo'),(3,'PC-04',0,3,'operativo'),
(3,'PC-05',1,0,'operativo'),(3,'PC-06',1,1,'operativo'),(3,'PC-07',1,2,'operativo'),(3,'PC-08',1,3,'operativo'),
(3,'PC-09',2,0,'operativo'),(3,'PC-10',2,1,'operativo'),(3,'PC-11',2,2,'operativo'),(3,'PC-12',2,3,'operativo'),
(3,'PC-13',3,0,'operativo'),(3,'PC-14',3,1,'operativo'),(3,'PC-15',3,2,'operativo'),(3,'PC-16',3,3,'operativo'),
(3,'PC-17',4,0,'operativo'),(3,'PC-18',4,1,'operativo'),(3,'PC-19',4,2,'operativo'),(3,'PC-20',4,3,'operativo'),
(3,'PC-21',5,0,'operativo'),(3,'PC-22',5,1,'operativo'),(3,'PC-23',5,2,'operativo'),(3,'PC-24',5,3,'operativo'),
(3,'PC-25',6,0,'operativo'),
(4,'PC-01',0,0,'operativo'),(4,'PC-02',0,1,'operativo'),(4,'PC-03',0,2,'operativo'),(4,'PC-04',0,3,'operativo'),
(4,'PC-05',1,0,'operativo'),(4,'PC-06',1,1,'operativo'),(4,'PC-07',1,2,'operativo'),(4,'PC-08',1,3,'operativo'),
(4,'PC-09',2,0,'operativo'),(4,'PC-10',2,1,'operativo'),(4,'PC-11',2,2,'operativo'),(4,'PC-12',2,3,'operativo'),
(4,'PC-13',3,0,'operativo'),(4,'PC-14',3,1,'operativo'),(4,'PC-15',3,2,'operativo'),(4,'PC-16',3,3,'operativo'),
(4,'PC-17',4,0,'operativo'),(4,'PC-18',4,1,'operativo'),(4,'PC-19',4,2,'operativo'),(4,'PC-20',4,3,'operativo'),
(4,'PC-21',5,0,'operativo'),(4,'PC-22',5,1,'operativo'),(4,'PC-23',5,2,'operativo'),(4,'PC-24',5,3,'operativo'),
(4,'PC-25',6,0,'operativo');

-- ------------------------------------------------------------
-- Chat privado: mensajes entre TIC/admin
-- david.lopez (id=6), elena.jimenez (id=7), admin (id=8)
-- ------------------------------------------------------------
INSERT INTO chat_mensajes (de_usuario_id, para_usuario_id, mensaje, leido, created_at) VALUES
-- David ↔ Elena
(6, 7, 'Hola Elena, ¿puedes encargarte hoy de la solicitud de AutoCAD? Tengo las manos ocupadas.', TRUE,  '2026-03-31 08:05:00'),
(7, 6, 'Claro, ya la tengo en revisión. Estoy consultando licencias educativas con el proveedor.', TRUE,  '2026-03-31 08:12:00'),
(6, 7, 'Perfecto, gracias. Si necesitas algo me dices.', TRUE,  '2026-03-31 08:14:00'),
(7, 6, 'Una cosa: ¿sabes si el Aula de Dibujo tiene suficiente RAM para AutoCAD 2025?', FALSE, '2026-03-31 09:30:00'),
-- David ↔ Admin
(8, 6, 'David, ha llegado una solicitud urgente de Python para IA. ¿La puedes atender hoy?', TRUE,  '2026-03-31 08:20:00'),
(6, 8, 'Sí, la tengo apuntada. La gestiono esta tarde después de instalar el MySQL Workbench.', TRUE,  '2026-03-31 08:22:00'),
(8, 6, 'Perfecto. Recuerda actualizar el estado en la plataforma.', FALSE, '2026-03-31 08:23:00'),
-- Elena ↔ Admin
(8, 7, 'Elena, ¿cómo va lo de las licencias de AutoCAD?', FALSE, '2026-03-31 10:00:00'),
(7, 8, 'Me han confirmado que tienen versión educativa. Te mando el presupuesto esta tarde.', FALSE, '2026-03-31 10:15:00');

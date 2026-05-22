<?php
/**
 * index.php — Router principal de la API REST
 * Punto de entrada único para todas las peticiones al backend.
 * Analiza la URL y el método HTTP para derivar la llamada al controller correcto.
 */

// Cabeceras globales de la API
header('Content-Type: application/json; charset=utf-8');
$origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, Authorization');

// Responder a peticiones OPTIONS (CORS preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Iniciar sesión para todos los endpoints
session_start();

// Autoload de helpers y clases base
require_once __DIR__ . '/helpers/Response.php';

// ---- Obtener ruta y método HTTP --------------------------------
$metodo = $_SERVER['REQUEST_METHOD'];

// REQUEST_URI puede ser: /api/solicitudes/5/estado?foo=bar
// Quitamos la query string y el prefijo /api
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = preg_replace('#^/rekestme/backend#', '', $uri); // Ajustar si cambia la ruta base
$uri = trim($uri, '/');

// Separar los segmentos: ['api','solicitudes','5','estado']
$segmentos = explode('/', $uri);

// El primer segmento debe ser 'api'
if (($segmentos[0] ?? '') !== 'api') {
    Response::notFound('Ruta no encontrada.');
}

$recurso     = $segmentos[1] ?? '';  // solicitudes, aulas, software, auth, users, asignaciones
$param1      = isset($segmentos[2]) && is_numeric($segmentos[2]) ? (int)$segmentos[2] : null;
$subaccion   = $segmentos[3] ?? null; // ej: 'estado', 'completar', 'comentarios'
$subrecurso  = isset($segmentos[2]) && !is_numeric($segmentos[2]) ? $segmentos[2] : null; // ej: 'leer-todas'

// ---- Enrutamiento ----------------------------------------------
try {
    switch ($recurso) {

        // ---- AUTH -----------------------------------------------
        case 'auth':
            require_once __DIR__ . '/controllers/AuthController.php';
            $ctrl = new AuthController();
            $accion = $segmentos[2] ?? '';

            match (true) {
                $metodo === 'POST' && $accion === 'login'            => $ctrl->login(),
                $metodo === 'POST' && $accion === 'register'         => $ctrl->register(),
                $metodo === 'POST' && $accion === 'logout'           => $ctrl->logout(),
                $metodo === 'GET'  && $accion === 'me'               => $ctrl->me(),
                $metodo === 'POST' && $accion === 'google'           => $ctrl->loginGoogle(),
                $metodo === 'POST' && $accion === 'forgot-password'  => $ctrl->forgotPassword(),
                default => Response::notFound('Endpoint de auth no encontrado.')
            };
            break;

        // ---- SOLICITUDES ----------------------------------------
        case 'solicitudes':
            require_once __DIR__ . '/controllers/SolicitudController.php';
            $ctrl = new SolicitudController();

            // Rutas anidadas: /api/solicitudes/{id}/comentarios
            if ($param1 !== null && $subaccion === 'comentarios') {
                require_once __DIR__ . '/controllers/ComentarioController.php';
                $ctrlComentario = new ComentarioController();
                match ($metodo) {
                    'GET'  => $ctrlComentario->index($param1),
                    'POST' => $ctrlComentario->store($param1),
                    default => Response::notFound('Endpoint de comentarios no encontrado.')
                };
                break;
            }

            match (true) {
                $metodo === 'GET'    && $param1 === null                          => $ctrl->index(),
                $metodo === 'GET'    && $param1 !== null                          => $ctrl->show($param1),
                $metodo === 'POST'   && $param1 === null                          => $ctrl->store(),
                $metodo === 'PUT'    && $param1 !== null && $subaccion === 'estado' => $ctrl->cambiarEstado($param1),
                $metodo === 'PUT'    && $param1 !== null                          => $ctrl->update($param1),
                $metodo === 'DELETE' && $param1 !== null                          => $ctrl->destroy($param1),
                default => Response::notFound('Endpoint de solicitudes no encontrado.')
            };
            break;

        // ---- AULAS ----------------------------------------------
        case 'aulas':
            require_once __DIR__ . '/controllers/AulaController.php';
            $ctrl = new AulaController();

            // Rutas anidadas: /api/aulas/{id}/ordenadores
            if ($param1 !== null && $subaccion === 'ordenadores') {
                require_once __DIR__ . '/controllers/OrdenadorController.php';
                $ctrlOrd = new OrdenadorController();
                match ($metodo) {
                    'GET'  => $ctrlOrd->listar($param1),
                    'POST' => $ctrlOrd->crear($param1),
                    default => Response::notFound('Endpoint de ordenadores no encontrado.')
                };
                break;
            }

            match (true) {
                $metodo === 'GET'    && $param1 === null                        => $ctrl->index(),
                $metodo === 'GET'    && $param1 !== null && $subaccion === 'vinculos' => $ctrl->vinculos($param1),
                $metodo === 'GET'    && $param1 !== null                        => $ctrl->show($param1),
                $metodo === 'POST'   && $param1 === null                        => $ctrl->store(),
                $metodo === 'PUT'    && $param1 !== null                        => $ctrl->update($param1),
                $metodo === 'DELETE' && $param1 !== null                        => $ctrl->destroy($param1),
                default => Response::notFound('Endpoint de aulas no encontrado.')
            };
            break;

        // ---- ORDENADORES ----------------------------------------
        case 'ordenadores':
            require_once __DIR__ . '/controllers/OrdenadorController.php';
            $ctrl = new OrdenadorController();

            // /api/ordenadores/{id}/software/{swId}  → segmentos[3]='software', segmentos[4]=swId
            // /api/ordenadores/{id}/software         → segmentos[3]='software'
            // /api/ordenadores/{id}/importar         → segmentos[3]='importar'
            $subaccionOrd = $segmentos[3] ?? null;
            $swId = isset($segmentos[4]) && is_numeric($segmentos[4]) ? (int)$segmentos[4] : null;

            match (true) {
                $metodo === 'POST'   && $param1 !== null && $subaccionOrd === 'software' && $swId === null
                    => $ctrl->añadirSoftware($param1),
                $metodo === 'DELETE' && $param1 !== null && $subaccionOrd === 'software' && $swId !== null
                    => $ctrl->eliminarSoftware($param1, $swId),
                $metodo === 'POST'   && $param1 !== null && $subaccionOrd === 'importar'
                    => $ctrl->importarSoftware($param1),
                $metodo === 'PUT'    && $param1 !== null && $subaccionOrd === null
                    => $ctrl->actualizar($param1),
                $metodo === 'DELETE' && $param1 !== null && $subaccionOrd === null
                    => $ctrl->eliminar($param1),
                default => Response::notFound('Endpoint de ordenadores no encontrado.')
            };
            break;

        // ---- SOFTWARE -------------------------------------------
        case 'software':
            require_once __DIR__ . '/controllers/SoftwareController.php';
            $ctrl = new SoftwareController();

            match (true) {
                $metodo === 'GET'    && $param1 === null                             => $ctrl->index(),
                $metodo === 'GET'    && $param1 !== null && $subaccion === 'vinculos' => $ctrl->vinculos($param1),
                $metodo === 'GET'    && $param1 !== null                             => $ctrl->show($param1),
                $metodo === 'POST'   && $param1 === null                             => $ctrl->store(),
                $metodo === 'PUT'    && $param1 !== null                             => $ctrl->update($param1),
                $metodo === 'DELETE' && $param1 !== null                             => $ctrl->destroy($param1),
                default => Response::notFound('Endpoint de software no encontrado.')
            };
            break;

        // ---- USUARIOS -------------------------------------------
        case 'users':
            require_once __DIR__ . '/controllers/UserController.php';
            $ctrl = new UserController();

            match (true) {
                // /api/users/me — deben ir ANTES que las rutas con {id} numérico
                $metodo === 'GET' && $subrecurso === 'me' && $subaccion === null        => $ctrl->perfil(),
                $metodo === 'PUT' && $subrecurso === 'me' && $subaccion === 'password'  => $ctrl->cambiarPassword(),
                $metodo === 'PUT' && $subrecurso === 'me' && $subaccion === null        => $ctrl->actualizarPerfil(),
                // Rutas estándar con ID numérico
                $metodo === 'GET'  && $param1 === null => $ctrl->index(),
                $metodo === 'POST' && $param1 === null => $ctrl->crear(),
                $metodo === 'GET'    && $param1 !== null && $subaccion === 'vinculos'      => $ctrl->vinculos($param1),
                $metodo === 'GET'    && $param1 !== null                                   => $ctrl->show($param1),
                $metodo === 'POST'   && $param1 !== null && $subaccion === 'reset-password'=> $ctrl->resetPassword($param1),
                $metodo === 'PUT'    && $param1 !== null                                   => $ctrl->update($param1),
                $metodo === 'DELETE' && $param1 !== null                                   => $ctrl->destroy($param1),
                default => Response::notFound('Endpoint de usuarios no encontrado.')
            };
            break;

        // ---- NOTIFICACIONES -------------------------------------
        case 'notificaciones':
            require_once __DIR__ . '/controllers/NotificacionController.php';
            $ctrl = new NotificacionController();

            match (true) {
                $metodo === 'GET'    && $param1 === null                             => $ctrl->index(),
                $metodo === 'PUT'    && $param1 !== null && $subaccion === 'leer'    => $ctrl->marcarLeida($param1),
                $metodo === 'PUT'    && $subrecurso === 'leer-todas'                 => $ctrl->marcarTodasLeidas(),
                $metodo === 'DELETE' && $param1 !== null                             => $ctrl->eliminar($param1),
                $metodo === 'DELETE' && $param1 === null                             => $ctrl->eliminarTodas(),
                default => Response::notFound('Endpoint de notificaciones no encontrado.')
            };
            break;

        // ---- CHAT PRIVADO TIC -----------------------------------
        case 'chat':
            require_once __DIR__ . '/controllers/ChatController.php';
            $ctrl = new ChatController();

            match (true) {
                // Rutas sin ID numérico (subrecurso textual) — van PRIMERO
                $metodo === 'GET' && $subrecurso === 'usuarios'    => $ctrl->usuarios(),
                $metodo === 'GET' && $subrecurso === 'no-leidos'   => $ctrl->noLeidos(),
                // GET  /api/chat/{otroId}/mensajes?desde_id=N
                $metodo === 'GET'  && $param1 !== null && $subaccion === 'mensajes' => $ctrl->conversacion($param1),
                // POST /api/chat/{otroId}/mensajes
                $metodo === 'POST' && $param1 !== null && $subaccion === 'mensajes' => $ctrl->enviar($param1),
                // PUT  /api/chat/{otroId}/leer
                $metodo === 'PUT'  && $param1 !== null && $subaccion === 'leer'     => $ctrl->leer($param1),
                default => Response::notFound('Endpoint de chat no encontrado.')
            };
            break;

        // ---- ESTADÍSTICAS ---------------------------------------
        case 'estadisticas':
            require_once __DIR__ . '/controllers/EstadisticaController.php';
            $ctrl = new EstadisticaController();

            match (true) {
                $metodo === 'GET' && $param1 === null => $ctrl->index(),
                default => Response::notFound('Endpoint de estadísticas no encontrado.')
            };
            break;

        // ---- ASIGNACIONES ---------------------------------------
        case 'asignaciones':
            require_once __DIR__ . '/controllers/AsignacionController.php';
            $ctrl = new AsignacionController();

            match (true) {
                $metodo === 'POST' && $param1 === null                          => $ctrl->store(),
                $metodo === 'PUT'  && $param1 !== null && $subaccion === 'completar' => $ctrl->completar($param1),
                default => Response::notFound('Endpoint de asignaciones no encontrado.')
            };
            break;

        // ---- CHATBOT IA -----------------------------------------
        case 'chatbot':
            require_once __DIR__ . '/controllers/ChatbotController.php';
            $ctrl = new ChatbotController();

            match (true) {
                $metodo === 'POST' && $param1 === null => $ctrl->chat(),
                default => Response::notFound('Endpoint de chatbot no encontrado.')
            };
            break;

        // ---- INVENTARIO -----------------------------------------
        case 'inventario':
            require_once __DIR__ . '/controllers/InventarioController.php';
            $ctrl = new InventarioController();

            // Subrecurso textual: 'categorias' o 'items'
            $subrecursoInv = $segmentos[2] ?? '';   // 'categorias' | 'items'
            $paramInv      = isset($segmentos[3]) && is_numeric($segmentos[3])
                                ? (int) $segmentos[3] : null;
            $subaccionInv  = $segmentos[4] ?? null; // 'items'

            match (true) {
                // GET  /api/inventario/categorias
                $metodo === 'GET'    && $subrecursoInv === 'categorias' && $paramInv === null
                    => $ctrl->indexCategorias(),
                // POST /api/inventario/categorias
                $metodo === 'POST'   && $subrecursoInv === 'categorias' && $paramInv === null
                    => $ctrl->storeCategoria(),
                // PUT  /api/inventario/categorias/{id}
                $metodo === 'PUT'    && $subrecursoInv === 'categorias' && $paramInv !== null && $subaccionInv === null
                    => $ctrl->updateCategoria($paramInv),
                // DELETE /api/inventario/categorias/{id}
                $metodo === 'DELETE' && $subrecursoInv === 'categorias' && $paramInv !== null && $subaccionInv === null
                    => $ctrl->destroyCategoria($paramInv),
                // GET  /api/inventario/categorias/{id}/items
                $metodo === 'GET'    && $subrecursoInv === 'categorias' && $paramInv !== null && $subaccionInv === 'items'
                    => $ctrl->indexItems($paramInv),
                // POST /api/inventario/categorias/{id}/items
                $metodo === 'POST'   && $subrecursoInv === 'categorias' && $paramInv !== null && $subaccionInv === 'items'
                    => $ctrl->addItems($paramInv),
                // PUT  /api/inventario/items/{id}
                $metodo === 'PUT'    && $subrecursoInv === 'items' && $paramInv !== null
                    => $ctrl->updateItem($paramInv),
                // DELETE /api/inventario/items/{id}
                $metodo === 'DELETE' && $subrecursoInv === 'items' && $paramInv !== null
                    => $ctrl->destroyItem($paramInv),
                default => Response::notFound('Endpoint de inventario no encontrado.')
            };
            break;

        default:
            Response::notFound('Recurso no encontrado.');
    }
} catch (Throwable $e) {
    // Captura cualquier excepción no controlada
    Response::error('Error interno del servidor.', 500, [
        // En producción, eliminar el mensaje de detalle
        $e->getMessage() . ' [' . $e->getFile() . ':' . $e->getLine() . ']'
    ]);
}

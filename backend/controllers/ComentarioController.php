<?php
/**
 * ComentarioController.php — Hilo de comentarios por solicitud
 * GET  /api/solicitudes/{id}/comentarios
 * POST /api/solicitudes/{id}/comentarios
 */

require_once __DIR__ . '/../models/Comentario.php';
require_once __DIR__ . '/../models/Notificacion.php';
require_once __DIR__ . '/../models/Solicitud.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';

class ComentarioController
{
    private Comentario $model;
    private Notificacion $notificacionModel;
    private Solicitud $solicitudModel;

    public function __construct()
    {
        $this->model             = new Comentario();
        $this->notificacionModel = new Notificacion();
        $this->solicitudModel    = new Solicitud();
    }

    // ----------------------------------------------------------
    // GET /api/solicitudes/{solicitudId}/comentarios
    // Profesores ven solo comentarios públicos; TIC/admin ven todos.
    // ----------------------------------------------------------
    public function index(int $solicitudId): void
    {
        $usuario   = Auth::requerirLogin();
        $solicitud = $this->solicitudModel->getById($solicitudId);

        if (!$solicitud) {
            Response::notFound('Solicitud no encontrada.');
        }

        // Los profesores solo pueden ver sus propias solicitudes
        if ($usuario['rol'] === 'profesor' && $solicitud['profesor_id'] !== $usuario['id']) {
            Response::forbidden();
        }

        $soloPublicos = $usuario['rol'] === 'profesor';
        $comentarios  = $this->model->getBySolicitud($solicitudId, $soloPublicos);

        Response::success($comentarios, 'Comentarios obtenidos correctamente.');
    }

    // ----------------------------------------------------------
    // POST /api/solicitudes/{solicitudId}/comentarios
    // Cualquier usuario autenticado puede comentar (si tiene acceso a la solicitud).
    // El campo es_interno solo pueden usarlo TIC/admin.
    // ----------------------------------------------------------
    public function store(int $solicitudId): void
    {
        $usuario   = Auth::requerirLogin();
        $solicitud = $this->solicitudModel->getById($solicitudId);

        if (!$solicitud) {
            Response::notFound('Solicitud no encontrada.');
        }

        // Los profesores solo pueden comentar sus propias solicitudes
        if ($usuario['rol'] === 'profesor' && $solicitud['profesor_id'] !== $usuario['id']) {
            Response::forbidden();
        }

        $body = $this->getBody();

        if (empty(trim($body['mensaje'] ?? ''))) {
            Response::error('El mensaje no puede estar vacío.', 422);
        }

        // Solo TIC/admin pueden marcar comentarios como internos
        $esInterno = false;
        if (in_array($usuario['rol'], ['tic', 'admin'], true) && !empty($body['es_interno'])) {
            $esInterno = true;
        }

        $nuevoId    = $this->model->create($solicitudId, $usuario['id'], trim($body['mensaje']), $esInterno);
        $comentario = $this->model->getById($nuevoId);

        // Notificar al profesor de la solicitud si el comentario es público
        // y el que comenta no es el propio profesor
        if (!$esInterno && $solicitud['profesor_id'] !== $usuario['id']) {
            $this->notificacionModel->create(
                $solicitud['profesor_id'],
                $solicitudId,
                'comentario_nuevo',
                "Nuevo comentario en tu solicitud #{$solicitudId}: " . mb_substr(trim($body['mensaje']), 0, 100)
            );
        }

        Response::success($comentario, 'Comentario añadido correctamente.', 201);
    }

    private function getBody(): array
    {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

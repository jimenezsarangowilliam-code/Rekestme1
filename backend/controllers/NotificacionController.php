<?php
/**
 * NotificacionController.php — Gestión de notificaciones del usuario en sesión
 * GET    /api/notificaciones              → listar (con count no leídas)
 * PUT    /api/notificaciones/{id}/leer   → marcar una como leída
 * PUT    /api/notificaciones/leer-todas  → marcar todas como leídas
 * DELETE /api/notificaciones/{id}        → eliminar una notificación
 * DELETE /api/notificaciones             → eliminar todas las notificaciones
 */

require_once __DIR__ . '/../models/Notificacion.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';

class NotificacionController
{
    private Notificacion $model;

    public function __construct()
    {
        $this->model = new Notificacion();
    }

    // ----------------------------------------------------------
    // GET /api/notificaciones
    // Devuelve las notificaciones del usuario + total no leídas
    // ----------------------------------------------------------
    public function index(): void
    {
        $usuario       = Auth::requerirLogin();
        $notificaciones = $this->model->getByUsuario($usuario['id']);
        $noLeidas       = $this->model->contarNoLeidas($usuario['id']);

        Response::success([
            'notificaciones' => $notificaciones,
            'no_leidas'      => $noLeidas,
        ], 'Notificaciones obtenidas correctamente.');
    }

    // ----------------------------------------------------------
    // PUT /api/notificaciones/{id}/leer
    // ----------------------------------------------------------
    public function marcarLeida(int $id): void
    {
        $usuario  = Auth::requerirLogin();
        $marcada  = $this->model->marcarLeida($id, $usuario['id']);

        if (!$marcada) {
            Response::notFound('Notificación no encontrada o ya leída.');
        }

        Response::success(null, 'Notificación marcada como leída.');
    }

    // ----------------------------------------------------------
    // PUT /api/notificaciones/leer-todas
    // ----------------------------------------------------------
    public function marcarTodasLeidas(): void
    {
        $usuario  = Auth::requerirLogin();
        $cantidad = $this->model->marcarTodasLeidas($usuario['id']);

        Response::success(['actualizadas' => $cantidad], 'Todas las notificaciones marcadas como leídas.');
    }

    // ----------------------------------------------------------
    // DELETE /api/notificaciones/{id}
    // ----------------------------------------------------------
    public function eliminar(int $id): void
    {
        $usuario  = Auth::requerirLogin();
        $eliminada = $this->model->eliminar($id, $usuario['id']);

        if (!$eliminada) {
            Response::notFound('Notificación no encontrada.');
        }

        Response::success(null, 'Notificación eliminada.');
    }

    // ----------------------------------------------------------
    // DELETE /api/notificaciones
    // ----------------------------------------------------------
    public function eliminarTodas(): void
    {
        $usuario  = Auth::requerirLogin();
        $cantidad = $this->model->eliminarTodas($usuario['id']);

        Response::success(['eliminadas' => $cantidad], 'Todas las notificaciones eliminadas.');
    }
}

<?php
/**
 * SolicitudController.php — CRUD de solicitudes de software
 */

require_once __DIR__ . '/../models/Solicitud.php';
require_once __DIR__ . '/../models/HistorialEstado.php';
require_once __DIR__ . '/../models/Notificacion.php';
require_once __DIR__ . '/../models/Ordenador.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';

class SolicitudController
{
    private Solicitud          $model;
    private HistorialEstado    $historialModel;
    private Notificacion       $notificacionModel;
    private Ordenador          $ordenadorModel;

    public function __construct()
    {
        $this->model             = new Solicitud();
        $this->historialModel    = new HistorialEstado();
        $this->notificacionModel = new Notificacion();
        $this->ordenadorModel    = new Ordenador();
    }

    // ----------------------------------------------------------
    // GET /api/solicitudes
    // Profesores: solo sus solicitudes. TIC/admin: todas.
    // ----------------------------------------------------------
    public function index(): void
    {
        $usuario = Auth::requerirLogin();

        $profesorId = ($usuario['rol'] === 'profesor') ? $usuario['id'] : null;
        $solicitudes = $this->model->getAll($profesorId);

        Response::success($solicitudes, 'Solicitudes obtenidas correctamente.');
    }

    // ----------------------------------------------------------
    // GET /api/solicitudes/{id}
    // ----------------------------------------------------------
    public function show(int $id): void
    {
        $usuario    = Auth::requerirLogin();
        $solicitud  = $this->model->getById($id);

        if (!$solicitud) {
            Response::notFound('Solicitud no encontrada.');
        }

        // Un profesor solo puede ver sus propias solicitudes
        if ($usuario['rol'] === 'profesor' && $solicitud['profesor_id'] !== $usuario['id']) {
            Response::forbidden();
        }

        // Adjuntar ordenadores asociados a esta solicitud
        $solicitud['ordenadores'] = $this->ordenadorModel->obtenerPorSolicitud($id);

        Response::success($solicitud, 'Solicitud obtenida correctamente.');
    }

    // ----------------------------------------------------------
    // POST /api/solicitudes
    // Solo profesores pueden crear solicitudes
    // ----------------------------------------------------------
    public function store(): void
    {
        $usuario = Auth::requerirRol(['profesor']);
        $body    = $this->getBody();

        // Validación
        $errores = [];
        if (empty($body['aula_id']))        $errores[] = 'El aula es obligatoria.';
        if (empty($body['software_id']))    $errores[] = 'El software es obligatorio.';
        if (empty($body['fecha_necesaria'])) $errores[] = 'La fecha necesaria es obligatoria.';
        if (empty($body['motivo']))         $errores[] = 'El motivo es obligatorio.';

        if (!empty($body['fecha_necesaria']) && strtotime($body['fecha_necesaria']) < strtotime('today')) {
            $errores[] = 'La fecha necesaria no puede ser en el pasado.';
        }

        $prioridadesValidas = ['baja', 'media', 'alta', 'urgente'];
        if (!empty($body['prioridad']) && !in_array($body['prioridad'], $prioridadesValidas, true)) {
            $errores[] = 'Prioridad no válida.';
        }

        if ($errores) {
            Response::error('Datos no válidos.', 422, $errores);
        }

        // Validar que ningún PC seleccionado esté averiado o en mantenimiento
        if (!empty($body['ordenador_ids']) && is_array($body['ordenador_ids'])) {
            $noSeleccionables = $this->ordenadorModel->obtenerNoSeleccionables($body['ordenador_ids']);
            if (!empty($noSeleccionables)) {
                $nombres = implode(', ', array_column($noSeleccionables, 'nombre'));
                Response::error("Los siguientes PCs no están disponibles: $nombres.", 422);
            }
        }

        $body['profesor_id'] = $usuario['id'];
        $nuevoId   = $this->model->create($body);

        // Asociar ordenadores si se indicaron
        if (!empty($body['ordenador_ids']) && is_array($body['ordenador_ids'])) {
            $this->ordenadorModel->asociarASolicitud($nuevoId, $body['ordenador_ids']);
        }

        $solicitud              = $this->model->getById($nuevoId);
        $solicitud['ordenadores'] = $this->ordenadorModel->obtenerPorSolicitud($nuevoId);

        Response::success($solicitud, 'Solicitud creada correctamente.', 201);
    }

    // ----------------------------------------------------------
    // PUT /api/solicitudes/{id}
    // El profesor solo puede editar sus solicitudes en estado "pendiente"
    // ----------------------------------------------------------
    public function update(int $id): void
    {
        $usuario   = Auth::requerirLogin();
        $solicitud = $this->model->getById($id);

        if (!$solicitud) {
            Response::notFound('Solicitud no encontrada.');
        }

        // Solo el profesor propietario puede editar, y solo si está pendiente
        if ($usuario['rol'] === 'profesor') {
            if ($solicitud['profesor_id'] !== $usuario['id']) {
                Response::forbidden('No puedes editar esta solicitud.');
            }
            if ($solicitud['estado'] !== 'pendiente') {
                Response::error('Solo puedes editar solicitudes en estado pendiente.', 403);
            }
        }

        $body    = $this->getBody();
        $errores = [];
        if (empty($body['aula_id']))         $errores[] = 'El aula es obligatoria.';
        if (empty($body['software_id']))     $errores[] = 'El software es obligatorio.';
        if (empty($body['fecha_necesaria'])) $errores[] = 'La fecha necesaria es obligatoria.';
        if (empty($body['motivo']))          $errores[] = 'El motivo es obligatorio.';

        if ($errores) {
            Response::error('Datos no válidos.', 422, $errores);
        }

        // Validar que ningún PC seleccionado esté averiado o en mantenimiento
        if (!empty($body['ordenador_ids']) && is_array($body['ordenador_ids'])) {
            $noSeleccionables = $this->ordenadorModel->obtenerNoSeleccionables($body['ordenador_ids']);
            if (!empty($noSeleccionables)) {
                $nombres = implode(', ', array_column($noSeleccionables, 'nombre'));
                Response::error("Los siguientes PCs no están disponibles: $nombres.", 422);
            }
        }

        $actualizado = $this->model->update($id, $body);

        // Actualizar ordenadores asociados si se indicaron
        if (isset($body['ordenador_ids']) && is_array($body['ordenador_ids'])) {
            $this->ordenadorModel->asociarASolicitud($id, $body['ordenador_ids']);
        }

        $solicitud              = $this->model->getById($id);
        $solicitud['ordenadores'] = $this->ordenadorModel->obtenerPorSolicitud($id);

        Response::success($solicitud, $actualizado ? 'Solicitud actualizada.' : 'Sin cambios.');
    }

    // ----------------------------------------------------------
    // PUT /api/solicitudes/{id}/estado
    // Solo TIC/admin pueden cambiar el estado
    // ----------------------------------------------------------
    public function cambiarEstado(int $id): void
    {
        $usuario   = Auth::requerirRol(['tic', 'admin']);
        $solicitud = $this->model->getById($id);

        if (!$solicitud) {
            Response::notFound('Solicitud no encontrada.');
        }

        $body    = $this->getBody();
        $errores = [];

        $estadosValidos = ['pendiente','en_revision','aprobada','rechazada','en_instalacion','completada'];
        if (empty($body['estado']) || !in_array($body['estado'], $estadosValidos, true)) {
            $errores[] = 'Estado no válido. Valores posibles: ' . implode(', ', $estadosValidos);
        }

        if ($errores) {
            Response::error('Datos no válidos.', 422, $errores);
        }

        $estadoAnterior = $solicitud['estado'];
        $estadoNuevo    = $body['estado'];

        $this->model->cambiarEstado($id, $estadoNuevo, $body['comentario_tic'] ?? null);

        // Si pasa a completada, registrar el software en los ordenadores asociados
        if ($estadoNuevo === 'completada') {
            $this->ordenadorModel->registrarSoftwareInstalado($id, $solicitud['software_id']);
        }

        // Registrar en historial
        $this->historialModel->create(
            $id,
            $usuario['id'],
            $estadoAnterior,
            $estadoNuevo,
            $body['comentario_tic'] ?? null
        );

        // Notificar al profesor propietario
        $etiquetas = [
            'pendiente'      => 'Pendiente',
            'en_revision'    => 'En revisión',
            'aprobada'       => 'Aprobada',
            'rechazada'      => 'Rechazada',
            'en_instalacion' => 'En instalación',
            'completada'     => 'Completada',
        ];
        $this->notificacionModel->create(
            $solicitud['profesor_id'],
            $id,
            'estado_cambiado',
            "Tu solicitud #{$id} ha cambiado de estado: {$etiquetas[$estadoAnterior]} → {$etiquetas[$estadoNuevo]}."
        );

        $solicitud = $this->model->getById($id);
        Response::success($solicitud, 'Estado actualizado correctamente.');
    }

    // ----------------------------------------------------------
    // DELETE /api/solicitudes/{id}
    // Solo TIC/admin pueden borrar solicitudes (no completadas).
    // Los profesores no pueden eliminar una vez enviadas.
    // ----------------------------------------------------------
    public function destroy(int $id): void
    {
        $usuario   = Auth::requerirLogin();
        $solicitud = $this->model->getById($id);

        if (!$solicitud) {
            Response::notFound('Solicitud no encontrada.');
        }

        // Los profesores no pueden eliminar solicitudes una vez enviadas
        if ($usuario['rol'] === 'profesor') {
            Response::forbidden('Los profesores no pueden eliminar solicitudes.');
        }

        // Nadie puede borrar una solicitud completada
        if ($solicitud['estado'] === 'completada') {
            Response::error('No se puede eliminar una solicitud ya completada.', 409);
        }

        $eliminado = $this->model->delete($id);

        if (!$eliminado) {
            Response::error('No se pudo eliminar la solicitud.', 500);
        }

        Response::success(null, 'Solicitud eliminada correctamente.');
    }

    private function getBody(): array
    {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

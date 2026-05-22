<?php
/**
 * AsignacionController.php — Asignación de técnicos a solicitudes
 */

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';

class AsignacionController
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // ----------------------------------------------------------
    // POST /api/asignaciones
    // Body: { solicitud_id, tecnico_id, notas? }
    // Solo TIC/admin pueden asignar técnicos
    // ----------------------------------------------------------
    public function store(): void
    {
        Auth::requerirRol(['tic', 'admin']);
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $errores = [];
        if (empty($body['solicitud_id'])) $errores[] = 'La solicitud es obligatoria.';
        if (empty($body['tecnico_id']))   $errores[] = 'El técnico es obligatorio.';
        if ($errores) Response::error('Datos no válidos.', 422, $errores);

        // Verificar que la solicitud existe y está en un estado asignable
        $stmt = $this->db->prepare('SELECT id, estado FROM solicitudes WHERE id = ?');
        $stmt->execute([$body['solicitud_id']]);
        $solicitud = $stmt->fetch();

        if (!$solicitud) Response::notFound('Solicitud no encontrada.');

        $estadosAsignables = ['aprobada', 'en_revision', 'en_instalacion'];
        if (!in_array($solicitud['estado'], $estadosAsignables, true)) {
            Response::error('Solo se puede asignar técnico a solicitudes aprobadas o en revisión.', 409);
        }

        // Verificar que el técnico existe y tiene rol tic/admin
        $stmt = $this->db->prepare("SELECT id FROM users WHERE id = ? AND rol IN ('tic','admin')");
        $stmt->execute([$body['tecnico_id']]);
        if (!$stmt->fetch()) {
            Response::error('El técnico indicado no existe o no tiene el rol adecuado.', 404);
        }

        // Crear la asignación
        $stmt = $this->db->prepare('
            INSERT INTO asignaciones (solicitud_id, tecnico_id, notas)
            VALUES (:solicitud_id, :tecnico_id, :notas)
        ');
        $stmt->execute([
            ':solicitud_id' => $body['solicitud_id'],
            ':tecnico_id'   => $body['tecnico_id'],
            ':notas'        => $body['notas'] ?? null,
        ]);
        $nuevoId = (int) $this->db->lastInsertId();

        // Devolver la asignación creada
        $stmt = $this->db->prepare('SELECT * FROM asignaciones WHERE id = ?');
        $stmt->execute([$nuevoId]);

        Response::success($stmt->fetch(), 'Técnico asignado correctamente.', 201);
    }

    // ----------------------------------------------------------
    // PUT /api/asignaciones/{id}/completar
    // Marca la asignación como completada y la solicitud como completada
    // ----------------------------------------------------------
    public function completar(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);

        $stmt = $this->db->prepare('SELECT * FROM asignaciones WHERE id = ?');
        $stmt->execute([$id]);
        $asignacion = $stmt->fetch();

        if (!$asignacion) Response::notFound('Asignación no encontrada.');
        if ($asignacion['fecha_completado'] !== null) {
            Response::error('Esta asignación ya está marcada como completada.', 409);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        // Marcar asignación como completada
        $this->db->prepare('
            UPDATE asignaciones
            SET fecha_completado = NOW(), notas = COALESCE(:notas, notas)
            WHERE id = :id
        ')->execute([
            ':notas' => $body['notas'] ?? null,
            ':id'    => $id,
        ]);

        // Marcar la solicitud como completada
        $this->db->prepare("UPDATE solicitudes SET estado = 'completada' WHERE id = ?")
                 ->execute([$asignacion['solicitud_id']]);

        $stmt = $this->db->prepare('SELECT * FROM asignaciones WHERE id = ?');
        $stmt->execute([$id]);

        Response::success($stmt->fetch(), 'Asignación completada. Solicitud marcada como completada.');
    }
}

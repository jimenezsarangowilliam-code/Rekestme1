<?php
/**
 * HistorialEstado.php — Modelo para historial de cambios de estado de solicitudes
 */

require_once __DIR__ . '/../config/Database.php';

class HistorialEstado
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Registra un cambio de estado en el historial.
     */
    public function create(int $solicitudId, int $usuarioId, ?string $estadoAnterior, string $estadoNuevo, ?string $comentario = null): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO historial_estados (solicitud_id, usuario_id, estado_anterior, estado_nuevo, comentario)
             VALUES (:solicitud_id, :usuario_id, :estado_anterior, :estado_nuevo, :comentario)'
        );
        $stmt->execute([
            ':solicitud_id'   => $solicitudId,
            ':usuario_id'     => $usuarioId,
            ':estado_anterior' => $estadoAnterior,
            ':estado_nuevo'   => $estadoNuevo,
            ':comentario'     => $comentario,
        ]);
        return (int) $this->db->lastInsertId();
    }

    /**
     * Devuelve el historial completo de una solicitud, con el nombre del usuario que hizo el cambio.
     */
    public function getBySolicitud(int $solicitudId): array
    {
        $stmt = $this->db->prepare(
            'SELECT h.id, h.solicitud_id, h.usuario_id,
                    u.nombre, u.apellidos, u.rol,
                    h.estado_anterior, h.estado_nuevo, h.comentario, h.created_at
             FROM historial_estados h
             JOIN users u ON u.id = h.usuario_id
             WHERE h.solicitud_id = :solicitud_id
             ORDER BY h.created_at ASC'
        );
        $stmt->execute([':solicitud_id' => $solicitudId]);
        return $stmt->fetchAll();
    }
}

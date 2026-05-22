<?php
/**
 * Notificacion.php — Modelo de notificaciones por usuario
 */

require_once __DIR__ . '/../config/Database.php';

class Notificacion
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Crea una nueva notificación para un usuario.
     */
    public function create(int $usuarioId, ?int $solicitudId, string $tipo, string $mensaje): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO notificaciones (usuario_id, solicitud_id, tipo, mensaje)
             VALUES (:usuario_id, :solicitud_id, :tipo, :mensaje)'
        );
        $stmt->execute([
            ':usuario_id'   => $usuarioId,
            ':solicitud_id' => $solicitudId,
            ':tipo'         => $tipo,
            ':mensaje'      => $mensaje,
        ]);
        return (int) $this->db->lastInsertId();
    }

    /**
     * Devuelve todas las notificaciones de un usuario (más recientes primero).
     */
    public function getByUsuario(int $usuarioId, int $limit = 50): array
    {
        $stmt = $this->db->prepare(
            'SELECT id, usuario_id, solicitud_id, tipo, mensaje, leida, created_at
             FROM notificaciones
             WHERE usuario_id = :usuario_id
             ORDER BY created_at DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':usuario_id', $usuarioId, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    /**
     * Cuenta las notificaciones no leídas de un usuario (usado en el badge de polling).
     */
    public function contarNoLeidas(int $usuarioId): int
    {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM notificaciones WHERE usuario_id = :usuario_id AND leida = FALSE'
        );
        $stmt->execute([':usuario_id' => $usuarioId]);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Marca una notificación concreta como leída (solo si pertenece al usuario).
     */
    public function marcarLeida(int $id, int $usuarioId): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE notificaciones SET leida = TRUE WHERE id = :id AND usuario_id = :usuario_id'
        );
        $stmt->execute([':id' => $id, ':usuario_id' => $usuarioId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Marca todas las notificaciones de un usuario como leídas.
     */
    public function marcarTodasLeidas(int $usuarioId): int
    {
        $stmt = $this->db->prepare(
            'UPDATE notificaciones SET leida = TRUE WHERE usuario_id = :usuario_id AND leida = FALSE'
        );
        $stmt->execute([':usuario_id' => $usuarioId]);
        return $stmt->rowCount();
    }

    /**
     * Elimina una notificación concreta (solo si pertenece al usuario).
     */
    public function eliminar(int $id, int $usuarioId): bool
    {
        $stmt = $this->db->prepare(
            'DELETE FROM notificaciones WHERE id = :id AND usuario_id = :usuario_id'
        );
        $stmt->execute([':id' => $id, ':usuario_id' => $usuarioId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Elimina todas las notificaciones de un usuario.
     */
    public function eliminarTodas(int $usuarioId): int
    {
        $stmt = $this->db->prepare(
            'DELETE FROM notificaciones WHERE usuario_id = :usuario_id'
        );
        $stmt->execute([':usuario_id' => $usuarioId]);
        return $stmt->rowCount();
    }
}

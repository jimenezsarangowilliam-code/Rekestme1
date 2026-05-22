<?php
/**
 * Comentario.php — Modelo para el hilo de comentarios por solicitud
 */

require_once __DIR__ . '/../config/Database.php';

class Comentario
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Devuelve los comentarios de una solicitud.
     * Si $soloPublicos = true, filtra los comentarios internos (solo TIC/admin los ven).
     */
    public function getBySolicitud(int $solicitudId, bool $soloPublicos = false): array
    {
        $where = 'WHERE c.solicitud_id = :solicitud_id';
        if ($soloPublicos) {
            $where .= ' AND c.es_interno = FALSE';
        }

        $stmt = $this->db->prepare(
            "SELECT c.id, c.solicitud_id, c.usuario_id,
                    u.nombre, u.apellidos, u.rol,
                    c.mensaje, c.es_interno, c.created_at
             FROM comentarios c
             JOIN users u ON u.id = c.usuario_id
             $where
             ORDER BY c.created_at ASC"
        );
        $stmt->execute([':solicitud_id' => $solicitudId]);
        return $stmt->fetchAll();
    }

    /**
     * Crea un nuevo comentario. Devuelve el ID insertado.
     */
    public function create(int $solicitudId, int $usuarioId, string $mensaje, bool $esInterno = false): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO comentarios (solicitud_id, usuario_id, mensaje, es_interno)
             VALUES (:solicitud_id, :usuario_id, :mensaje, :es_interno)'
        );
        $stmt->execute([
            ':solicitud_id' => $solicitudId,
            ':usuario_id'   => $usuarioId,
            ':mensaje'      => $mensaje,
            ':es_interno'   => $esInterno ? 1 : 0,
        ]);
        return (int) $this->db->lastInsertId();
    }

    /**
     * Busca un comentario por ID (para validar propietario antes de borrar, etc.)
     */
    public function getById(int $id): array|false
    {
        $stmt = $this->db->prepare('SELECT * FROM comentarios WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch();
    }
}

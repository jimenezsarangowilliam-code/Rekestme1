<?php
/**
 * ChatMensaje.php — Modelo de mensajes privados 1 a 1 para TIC/admin
 */

require_once __DIR__ . '/../config/Database.php';

class ChatMensaje
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Devuelve la lista de otros usuarios TIC/admin con info de conversación:
     * último mensaje, hora y cuántos mensajes no leídos envió cada uno.
     */
    public function obtenerUsuarios(int $miId): array
    {
        $stmt = $this->db->prepare(
            "SELECT u.id, u.nombre, u.apellidos, u.rol,
                    -- Último mensaje de la conversación (en cualquier dirección)
                    (SELECT m2.mensaje FROM chat_mensajes m2
                     WHERE (m2.de_usuario_id = u.id AND m2.para_usuario_id = :mid1)
                        OR (m2.de_usuario_id = :mid2 AND m2.para_usuario_id = u.id)
                     ORDER BY m2.created_at DESC LIMIT 1) AS ultimo_mensaje,
                    (SELECT m2.created_at FROM chat_mensajes m2
                     WHERE (m2.de_usuario_id = u.id AND m2.para_usuario_id = :mid3)
                        OR (m2.de_usuario_id = :mid4 AND m2.para_usuario_id = u.id)
                     ORDER BY m2.created_at DESC LIMIT 1) AS ultimo_at,
                    -- Mensajes no leídos que este usuario me envió a mí
                    (SELECT COUNT(*) FROM chat_mensajes m3
                     WHERE m3.de_usuario_id = u.id
                       AND m3.para_usuario_id = :mid5
                       AND m3.leido = FALSE) AS no_leidos
             FROM users u
             WHERE u.id != :mid6
               AND u.rol IN ('tic','admin')
             ORDER BY ultimo_at DESC, u.apellidos ASC"
        );
        $stmt->execute([
            ':mid1' => $miId, ':mid2' => $miId, ':mid3' => $miId,
            ':mid4' => $miId, ':mid5' => $miId, ':mid6' => $miId,
        ]);
        return $stmt->fetchAll();
    }

    /**
     * Devuelve los mensajes de la conversación entre dos usuarios.
     * Si $desdeId > 0, solo mensajes con id > $desdeId (polling incremental).
     */
    public function obtenerConversacion(int $miId, int $otroId, int $desdeId = 0): array
    {
        $condExtra = $desdeId > 0 ? 'AND m.id > :desde_id' : '';

        $stmt = $this->db->prepare(
            "SELECT m.id, m.de_usuario_id, m.para_usuario_id,
                    m.mensaje, m.leido, m.created_at,
                    u.nombre, u.apellidos
             FROM chat_mensajes m
             JOIN users u ON u.id = m.de_usuario_id
             WHERE ((m.de_usuario_id = :mid1 AND m.para_usuario_id = :oid1)
                 OR (m.de_usuario_id = :oid2 AND m.para_usuario_id = :mid2))
             $condExtra
             ORDER BY m.created_at ASC
             LIMIT 100"
        );

        $params = [':mid1' => $miId, ':oid1' => $otroId, ':oid2' => $otroId, ':mid2' => $miId];
        if ($desdeId > 0) $params[':desde_id'] = $desdeId;
        $stmt->execute($params);

        return array_map(fn($row) => [
            'id'             => (int) $row['id'],
            'de_usuario_id'  => (int) $row['de_usuario_id'],
            'mensaje'        => $row['mensaje'],
            'leido'          => (bool) $row['leido'],
            'created_at'     => $row['created_at'],
            'nombre_usuario' => $row['nombre'] . ' ' . $row['apellidos'],
            'avatar_inicial' => mb_strtoupper(mb_substr($row['nombre'], 0, 1)),
        ], $stmt->fetchAll());
    }

    /**
     * Inserta un mensaje de $deId hacia $paraId. Devuelve el id.
     */
    public function enviarMensaje(int $deId, int $paraId, string $mensaje): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO chat_mensajes (de_usuario_id, para_usuario_id, mensaje) VALUES (?, ?, ?)'
        );
        $stmt->execute([$deId, $paraId, $mensaje]);
        return (int) $this->db->lastInsertId();
    }

    /**
     * Marca como leídos todos los mensajes que $deId envió a $paraId.
     */
    public function marcarLeidos(int $deId, int $paraId): int
    {
        $stmt = $this->db->prepare(
            'UPDATE chat_mensajes SET leido = TRUE
             WHERE de_usuario_id = ? AND para_usuario_id = ? AND leido = FALSE'
        );
        $stmt->execute([$deId, $paraId]);
        return $stmt->rowCount();
    }

    /**
     * Total de mensajes no leídos recibidos por $usuarioId (para badge global).
     */
    public function contarNoLeidos(int $usuarioId): int
    {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM chat_mensajes WHERE para_usuario_id = ? AND leido = FALSE'
        );
        $stmt->execute([$usuarioId]);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Devuelve el último mensaje insertado por su id.
     */
    public function getById(int $id): array|false
    {
        $stmt = $this->db->prepare(
            'SELECT m.id, m.de_usuario_id, m.para_usuario_id, m.mensaje, m.leido, m.created_at,
                    u.nombre, u.apellidos
             FROM chat_mensajes m JOIN users u ON u.id = m.de_usuario_id
             WHERE m.id = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) return false;

        return [
            'id'             => (int) $row['id'],
            'de_usuario_id'  => (int) $row['de_usuario_id'],
            'mensaje'        => $row['mensaje'],
            'leido'          => (bool) $row['leido'],
            'created_at'     => $row['created_at'],
            'nombre_usuario' => $row['nombre'] . ' ' . $row['apellidos'],
            'avatar_inicial' => mb_strtoupper(mb_substr($row['nombre'], 0, 1)),
        ];
    }
}

<?php
/**
 * Solicitud.php — Modelo de solicitudes de instalación de software
 */

require_once __DIR__ . '/../config/Database.php';

class Solicitud
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // ----------------------------------------------------------
    // Consultas
    // ----------------------------------------------------------

    /**
     * Lista solicitudes. Si $profesorId es null, devuelve todas (para TIC/admin).
     * Si se pasa un $profesorId, solo devuelve las de ese profesor.
     */
    public function getAll(?int $profesorId = null): array
    {
        $sql = '
            SELECT
                s.id, s.estado, s.prioridad, s.fecha_necesaria, s.motivo,
                s.comentario_tic, s.created_at, s.updated_at,
                u.id AS profesor_id,
                CONCAT(u.nombre, " ", u.apellidos) AS profesor_nombre,
                a.id AS aula_id, a.nombre AS aula_nombre, a.edificio,
                sw.id AS software_id, sw.nombre AS software_nombre, sw.version, sw.tipo,
                CONCAT(t.nombre, " ", t.apellidos) AS tecnico_nombre
            FROM solicitudes s
            JOIN users    u  ON u.id  = s.profesor_id
            JOIN aulas    a  ON a.id  = s.aula_id
            JOIN software sw ON sw.id = s.software_id
            LEFT JOIN asignaciones asg ON asg.id = (
                SELECT MAX(a2.id) FROM asignaciones a2 WHERE a2.solicitud_id = s.id
            )
            LEFT JOIN users t ON t.id = asg.tecnico_id
        ';

        if ($profesorId !== null) {
            $sql  .= ' WHERE s.profesor_id = ?';
            $sql  .= ' ORDER BY s.created_at DESC';
            $stmt  = $this->db->prepare($sql);
            $stmt->execute([$profesorId]);
        } else {
            $sql  .= ' ORDER BY s.prioridad DESC, s.created_at DESC';
            $stmt  = $this->db->query($sql);
        }

        return $stmt->fetchAll();
    }

    /**
     * Detalle de una solicitud por ID
     */
    public function getById(int $id): array|false
    {
        $stmt = $this->db->prepare('
            SELECT
                s.id, s.estado, s.prioridad, s.fecha_necesaria, s.motivo,
                s.comentario_tic, s.created_at, s.updated_at,
                u.id AS profesor_id,
                CONCAT(u.nombre, " ", u.apellidos) AS profesor_nombre,
                u.email AS profesor_email, u.departamento,
                a.id AS aula_id, a.nombre AS aula_nombre, a.edificio, a.planta,
                sw.id AS software_id, sw.nombre AS software_nombre,
                sw.version, sw.tipo, sw.requisitos
            FROM solicitudes s
            JOIN users    u  ON u.id  = s.profesor_id
            JOIN aulas    a  ON a.id  = s.aula_id
            JOIN software sw ON sw.id = s.software_id
            WHERE s.id = ?
        ');
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    /**
     * Crea una nueva solicitud. Devuelve el ID insertado.
     */
    public function create(array $datos): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO solicitudes (profesor_id, aula_id, software_id, prioridad, fecha_necesaria, motivo)
            VALUES (:profesor_id, :aula_id, :software_id, :prioridad, :fecha_necesaria, :motivo)
        ');
        $stmt->execute([
            ':profesor_id'    => $datos['profesor_id'],
            ':aula_id'        => $datos['aula_id'],
            ':software_id'    => $datos['software_id'],
            ':prioridad'      => $datos['prioridad'] ?? 'media',
            ':fecha_necesaria'=> $datos['fecha_necesaria'],
            ':motivo'         => $datos['motivo'],
        ]);
        return (int) $this->db->lastInsertId();
    }

    /**
     * Actualiza campos editables de una solicitud (solo si está pendiente)
     */
    public function update(int $id, array $datos): bool
    {
        $stmt = $this->db->prepare('
            UPDATE solicitudes
            SET aula_id = :aula_id,
                software_id = :software_id,
                prioridad = :prioridad,
                fecha_necesaria = :fecha_necesaria,
                motivo = :motivo
            WHERE id = :id AND estado = "pendiente"
        ');
        $stmt->execute([
            ':aula_id'        => $datos['aula_id'],
            ':software_id'    => $datos['software_id'],
            ':prioridad'      => $datos['prioridad'],
            ':fecha_necesaria'=> $datos['fecha_necesaria'],
            ':motivo'         => $datos['motivo'],
            ':id'             => $id,
        ]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Cambia el estado y/o añade comentario TIC
     */
    public function cambiarEstado(int $id, string $estado, ?string $comentario = null): bool
    {
        $stmt = $this->db->prepare('
            UPDATE solicitudes
            SET estado = :estado, comentario_tic = :comentario
            WHERE id = :id
        ');
        $stmt->execute([
            ':estado'     => $estado,
            ':comentario' => $comentario,
            ':id'         => $id,
        ]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Elimina una solicitud siempre que NO esté completada
     */
    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare(
            'DELETE FROM solicitudes WHERE id = ? AND estado != "completada"'
        );
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Verifica si una solicitud pertenece a un profesor concreto
     */
    public function perteneceAProfesor(int $solicitudId, int $profesorId): bool
    {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM solicitudes WHERE id = ? AND profesor_id = ?'
        );
        $stmt->execute([$solicitudId, $profesorId]);
        return (int) $stmt->fetchColumn() > 0;
    }
}

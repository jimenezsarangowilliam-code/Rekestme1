<?php
/**
 * Aula.php — Modelo de aulas del centro
 */

require_once __DIR__ . '/../config/Database.php';

class Aula
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // Devuelve todas las aulas ordenadas por edificio y nombre
    public function getAll(): array
    {
        return $this->db->query('SELECT * FROM aulas ORDER BY edificio, nombre')->fetchAll();
    }

    // Busca un aula por su ID
    public function getById(int $id): array|false
    {
        $stmt = $this->db->prepare('SELECT * FROM aulas WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    // Comprueba si ya existe un aula con ese nombre en ese edificio (para evitar duplicados)
    public function nombreExiste(string $nombre, string $edificio, ?int $excluirId = null): bool
    {
        if ($excluirId !== null) {
            $stmt = $this->db->prepare('SELECT COUNT(*) FROM aulas WHERE nombre = ? AND edificio = ? AND id != ?');
            $stmt->execute([$nombre, $edificio, $excluirId]);
        } else {
            $stmt = $this->db->prepare('SELECT COUNT(*) FROM aulas WHERE nombre = ? AND edificio = ?');
            $stmt->execute([$nombre, $edificio]);
        }
        return (int) $stmt->fetchColumn() > 0;
    }

    // Inserta una nueva aula y devuelve el ID generado
    public function create(array $datos): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO aulas (nombre, edificio, planta, capacidad, tiene_proyector, tiene_red, columnas)
            VALUES (:nombre, :edificio, :planta, :capacidad, :tiene_proyector, :tiene_red, :columnas)
        ');
        $stmt->execute([
            ':nombre'          => $datos['nombre'],
            ':edificio'        => $datos['edificio'],
            ':planta'          => $datos['planta'],
            ':capacidad'       => (int) $datos['capacidad'],
            ':tiene_proyector' => (bool) ($datos['tiene_proyector'] ?? false),
            ':tiene_red'       => (bool) ($datos['tiene_red'] ?? false),
            ':columnas'        => (int) ($datos['columnas'] ?? 4),
        ]);
        return (int) $this->db->lastInsertId();
    }

    // Actualiza los datos de un aula existente
    public function update(int $id, array $datos): bool
    {
        $stmt = $this->db->prepare('
            UPDATE aulas
            SET nombre = :nombre, edificio = :edificio, planta = :planta,
                capacidad = :capacidad, tiene_proyector = :tiene_proyector,
                tiene_red = :tiene_red, columnas = :columnas
            WHERE id = :id
        ');
        $stmt->execute([
            ':nombre'          => $datos['nombre'],
            ':edificio'        => $datos['edificio'],
            ':planta'          => $datos['planta'],
            ':capacidad'       => (int) $datos['capacidad'],
            ':tiene_proyector' => (bool) ($datos['tiene_proyector'] ?? false),
            ':tiene_red'       => (bool) ($datos['tiene_red'] ?? false),
            ':columnas'        => (int) ($datos['columnas'] ?? 4),
            ':id'              => $id,
        ]);
        return $stmt->rowCount() > 0;
    }

    // Devuelve conteos de solicitudes y ordenadores asociados (para bloquear borrado si hay activos)
    public function getVinculos(int $id): array
    {
        $stmt = $this->db->prepare(
            "SELECT
                COUNT(*) AS total_solicitudes,
                SUM(estado NOT IN ('completada','rechazada')) AS solicitudes_activas,
                SUM(estado IN ('completada','rechazada')) AS solicitudes_historial
             FROM solicitudes WHERE aula_id = ?"
        );
        $stmt->execute([$id]);
        $sol = $stmt->fetch();

        $stmt = $this->db->prepare('SELECT COUNT(*) FROM ordenadores WHERE aula_id = ?');
        $stmt->execute([$id]);
        $ordenadores = (int) $stmt->fetchColumn();

        return [
            'solicitudes_activas'   => (int) ($sol['solicitudes_activas']  ?? 0),
            'solicitudes_historial' => (int) ($sol['solicitudes_historial'] ?? 0),
            'ordenadores'           => $ordenadores,
        ];
    }

    // Elimina el aula si no tiene solicitudes vinculadas; devuelve false si no se puede borrar
    public function delete(int $id): bool
    {
        // Verificar que no tenga solicitudes asociadas antes de borrar
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM solicitudes WHERE aula_id = ?');
        $stmt->execute([$id]);
        if ((int) $stmt->fetchColumn() > 0) {
            return false; // No se puede borrar; tiene solicitudes vinculadas
        }

        $stmt = $this->db->prepare('DELETE FROM aulas WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }
}

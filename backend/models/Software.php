<?php
/**
 * Software.php — Modelo del catálogo de software
 */

require_once __DIR__ . '/../config/Database.php';

class Software
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // Devuelve todo el catálogo de software ordenado por nombre
    public function getAll(): array
    {
        return $this->db->query('SELECT * FROM software ORDER BY nombre')->fetchAll();
    }

    // Busca un software por su ID
    public function getById(int $id): array|false
    {
        $stmt = $this->db->prepare('SELECT * FROM software WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    // Comprueba si ya existe software con ese nombre y versión (para evitar duplicados)
    public function nombreVersionExiste(string $nombre, string $version, ?int $excluirId = null): bool
    {
        if ($excluirId !== null) {
            $stmt = $this->db->prepare('SELECT COUNT(*) FROM software WHERE nombre = ? AND version = ? AND id != ?');
            $stmt->execute([$nombre, $version, $excluirId]);
        } else {
            $stmt = $this->db->prepare('SELECT COUNT(*) FROM software WHERE nombre = ? AND version = ?');
            $stmt->execute([$nombre, $version]);
        }
        return (int) $stmt->fetchColumn() > 0;
    }

    // Inserta un nuevo software en el catálogo y devuelve el ID generado
    public function create(array $datos): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO software (nombre, version, tipo, url_descarga, requisitos)
            VALUES (:nombre, :version, :tipo, :url_descarga, :requisitos)
        ');
        $stmt->execute([
            ':nombre'       => $datos['nombre'],
            ':version'      => $datos['version'] ?? '1.0',
            ':tipo'         => $datos['tipo'],
            ':url_descarga' => $datos['url_descarga'] ?? null,
            ':requisitos'   => $datos['requisitos'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    // Actualiza los datos de un software existente
    public function update(int $id, array $datos): bool
    {
        $stmt = $this->db->prepare('
            UPDATE software
            SET nombre = :nombre, version = :version, tipo = :tipo,
                url_descarga = :url_descarga, requisitos = :requisitos
            WHERE id = :id
        ');
        $stmt->execute([
            ':nombre'       => $datos['nombre'],
            ':version'      => $datos['version'],
            ':tipo'         => $datos['tipo'],
            ':url_descarga' => $datos['url_descarga'] ?? null,
            ':requisitos'   => $datos['requisitos'] ?? null,
            ':id'           => $id,
        ]);
        return $stmt->rowCount() > 0;
    }

    // Devuelve conteos de solicitudes activas e historial vinculadas a este software
    public function getVinculos(int $id): array
    {
        $stmt = $this->db->prepare(
            "SELECT
                SUM(estado NOT IN ('completada','rechazada')) AS solicitudes_activas,
                SUM(estado IN ('completada','rechazada')) AS solicitudes_historial
             FROM solicitudes WHERE software_id = ?"
        );
        $stmt->execute([$id]);
        $sol = $stmt->fetch();

        return [
            'solicitudes_activas'   => (int) ($sol['solicitudes_activas']  ?? 0),
            'solicitudes_historial' => (int) ($sol['solicitudes_historial'] ?? 0),
        ];
    }

    // Elimina el software si no tiene solicitudes vinculadas; devuelve false si no se puede borrar
    public function delete(int $id): bool
    {
        // No borrar si hay solicitudes que usan este software
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM solicitudes WHERE software_id = ?');
        $stmt->execute([$id]);
        if ((int) $stmt->fetchColumn() > 0) {
            return false;
        }

        $stmt = $this->db->prepare('DELETE FROM software WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }
}

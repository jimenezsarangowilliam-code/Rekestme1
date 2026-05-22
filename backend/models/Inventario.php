<?php
/**
 * Inventario.php — Modelo para inventario de hardware
 */

require_once __DIR__ . '/../config/Database.php';

class Inventario
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // ---- CATEGORÍAS ------------------------------------------------

    // Devuelve todas las categorías con stock calculado (total, operativo, averiado, etc.)
    public function getAllCategorias(): array
    {
        return $this->db->query(
            "SELECT c.id, c.nombre, c.created_at,
                    CONCAT(u.nombre, ' ', u.apellidos) AS creado_por,
                    COUNT(i.id)                        AS total,
                    SUM(i.estado = 'operativo')        AS disponible,
                    SUM(i.estado = 'averiado')         AS averiado,
                    SUM(i.estado = 'en_reparacion')    AS en_reparacion,
                    SUM(i.estado = 'dado_de_baja')     AS dado_de_baja
             FROM inventario_categorias c
             LEFT JOIN users u          ON u.id = c.creado_por
             LEFT JOIN inventario_items i ON i.categoria_id = c.id
             GROUP BY c.id
             ORDER BY c.nombre"
        )->fetchAll();
    }

    // Devuelve una categoría por ID con su stock calculado, o false si no existe
    public function getCategoriaById(int $id): array|false
    {
        $stmt = $this->db->prepare(
            "SELECT c.id, c.nombre, c.created_at,
                    CONCAT(u.nombre, ' ', u.apellidos) AS creado_por,
                    COUNT(i.id)                        AS total,
                    SUM(i.estado = 'operativo')        AS disponible,
                    SUM(i.estado = 'averiado')         AS averiado,
                    SUM(i.estado = 'en_reparacion')    AS en_reparacion,
                    SUM(i.estado = 'dado_de_baja')     AS dado_de_baja
             FROM inventario_categorias c
             LEFT JOIN users u          ON u.id = c.creado_por
             LEFT JOIN inventario_items i ON i.categoria_id = c.id
             WHERE c.id = ?
             GROUP BY c.id"
        );
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    // Comprueba si ya existe una categoría con ese nombre (para evitar duplicados)
    public function nombreCategoriaExiste(string $nombre, ?int $excluirId = null): bool
    {
        if ($excluirId !== null) {
            $stmt = $this->db->prepare('SELECT COUNT(*) FROM inventario_categorias WHERE nombre = ? AND id != ?');
            $stmt->execute([$nombre, $excluirId]);
        } else {
            $stmt = $this->db->prepare('SELECT COUNT(*) FROM inventario_categorias WHERE nombre = ?');
            $stmt->execute([$nombre]);
        }
        return (int) $stmt->fetchColumn() > 0;
    }

    // Crea una nueva categoría y devuelve el ID generado
    public function createCategoria(string $nombre, int $creadoPor): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO inventario_categorias (nombre, creado_por) VALUES (:nombre, :creado_por)'
        );
        $stmt->execute([':nombre' => $nombre, ':creado_por' => $creadoPor]);
        return (int) $this->db->lastInsertId();
    }

    /**
     * INSERT múltiple: crea $cantidad items con nombres "$nombreBase $i"
     * para i desde $desde hasta $desde + $cantidad - 1, todos operativos.
     */
    public function crearItemsEnLote(int $categoriaId, string $nombreBase, int $desde, int $cantidad): void
    {
        $placeholders = implode(',', array_fill(0, $cantidad, '(?, ?, ?)'));
        $values = [];
        for ($i = $desde; $i < $desde + $cantidad; $i++) {
            $values[] = $categoriaId;
            $values[] = "$nombreBase $i";
            $values[] = 'operativo';
        }
        $stmt = $this->db->prepare(
            "INSERT INTO inventario_items (categoria_id, nombre, estado) VALUES $placeholders"
        );
        $stmt->execute($values);
    }

    /**
     * Devuelve el mayor sufijo numérico entre los nombres de items de la categoría.
     * Extrae el número al final del nombre: "Ratón 30" → 30. Devuelve 0 si no hay items.
     */
    public function getUltimoNumeroItem(int $categoriaId): int
    {
        $stmt = $this->db->prepare(
            "SELECT COALESCE(MAX(CAST(REGEXP_SUBSTR(nombre, '[0-9]+$') AS UNSIGNED)), 0)
             FROM inventario_items WHERE categoria_id = ?"
        );
        $stmt->execute([$categoriaId]);
        return (int) $stmt->fetchColumn();
    }

    // Actualiza el nombre de una categoría
    public function updateCategoria(int $id, string $nombre): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE inventario_categorias SET nombre = :nombre WHERE id = :id'
        );
        $stmt->execute([':nombre' => $nombre, ':id' => $id]);
        return $stmt->rowCount() > 0;
    }

    // Elimina una categoría y sus items en cascada (vía FK)
    public function deleteCategoria(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM inventario_categorias WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }

    // ---- ITEMS -----------------------------------------------------

    // Devuelve los items de una categoría, ordenados por sufijo numérico del nombre
    public function getItemsByCategoria(int $categoriaId): array
    {
        $stmt = $this->db->prepare(
            "SELECT id, nombre, estado FROM inventario_items
             WHERE categoria_id = ?
             ORDER BY CAST(REGEXP_SUBSTR(nombre, '[0-9]+$') AS UNSIGNED), nombre"
        );
        $stmt->execute([$categoriaId]);
        return $stmt->fetchAll();
    }

    // Busca un item por su ID
    public function getItemById(int $id): array|false
    {
        $stmt = $this->db->prepare('SELECT * FROM inventario_items WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    // Actualiza el nombre y estado de un item de inventario
    public function updateItem(int $id, string $nombre, string $estado): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE inventario_items SET nombre = :nombre, estado = :estado WHERE id = :id'
        );
        $stmt->execute([':nombre' => $nombre, ':estado' => $estado, ':id' => $id]);
        return $stmt->rowCount() > 0;
    }

    // Elimina un item individual de inventario
    public function deleteItem(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM inventario_items WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }
}

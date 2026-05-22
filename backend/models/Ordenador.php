<?php
/**
 * Ordenador.php — Modelo de ordenadores de un aula
 * Gestiona los PCs físicos, su posición en la cuadrícula y su software instalado.
 */

require_once __DIR__ . '/../config/Database.php';

class Ordenador
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // ----------------------------------------------------------
    // Obtener todos los ordenadores de un aula, con su software
    // Ordenados por fila y columna (orden de lectura)
    // ----------------------------------------------------------
    public function obtenerPorAula(int $aulaId): array
    {
        $stmt = $this->db->prepare('
            SELECT id, aula_id, nombre, fila, columna, estado, created_at
            FROM ordenadores
            WHERE aula_id = ?
            ORDER BY fila, columna
        ');
        $stmt->execute([$aulaId]);
        $ordenadores = $stmt->fetchAll();

        if (empty($ordenadores)) {
            return [];
        }

        // Obtener el software de todos los PCs en una sola consulta
        $ids          = array_column($ordenadores, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt2 = $this->db->prepare("
            SELECT os.ordenador_id, s.id, s.nombre, s.version, os.origen
            FROM ordenador_software os
            JOIN software s ON os.software_id = s.id
            WHERE os.ordenador_id IN ($placeholders)
            ORDER BY s.nombre
        ");
        $stmt2->execute($ids);

        $softwarePorOrdenador = [];
        foreach ($stmt2->fetchAll() as $sw) {
            $softwarePorOrdenador[$sw['ordenador_id']][] = [
                'id'      => $sw['id'],
                'nombre'  => $sw['nombre'],
                'version' => $sw['version'],
                'origen'  => $sw['origen'],
            ];
        }

        foreach ($ordenadores as &$o) {
            $o['software'] = $softwarePorOrdenador[$o['id']] ?? [];
        }
        unset($o);

        return $ordenadores;
    }

    // ----------------------------------------------------------
    // Obtener un ordenador por ID (con su software instalado)
    // ----------------------------------------------------------
    public function obtenerPorId(int $id): array|false
    {
        $stmt = $this->db->prepare('
            SELECT id, aula_id, nombre, fila, columna, estado, created_at
            FROM ordenadores
            WHERE id = ?
        ');
        $stmt->execute([$id]);
        $o = $stmt->fetch();

        if (!$o) {
            return false;
        }

        $stmt2 = $this->db->prepare('
            SELECT s.id, s.nombre, s.version, os.origen
            FROM ordenador_software os
            JOIN software s ON os.software_id = s.id
            WHERE os.ordenador_id = ?
            ORDER BY s.nombre
        ');
        $stmt2->execute([$id]);
        $o['software'] = $stmt2->fetchAll();

        return $o;
    }

    // ----------------------------------------------------------
    // Crear un único ordenador en una posición concreta
    // ----------------------------------------------------------
    public function crear(int $aulaId, string $nombre, int $fila, int $columna): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO ordenadores (aula_id, nombre, fila, columna)
            VALUES (:aula_id, :nombre, :fila, :columna)
        ');
        $stmt->execute([
            ':aula_id' => $aulaId,
            ':nombre'  => $nombre,
            ':fila'    => $fila,
            ':columna' => $columna,
        ]);
        return (int) $this->db->lastInsertId();
    }

    // ----------------------------------------------------------
    // Crear N ordenadores en lote con posiciones automáticas
    // Nombre por defecto: PC-01, PC-02, ...
    // Posición: fila = floor(i / columnas), columna = i % columnas
    // ----------------------------------------------------------
    public function crearEnLote(int $aulaId, int $cantidad, int $columnas): array
    {
        $ids = [];
        $stmt = $this->db->prepare('
            INSERT INTO ordenadores (aula_id, nombre, fila, columna)
            VALUES (:aula_id, :nombre, :fila, :columna)
        ');

        for ($i = 0; $i < $cantidad; $i++) {
            $nombre = 'PC-' . str_pad($i + 1, 2, '0', STR_PAD_LEFT);
            $fila   = (int) floor($i / $columnas);
            $col    = $i % $columnas;
            $stmt->execute([
                ':aula_id' => $aulaId,
                ':nombre'  => $nombre,
                ':fila'    => $fila,
                ':columna' => $col,
            ]);
            $ids[] = (int) $this->db->lastInsertId();
        }

        return $ids;
    }

    // ----------------------------------------------------------
    // Actualizar nombre y/o estado de un ordenador
    // ----------------------------------------------------------
    public function actualizar(int $id, array $datos): bool
    {
        $campos = [];
        $params = [];

        if (array_key_exists('nombre', $datos)) {
            $campos[]          = 'nombre = :nombre';
            $params[':nombre'] = $datos['nombre'];
        }
        if (array_key_exists('estado', $datos)) {
            $campos[]          = 'estado = :estado';
            $params[':estado'] = $datos['estado'];
        }

        if (empty($campos)) {
            return false;
        }

        $params[':id'] = $id;
        $stmt = $this->db->prepare('
            UPDATE ordenadores SET ' . implode(', ', $campos) . ' WHERE id = :id
        ');
        $stmt->execute($params);
        return $stmt->rowCount() > 0;
    }

    // ----------------------------------------------------------
    // Eliminar un ordenador
    // ----------------------------------------------------------
    public function eliminar(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM ordenadores WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }

    // ----------------------------------------------------------
    // Obtener los ordenadores asociados a una solicitud
    // ----------------------------------------------------------
    public function obtenerPorSolicitud(int $solicitudId): array
    {
        $stmt = $this->db->prepare('
            SELECT o.id, o.nombre, o.fila, o.columna, o.estado
            FROM solicitud_ordenadores so
            JOIN ordenadores o ON o.id = so.ordenador_id
            WHERE so.solicitud_id = ?
            ORDER BY o.fila, o.columna
        ');
        $stmt->execute([$solicitudId]);
        return $stmt->fetchAll();
    }

    // ----------------------------------------------------------
    // Devuelve los IDs de la lista que tienen estado no seleccionable
    // (averiado o mantenimiento). Array vacío = todos válidos.
    // ----------------------------------------------------------
    public function obtenerNoSeleccionables(array $ordenadorIds): array
    {
        if (empty($ordenadorIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($ordenadorIds), '?'));
        $stmt = $this->db->prepare("
            SELECT id, nombre, estado
            FROM ordenadores
            WHERE id IN ($placeholders)
              AND estado IN ('averiado', 'mantenimiento')
        ");
        $stmt->execute(array_values($ordenadorIds));
        return $stmt->fetchAll();
    }

    // ----------------------------------------------------------
    // Asociar ordenadores a una solicitud (reemplaza los existentes)
    // ----------------------------------------------------------
    public function asociarASolicitud(int $solicitudId, array $ordenadorIds): void
    {
        // Borrar asociaciones previas
        $stmt = $this->db->prepare('DELETE FROM solicitud_ordenadores WHERE solicitud_id = ?');
        $stmt->execute([$solicitudId]);

        if (empty($ordenadorIds)) {
            return;
        }

        $stmt = $this->db->prepare('
            INSERT IGNORE INTO solicitud_ordenadores (solicitud_id, ordenador_id)
            VALUES (:solicitud_id, :ordenador_id)
        ');
        foreach ($ordenadorIds as $oid) {
            $stmt->execute([':solicitud_id' => $solicitudId, ':ordenador_id' => (int) $oid]);
        }
    }

    // ----------------------------------------------------------
    // Registrar software como instalado en los ordenadores de una solicitud.
    // Se llama automáticamente cuando la solicitud pasa a "completada".
    // Usa INSERT IGNORE para no duplicar si ya estaba registrado.
    // ----------------------------------------------------------
    public function registrarSoftwareInstalado(int $solicitudId, int $softwareId): void
    {
        $stmt = $this->db->prepare('
            INSERT IGNORE INTO ordenador_software (ordenador_id, software_id)
            SELECT ordenador_id, :software_id
            FROM solicitud_ordenadores
            WHERE solicitud_id = :solicitud_id
        ');
        $stmt->execute([
            ':software_id'  => $softwareId,
            ':solicitud_id' => $solicitudId,
        ]);
    }

    // ----------------------------------------------------------
    // Resumen de estado de los ordenadores de un aula
    // Devuelve: [ 'total' => N, 'operativo' => N, 'averiado' => N, ... ]
    // ----------------------------------------------------------
    public function resumenEstadoPorAula(int $aulaId): array
    {
        $stmt = $this->db->prepare('
            SELECT estado, COUNT(*) as total
            FROM ordenadores
            WHERE aula_id = ?
            GROUP BY estado
        ');
        $stmt->execute([$aulaId]);

        $resumen = [
            'total'        => 0,
            'operativo'    => 0,
            'averiado'     => 0,
            'sin_monitor'  => 0,
            'mantenimiento'=> 0,
        ];

        foreach ($stmt->fetchAll() as $fila) {
            $resumen[$fila['estado']] = (int) $fila['total'];
            $resumen['total']        += (int) $fila['total'];
        }

        return $resumen;
    }

    // ----------------------------------------------------------
    // Añadir software manualmente desde el catálogo (origen: manual)
    // Devuelve false si ya estaba instalado (duplicado).
    // ----------------------------------------------------------
    public function añadirSoftware(int $ordenadorId, int $softwareId): bool
    {
        // Verificar que no exista ya
        $stmt = $this->db->prepare('
            SELECT 1 FROM ordenador_software
            WHERE ordenador_id = ? AND software_id = ?
        ');
        $stmt->execute([$ordenadorId, $softwareId]);
        if ($stmt->fetch()) {
            return false;
        }

        $stmt = $this->db->prepare('
            INSERT INTO ordenador_software (ordenador_id, software_id, origen)
            VALUES (?, ?, \'manual\')
        ');
        $stmt->execute([$ordenadorId, $softwareId]);
        return true;
    }

    // ----------------------------------------------------------
    // Eliminar software de un PC (cualquier origen)
    // Devuelve true si se eliminó, false si no existía.
    // ----------------------------------------------------------
    public function eliminarSoftware(int $ordenadorId, int $softwareId): bool
    {
        $stmt = $this->db->prepare('
            DELETE FROM ordenador_software
            WHERE ordenador_id = ? AND software_id = ?
        ');
        $stmt->execute([$ordenadorId, $softwareId]);
        return $stmt->rowCount() > 0;
    }

    // ----------------------------------------------------------
    // Importar software seleccionado de otro PC del mismo aula.
    // $softwareIds: array de software_id a copiar.
    // Verifica que todos los IDs pertenezcan a PCs del mismo aula.
    // Usa INSERT IGNORE para no duplicar.
    // Devuelve el número de filas insertadas.
    // ----------------------------------------------------------
    public function importarSoftware(int $ordenadorId, array $softwareIds): int
    {
        if (empty($softwareIds)) {
            return 0;
        }

        // Obtener el aula_id del PC destino
        $stmt = $this->db->prepare('SELECT aula_id FROM ordenadores WHERE id = ?');
        $stmt->execute([$ordenadorId]);
        $row = $stmt->fetch();
        if (!$row) {
            return 0;
        }
        $aulaId = (int) $row['aula_id'];

        // Verificar que los software_ids pertenecen a PCs del mismo aula
        $placeholders = implode(',', array_fill(0, count($softwareIds), '?'));
        $stmt = $this->db->prepare("
            SELECT DISTINCT os.software_id
            FROM ordenador_software os
            JOIN ordenadores o ON os.ordenador_id = o.id
            WHERE o.aula_id = ?
              AND os.software_id IN ($placeholders)
        ");
        $stmt->execute(array_merge([$aulaId], array_values($softwareIds)));
        $validos = array_column($stmt->fetchAll(), 'software_id');

        $insertados = 0;
        $stmtIns = $this->db->prepare('
            INSERT IGNORE INTO ordenador_software (ordenador_id, software_id, origen)
            VALUES (?, ?, \'importado\')
        ');
        foreach ($validos as $swId) {
            $stmtIns->execute([$ordenadorId, (int) $swId]);
            $insertados += $stmtIns->rowCount();
        }

        return $insertados;
    }
}

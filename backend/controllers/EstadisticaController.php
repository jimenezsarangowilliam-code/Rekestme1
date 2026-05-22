<?php
/**
 * EstadisticaController.php — Estadísticas para el dashboard TIC/admin
 * GET /api/estadisticas
 */

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';

class EstadisticaController
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // ----------------------------------------------------------
    // GET /api/estadisticas
    // Solo TIC/admin pueden consultar estadísticas globales
    // ----------------------------------------------------------
    public function index(): void
    {
        Auth::requerirRol(['tic', 'admin']);

        $data = [
            'total_por_estado'         => $this->totalPorEstado(),
            'software_mas_solicitado'  => $this->softwareMasSolicitado(),
            'aulas_con_mas_solicitudes'=> $this->aulasMasSolicitudes(),
            'solicitudes_por_mes'      => $this->solicitudesPorMes(),
            'tiempo_medio_resolucion'  => $this->tiempoMedioResolucion(),
            'resumen'                  => $this->resumen(),
        ];

        Response::success($data, 'Estadísticas obtenidas correctamente.');
    }

    // Totales agrupados por estado
    private function totalPorEstado(): array
    {
        $stmt = $this->db->query(
            "SELECT estado, COUNT(*) AS total
             FROM solicitudes
             GROUP BY estado
             ORDER BY FIELD(estado,'pendiente','en_revision','aprobada','en_instalacion','completada','rechazada')"
        );
        return $stmt->fetchAll();
    }

    // Top 5 software más solicitado
    private function softwareMasSolicitado(): array
    {
        $stmt = $this->db->query(
            "SELECT sw.nombre, sw.version, COUNT(s.id) AS total
             FROM solicitudes s
             JOIN software sw ON sw.id = s.software_id
             GROUP BY s.software_id
             ORDER BY total DESC
             LIMIT 5"
        );
        return $stmt->fetchAll();
    }

    // Top 5 aulas con más solicitudes
    private function aulasMasSolicitudes(): array
    {
        $stmt = $this->db->query(
            "SELECT a.nombre AS aula, a.edificio, COUNT(s.id) AS total
             FROM solicitudes s
             JOIN aulas a ON a.id = s.aula_id
             GROUP BY s.aula_id
             ORDER BY total DESC
             LIMIT 5"
        );
        return $stmt->fetchAll();
    }

    // Solicitudes creadas por mes (últimos 6 meses)
    private function solicitudesPorMes(): array
    {
        $stmt = $this->db->query(
            "SELECT DATE_FORMAT(created_at, '%Y-%m') AS mes,
                    COUNT(*) AS total
             FROM solicitudes
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
             GROUP BY mes
             ORDER BY mes ASC"
        );
        return $stmt->fetchAll();
    }

    // Tiempo medio de resolución en días (solicitudes completadas)
    private function tiempoMedioResolucion(): float|null
    {
        $stmt = $this->db->query(
            "SELECT AVG(DATEDIFF(updated_at, created_at)) AS dias_promedio
             FROM solicitudes
             WHERE estado = 'completada'"
        );
        $row = $stmt->fetch();
        return $row && $row['dias_promedio'] !== null
            ? round((float) $row['dias_promedio'], 1)
            : null;
    }

    // Resumen rápido: totales globales
    private function resumen(): array
    {
        $stmt = $this->db->query(
            "SELECT
                COUNT(*) AS total,
                SUM(estado = 'pendiente') AS pendientes,
                SUM(estado IN ('en_revision','aprobada','en_instalacion')) AS en_curso,
                SUM(estado = 'completada') AS completadas,
                SUM(estado = 'rechazada') AS rechazadas
             FROM solicitudes"
        );
        return $stmt->fetch();
    }
}

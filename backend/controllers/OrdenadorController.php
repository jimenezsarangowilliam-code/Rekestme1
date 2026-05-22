<?php
/**
 * OrdenadorController.php — Gestión de ordenadores por aula
 *
 * GET    /api/aulas/{aulaId}/ordenadores         → lista PCs del aula con software
 * POST   /api/aulas/{aulaId}/ordenadores         → crear PC(s) en el aula
 * PUT    /api/ordenadores/{id}                   → actualizar estado y/o nombre
 * DELETE /api/ordenadores/{id}                   → eliminar PC
 */

require_once __DIR__ . '/../models/Ordenador.php';
require_once __DIR__ . '/../models/Aula.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';

class OrdenadorController
{
    private Ordenador $model;
    private Aula      $aulaModel;

    public function __construct()
    {
        $this->model     = new Ordenador();
        $this->aulaModel = new Aula();
    }

    // ----------------------------------------------------------
    // GET /api/aulas/{aulaId}/ordenadores
    // Devuelve todos los PCs del aula con su software instalado
    // Accesible para cualquier usuario autenticado
    // ----------------------------------------------------------
    public function listar(int $aulaId): void
    {
        Auth::requerirLogin();

        if (!$this->aulaModel->getById($aulaId)) {
            Response::notFound('Aula no encontrada.');
        }

        $ordenadores = $this->model->obtenerPorAula($aulaId);
        $resumen     = $this->model->resumenEstadoPorAula($aulaId);

        Response::success(
            ['ordenadores' => $ordenadores, 'resumen' => $resumen],
            'Ordenadores obtenidos correctamente.'
        );
    }

    // ----------------------------------------------------------
    // POST /api/aulas/{aulaId}/ordenadores
    // Crear uno o varios PCs. Solo TIC/admin.
    //
    // Modo lote:   { cantidad: N, columnas: N }
    // Modo individual: { nombre: "PC-05", fila: 1, columna: 0 }
    // ----------------------------------------------------------
    public function crear(int $aulaId): void
    {
        Auth::requerirRol(['tic', 'admin']);

        if (!$this->aulaModel->getById($aulaId)) {
            Response::notFound('Aula no encontrada.');
        }

        $body = $this->getBody();

        if (isset($body['cantidad'])) {
            // Modo lote
            $cantidad = (int) $body['cantidad'];
            $columnas = (int) ($body['columnas'] ?? 4);

            if ($cantidad < 1 || $cantidad > 100) {
                Response::error('La cantidad debe estar entre 1 y 100.', 422);
            }
            if ($columnas < 1 || $columnas > 10) {
                Response::error('Las columnas deben estar entre 1 y 10.', 422);
            }

            // Si se envían columnas, actualizar el campo columnas del aula
            if (isset($body['columnas'])) {
                $aula = $this->aulaModel->getById($aulaId);
                $this->aulaModel->update($aulaId, array_merge((array) $aula, ['columnas' => $columnas]));
            }

            $ids = $this->model->crearEnLote($aulaId, $cantidad, $columnas);
            $ordenadores = $this->model->obtenerPorAula($aulaId);
            Response::success(
                ['ids' => $ids, 'ordenadores' => $ordenadores],
                "{$cantidad} ordenadores creados correctamente.",
                201
            );
        } else {
            // Modo individual
            $errores = [];
            if (empty($body['nombre']))           $errores[] = 'El nombre es obligatorio.';
            if (!isset($body['fila']))             $errores[] = 'La fila es obligatoria.';
            if (!isset($body['columna']))          $errores[] = 'La columna es obligatoria.';
            if ($errores) Response::error('Datos no válidos.', 422, $errores);

            $id = $this->model->crear(
                $aulaId,
                trim($body['nombre']),
                (int) $body['fila'],
                (int) $body['columna']
            );
            $ordenador = $this->model->obtenerPorId($id);
            Response::success($ordenador, 'Ordenador creado correctamente.', 201);
        }
    }

    // ----------------------------------------------------------
    // PUT /api/ordenadores/{id}
    // Actualizar nombre y/o estado. Solo TIC/admin.
    // ----------------------------------------------------------
    public function actualizar(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);

        $ordenador = $this->model->obtenerPorId($id);
        if (!$ordenador) Response::notFound('Ordenador no encontrado.');

        $body    = $this->getBody();
        $errores = [];

        $estadosValidos = ['operativo', 'averiado', 'sin_monitor', 'mantenimiento'];
        if (isset($body['estado']) && !in_array($body['estado'], $estadosValidos, true)) {
            $errores[] = 'Estado no válido. Valores: ' . implode(', ', $estadosValidos);
        }
        if (isset($body['nombre']) && trim($body['nombre']) === '') {
            $errores[] = 'El nombre no puede estar vacío.';
        }
        if ($errores) Response::error('Datos no válidos.', 422, $errores);

        $datos = array_filter([
            'nombre' => isset($body['nombre']) ? trim($body['nombre']) : null,
            'estado' => $body['estado'] ?? null,
        ], fn($v) => $v !== null);

        $this->model->actualizar($id, $datos);
        $ordenador = $this->model->obtenerPorId($id);
        Response::success($ordenador, 'Ordenador actualizado correctamente.');
    }

    // ----------------------------------------------------------
    // DELETE /api/ordenadores/{id}
    // Eliminar un PC. Solo TIC/admin.
    // ----------------------------------------------------------
    public function eliminar(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);

        if (!$this->model->obtenerPorId($id)) {
            Response::notFound('Ordenador no encontrado.');
        }

        $eliminado = $this->model->eliminar($id);
        if (!$eliminado) {
            Response::error('No se pudo eliminar el ordenador.', 500);
        }

        Response::success(null, 'Ordenador eliminado correctamente.');
    }

    // ----------------------------------------------------------
    // POST /api/ordenadores/{id}/software
    // Añadir software del catálogo a un PC (origen: manual).
    // Solo TIC/admin.
    // ----------------------------------------------------------
    public function añadirSoftware(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);

        $ordenador = $this->model->obtenerPorId($id);
        if (!$ordenador) Response::notFound('Ordenador no encontrado.');

        $body = $this->getBody();
        $softwareId = isset($body['software_id']) ? (int) $body['software_id'] : 0;
        if ($softwareId <= 0) {
            Response::error('El campo software_id es obligatorio.', 422);
        }

        // Verificar que el software existe en el catálogo
        require_once __DIR__ . '/../models/Software.php';
        $swModel = new Software();
        if (!$swModel->getById($softwareId)) {
            Response::notFound('Software no encontrado en el catálogo.');
        }

        $insertado = $this->model->añadirSoftware($id, $softwareId);
        if (!$insertado) {
            Response::error('Este software ya está instalado en el PC.', 409);
        }

        $ordenador = $this->model->obtenerPorId($id);
        Response::success($ordenador, 'Software añadido correctamente.', 201);
    }

    // ----------------------------------------------------------
    // DELETE /api/ordenadores/{id}/software/{swId}
    // Eliminar software de un PC. Solo TIC/admin.
    // ----------------------------------------------------------
    public function eliminarSoftware(int $id, int $swId): void
    {
        Auth::requerirRol(['tic', 'admin']);

        if (!$this->model->obtenerPorId($id)) {
            Response::notFound('Ordenador no encontrado.');
        }

        $eliminado = $this->model->eliminarSoftware($id, $swId);
        if (!$eliminado) {
            Response::notFound('Este software no está instalado en el PC.');
        }

        $ordenador = $this->model->obtenerPorId($id);
        Response::success($ordenador, 'Software eliminado correctamente.');
    }

    // ----------------------------------------------------------
    // POST /api/ordenadores/{id}/importar
    // Importar software seleccionado de otro PC del mismo aula.
    // Body: { software_ids: [1, 2, 3] }
    // Solo TIC/admin.
    // ----------------------------------------------------------
    public function importarSoftware(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);

        if (!$this->model->obtenerPorId($id)) {
            Response::notFound('Ordenador no encontrado.');
        }

        $body = $this->getBody();
        $softwareIds = $body['software_ids'] ?? [];

        if (!is_array($softwareIds) || empty($softwareIds)) {
            Response::error('El campo software_ids debe ser un array no vacío.', 422);
        }

        $softwareIds = array_map('intval', $softwareIds);
        $insertados  = $this->model->importarSoftware($id, $softwareIds);

        $ordenador = $this->model->obtenerPorId($id);
        Response::success($ordenador, "{$insertados} software(s) importados correctamente.");
    }

    private function getBody(): array
    {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

<?php
/**
 * AulaController.php — CRUD de aulas del centro
 * Gestiona la creación, edición, borrado y consulta de aulas,
 * incluyendo el resumen de estado de sus ordenadores.
 */

require_once __DIR__ . '/../models/Aula.php';
require_once __DIR__ . '/../models/Ordenador.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';

class AulaController
{
    private Aula      $model;
    private Ordenador $ordenadorModel;

    public function __construct()
    {
        $this->model          = new Aula();
        $this->ordenadorModel = new Ordenador();
    }

    // GET /api/aulas — Accesible para cualquier usuario autenticado
    public function index(): void
    {
        Auth::requerirLogin();
        $aulas = $this->model->getAll();
        foreach ($aulas as &$aula) {
            $aula['ordenadores_resumen'] = $this->ordenadorModel->resumenEstadoPorAula($aula['id']);
        }
        unset($aula);
        Response::success($aulas, 'Aulas obtenidas correctamente.');
    }

    // GET /api/aulas/{id} — Incluye resumen de ordenadores
    public function show(int $id): void
    {
        Auth::requerirLogin();
        $aula = $this->model->getById($id);
        if (!$aula) Response::notFound('Aula no encontrada.');

        // Adjuntar resumen de ordenadores
        $aula['ordenadores_resumen'] = $this->ordenadorModel->resumenEstadoPorAula($id);

        Response::success($aula, 'Aula obtenida correctamente.');
    }

    // POST /api/aulas — Solo TIC/admin
    // Acepta opcionales: num_ordenadores (int) y columnas (int)
    public function store(): void
    {
        Auth::requerirRol(['tic', 'admin']);
        $body    = $this->getBody();
        $errores = $this->validar($body);
        if ($errores) Response::error('Datos no válidos.', 422, $errores);

        if ($this->model->nombreExiste($body['nombre'], $body['edificio'])) {
            Response::error('Ya existe un aula con ese nombre en ese edificio.', 409);
        }

        $id   = $this->model->create($body);
        $aula = $this->model->getById($id);

        // Crear ordenadores en lote si se indica cantidad
        if (!empty($body['num_ordenadores']) && (int) $body['num_ordenadores'] > 0) {
            $columnas = (int) ($body['columnas'] ?? 4);
            $this->ordenadorModel->crearEnLote($id, (int) $body['num_ordenadores'], $columnas);
        }

        $aula['ordenadores_resumen'] = $this->ordenadorModel->resumenEstadoPorAula($id);
        Response::success($aula, 'Aula creada correctamente.', 201);
    }

    // PUT /api/aulas/{id} — Solo TIC/admin
    public function update(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);
        if (!$this->model->getById($id)) Response::notFound('Aula no encontrada.');

        $body    = $this->getBody();
        $errores = $this->validar($body);
        if ($errores) Response::error('Datos no válidos.', 422, $errores);

        if ($this->model->nombreExiste($body['nombre'], $body['edificio'], $id)) {
            Response::error('Ya existe un aula con ese nombre en ese edificio.', 409);
        }

        $this->model->update($id, $body);
        $aula = $this->model->getById($id);
        $aula['ordenadores_resumen'] = $this->ordenadorModel->resumenEstadoPorAula($id);
        Response::success($aula, 'Aula actualizada correctamente.');
    }

    // GET /api/aulas/{id}/vinculos — Solo TIC/admin
    public function vinculos(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);
        if (!$this->model->getById($id)) Response::notFound('Aula no encontrada.');
        Response::success($this->model->getVinculos($id), 'Vínculos obtenidos.');
    }

    // DELETE /api/aulas/{id} — Solo TIC/admin
    public function destroy(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);
        if (!$this->model->getById($id)) Response::notFound('Aula no encontrada.');

        $eliminado = $this->model->delete($id);
        if (!$eliminado) {
            Response::error('No se puede eliminar: el aula tiene solicitudes asociadas.', 409);
        }
        Response::success(null, 'Aula eliminada correctamente.');
    }

    private function validar(array $body): array
    {
        $errores = [];
        if (empty($body['nombre']))   $errores[] = 'El nombre es obligatorio.';
        if (empty($body['edificio'])) $errores[] = 'El edificio es obligatorio.';
        if (empty($body['planta']))   $errores[] = 'La planta es obligatoria.';
        if (!isset($body['capacidad']) || !is_numeric($body['capacidad'])) {
            $errores[] = 'La capacidad debe ser un número.';
        } elseif ((int) $body['capacidad'] < 1 || (int) $body['capacidad'] > 100) {
            $errores[] = 'La capacidad debe estar entre 1 y 100.';
        }
        if (isset($body['num_ordenadores']) && (int) $body['num_ordenadores'] > 100) {
            $errores[] = 'El número de ordenadores no puede superar 100.';
        }
        return $errores;
    }

    private function getBody(): array
    {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

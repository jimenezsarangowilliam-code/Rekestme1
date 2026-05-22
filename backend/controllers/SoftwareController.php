<?php
/**
 * SoftwareController.php — CRUD del catálogo de software instalable
 * Gestiona el alta, edición y borrado de software disponible para solicitudes.
 * TIC/admin pueden gestionar el catálogo; profesores pueden añadir software al crear solicitudes.
 */

require_once __DIR__ . '/../models/Software.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';

class SoftwareController
{
    private Software $model;

    public function __construct()
    {
        $this->model = new Software();
    }

    // GET /api/software
    public function index(): void
    {
        Auth::requerirLogin();
        Response::success($this->model->getAll(), 'Software obtenido correctamente.');
    }

    // GET /api/software/{id}
    public function show(int $id): void
    {
        Auth::requerirLogin();
        $sw = $this->model->getById($id);
        if (!$sw) Response::notFound('Software no encontrado.');
        Response::success($sw, 'Software obtenido correctamente.');
    }

    // POST /api/software — TIC/admin y profesor (al crear solicitudes con software nuevo)
    public function store(): void
    {
        Auth::requerirRol(['tic', 'admin', 'profesor']);
        $body    = $this->getBody();
        $errores = $this->validar($body);
        if ($errores) Response::error('Datos no válidos.', 422, $errores);

        $version = $body['version'] ?? '1.0';
        if ($this->model->nombreVersionExiste($body['nombre'], $version)) {
            Response::error('Ya existe software con ese nombre y versión.', 409);
        }

        $id = $this->model->create($body);
        Response::success($this->model->getById($id), 'Software añadido correctamente.', 201);
    }

    // PUT /api/software/{id} — Solo TIC/admin
    public function update(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);
        if (!$this->model->getById($id)) Response::notFound('Software no encontrado.');

        $body    = $this->getBody();
        $errores = $this->validar($body);
        if ($errores) Response::error('Datos no válidos.', 422, $errores);

        $version = $body['version'] ?? '1.0';
        if ($this->model->nombreVersionExiste($body['nombre'], $version, $id)) {
            Response::error('Ya existe software con ese nombre y versión.', 409);
        }

        $this->model->update($id, $body);
        Response::success($this->model->getById($id), 'Software actualizado correctamente.');
    }

    // GET /api/software/{id}/vinculos — Solo TIC/admin
    public function vinculos(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);
        if (!$this->model->getById($id)) Response::notFound('Software no encontrado.');
        Response::success($this->model->getVinculos($id), 'Vínculos obtenidos.');
    }

    // DELETE /api/software/{id} — Solo TIC/admin
    public function destroy(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);
        if (!$this->model->getById($id)) Response::notFound('Software no encontrado.');

        $eliminado = $this->model->delete($id);
        if (!$eliminado) {
            Response::error('No se puede eliminar: hay solicitudes que usan este software.', 409);
        }
        Response::success(null, 'Software eliminado correctamente.');
    }

    private function validar(array $body): array
    {
        $errores      = [];
        $tiposValidos = ['gratuito', 'licencia', 'open_source'];

        if (empty($body['nombre'])) $errores[] = 'El nombre es obligatorio.';
        if (empty($body['tipo']) || !in_array($body['tipo'], $tiposValidos, true)) {
            $errores[] = 'El tipo debe ser: gratuito, licencia o open_source.';
        }
        if (!empty($body['url_descarga']) && !filter_var($body['url_descarga'], FILTER_VALIDATE_URL)) {
            $errores[] = 'La URL de descarga no es válida.';
        }
        return $errores;
    }

    private function getBody(): array
    {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

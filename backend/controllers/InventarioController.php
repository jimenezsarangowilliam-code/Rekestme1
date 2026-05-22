<?php
/**
 * InventarioController.php — CRUD de inventario de hardware
 *
 * GET    /api/inventario/categorias              → indexCategorias()
 * POST   /api/inventario/categorias              → storeCategoria()    body: { nombre, cantidad }
 * PUT    /api/inventario/categorias/{id}         → updateCategoria()   body: { nombre }
 * DELETE /api/inventario/categorias/{id}         → destroyCategoria()
 *
 * GET    /api/inventario/categorias/{id}/items   → indexItems()
 * POST   /api/inventario/categorias/{id}/items   → addItems()          body: { cantidad }
 * PUT    /api/inventario/items/{id}              → updateItem()        body: { nombre, estado }
 * DELETE /api/inventario/items/{id}              → destroyItem()
 */

require_once __DIR__ . '/../models/Inventario.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';

class InventarioController
{
    private Inventario $model;

    public function __construct()
    {
        $this->model = new Inventario();
    }

    // GET /api/inventario/categorias
    public function indexCategorias(): void
    {
        Auth::requerirRol(['tic', 'admin']);
        Response::success($this->model->getAllCategorias(), 'Categorías obtenidas.');
    }

    // POST /api/inventario/categorias  body: { nombre, cantidad }
    public function storeCategoria(): void
    {
        $usuario = Auth::requerirRol(['tic', 'admin']);
        $body    = $this->getBody();
        $errores = $this->validarNombreYCantidad($body);
        if ($errores) Response::error('Datos no válidos.', 422, $errores);

        $nombre   = trim($body['nombre']);
        $cantidad = (int) $body['cantidad'];
        $id       = $this->model->createCategoria($nombre, $usuario['id']);
        $this->model->crearItemsEnLote($id, $nombre, 1, $cantidad);

        Response::success($this->model->getCategoriaById($id), 'Categoría creada.', 201);
    }

    // PUT /api/inventario/categorias/{id}  body: { nombre }
    public function updateCategoria(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);
        if (!$this->model->getCategoriaById($id)) Response::notFound('Categoría no encontrada.');

        $body    = $this->getBody();
        $errores = [];
        if (empty(trim($body['nombre'] ?? ''))) $errores[] = 'El nombre es obligatorio.';
        if ($errores) Response::error('Datos no válidos.', 422, $errores);

        $this->model->updateCategoria($id, trim($body['nombre']));
        Response::success($this->model->getCategoriaById($id), 'Categoría actualizada.');
    }

    // DELETE /api/inventario/categorias/{id}
    public function destroyCategoria(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);
        if (!$this->model->getCategoriaById($id)) Response::notFound('Categoría no encontrada.');

        $this->model->deleteCategoria($id);
        Response::success(null, 'Categoría eliminada.');
    }

    // GET /api/inventario/categorias/{id}/items
    public function indexItems(int $categoriaId): void
    {
        Auth::requerirRol(['tic', 'admin']);
        if (!$this->model->getCategoriaById($categoriaId)) Response::notFound('Categoría no encontrada.');

        Response::success($this->model->getItemsByCategoria($categoriaId), 'Items obtenidos.');
    }

    // POST /api/inventario/categorias/{id}/items  body: { cantidad }
    public function addItems(int $categoriaId): void
    {
        Auth::requerirRol(['tic', 'admin']);
        $cat = $this->model->getCategoriaById($categoriaId);
        if (!$cat) Response::notFound('Categoría no encontrada.');

        $body     = $this->getBody();
        $errores  = [];
        $cantidad = (int) ($body['cantidad'] ?? 0);
        if ($cantidad < 1)   $errores[] = 'La cantidad debe ser al menos 1.';
        if ($cantidad > 500) $errores[] = 'La cantidad no puede superar 500.';
        if ($errores) Response::error('Datos no válidos.', 422, $errores);

        $ultimo = $this->model->getUltimoNumeroItem($categoriaId);
        $this->model->crearItemsEnLote($categoriaId, $cat['nombre'], $ultimo + 1, $cantidad);

        Response::success($this->model->getCategoriaById($categoriaId), 'Unidades añadidas.');
    }

    // PUT /api/inventario/items/{id}  body: { nombre, estado }
    public function updateItem(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);
        if (!$this->model->getItemById($id)) Response::notFound('Item no encontrado.');

        $body    = $this->getBody();
        $errores = $this->validarItem($body);
        if ($errores) Response::error('Datos no válidos.', 422, $errores);

        $this->model->updateItem($id, trim($body['nombre']), $body['estado']);
        Response::success($this->model->getItemById($id), 'Item actualizado.');
    }

    // DELETE /api/inventario/items/{id}
    public function destroyItem(int $id): void
    {
        Auth::requerirRol(['tic', 'admin']);
        if (!$this->model->getItemById($id)) Response::notFound('Item no encontrado.');

        $this->model->deleteItem($id);
        Response::success(null, 'Item eliminado.');
    }

    private function validarNombreYCantidad(array $body): array
    {
        $errores  = [];
        if (empty(trim($body['nombre'] ?? ''))) $errores[] = 'El nombre es obligatorio.';
        $cantidad = (int) ($body['cantidad'] ?? 0);
        if ($cantidad < 1)   $errores[] = 'La cantidad debe ser al menos 1.';
        if ($cantidad > 500) $errores[] = 'La cantidad no puede superar 500.';
        return $errores;
    }

    private function validarItem(array $body): array
    {
        $estadosValidos = ['operativo', 'averiado', 'en_reparacion', 'dado_de_baja'];
        $errores        = [];
        if (empty(trim($body['nombre'] ?? ''))) $errores[] = 'El nombre es obligatorio.';
        if (empty($body['estado']) || !in_array($body['estado'], $estadosValidos, true))
            $errores[] = 'Estado no válido.';
        return $errores;
    }

    private function getBody(): array
    {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

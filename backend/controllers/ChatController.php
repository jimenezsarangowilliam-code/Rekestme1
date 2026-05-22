<?php
/**
 * ChatController.php — Mensajes privados 1 a 1 para TIC/admin
 *
 * GET  /api/chat/usuarios           → usuarios()       Lista de contactos con info
 * GET  /api/chat/no-leidos          → noLeidos()       Badge global
 * GET  /api/chat/{id}/mensajes      → conversacion()   Mensajes con un usuario
 * POST /api/chat/{id}/mensajes      → enviar()         Enviar mensaje
 * PUT  /api/chat/{id}/leer          → leer()           Marcar leídos
 */

require_once __DIR__ . '/../models/ChatMensaje.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';

class ChatController
{
    private ChatMensaje $model;

    public function __construct()
    {
        $this->model = new ChatMensaje();
    }

    // GET /api/chat/usuarios
    public function usuarios(): void
    {
        $usuario  = Auth::requerirRol(['tic', 'admin']);
        $contactos = $this->model->obtenerUsuarios($usuario['id']);
        Response::success($contactos, 'Contactos obtenidos.');
    }

    // GET /api/chat/no-leidos
    public function noLeidos(): void
    {
        $usuario = Auth::requerirRol(['tic', 'admin']);
        $count   = $this->model->contarNoLeidos($usuario['id']);
        Response::success(['count' => $count], 'No leídos.');
    }

    // GET /api/chat/{otroId}/mensajes?desde_id=N
    public function conversacion(int $otroId): void
    {
        $usuario = Auth::requerirRol(['tic', 'admin']);
        $desdeId = max(0, (int) ($_GET['desde_id'] ?? 0));

        $mensajes = $this->model->obtenerConversacion($usuario['id'], $otroId, $desdeId);
        $ultimoId = count($mensajes) > 0 ? end($mensajes)['id'] : $desdeId;

        Response::success([
            'mensajes'  => $mensajes,
            'ultimo_id' => $ultimoId,
        ], 'Conversación obtenida.');
    }

    // POST /api/chat/{otroId}/mensajes
    public function enviar(int $otroId): void
    {
        $usuario = Auth::requerirRol(['tic', 'admin']);
        $body    = json_decode(file_get_contents('php://input'), true) ?? [];

        $mensaje = trim($body['mensaje'] ?? '');

        if ($mensaje === '') {
            Response::error('El mensaje no puede estar vacío.', 422);
        }
        if (mb_strlen($mensaje) > 1000) {
            Response::error('Máximo 1000 caracteres.', 422);
        }
        if ($otroId === $usuario['id']) {
            Response::error('No puedes enviarte mensajes a ti mismo.', 422);
        }

        $mensaje  = htmlspecialchars(strip_tags($mensaje), ENT_QUOTES, 'UTF-8');
        $nuevoId  = $this->model->enviarMensaje($usuario['id'], $otroId, $mensaje);
        $creado   = $this->model->getById($nuevoId);

        Response::success($creado, 'Mensaje enviado.', 201);
    }

    // PUT /api/chat/{otroId}/leer
    public function leer(int $otroId): void
    {
        $usuario = Auth::requerirRol(['tic', 'admin']);
        $n       = $this->model->marcarLeidos($otroId, $usuario['id']);
        Response::success(['marcados' => $n], 'Mensajes marcados como leídos.');
    }
}

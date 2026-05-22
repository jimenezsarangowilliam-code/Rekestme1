<?php
/**
 * ChatbotController.php
 *
 * POST /api/chatbot  → chat()
 */

require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/AIClient.php';

class ChatbotController
{
    public function chat(): void
    {
        // 1. Autenticación requerida (cualquier rol)
        $usuario = Auth::requerirLogin();

        // 2. Rate limiting: asegurar que la sesión PHP está activa
        //    (puede llegar solo con JWT sin sesión PHP)
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $ahora   = time();
        $ultimo  = $_SESSION['chatbot_ultimo'] ?? 0;
        if (($ahora - $ultimo) < 2) {
            Response::error('Espera un momento antes de enviar otro mensaje.', 429);
        }
        // El timestamp se actualiza justo antes de llamar a la IA,
        // para no penalizar peticiones rechazadas por validación.

        // 3. Leer y validar body JSON
        $body     = json_decode(file_get_contents('php://input'), true);
        $mensajes = $body['mensajes'] ?? null;

        if (!is_array($mensajes) || count($mensajes) === 0) {
            Response::error('El campo "mensajes" es obligatorio y debe ser un array no vacío.', 400);
        }

        if (count($mensajes) > 20) {
            Response::error('El historial no puede superar 20 mensajes.', 400);
        }

        // El último mensaje debe ser del usuario
        $ultimoMensaje = end($mensajes);
        if (($ultimoMensaje['role'] ?? '') !== 'user') {
            Response::error('El último mensaje debe ser del usuario.', 400);
        }

        // Sanitizar y validar cada mensaje
        $mensajesSanitizados = [];
        foreach ($mensajes as $i => $msg) {
            $role    = $msg['role']    ?? '';
            $content = $msg['content'] ?? '';

            if (!is_string($role) || !in_array($role, ['user', 'assistant'], true)) {
                Response::error("El mensaje #$i tiene un rol inválido.", 400);
            }

            if (!is_string($content)) {
                Response::error("El mensaje #$i: el campo content debe ser texto.", 400);
            }

            // strip_tags es suficiente aquí: el contenido va a la API de IA, no a la BD ni a HTML.
            // NO usar htmlspecialchars — convertiría entidades HTML y corrompería el texto enviado al modelo.
            $content = trim(strip_tags($content));

            if ($content === '') {
                Response::error("El mensaje #$i no puede estar vacío.", 400);
            }

            if (mb_strlen($content) > 500) {
                Response::error("El mensaje #$i supera los 500 caracteres.", 400);
            }

            $mensajesSanitizados[] = ['role' => $role, 'content' => $content];
        }

        // 4. Llamar al cliente de IA
        $_SESSION['chatbot_ultimo'] = $ahora;
        try {
            $respuesta = AIClient::chat($mensajesSanitizados, $usuario['rol']);
            Response::success(['respuesta' => $respuesta], 'Respuesta generada correctamente.');
        } catch (Exception) {
            Response::error('El asistente no está disponible ahora. Inténtalo más tarde.', 503);
        }
    }
}

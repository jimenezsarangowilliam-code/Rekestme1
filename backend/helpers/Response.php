<?php
/**
 * Response.php — Helper para respuestas JSON estandarizadas
 * Todos los endpoints de la API usan este helper para garantizar
 * un formato de respuesta homogéneo.
 */

class Response
{
    /**
     * Respuesta de éxito (HTTP 200 por defecto)
     *
     * @param mixed  $data    Datos a devolver (array, objeto, null…)
     * @param string $message Mensaje descriptivo del resultado
     * @param int    $code    Código HTTP (200, 201, etc.)
     */
    public static function success(mixed $data = null, string $message = 'OK', int $code = 200): void
    {
        self::send([
            'success' => true,
            'data'    => $data,
            'message' => $message,
            'errors'  => [],
        ], $code);
    }

    /**
     * Respuesta de error
     *
     * @param string $message Mensaje principal del error
     * @param int    $code    Código HTTP (400, 401, 403, 404, 500…)
     * @param array  $errors  Lista de errores de detalle (validación, etc.)
     */
    public static function error(string $message = 'Error', int $code = 400, array $errors = []): void
    {
        self::send([
            'success' => false,
            'data'    => null,
            'message' => $message,
            'errors'  => $errors,
        ], $code);
    }

    /**
     * Respuesta 401 Unauthorized
     */
    public static function unauthorized(string $message = 'No autenticado. Inicia sesión.'): void
    {
        self::error($message, 401);
    }

    /**
     * Respuesta 403 Forbidden
     */
    public static function forbidden(string $message = 'No tienes permisos para realizar esta acción.'): void
    {
        self::error($message, 403);
    }

    /**
     * Respuesta 404 Not Found
     */
    public static function notFound(string $message = 'Recurso no encontrado.'): void
    {
        self::error($message, 404);
    }

    /**
     * Envía la respuesta JSON al cliente y termina la ejecución.
     */
    private static function send(array $body, int $code): void
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

<?php
/**
 * Auth.php — Middleware de autenticación y autorización
 * Verifica que el usuario esté logueado y, opcionalmente,
 * que tenga el rol requerido para acceder al recurso.
 * Soporta sesión PHP y JWT (Authorization: Bearer {token}).
 */

require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/JWT.php';

class Auth
{
    /**
     * Exige que haya una sesión activa o un JWT válido en la cabecera.
     * Prioridad: JWT > sesión PHP.
     * Devuelve los datos del usuario, o termina con 401.
     */
    public static function requerirLogin(): array
    {
        // 1. Intentar autenticación por JWT
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (str_starts_with($authHeader, 'Bearer ')) {
            $token = substr($authHeader, 7);
            try {
                $payload = JWT::verify($token);
                // El payload contiene id, nombre, apellidos, email, rol, departamento
                return $payload;
            } catch (RuntimeException) {
                Response::unauthorized('Token JWT inválido o expirado.');
            }
        }

        // 2. Fallback: sesión PHP
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        if (empty($_SESSION['usuario'])) {
            Response::unauthorized();
        }

        return $_SESSION['usuario'];
    }

    /**
     * Exige que el usuario tenga alguno de los roles indicados.
     * Uso: Auth::requerirRol(['tic', 'admin'])
     *
     * @param string[] $rolesPermitidos
     */
    public static function requerirRol(array $rolesPermitidos): array
    {
        $usuario = self::requerirLogin();

        if (!in_array($usuario['rol'], $rolesPermitidos, true)) {
            Response::forbidden();
        }

        return $usuario;
    }

    /**
     * Inicia sesión guardando los datos del usuario.
     * Regenera el ID de sesión para prevenir session fixation.
     */
    public static function iniciarSesion(array $usuario): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        session_regenerate_id(true);

        // Guardamos solo los datos necesarios (nunca el hash de contraseña)
        $_SESSION['usuario'] = [
            'id'          => $usuario['id'],
            'nombre'      => $usuario['nombre'],
            'apellidos'   => $usuario['apellidos'],
            'email'       => $usuario['email'],
            'rol'         => $usuario['rol'],
            'departamento'=> $usuario['departamento'] ?? null,
        ];
    }

    /**
     * Cierra la sesión actual
     */
    public static function cerrarSesion(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $_SESSION = [];
        session_destroy();
    }

    /**
     * Devuelve true si hay sesión activa (sin lanzar error)
     */
    public static function estaLogueado(): bool
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        return !empty($_SESSION['usuario']);
    }
}

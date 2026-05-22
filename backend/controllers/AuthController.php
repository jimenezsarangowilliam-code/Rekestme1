<?php
/**
 * AuthController.php — Gestión de autenticación
 * Endpoints: login, register, logout, me
 */

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/JWT.php';
require_once __DIR__ . '/../helpers/Mailer.php';
require_once __DIR__ . '/../config/ApiKeys.php';

class AuthController
{
    private User $userModel;

    public function __construct()
    {
        $this->userModel = new User();
    }

    // ----------------------------------------------------------
    // POST /api/auth/login
    // Body: { email, password }
    // ----------------------------------------------------------
    public function login(): void
    {
        $body = $this->getBody();

        // Validación básica de campos obligatorios
        $errores = [];
        if (empty($body['email']))    $errores[] = 'El email es obligatorio.';
        if (empty($body['password'])) $errores[] = 'La contraseña es obligatoria.';
        if ($errores) {
            Response::error('Datos incompletos.', 422, $errores);
        }

        // Buscar el usuario por email
        $usuario = $this->userModel->getByEmail($body['email']);

        // Verificar credenciales (email existe, tiene password y coincide)
        // $usuario['password'] puede ser NULL en cuentas Google-only; password_verify lanzaría TypeError
        if (!$usuario || empty($usuario['password']) || !password_verify($body['password'], $usuario['password'])) {
            Response::error('Email o contraseña incorrectos.', 401);
        }

        // Iniciar sesión (cookie de sesión PHP, compatible con frontend clásico)
        Auth::iniciarSesion($usuario);

        // Generar JWT para clientes que prefieran Authorization header
        unset($usuario['password']);
        $token = JWT::generate($usuario);

        Response::success(array_merge($usuario, ['token' => $token]), 'Sesión iniciada correctamente.');
    }

    // ----------------------------------------------------------
    // POST /api/auth/register — Solo accesible para admin
    // Body: { nombre, apellidos, email, password, rol?, departamento? }
    // ----------------------------------------------------------
    public function register(): void
    {
        Auth::requerirRol(['admin']);
        $body = $this->getBody();

        // Validación de campos
        $errores = [];
        if (empty($body['nombre']))    $errores[] = 'El nombre es obligatorio.';
        if (empty($body['apellidos'])) $errores[] = 'Los apellidos son obligatorios.';
        if (empty($body['email']))     $errores[] = 'El email es obligatorio.';
        if (empty($body['password']))  $errores[] = 'La contraseña es obligatoria.';
        if (strlen($body['password'] ?? '') < 8) $errores[] = 'La contraseña debe tener al menos 8 caracteres.';
        if (!filter_var($body['email'] ?? '', FILTER_VALIDATE_EMAIL)) $errores[] = 'El email no es válido.';

        $rolesValidos = ['profesor', 'tic', 'admin'];
        if (!empty($body['rol']) && !in_array($body['rol'], $rolesValidos, true)) {
            $errores[] = 'El rol indicado no existe.';
        }

        if ($errores) {
            Response::error('Datos no válidos.', 422, $errores);
        }

        // Verificar que el email no esté ya registrado
        if ($this->userModel->emailExists($body['email'])) {
            Response::error('El email ya está registrado.', 409);
        }

        // Crear usuario
        $nuevoId = $this->userModel->create($body);
        $usuario  = $this->userModel->getById($nuevoId);

        Response::success($usuario, 'Usuario registrado correctamente.', 201);
    }

    // ----------------------------------------------------------
    // POST /api/auth/logout
    // ----------------------------------------------------------
    public function logout(): void
    {
        Auth::cerrarSesion();
        Response::success(null, 'Sesión cerrada correctamente.');
    }

    // ----------------------------------------------------------
    // GET /api/auth/me — Devuelve el usuario de la sesión actual
    // ----------------------------------------------------------
    public function me(): void
    {
        $usuario = Auth::requerirLogin();
        Response::success($usuario, 'Datos del usuario actual.');
    }

    // ----------------------------------------------------------
    // POST /api/auth/google
    // Body: { token: "ID_TOKEN_de_Google" }
    // ----------------------------------------------------------
    public function loginGoogle(): void
    {
        $body = $this->getBody();

        if (empty($body['token'])) {
            Response::error('Token de Google requerido.', 422);
        }

        // Verificar el token con la API de Google
        $url      = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($body['token']);
        $context  = stream_context_create(['http' => ['timeout' => 10]]);
        $respJson = @file_get_contents($url, false, $context);

        if ($respJson === false) {
            Response::error('No se pudo verificar el token de Google.', 502);
        }

        $tokenInfo = json_decode($respJson, true);

        // Validar que el token es para esta aplicación
        if (empty($tokenInfo['aud']) || $tokenInfo['aud'] !== GOOGLE_CLIENT_ID) {
            Response::error('Token de Google no válido.', 401);
        }

        $email    = $tokenInfo['email']    ?? null;
        $googleId = $tokenInfo['sub']      ?? null;

        if (!$email || !$googleId) {
            Response::error('Token de Google incompleto.', 401);
        }

        // Buscar usuario por google_id primero, luego por email
        $usuario = $this->userModel->getByGoogleId($googleId)
                ?: $this->userModel->getByEmail($email);

        if (!$usuario) {
            Response::error('No hay ninguna cuenta registrada con este correo de Google. Contacta con el administrador.', 404);
        }

        // Actualizar google_id si aún no está vinculado
        if (empty($usuario['google_id'])) {
            $this->userModel->setGoogleId($usuario['id'], $googleId);
        }

        Auth::iniciarSesion($usuario);
        unset($usuario['password'], $usuario['google_id']);
        $token = JWT::generate($usuario);

        Response::success(array_merge($usuario, ['token' => $token]), 'Sesión iniciada con Google.');
    }

    // ----------------------------------------------------------
    // POST /api/auth/forgot-password
    // Body: { email: "..." }
    // ----------------------------------------------------------
    public function forgotPassword(): void
    {
        $body  = $this->getBody();
        $email = trim($body['email'] ?? '');

        // Respuesta genérica siempre (no revelar si el email existe)
        $respuesta = 'Si el correo está registrado, recibirás una nueva contraseña en breve.';

        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::success(null, $respuesta);
        }

        $usuario = $this->userModel->getByEmail($email);
        if (!$usuario) {
            Response::success(null, $respuesta);
        }

        // Generar nueva contraseña aleatoria
        $nuevaPass = $this->generarPassword();
        $hash      = password_hash($nuevaPass, PASSWORD_BCRYPT, ['cost' => 12]);
        $this->userModel->setPassword($usuario['id'], $hash);

        // Enviar por email
        $nombre = htmlspecialchars($usuario['nombre']);
        $html   = "
            <div style='font-family:sans-serif;max-width:480px;margin:0 auto'>
              <h2 style='color:#1d4ed8'>ReKestMe — Nueva contraseña</h2>
              <p>Hola, <strong>{$nombre}</strong>.</p>
              <p>Se ha generado una nueva contraseña para tu cuenta:</p>
              <div style='background:#f3f4f6;padding:16px;border-radius:8px;font-size:22px;font-weight:700;letter-spacing:2px;text-align:center;color:#111827'>
                {$nuevaPass}
              </div>
              <p style='margin-top:16px;color:#6b7280;font-size:13px'>
                Por seguridad, cámbiala desde tu perfil después de iniciar sesión.
              </p>
            </div>";

        Mailer::enviar($email, 'ReKestMe — Tu nueva contraseña', $html);

        Response::success(null, $respuesta);
    }

    // ----------------------------------------------------------
    // Helper: genera una contraseña aleatoria de 12 caracteres
    // ----------------------------------------------------------
    private function generarPassword(int $longitud = 12): string
    {
        $chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $pass  = '';
        for ($i = 0; $i < $longitud; $i++) {
            $pass .= $chars[random_int(0, strlen($chars) - 1)];
        }
        return $pass;
    }

    // ----------------------------------------------------------
    // Helper: lee y decodifica el body JSON de la petición
    // ----------------------------------------------------------
    private function getBody(): array
    {
        $raw = file_get_contents('php://input');
        return json_decode($raw, true) ?? [];
    }
}

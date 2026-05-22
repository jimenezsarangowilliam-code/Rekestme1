<?php
/**
 * UserController.php — Gestión de usuarios
 * Perfil propio (cualquier rol), gestión completa de cuentas (solo admin).
 */

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Mailer.php';

class UserController
{
    private User $model;

    public function __construct()
    {
        $this->model = new User();
    }

    // GET /api/users/me — Devuelve los datos del usuario autenticado
    public function perfil(): void
    {
        $usuario = Auth::requerirLogin();
        $user    = $this->model->getById($usuario['id']);
        if (!$user) Response::notFound('Usuario no encontrado.');
        Response::success($user, 'Perfil obtenido correctamente.');
    }

    // PUT /api/users/me — Actualiza nombre, apellidos y email del usuario autenticado
    public function actualizarPerfil(): void
    {
        $usuario = Auth::requerirLogin();
        $body    = $this->getBody();

        $errores = [];
        $nombre    = trim($body['nombre']    ?? '');
        $apellidos = trim($body['apellidos'] ?? '');
        $email     = trim($body['email']     ?? '');

        if (strlen($nombre) < 2 || strlen($nombre) > 100)       $errores[] = 'El nombre debe tener entre 2 y 100 caracteres.';
        if (strlen($apellidos) < 2 || strlen($apellidos) > 100) $errores[] = 'Los apellidos deben tener entre 2 y 100 caracteres.';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL))          $errores[] = 'El email no tiene un formato válido.';
        if (strlen($email) > 150)                                $errores[] = 'El email no puede superar 150 caracteres.';

        if ($errores) Response::error('Datos no válidos.', 422, $errores);

        $ok = $this->model->actualizarPerfil($usuario['id'], compact('nombre', 'apellidos', 'email'));

        if (!$ok) Response::error($this->model->getError(), 409);

        // Actualizar datos en sesión PHP si existe
        if (!empty($_SESSION['usuario'])) {
            $_SESSION['usuario']['nombre']    = $nombre;
            $_SESSION['usuario']['apellidos'] = $apellidos;
            $_SESSION['usuario']['email']     = $email;
        }

        Response::success($this->model->getById($usuario['id']), 'Perfil actualizado correctamente.');
    }

    // PUT /api/users/me/password — Cambia la contraseña verificando la contraseña actual primero
    public function cambiarPassword(): void
    {
        $usuario = Auth::requerirLogin();
        $body    = $this->getBody();

        $actual        = $body['password_actual']        ?? '';
        $nueva         = $body['password_nueva']         ?? '';
        $confirmacion  = $body['password_confirmacion']  ?? '';

        if ($nueva !== $confirmacion) {
            Response::error('Las contraseñas no coinciden.', 422);
        }

        $ok = $this->model->actualizarPassword($usuario['id'], $actual, $nueva);

        if (!$ok) Response::error($this->model->getError(), 400);

        Response::success(null, 'Contraseña actualizada correctamente.');
    }

    // POST /api/users — Solo admin. Crea un usuario y le envía las credenciales por email.
    public function crear(): void
    {
        Auth::requerirRol(['admin']);
        $body = $this->getBody();

        $errores = [];
        $nombre    = trim($body['nombre']    ?? '');
        $apellidos = trim($body['apellidos'] ?? '');
        $email     = trim($body['email']     ?? '');
        $rol       = $body['rol']            ?? 'profesor';

        if (empty($nombre))    $errores[] = 'El nombre es obligatorio.';
        if (empty($apellidos)) $errores[] = 'Los apellidos son obligatorios.';
        if (empty($email))     $errores[] = 'El email es obligatorio.';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errores[] = 'El email no tiene un formato válido.';

        $rolesValidos = ['profesor', 'tic', 'admin'];
        if (!in_array($rol, $rolesValidos, true)) $errores[] = 'El rol indicado no es válido.';

        if ($errores) Response::error('Datos no válidos.', 422, $errores);

        if ($this->model->emailExists($email)) {
            Response::error('El email ya está registrado.', 409);
        }

        // Generar contraseña aleatoria
        $password = $this->generarPassword();

        $nuevoId = $this->model->create([
            'nombre'       => $nombre,
            'apellidos'    => $apellidos,
            'email'        => $email,
            'password'     => $password,
            'rol'          => $rol,
            'departamento' => $body['departamento'] ?? null,
        ]);

        // Enviar credenciales por email
        $nombreHtml = htmlspecialchars($nombre . ' ' . $apellidos);
        $emailHtml  = htmlspecialchars($email);
        $html = "
            <div style='font-family:sans-serif;max-width:480px;margin:0 auto'>
              <h2 style='color:#1d4ed8'>Bienvenido/a a ReKestMe</h2>
              <p>Hola, <strong>{$nombreHtml}</strong>.</p>
              <p>El administrador ha creado una cuenta para ti. Estas son tus credenciales de acceso:</p>
              <table style='border-collapse:collapse;width:100%;margin:16px 0'>
                <tr>
                  <td style='padding:8px;background:#f3f4f6;font-weight:600;width:40%'>Email</td>
                  <td style='padding:8px;background:#f9fafb'>{$emailHtml}</td>
                </tr>
                <tr>
                  <td style='padding:8px;background:#f3f4f6;font-weight:600'>Contraseña</td>
                  <td style='padding:8px;background:#f9fafb;font-size:18px;font-weight:700;letter-spacing:2px'>{$password}</td>
                </tr>
              </table>
              <p style='color:#6b7280;font-size:13px'>Por seguridad, cambia tu contraseña desde el perfil después de iniciar sesión por primera vez.</p>
              <p style='color:#6b7280;font-size:13px'>También puedes iniciar sesión directamente con tu cuenta de Google si usas el mismo correo.</p>
            </div>";

        Mailer::enviar($email, 'ReKestMe — Tus credenciales de acceso', $html);

        $usuario = $this->model->getById($nuevoId);
        Response::success($usuario, "Usuario creado. Credenciales enviadas a {$email}.", 201);
    }

    // GET /api/users/{id}/vinculos — Solo admin. Consulta los vínculos antes de intentar eliminar.
    public function vinculos(int $id): void
    {
        Auth::requerirRol(['admin']);
        if (!$this->model->getById($id)) Response::notFound('Usuario no encontrado.');
        Response::success($this->model->getVinculos($id), 'Vínculos obtenidos.');
    }

    // DELETE /api/users/{id} — Solo admin. Bloquea si el usuario tiene solicitudes activas o asignaciones.
    public function destroy(int $id): void
    {
        $admin = Auth::requerirRol(['admin']);
        if ($admin['id'] === $id) {
            Response::error('No puedes eliminar tu propio usuario.', 403);
        }

        $usuario = $this->model->getById($id);
        if (!$usuario) Response::notFound('Usuario no encontrado.');

        $vinculos = $this->model->getVinculos($id);
        if ($vinculos['solicitudes_activas'] > 0) {
            Response::error('No se puede eliminar: el usuario tiene solicitudes activas.', 409);
        }
        if ($vinculos['asignaciones'] > 0 || $vinculos['historial_estados'] > 0) {
            Response::error('No se puede eliminar: el usuario tiene asignaciones o historial de estados vinculados.', 409);
        }

        $this->model->delete($id);
        Response::success(null, 'Usuario eliminado correctamente.');
    }

    // GET /api/users — Solo admin. Devuelve la lista completa de usuarios.
    public function index(): void
    {
        Auth::requerirRol(['admin']);
        Response::success($this->model->getAll(), 'Usuarios obtenidos correctamente.');
    }

    // GET /api/users/{id} — Devuelve un usuario; un usuario normal solo puede ver su propio perfil.
    public function show(int $id): void
    {
        $usuario = Auth::requerirLogin();

        // Un usuario normal solo puede ver su propio perfil
        if ($usuario['rol'] !== 'admin' && $usuario['id'] !== $id) {
            Response::forbidden();
        }

        $user = $this->model->getById($id);
        if (!$user) Response::notFound('Usuario no encontrado.');

        Response::success($user, 'Usuario obtenido correctamente.');
    }

    // PUT /api/users/{id} — Admin puede cambiar el rol; cualquier usuario puede editar sus propios datos.
    public function update(int $id): void
    {
        $usuarioSesion = Auth::requerirLogin();

        // Solo admin puede cambiar el rol de otro usuario
        if ($usuarioSesion['rol'] !== 'admin' && $usuarioSesion['id'] !== $id) {
            Response::forbidden();
        }

        $body = $this->getBody();

        // Solo el admin puede cambiar roles
        if ($usuarioSesion['rol'] !== 'admin') {
            unset($body['rol']);
        }

        if (isset($body['rol'])) {
            $rolesValidos = ['profesor', 'tic', 'admin'];
            if (!in_array($body['rol'], $rolesValidos, true)) {
                Response::error('El rol indicado no es válido.', 422);
            }
        }

        if (!$this->model->getById($id)) {
            Response::notFound('Usuario no encontrado.');
        }

        $errores = [];
        $nombre    = trim($body['nombre']    ?? '');
        $apellidos = trim($body['apellidos'] ?? '');
        $email     = trim($body['email']     ?? '');

        if (strlen($nombre) < 2 || strlen($nombre) > 100)       $errores[] = 'El nombre debe tener entre 2 y 100 caracteres.';
        if (strlen($apellidos) < 2 || strlen($apellidos) > 100) $errores[] = 'Los apellidos deben tener entre 2 y 100 caracteres.';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL))          $errores[] = 'El email no tiene un formato válido.';
        if (strlen($email) > 150)                                $errores[] = 'El email no puede superar 150 caracteres.';

        if ($errores) Response::error('Datos no válidos.', 422, $errores);

        // Comprobar email duplicado en otro usuario
        $otroUsuario = $this->model->getByEmail($email);
        if ($otroUsuario && (int)$otroUsuario['id'] !== $id) {
            Response::error('El email ya está en uso por otro usuario.', 409);
        }

        $ok = $this->model->update($id, $body);
        if (!$ok) Response::error($this->model->getError() ?: 'No se pudo actualizar el usuario.', 409);
        Response::success($this->model->getById($id), 'Usuario actualizado correctamente.');
    }

    // POST /api/users/{id}/reset-password — Solo admin. Genera nueva contraseña y la envía al email del usuario.
    public function resetPassword(int $id): void
    {
        Auth::requerirRol(['admin']);

        $usuario = $this->model->getById($id);
        if (!$usuario) Response::notFound('Usuario no encontrado.');

        $nuevaPass = $this->generarPassword();
        $hash      = password_hash($nuevaPass, PASSWORD_BCRYPT, ['cost' => 12]);
        $this->model->setPassword($id, $hash);

        $nombre = htmlspecialchars($usuario['nombre'] . ' ' . $usuario['apellidos']);
        $email  = htmlspecialchars($usuario['email']);
        $html = "
        <div style='font-family:sans-serif;max-width:480px;margin:0 auto'>
          <h2 style='color:#1d4ed8'>ReKestMe — Nueva contraseña</h2>
          <p>Hola, <strong>{$nombre}</strong>.</p>
          <p>El administrador ha generado una nueva contraseña para tu cuenta:</p>
          <div style='background:#f3f4f6;padding:16px;border-radius:8px;font-size:22px;font-weight:700;letter-spacing:2px;text-align:center;color:#111827'>
            {$nuevaPass}
          </div>
          <p style='color:#6b7280;font-size:13px;margin-top:16px'>
            Por seguridad, cambia tu contraseña desde el perfil después de iniciar sesión.
          </p>
        </div>";

        Mailer::enviar($email, 'ReKestMe — Tu nueva contraseña', $html);

        Response::success(null, "Nueva contraseña enviada a {$email}.");
    }

    private function generarPassword(int $longitud = 12): string
    {
        $chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $pass  = '';
        for ($i = 0; $i < $longitud; $i++) {
            $pass .= $chars[random_int(0, strlen($chars) - 1)];
        }
        return $pass;
    }

    private function getBody(): array
    {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}

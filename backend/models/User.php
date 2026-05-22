<?php
/**
 * User.php — Modelo de usuarios
 * Contiene toda la lógica de acceso a datos de la tabla `users`
 */

require_once __DIR__ . '/../config/Database.php';

class User
{
    private PDO $db;
    private string $error = '';

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getError(): string
    {
        return $this->error;
    }

    // ----------------------------------------------------------
    // Consultas de búsqueda
    // ----------------------------------------------------------

    /**
     * Devuelve todos los usuarios (para el panel de admin)
     */
    public function getAll(): array
    {
        $stmt = $this->db->query(
            'SELECT id, nombre, apellidos, email, rol, departamento, created_at FROM users ORDER BY apellidos'
        );
        return $stmt->fetchAll();
    }

    /**
     * Busca un usuario por su ID
     */
    public function getById(int $id): array|false
    {
        $stmt = $this->db->prepare(
            'SELECT id, nombre, apellidos, email, rol, departamento, created_at FROM users WHERE id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    /**
     * Busca un usuario por email (incluye password para autenticación)
     */
    public function getByEmail(string $email): array|false
    {
        $stmt = $this->db->prepare(
            'SELECT id, nombre, apellidos, email, google_id, password, rol, departamento FROM users WHERE email = ?'
        );
        $stmt->execute([$email]);
        return $stmt->fetch();
    }

    /**
     * Busca un usuario por su google_id
     */
    public function getByGoogleId(string $googleId): array|false
    {
        $stmt = $this->db->prepare(
            'SELECT id, nombre, apellidos, email, google_id, rol, departamento FROM users WHERE google_id = ?'
        );
        $stmt->execute([$googleId]);
        return $stmt->fetch();
    }

    /**
     * Comprueba si un email ya está registrado
     */
    public function emailExists(string $email): bool
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM users WHERE email = ?');
        $stmt->execute([$email]);
        return (int) $stmt->fetchColumn() > 0;
    }

    // ----------------------------------------------------------
    // Operaciones de escritura
    // ----------------------------------------------------------

    /**
     * Crea un nuevo usuario. Devuelve el ID insertado.
     * password es opcional (NULL para cuentas Google-only).
     */
    public function create(array $datos): int
    {
        $hash = !empty($datos['password'])
            ? password_hash($datos['password'], PASSWORD_BCRYPT, ['cost' => 12])
            : null;

        $stmt = $this->db->prepare(
            'INSERT INTO users (nombre, apellidos, email, password, rol, departamento)
             VALUES (:nombre, :apellidos, :email, :password, :rol, :departamento)'
        );
        $stmt->execute([
            ':nombre'       => $datos['nombre'],
            ':apellidos'    => $datos['apellidos'],
            ':email'        => $datos['email'],
            ':password'     => $hash,
            ':rol'          => $datos['rol'] ?? 'profesor',
            ':departamento' => $datos['departamento'] ?? null,
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Guarda o actualiza el google_id de un usuario.
     */
    public function setGoogleId(int $id, string $googleId): void
    {
        $stmt = $this->db->prepare('UPDATE users SET google_id = ? WHERE id = ?');
        $stmt->execute([$googleId, $id]);
    }

    /**
     * Reemplaza la contraseña de un usuario (ya hasheada).
     */
    public function setPassword(int $id, string $hash): void
    {
        $stmt = $this->db->prepare('UPDATE users SET password = ? WHERE id = ?');
        $stmt->execute([$hash, $id]);
    }

    /**
     * Actualiza nombre, apellidos y email del propio perfil.
     * Verifica que el email no esté en uso por otro usuario.
     */
    public function actualizarPerfil(int $id, array $datos): bool
    {
        // Comprobar email duplicado en otro usuario
        $stmt = $this->db->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
        $stmt->execute([$datos['email'], $id]);
        if ($stmt->fetch()) {
            $this->error = 'El email ya está en uso por otro usuario.';
            return false;
        }

        $stmt = $this->db->prepare(
            'UPDATE users SET nombre = :nombre, apellidos = :apellidos, email = :email WHERE id = :id'
        );
        $stmt->execute([
            ':nombre'    => $datos['nombre'],
            ':apellidos' => $datos['apellidos'],
            ':email'     => $datos['email'],
            ':id'        => $id,
        ]);
        return $stmt->rowCount() >= 0; // 0 rowCount es OK si no hubo cambios reales
    }

    /**
     * Cambia la contraseña verificando la actual primero.
     */
    public function actualizarPassword(int $id, string $passwordActual, string $passwordNueva): bool
    {
        $stmt = $this->db->prepare('SELECT password FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        if (!$row || !password_verify($passwordActual, $row['password'])) {
            $this->error = 'La contraseña actual no es correcta.';
            return false;
        }

        if (strlen($passwordNueva) < 8 || !preg_match('/[A-Z]/', $passwordNueva) || !preg_match('/[0-9]/', $passwordNueva)) {
            $this->error = 'La contraseña debe tener mínimo 8 caracteres, una mayúscula y un número.';
            return false;
        }

        $hash = password_hash($passwordNueva, PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $this->db->prepare('UPDATE users SET password = ? WHERE id = ?');
        $stmt->execute([$hash, $id]);
        return true;
    }

    /**
     * Actualiza los datos de un usuario
     */
    public function update(int $id, array $datos): bool
    {
        // Construimos el SET dinámico con solo los campos enviados
        $campos  = [];
        $valores = [];

        $permitidos = ['nombre', 'apellidos', 'email', 'rol', 'departamento', 'google_id'];
        foreach ($permitidos as $campo) {
            if (array_key_exists($campo, $datos)) {
                $campos[]  = "$campo = :$campo";
                $valores[":$campo"] = $datos[$campo];
            }
        }

        // Si viene nueva contraseña, la hasheamos
        if (!empty($datos['password'])) {
            $campos[]           = 'password = :password';
            $valores[':password'] = password_hash($datos['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        }

        if (empty($campos)) {
            return false; // Nada que actualizar
        }

        $valores[':id'] = $id;
        $sql = 'UPDATE users SET ' . implode(', ', $campos) . ' WHERE id = :id';
        $stmt = $this->db->prepare($sql);
        $stmt->execute($valores);

        return $stmt->rowCount() >= 0;
    }

    // Devuelve conteos de solicitudes, asignaciones, historial y comentarios vinculados al usuario
    public function getVinculos(int $id): array
    {
        $stmt = $this->db->prepare(
            "SELECT
                SUM(estado NOT IN ('completada','rechazada')) AS solicitudes_activas,
                SUM(estado IN ('completada','rechazada')) AS solicitudes_historial
             FROM solicitudes WHERE profesor_id = ?"
        );
        $stmt->execute([$id]);
        $sol = $stmt->fetch();

        $stmt = $this->db->prepare('SELECT COUNT(*) FROM asignaciones WHERE tecnico_id = ?');
        $stmt->execute([$id]);
        $asignaciones = (int) $stmt->fetchColumn();

        $stmt = $this->db->prepare('SELECT COUNT(*) FROM historial_estados WHERE usuario_id = ?');
        $stmt->execute([$id]);
        $historialEstados = (int) $stmt->fetchColumn();

        $stmt = $this->db->prepare('SELECT COUNT(*) FROM comentarios WHERE usuario_id = ?');
        $stmt->execute([$id]);
        $comentarios = (int) $stmt->fetchColumn();

        return [
            'solicitudes_activas'   => (int) ($sol['solicitudes_activas']  ?? 0),
            'solicitudes_historial' => (int) ($sol['solicitudes_historial'] ?? 0),
            'asignaciones'          => $asignaciones,
            'historial_estados'     => $historialEstados,
            'comentarios'           => $comentarios,
        ];
    }

    // Elimina un usuario por ID; solo llama a esto tras verificar vínculos en el controlador
    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }
}

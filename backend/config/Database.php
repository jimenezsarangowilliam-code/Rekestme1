<?php
/**
 * Database.php — Conexión PDO a MySQL
 * Patrón Singleton: solo se crea una instancia de la conexión por petición
 */

class Database
{
    // Parámetros de conexión — ajustar según el entorno
    private static string $host    = 'localhost';
    private static string $dbName  = 'rekestme';
    private static string $user    = 'root';
    private static string $pass    = '';
    private static string $charset = 'utf8mb4';

    // Instancia única de PDO
    private static ?PDO $instance = null;

    // Constructor privado: impide instanciar la clase directamente
    private function __construct() {}

    /**
     * Devuelve la conexión PDO, creándola si no existe todavía.
     */
    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $dsn = sprintf(
                'mysql:host=%s;dbname=%s;charset=%s',
                self::$host,
                self::$dbName,
                self::$charset
            );

            $opciones = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,   // lanza excepciones en errores
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,         // resultados como arrays asociativos
                PDO::ATTR_EMULATE_PREPARES   => false,                    // prepared statements reales
            ];

            try {
                self::$instance = new PDO($dsn, self::$user, self::$pass, $opciones);
            } catch (PDOException $e) {
                // En producción no exponer el mensaje real; aquí lo dejamos para desarrollo
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'data'    => null,
                    'message' => 'Error de conexión con la base de datos.',
                    'errors'  => [$e->getMessage()],
                ]);
                exit;
            }
        }

        return self::$instance;
    }
}

<?php
/**
 * JWT.php — Implementación manual de JWT HS256 sin librerías externas
 * Soporta generación, verificación y decodificación de tokens.
 */

class JWT
{
    /** Clave secreta — cambiar en producción por una cadena larga y aleatoria */
    private static string $secret = 'rekestme_secret_key_tfg_2daw_2026';

    /** Tiempo de expiración por defecto: 8 horas */
    private static int $ttl = 28800;

    // -------------------------------------------------------
    // Genera un token JWT firmado con HS256
    // $payload: array de datos a incluir (se añaden iat y exp)
    // -------------------------------------------------------
    public static function generate(array $payload): string
    {
        $header = self::base64UrlEncode(json_encode([
            'alg' => 'HS256',
            'typ' => 'JWT',
        ]));

        $payload['iat'] = time();
        $payload['exp'] = time() + self::$ttl;

        $body = self::base64UrlEncode(json_encode($payload));

        $firma = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$body", self::$secret, true)
        );

        return "$header.$body.$firma";
    }

    // -------------------------------------------------------
    // Verifica la firma y la expiración del token.
    // Devuelve el payload decodificado o lanza una excepción.
    // -------------------------------------------------------
    public static function verify(string $token): array
    {
        $partes = explode('.', $token);

        if (count($partes) !== 3) {
            throw new RuntimeException('Token JWT malformado.');
        }

        [$header, $body, $firmaToken] = $partes;

        // Recalcular la firma esperada
        $firmaEsperada = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$body", self::$secret, true)
        );

        // Comparación segura contra timing attacks
        if (!hash_equals($firmaEsperada, $firmaToken)) {
            throw new RuntimeException('Firma JWT inválida.');
        }

        $payload = json_decode(self::base64UrlDecode($body), true);

        if (!$payload) {
            throw new RuntimeException('Payload JWT inválido.');
        }

        // Comprobar expiración
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            throw new RuntimeException('Token JWT expirado.');
        }

        return $payload;
    }

    // -------------------------------------------------------
    // Decodifica el payload sin verificar la firma.
    // Útil para depuración; NO usar para autenticar.
    // -------------------------------------------------------
    public static function decode(string $token): array
    {
        $partes = explode('.', $token);

        if (count($partes) !== 3) {
            throw new RuntimeException('Token JWT malformado.');
        }

        $payload = json_decode(self::base64UrlDecode($partes[1]), true);

        if (!$payload) {
            throw new RuntimeException('Payload JWT inválido.');
        }

        return $payload;
    }

    // -------------------------------------------------------
    // Codificación base64url (sin padding, segura para URLs)
    // -------------------------------------------------------
    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string
    {
        $padding = strlen($data) % 4;
        if ($padding) {
            $data .= str_repeat('=', 4 - $padding);
        }
        return base64_decode(strtr($data, '-_', '+/'));
    }
}

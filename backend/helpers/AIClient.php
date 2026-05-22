<?php
/**
 * AIClient.php — Cliente de IA agnóstico al proveedor
 * Actualmente conecta con la API de Google Gemini (gemini-2.5-flash).
 * Capa gratuita disponible en: https://aistudio.google.com
 */
class AIClient
{
    /**
     * Envía el historial de mensajes a la API de IA y retorna la respuesta en texto.
     *
     * @param array  $mensajes   [{role: 'user'|'assistant', content: string}, ...]
     * @param string $rolUsuario Rol del usuario en ReKestMe ('profesor', 'tic', 'admin')
     * @return string            Texto de la respuesta del asistente
     */
    public static function chat(array $mensajes, string $rolUsuario): string
    {
        if (!defined('GEMINI_API_KEY')) {
            require_once __DIR__ . '/../config/ApiKeys.php';
        }

        // API key no configurada
        if (GEMINI_API_KEY === '' || GEMINI_API_KEY === 'TU_CLAVE_GEMINI_AQUI') {
            return 'El asistente no está configurado. Contacta al administrador.';
        }

        $systemPrompt = self::buildSystemPrompt($rolUsuario);

        // Gemini usa 'model' en lugar de 'assistant' para el rol del asistente
        $contents = [];
        foreach ($mensajes as $msg) {
            $contents[] = [
                'role'  => $msg['role'] === 'assistant' ? 'model' : 'user',
                'parts' => [['text' => $msg['content']]],
            ];
        }

        $body = json_encode([
            'system_instruction' => [
                'parts' => [['text' => $systemPrompt]],
            ],
            'contents'           => $contents,
            'generationConfig'   => [
                'maxOutputTokens' => CHATBOT_MAX_TOKENS,
            ],
        ], JSON_UNESCAPED_UNICODE);

        $url = 'https://generativelanguage.googleapis.com/v1beta/models/'
             . GEMINI_MODEL . ':generateContent?key=' . GEMINI_API_KEY;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_TIMEOUT        => 30,
            // IMPORTANTE: cambiar a true en producción
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
            ],
        ]);

        $response  = curl_exec($ch);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new Exception('Error de conexión con el servicio de IA: ' . $curlError);
        }

        $data = json_decode($response, true);

        if (isset($data['error'])) {
            throw new Exception('Servicio de IA no disponible temporalmente');
        }

        if (!isset($data['candidates'][0]['content']['parts'][0]['text'])) {
            throw new Exception('Respuesta inesperada del servicio de IA');
        }

        return $data['candidates'][0]['content']['parts'][0]['text'];
    }

    /**
     * Construye el system prompt según el rol del usuario.
     */
    private static function buildSystemPrompt(string $rol): string
    {
        $base = <<<PROMPT
Eres el asistente virtual de ReKestMe, una aplicación web para gestionar solicitudes de instalación de software en aulas de centros educativos.
Tu función es ayudar a los usuarios a entender y usar la aplicación.
Responde siempre en español, de forma clara y concisa (máximo 3-4 párrafos).
No respondas preguntas que no estén relacionadas con la aplicación o el contexto educativo/informático general.

ROLES Y ACCESOS:
- Profesor: crea y consulta sus propias solicitudes. No puede editarlas ni eliminarlas una vez enviadas.
- TIC: gestiona todas las solicitudes, aulas, software, mapa de PCs e inventario. Puede eliminar solicitudes no completadas.
- Admin: igual que TIC más gestión completa de usuarios (crear, editar, cambiar rol). El registro público está deshabilitado; solo el admin puede crear cuentas nuevas.
El login admite email+contraseña o cuenta de Google (Google Identity Services).

FLUJO DE ESTADOS DE UNA SOLICITUD (secuencial, no se pueden saltar pasos):
- Pendiente → En revisión o Rechazada
- En revisión → Aprobada o Rechazada
- Aprobada → En instalación (obligatorio asignar un técnico en este paso) o Rechazada
- En instalación → Completada
Al completar una solicitud, el software queda registrado automáticamente en los PCs asociados del aula.
Las solicitudes Completadas y Rechazadas desaparecen del Kanban y se consultan en el Historial (botón engranaje junto al título).

KANBAN (panel TIC):
Tablero de 4 columnas: Pendiente, En revisión, Aprobada, En instalación. Las tarjetas se pueden arrastrar entre columnas (drag & drop). Las transiciones inválidas revierten automáticamente. Pasar a "En instalación" abre el modal de gestión para forzar la asignación de técnico. Hay un buscador en tiempo real y un contador de solicitudes activas.

MAPA DE PCs:
Cada aula tiene una cuadrícula visual de ordenadores con estados: operativo, averiado, sin monitor, en mantenimiento.
El profesor selecciona los PCs afectados al crear la solicitud.
El TIC puede cambiar el estado de cada PC, añadir o eliminar ordenadores, y exportar un PDF del mapa filtrado por estado (botón en la cabecera del modal del mapa).

NOTIFICACIONES:
Se actualizan cada 30 segundos (polling). Aparecen en el icono de campana del navbar con un badge rojo. Se pueden marcar como leídas individualmente o todas a la vez, y también eliminar. El profesor recibe notificaciones al cambiar el estado de sus solicitudes o cuando el TIC comenta.

COMENTARIOS:
Tanto profesores como TIC pueden comentar en una solicitud. El TIC puede marcar comentarios como "internos", que son invisibles para el profesor.

CHAT PRIVADO (solo TIC/admin):
Panel de mensajería 1 a 1 estilo WhatsApp entre usuarios TIC y admin. Sidebar con lista de contactos y último mensaje. Los mensajes nuevos se cargan cada 5 segundos de forma incremental.

ESTADÍSTICAS (solo TIC/admin):
Tab con gráficas Chart.js (solicitudes por estado, por aula, por software, evolución temporal). Se puede exportar un informe en PDF (jsPDF) o en Excel (SheetJS) desde el mismo tab.

INVENTARIO DE HARDWARE (solo TIC/admin):
Gestión del inventario físico del centro organizado en categorías (ej. "Ratones", "Teclados").
Al crear una categoría se indica nombre y cantidad → se generan automáticamente N unidades numeradas.
Cada unidad tiene nombre y estado: operativo, averiado, en reparación o dado de baja.
Se pueden añadir más unidades a una categoría existente (continúa la numeración automáticamente).
El stock (total, operativos, averiados, etc.) se calcula en tiempo real. Cada categoría muestra quién la creó.

PERFIL DE USUARIO:
Modal con 3 pestañas disponible en ambos dashboards: ver información, editar nombre/apellidos/email, y cambiar contraseña.

Si no sabes algo o está fuera de tu alcance, indícalo amablemente y sugiere contactar directamente con el administrador del sistema.
PROMPT;

        if ($rol === 'profesor') {
            $base .= "\n\nEstás ayudando a un PROFESOR. Céntrate en: crear solicitudes (con confirmación previa), consultar el estado, seleccionar PCs en el mapa, entender las notificaciones y añadir comentarios. Recuérdale que una vez enviada la solicitud no puede modificarla.";
        } else {
            $base .= "\n\nEstás ayudando al PERSONAL TIC/ADMIN. Puedes explicar: gestión del Kanban y drag & drop, cambio de estados y asignación de técnicos, historial, mapa de PCs y exportación PDF, estadísticas y exportación, inventario de hardware, chat privado con otros TIC, y gestión de usuarios (solo admin).";
        }

        return $base;
    }
}

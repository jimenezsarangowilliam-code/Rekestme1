/**
 * chatbot.js — Módulo del asistente de ayuda con IA
 * Se integra en cualquier dashboard llamando a inicializarChatbot(usuarioActual).
 * No depende de ningún otro módulo salvo api.js.
 */

import { chatbot as chatbotApi } from './api.js';

// ============================================================
// Estado del módulo
// ============================================================
let historial      = [];    // [{role, content}] — historial de la conversación
let cargando       = false; // evita envíos simultáneos
let usuario        = null;
let panelAbierto   = false;

// ============================================================
// Punto de entrada público
// ============================================================
export function inicializarChatbot(usuarioActual) {
  if (document.getElementById('chatbot-btn')) return; // ya inicializado
  usuario = usuarioActual;
  _inyectarHTML();
  _configurarEventListeners();
  _mostrarBienvenida();
}

// ============================================================
// HTML inyectado en el DOM
// ============================================================
function _inyectarHTML() {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <!-- Botón flotante -->
    <button id="chatbot-btn" title="Asistente de ayuda">
      <i class="bi bi-robot"></i>
    </button>

    <!-- Panel del chat -->
    <div id="chatbot-panel" class="d-none">
      <div id="chatbot-header">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-robot fs-5"></i>
          <div>
            <div class="fw-bold" style="font-size:0.9rem">Asistente ReKestMe</div>
            <div class="d-flex align-items-center gap-1" style="font-size:0.7rem;opacity:0.85">
              <span id="chatbot-status-dot" style="
                display:inline-block;width:8px;height:8px;
                border-radius:50%;background:#28a745;
                flex-shrink:0;"></span>
              <span id="chatbot-status-text">Servicio activo</span>
            </div>
          </div>
        </div>
        <div class="d-flex gap-2">
          <button id="chatbot-limpiar" title="Limpiar conversación"
                  class="btn btn-sm btn-link text-white p-0">
            <i class="bi bi-trash3"></i>
          </button>
          <button id="chatbot-cerrar" class="btn btn-sm btn-link text-white p-0">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      <div id="chatbot-mensajes"></div>

      <div id="chatbot-typing" class="d-none">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>

      <div id="chatbot-footer">
        <div class="d-flex gap-2">
          <input type="text" id="chatbot-input" class="form-control form-control-sm"
                 placeholder="Escribe tu pregunta..." maxlength="500" autocomplete="off">
          <button id="chatbot-enviar" class="btn btn-primary btn-sm">
            <i class="bi bi-send"></i>
          </button>
        </div>
        <div class="text-center mt-1" style="font-size:0.65rem;color:#aaa;">
          Respuestas generadas por IA · Pueden contener errores
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);
}

// ============================================================
// Event listeners
// ============================================================
function _configurarEventListeners() {
  document.getElementById('chatbot-btn').addEventListener('click', togglePanel);
  document.getElementById('chatbot-cerrar').addEventListener('click', togglePanel);
  document.getElementById('chatbot-limpiar').addEventListener('click', limpiarConversacion);
  document.getElementById('chatbot-enviar').addEventListener('click', enviarMensaje);
  document.getElementById('chatbot-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  });
}

// ============================================================
// Bienvenida inicial (hardcodeada, sin llamada a la API)
// ============================================================
function _mostrarBienvenida() {
  const texto = mensajeBienvenida(usuario?.rol);
  historial = []; // limpiar historial al inicializar
  const contenedor = document.getElementById('chatbot-mensajes');
  if (contenedor) {
    contenedor.innerHTML = '';
    contenedor.insertAdjacentHTML('beforeend', renderizarMensaje(texto, true));
  }
}

// ============================================================
// Funciones públicas del módulo
// ============================================================
export function togglePanel() {
  const panel = document.getElementById('chatbot-panel');
  panelAbierto = !panelAbierto;

  if (panelAbierto) {
    panel.classList.remove('d-none');
    setTimeout(() => document.getElementById('chatbot-input')?.focus(), 50);
  } else {
    panel.classList.add('d-none');
  }
}

export function limpiarConversacion() {
  historial = [];
  _mostrarBienvenida();
}

export async function enviarMensaje() {
  if (cargando) return;

  const input  = document.getElementById('chatbot-input');
  const texto  = input.value.trim();
  if (!texto) return;

  // Añadir mensaje del usuario al DOM y al historial
  const contenedor = document.getElementById('chatbot-mensajes');
  contenedor.insertAdjacentHTML('beforeend', renderizarMensaje(texto, false));
  historial.push({ role: 'user', content: texto });
  input.value = '';
  _scrollAlFinal();

  // Mostrar typing indicator
  const typing = document.getElementById('chatbot-typing');
  typing.classList.remove('d-none');
  cargando = true;

  try {
    const resp = await chatbotApi.enviar(historial);
    const respuesta = resp.data?.respuesta ?? 'Sin respuesta del asistente.';

    typing.classList.add('d-none');
    contenedor.insertAdjacentHTML('beforeend', renderizarMensaje(respuesta, true));
    historial.push({ role: 'assistant', content: respuesta });
    _scrollAlFinal();
    actualizarIndicadorEstado(true);
  } catch (err) {
    console.error('[chatbot] Error al contactar la API:', err);
    typing.classList.add('d-none');
    const mensajeError = 'Lo siento, el asistente no está disponible en este momento. Inténtalo de nuevo más tarde.';
    contenedor.insertAdjacentHTML('beforeend', renderizarMensaje(mensajeError, true));
    actualizarIndicadorEstado(false);
  } finally {
    // Limpiar par más antiguo si el historial supera 20 mensajes
    // Se eliminan SIEMPRE en parejas (user + assistant) para preservar
    // la alternancia de roles que exige la API de Gemini.
    while (historial.length > 20) {
      historial.splice(0, 2);
    }
    cargando = false;
  }
}

// ============================================================
// Helpers de renderizado
// ============================================================
export function renderizarMensaje(content, esBot) {
  const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const tipo = esBot ? 'bot' : 'usuario';
  // Escapar HTML del contenido para evitar XSS
  const contentEscapado = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `
    <div class="chatbot-burbuja ${tipo}">
      <div>${contentEscapado}</div>
      <div class="chatbot-hora">${hora}</div>
    </div>
  `;
}

export function mensajeBienvenida(rol) {
  if (rol === 'profesor') {
    return '¡Hola! Soy el asistente de ReKestMe 👋 Puedo ayudarte a crear solicitudes, entender los estados o resolver cualquier duda sobre la app. ¿En qué puedo ayudarte?';
  }
  return '¡Hola! Soy el asistente de ReKestMe 👋 Puedo ayudarte con la gestión de solicitudes, estadísticas o cualquier función del panel TIC. ¿En qué puedo ayudarte?';
}

export function actualizarIndicadorEstado(activo) {
  const dot  = document.getElementById('chatbot-status-dot');
  const text = document.getElementById('chatbot-status-text');
  if (!dot || !text) return;

  if (activo) {
    dot.style.background  = '#28a745';
    text.textContent      = 'Servicio activo';
  } else {
    dot.style.background  = '#dc3545';
    text.textContent      = 'Servicio no disponible';
  }
}

// ============================================================
// Utilidades privadas
// ============================================================
function _scrollAlFinal() {
  const contenedor = document.getElementById('chatbot-mensajes');
  if (contenedor) {
    contenedor.scrollTop = contenedor.scrollHeight;
  }
}

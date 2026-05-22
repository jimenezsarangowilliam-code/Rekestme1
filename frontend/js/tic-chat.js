/**
 * tic-chat.js — Chat privado 1 a 1 estilo WhatsApp para TIC/admin
 * Sidebar con lista de contactos + panel de conversación.
 * Polling cada 5 segundos en la conversación activa.
 */

import { chat } from './api.js';

// Day.js (cargado vía CDN antes que este módulo)
dayjs.extend(dayjs_plugin_relativeTime);
dayjs.locale('es');

let usuarioActual    = null;
let contactoActivo   = null;   // { id, nombre, apellidos }
let ultimoMensajeId  = 0;
let pollingInterval  = null;
let inicializado     = false;

// ============================================================
// Entrada pública
// ============================================================
export async function inicializarChat(usuario) {
  if (inicializado) return;
  inicializado  = true;
  usuarioActual = usuario;

  document.getElementById('chat-form')?.addEventListener('submit', enviarMensaje);

  await cargarContactos();
}

export function detenerChat() {
  pararPolling();
  inicializado   = false;
  contactoActivo = null;
}

// ============================================================
// Sidebar — lista de contactos
// ============================================================
async function cargarContactos() {
  const sidebar = document.getElementById('chat-sidebar');
  if (!sidebar) return;

  try {
    const resp      = await chat.usuarios();
    const contactos = resp.data;

    if (!contactos.length) {
      sidebar.innerHTML = `<div class="chat-sidebar-empty">No hay otros usuarios TIC/admin.</div>`;
      return;
    }

    sidebar.innerHTML = contactos.map(c => renderizarContacto(c)).join('');

    sidebar.querySelectorAll('.chat-contacto').forEach(el => {
      el.addEventListener('click', () => {
        const id       = parseInt(el.dataset.id);
        const contacto = contactos.find(c => c.id === id);
        if (contacto) abrirConversacion(contacto);
      });
    });
  } catch (err) {
    sidebar.innerHTML = `<div class="chat-sidebar-empty text-danger">${err.message}</div>`;
  }
}

function renderizarContacto(c) {
  const iniciales  = inicialDe(c.nombre, c.apellidos);
  const color      = colorAvatar(c.id);
  const noLeidos   = parseInt(c.no_leidos) || 0;
  const ultimoMsg  = c.ultimo_mensaje
    ? (c.ultimo_mensaje.length > 40 ? c.ultimo_mensaje.slice(0, 40) + '…' : c.ultimo_mensaje)
    : 'Sin mensajes aún';
  const hora       = c.ultimo_at ? dayjs(c.ultimo_at).fromNow() : '';

  return `
    <div class="chat-contacto" data-id="${c.id}">
      <div class="chat-avatar" style="background:${color};">${iniciales}</div>
      <div class="chat-contacto-info">
        <div class="chat-contacto-nombre">${c.nombre} ${c.apellidos}</div>
        <div class="chat-contacto-preview">${ultimoMsg}</div>
      </div>
      <div class="chat-contacto-meta">
        ${hora ? `<div class="chat-contacto-hora">${hora}</div>` : ''}
        ${noLeidos > 0 ? `<div class="chat-contacto-badge">${noLeidos}</div>` : ''}
      </div>
    </div>`;
}

// ============================================================
// Abrir conversación
// ============================================================
async function abrirConversacion(contacto) {
  // Marcar como activo en sidebar
  document.querySelectorAll('.chat-contacto').forEach(el =>
    el.classList.toggle('activo', parseInt(el.dataset.id) === contacto.id));

  contactoActivo  = contacto;
  ultimoMensajeId = 0;

  // Actualizar cabecera
  const header = document.getElementById('chat-conv-header');
  if (header) {
    const color = colorAvatar(contacto.id);
    header.innerHTML = `
      <div class="chat-avatar" style="background:${color};width:36px;height:36px;font-size:.95rem;">
        ${inicialDe(contacto.nombre, contacto.apellidos)}
      </div>
      <div>
        <div style="font-weight:700;color:var(--navy);line-height:1.2;">${contacto.nombre} ${contacto.apellidos}</div>
        <div style="font-size:.72rem;color:var(--gray-400);">${capitalizar(contacto.rol)}</div>
      </div>`;
  }

  // Habilitar input y botón
  const input = document.getElementById('chat-input');
  const btn   = document.querySelector('#chat-form button[type="submit"]');
  if (input) { input.disabled = false; input.focus(); }
  if (btn)   btn.disabled = false;

  // Cargar mensajes
  await cargarMensajes();

  // Marcar como leídos los mensajes recibidos de este contacto
  chat.leer(contacto.id).catch(() => {});

  // Recargar sidebar para quitar badge
  cargarContactos();

  // Arrancar/reiniciar polling
  pararPolling();
  pollingInterval = setInterval(pollingConversacion, 5000);
}

// ============================================================
// Cargar mensajes de la conversación activa
// ============================================================
async function cargarMensajes() {
  if (!contactoActivo) return;
  const contenedor = document.getElementById('chat-mensajes');
  if (!contenedor) return;

  contenedor.innerHTML = `<div class="chat-cargando"><div class="spinner-border spinner-border-sm"></div></div>`;

  try {
    const resp      = await chat.conversacion(contactoActivo.id, 0);
    const mensajes  = resp.data.mensajes;
    ultimoMensajeId = resp.data.ultimo_id;

    if (!mensajes.length) {
      contenedor.innerHTML = `
        <div class="chat-placeholder">
          <i class="bi bi-chat-dots"></i>
          <span>Aún no hay mensajes.<br>¡Sé el primero en escribir!</span>
        </div>`;
      return;
    }

    contenedor.innerHTML = mensajes.map(m => renderizarMensaje(m)).join('');
    scrollAlFinal();
  } catch (err) {
    contenedor.innerHTML = `<div class="text-center py-3 text-danger small">${err.message}</div>`;
  }
}

// ============================================================
// Polling — solo mensajes nuevos
// ============================================================
async function pollingConversacion() {
  if (!contactoActivo) return;
  try {
    const resp   = await chat.conversacion(contactoActivo.id, ultimoMensajeId);
    const nuevos = resp.data.mensajes;
    if (!nuevos.length) return;

    ultimoMensajeId = resp.data.ultimo_id;

    const contenedor = document.getElementById('chat-mensajes');
    if (!contenedor) return;

    const placeholder = contenedor.querySelector('.chat-placeholder');
    if (placeholder) contenedor.innerHTML = '';

    nuevos.forEach(m => contenedor.insertAdjacentHTML('beforeend', renderizarMensaje(m, true)));
    scrollAlFinal();

    // Marcar como leídos los que nos llegaron
    if (nuevos.some(m => m.de_usuario_id !== usuarioActual.id)) {
      chat.leer(contactoActivo.id).catch(() => {});
    }
  } catch { /* silenciar errores de red */ }
}

// ============================================================
// Enviar mensaje
// ============================================================
async function enviarMensaje(e) {
  e.preventDefault();
  if (!contactoActivo) return;

  const input   = document.getElementById('chat-input');
  const mensaje = input?.value.trim();
  if (!mensaje) return;

  const btn = document.querySelector('#chat-form button[type="submit"]');
  if (btn) btn.disabled = true;

  try {
    const resp     = await chat.enviar(contactoActivo.id, mensaje);
    const nuevoMsg = resp.data;

    input.value = '';

    const contenedor = document.getElementById('chat-mensajes');
    if (contenedor) {
      const placeholder = contenedor.querySelector('.chat-placeholder');
      if (placeholder) contenedor.innerHTML = '';
      contenedor.insertAdjacentHTML('beforeend', renderizarMensaje(nuevoMsg, true));
      scrollAlFinal();
    }

    if (nuevoMsg.id > ultimoMensajeId) ultimoMensajeId = nuevoMsg.id;

    // Actualizar sidebar con el nuevo último mensaje
    cargarContactos();
  } catch (err) {
    const contenedor = document.getElementById('chat-mensajes');
    if (contenedor) {
      contenedor.insertAdjacentHTML('beforeend',
        `<div class="text-center py-1"><small class="text-danger">${err.message}</small></div>`);
      scrollAlFinal();
    }
  } finally {
    if (btn) btn.disabled = false;
    input?.focus();
  }
}

// ============================================================
// Renderizar burbuja de mensaje
// ============================================================
function renderizarMensaje(msg, esNuevo = false) {
  const esMio     = msg.de_usuario_id === usuarioActual?.id;
  const animacion = esNuevo ? 'chat-nuevo' : '';
  const hora      = new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const color     = colorAvatar(msg.de_usuario_id);

  if (esMio) {
    return `
      <div class="d-flex flex-column align-items-end ${animacion}">
        <div class="chat-meta">${hora}${msg.leido ? ' ✓✓' : ' ✓'}</div>
        <div class="chat-burbuja yo">${msg.mensaje}</div>
      </div>`;
  }

  return `
    <div class="d-flex gap-2 align-items-end ${animacion}">
      <div class="chat-avatar" style="background:${color};">${msg.avatar_inicial}</div>
      <div class="d-flex flex-column">
        <div class="chat-meta">${hora}</div>
        <div class="chat-burbuja otro">${msg.mensaje}</div>
      </div>
    </div>`;
}

// ============================================================
// Helpers
// ============================================================
function pararPolling() {
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
}

function scrollAlFinal() {
  const c = document.getElementById('chat-mensajes');
  if (c) c.scrollTop = c.scrollHeight;
}

function inicialDe(nombre, apellidos) {
  return (mb_substr(nombre, 0) + mb_substr(apellidos, 0)).toUpperCase();
}

function mb_substr(str, pos) {
  return str ? str.charAt(pos) : '';
}

function capitalizar(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function colorAvatar(userId) {
  const c = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#e67e22'];
  return c[userId % c.length];
}

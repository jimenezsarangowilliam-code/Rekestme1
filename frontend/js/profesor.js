/**
 * profesor.js — Lógica del dashboard del profesor
 * Gestiona: listar solicitudes, crear nueva, ver detalle, editar, eliminar
 */

import { solicitudes, aulas, software, auth, usuarios, notificaciones } from './api.js';

// Day.js (cargado vía CDN antes que este módulo)
dayjs.extend(dayjs_plugin_relativeTime);
dayjs.locale('es');
import { inicializarChatbot } from './chatbot.js';
import { renderizarMapaProfesor, renderizarMapaLectura } from './aula-mapa.js';

// ============================================================
// Verificar sesión y rol al cargar la página
// ============================================================
let usuarioActual = null;

// Flatpickr — selector de fecha (cargado vía CDN)
flatpickr('#fechaNecesaria', {
  locale:     'es',
  dateFormat: 'Y-m-d',
  altInput:   true,
  altFormat:  'd/m/Y',
  minDate:    'today',
  disableMobile: true,
});

async function inicializar() {
  try {
    const resp  = await auth.me();
    usuarioActual = resp.data;

    if (usuarioActual.rol !== 'profesor') {
      // Si no es profesor, redirigir al dashboard correcto
      window.location.href = window.location.origin + '/rekestme/panel-tic';
      return;
    }

    document.getElementById('nombreUsuario').textContent =
      `${usuarioActual.nombre} ${usuarioActual.apellidos}`;

    await cargarDashboard();
    iniciarPollingNotificaciones();
    inicializarChatbot(usuarioActual);
  } catch {
    // Sin sesión → al login
    window.location.href = window.location.origin + '/rekestme/login';
  }
}

// ============================================================
// Cargar datos principales del dashboard
// ============================================================
async function cargarDashboard() {
  const [respSolicitudes, respAulas, respSoftware] = await Promise.all([
    solicitudes.listar(),
    aulas.listar(),
    software.listar(),
  ]);

  const listaSolicitudes = respSolicitudes.data;

  actualizarEstadisticas(listaSolicitudes);
  renderizarTablaSolicitudes(listaSolicitudes);
  rellenarSelectAulas(respAulas.data);
  rellenarSelectSoftware(respSoftware.data);
  renderizarGridAulas(respAulas.data);
}

// ============================================================
// Estadísticas del panel
// ============================================================
function actualizarEstadisticas(lista) {
  const total      = lista.length;
  const pendientes = lista.filter(s => s.estado === 'pendiente').length;
  const enCurso    = lista.filter(s => ['en_revision','aprobada','en_instalacion'].includes(s.estado)).length;
  const completadas= lista.filter(s => s.estado === 'completada').length;

  document.getElementById('statTotal').textContent      = total;
  document.getElementById('statPendientes').textContent = pendientes;
  document.getElementById('statEnCurso').textContent    = enCurso;
  document.getElementById('statCompletadas').textContent= completadas;
}

// ============================================================
// Tabla de solicitudes
// ============================================================
function renderizarTablaSolicitudes(lista) {
  const tbody = document.getElementById('tablaSolicitudes');

  if (!lista.length) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="text-center text-muted py-4">
        No tienes solicitudes. ¡Crea la primera!
      </td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(s => `
    <tr data-id="${s.id}" class="fila-solicitud">
      <td>${s.id}</td>
      <td>${s.software_nombre} <small class="text-muted">v${s.version}</small></td>
      <td>${s.aula_nombre}</td>
      <td>${formatearFecha(s.fecha_necesaria)}</td>
      <td><span class="badge badge-${s.estado} rounded-pill">${formatearEstado(s.estado)}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-primary btn-ver" data-id="${s.id}" title="Ver detalle">
          <i class="bi bi-eye"></i>
        </button>
      </td>
    </tr>
  `).join('');

  // Adjuntar eventos a los botones de la tabla
  tbody.querySelectorAll('.btn-ver').forEach(btn =>
    btn.addEventListener('click', () => verDetalle(parseInt(btn.dataset.id))));
}

// ============================================================
// Formulario "Nueva solicitud"
// ============================================================
let ordenadoresSeleccionados = []; // IDs seleccionados en el mapa

function rellenarSelectAulas(listaAulas) {
  const select = document.getElementById('selectAula');
  select.innerHTML = '<option value="">-- Selecciona un aula --</option>' +
    listaAulas.map(a => `<option value="${a.id}">${a.nombre} (${a.edificio})</option>`).join('');
}

// Cuando el profesor cambia de aula, cargar el mapa de esa aula
document.getElementById('selectAula')?.addEventListener('change', async function () {
  const aulaId = parseInt(this.value);
  ordenadoresSeleccionados = [];
  const zonaMapaProfesor = document.getElementById('zonaMapaProfesor');
  if (!zonaMapaProfesor) return;

  if (!aulaId) {
    zonaMapaProfesor.style.display = 'none';
    return;
  }

  zonaMapaProfesor.style.display = '';
  const contenedorMapa = document.getElementById('contenedorMapaProfesor');
  await renderizarMapaProfesor(aulaId, contenedorMapa, (ids) => {
    ordenadoresSeleccionados = ids;
  });
});

function rellenarSelectSoftware(listaSoftware) {
  const opts = '<option value="">-- Selecciona software --</option>' +
    listaSoftware.map(sw => `<option value="${sw.id}">${sw.nombre} v${sw.version}</option>`).join('');
  ['selectSoftware', 'editarSoftware'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

// Botones "Añadir nuevo" / "Cancelar" del panel nuevo software
document.getElementById('btnNuevoSoftware')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('selectSoftware').value = '';
  document.getElementById('selectSoftware').required = false;
  document.getElementById('panelNuevoSoftware').style.display = '';
  document.getElementById('inputNombreSoftware').focus();
});

document.getElementById('btnCancelarNuevo')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('panelNuevoSoftware').style.display = 'none';
  document.getElementById('selectSoftware').required = true;
  document.getElementById('inputNombreSoftware').value = '';
  document.getElementById('inputVersion').value = '';
  document.getElementById('inputUrlDescarga').value = '';
});

// Datos pendientes de envío (se guardan cuando el profesor confirma en el modal)
let _datosSolicitudPendiente = null;

const formNuevaSolicitud = document.getElementById('formNuevaSolicitud');
if (formNuevaSolicitud) {
  formNuevaSolicitud.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarAlerta('alertaFormSolicitud');

    // Resolver software_id: existente o crear nuevo
    const panelNuevo = document.getElementById('panelNuevoSoftware');
    let swId = null;

    if (panelNuevo.style.display !== 'none') {
      const nombre = document.getElementById('inputNombreSoftware').value.trim();
      if (!nombre) {
        mostrarAlerta('alertaFormSolicitud', 'Escribe el nombre del software nuevo.', 'danger');
        return;
      }
      try {
        const respSw = await software.crear({
          nombre,
          version:      document.getElementById('inputVersion').value.trim() || '1.0',
          url_descarga: document.getElementById('inputUrlDescarga').value.trim() || null,
          tipo:         'gratuito',
        });
        swId = respSw.data.id;
      } catch (err) {
        mostrarAlerta('alertaFormSolicitud', 'Error al crear el software: ' + err.message, 'danger');
        return;
      }
    } else {
      swId = parseInt(document.getElementById('selectSoftware').value);
      if (!swId) {
        mostrarAlerta('alertaFormSolicitud', 'Selecciona un software.', 'danger');
        return;
      }
    }

    const zonaVisible = document.getElementById('zonaMapaProfesor')?.style.display !== 'none';
    if (zonaVisible && ordenadoresSeleccionados.length === 0) {
      mostrarAlerta('alertaFormSolicitud', 'Debes seleccionar al menos un ordenador del aula.', 'danger');
      return;
    }

    const aulaId   = parseInt(document.getElementById('selectAula').value);
    const aulaText = document.getElementById('selectAula').options[document.getElementById('selectAula').selectedIndex]?.text ?? '—';
    const swText   = document.getElementById('selectSoftware').options[document.getElementById('selectSoftware').selectedIndex]?.text
                     ?? document.getElementById('inputNombreSoftware')?.value ?? '—';
    const fecha    = document.getElementById('fechaNecesaria').value;

    _datosSolicitudPendiente = {
      aula_id:         aulaId,
      software_id:     swId,
      fecha_necesaria: fecha,
      motivo:          document.getElementById('motivo').value.trim(),
      ordenador_ids:   ordenadoresSeleccionados.length > 0 ? ordenadoresSeleccionados : undefined,
    };

    // Mostrar resumen en el modal de confirmación
    document.getElementById('resumenSolicitud').innerHTML = `
      <table class="table table-sm mb-0">
        <tr><th style="width:120px;">Software</th><td>${swText}</td></tr>
        <tr><th>Aula</th><td>${aulaText}</td></tr>
        <tr><th>Fecha límite</th><td>${formatearFecha(fecha)}</td></tr>
        ${ordenadoresSeleccionados.length > 0 ? `<tr><th>Ordenadores</th><td>${ordenadoresSeleccionados.length} PC(s) seleccionado(s)</td></tr>` : ''}
      </table>`;

    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConfirmarEnvio')).show();
  });
}

// Confirmar envío definitivo
document.getElementById('btnConfirmarEnvio')?.addEventListener('click', async () => {
  bootstrap.Modal.getInstance(document.getElementById('modalConfirmarEnvio')).hide();
  if (!_datosSolicitudPendiente) return;

  const datos = _datosSolicitudPendiente;
  _datosSolicitudPendiente = null;

  try {
    await solicitudes.crear(datos);
    const panelNuevo = document.getElementById('panelNuevoSoftware');
    if (panelNuevo) panelNuevo.style.display = 'none';
    document.getElementById('selectSoftware').required = true;
    ordenadoresSeleccionados = [];
    const zonaMapaProfesor = document.getElementById('zonaMapaProfesor');
    if (zonaMapaProfesor) zonaMapaProfesor.style.display = 'none';
    formNuevaSolicitud.reset();
    mostrarToast('Solicitud enviada correctamente.', 'success');
    await cargarDashboard();
  } catch (err) {
    mostrarAlerta('alertaFormSolicitud', err.message, 'danger', err.errores);
  }
});

// ============================================================
// Ver detalle de solicitud (en modal)
// ============================================================
async function verDetalle(id) {
  try {
    const resp      = await solicitudes.obtener(id);
    const s         = resp.data;
    const modal     = document.getElementById('modalDetalle');
    const contenido = document.getElementById('modalDetalleContenido');

    contenido.innerHTML = `
      <div class="detail-grid">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
          <div class="detail-cell detail-cell-accent">
            <div class="detail-cell-label">Software</div>
            <div class="detail-cell-value">${s.software_nombre} <span style="color:var(--gray-400);font-weight:400;">v${s.version}</span></div>
          </div>
          <div class="detail-cell">
            <div class="detail-cell-label">Aula</div>
            <div class="detail-cell-value">${s.aula_nombre}</div>
            <div style="font-size:.8rem;color:var(--gray-500);margin-top:.2rem;">${s.edificio}, ${s.planta}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
          <div class="detail-cell">
            <div class="detail-cell-label">Estado</div>
            <div style="margin-top:.4rem;"><span class="badge badge-${s.estado} rounded-pill">${formatearEstado(s.estado)}</span></div>
          </div>
          <div class="detail-cell">
            <div class="detail-cell-label">Fecha límite</div>
            <div class="detail-cell-value">${formatearFecha(s.fecha_necesaria)}</div>
          </div>
        </div>
        <div class="detail-cell">
          <div class="detail-cell-label">Motivo</div>
          <div style="color:var(--gray-600);font-size:.875rem;line-height:1.6;margin-top:.25rem;">${s.motivo}</div>
        </div>
        ${s.comentario_tic ? `
        <div class="detail-cell detail-cell-accent">
          <div class="detail-cell-label"><i class="bi bi-chat-dots me-1"></i>Comentario TIC</div>
          <div style="color:var(--blue);font-size:.875rem;line-height:1.6;margin-top:.25rem;">${s.comentario_tic}</div>
        </div>` : ''}
        <div style="font-size:.75rem;color:var(--gray-400);text-align:right;">Creada: ${formatearFechaHora(s.created_at)}</div>
      </div>
    `;

    bootstrap.Modal.getOrCreateInstance(modal).show();
  } catch (err) {
    mostrarToast(err.message, 'danger');
  }
}


// ============================================================
// Aulas del centro (solo lectura)
// ============================================================
function renderizarGridAulas(listaAulas) {
  const contenedor = document.getElementById('gridAulas');
  if (!contenedor) return;

  if (!listaAulas.length) {
    contenedor.innerHTML = '<div class="col-12"><p class="text-muted text-center py-3">No hay aulas registradas.</p></div>';
    return;
  }

  contenedor.innerHTML = listaAulas.map(a => `
    <div class="col-6 col-md-4 col-lg-3">
      <div class="card aula-card-btn h-100 p-3" data-aula-id="${a.id}"
           style="cursor:pointer;border:1px solid var(--gray-200);transition:box-shadow .18s,border-color .18s;"
           onmouseover="this.style.boxShadow='0 4px 16px rgba(99,102,241,.13)';this.style.borderColor='var(--blue)'"
           onmouseout="this.style.boxShadow='';this.style.borderColor='var(--gray-200)'">
        <div style="font-size:.65rem;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:.05em;">${a.edificio ?? ''}</div>
        <div style="font-weight:700;color:var(--navy);font-size:.95rem;margin:.1rem 0;">${a.nombre}</div>
        <div style="font-size:.75rem;color:var(--gray-500);">${a.planta ?? ''}</div>
        <div class="mt-2" style="font-size:.75rem;color:var(--gray-400);">
          <i class="bi bi-pc-display-horizontal me-1"></i>Ver PCs y software
        </div>
      </div>
    </div>
  `).join('');

  contenedor.querySelectorAll('.aula-card-btn').forEach(card =>
    card.addEventListener('click', () => abrirModalAula(parseInt(card.dataset.aulaId), listaAulas))
  );
}

async function abrirModalAula(aulaId, listaAulas) {
  const aula    = listaAulas.find(a => a.id === aulaId);
  const modalEl = document.getElementById('modalAula');
  const titulo  = aula ? `${aula.nombre}${aula.edificio ? ' — ' + aula.edificio : ''}` : 'Aula';
  document.getElementById('modalAulaNombre').textContent = titulo;
  const contenido = document.getElementById('modalAulaContenido');
  contenido.innerHTML = '';
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
  await renderizarMapaLectura(aulaId, contenido);
}

// ============================================================
// Perfil — ver, editar datos y cambiar contraseña
// ============================================================
document.getElementById('btnVerPerfil')?.addEventListener('click', async () => {
  const modalEl = document.getElementById('modalPerfil');

  // Resetear al tab info y mostrar spinner
  document.getElementById('perfilHeader').style.display    = 'none';
  document.getElementById('perfilCargando').style.display  = 'block';
  document.getElementById('perfilTabs').style.display      = 'none';
  document.getElementById('perfilInfoContenido').innerHTML  = '';
  limpiarAlerta('alertaEditarPerfil');
  limpiarAlerta('alertaCambiarPassword');

  // Activar tab info
  const infoTabBtn = modalEl.querySelector('[data-bs-target="#perfilTabInfo"]');
  new bootstrap.Tab(infoTabBtn).show();

  bootstrap.Modal.getOrCreateInstance(modalEl).show();

  try {
    const resp = await usuarios.perfil();
    const u    = resp.data;

    // Cabecera
    document.getElementById('perfilAvatar').textContent       = u.nombre.charAt(0) + u.apellidos.charAt(0);
    document.getElementById('perfilNombreDisplay').textContent = `${u.nombre} ${u.apellidos}`;
    document.getElementById('perfilRolDisplay').textContent    = capitalizar(u.rol);
    document.getElementById('perfilHeader').style.display      = 'block';
    document.getElementById('perfilCargando').style.display    = 'none';
    document.getElementById('perfilTabs').style.display        = '';

    // Tab info
    document.getElementById('perfilInfoContenido').innerHTML = `
      <div class="detail-grid" style="grid-template-columns:1fr 1fr;">
        <div class="detail-cell detail-cell-accent">
          <div class="detail-cell-label">Email</div>
          <div class="detail-cell-value" style="font-size:.875rem;word-break:break-all;">${u.email}</div>
        </div>
        <div class="detail-cell">
          <div class="detail-cell-label">Rol</div>
          <div style="margin-top:.4rem;"><span class="badge badge-aprobada rounded-pill">${capitalizar(u.rol)}</span></div>
        </div>
        ${u.departamento ? `
        <div class="detail-cell">
          <div class="detail-cell-label">Departamento</div>
          <div class="detail-cell-value">${u.departamento}</div>
        </div>` : ''}
        <div class="detail-cell" style="grid-column:1/-1;">
          <div class="detail-cell-label">Miembro desde</div>
          <div class="detail-cell-value" style="font-weight:500;color:var(--gray-600);">${formatearFechaHora(u.created_at)}</div>
        </div>
      </div>`;

    // Pre-rellenar formulario de edición
    document.getElementById('perfilNombre').value    = u.nombre;
    document.getElementById('perfilApellidos').value = u.apellidos;
    document.getElementById('perfilEmail').value     = u.email;
  } catch (err) {
    document.getElementById('perfilCargando').style.display = 'none';
    document.getElementById('perfilInfoContenido').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    document.getElementById('perfilTabs').style.display = '';
  }
});

document.getElementById('formEditarPerfil')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarAlerta('alertaEditarPerfil');

  const datos = {
    nombre:    document.getElementById('perfilNombre').value.trim(),
    apellidos: document.getElementById('perfilApellidos').value.trim(),
    email:     document.getElementById('perfilEmail').value.trim(),
  };

  try {
    await usuarios.actualizarPerfil(datos);
    usuarioActual = { ...usuarioActual, ...datos };
    document.getElementById('nombreUsuario').textContent      = `${datos.nombre} ${datos.apellidos}`;
    document.getElementById('perfilNombreDisplay').textContent = `${datos.nombre} ${datos.apellidos}`;
    document.getElementById('perfilAvatar').textContent        = datos.nombre.charAt(0) + datos.apellidos.charAt(0);
    mostrarAlerta('alertaEditarPerfil', 'Perfil actualizado correctamente.', 'success');
  } catch (err) {
    mostrarAlerta('alertaEditarPerfil', err.message, 'danger', err.errores);
  }
});

document.getElementById('formCambiarPassword')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarAlerta('alertaCambiarPassword');

  const datos = {
    password_actual:       document.getElementById('perfilPasswordActual').value,
    password_nueva:        document.getElementById('perfilPasswordNueva').value,
    password_confirmacion: document.getElementById('perfilPasswordConfirmacion').value,
  };

  try {
    await usuarios.cambiarPassword(datos);
    document.getElementById('formCambiarPassword').reset();
    mostrarAlerta('alertaCambiarPassword', 'Contraseña actualizada correctamente.', 'success');
  } catch (err) {
    mostrarAlerta('alertaCambiarPassword', err.message, 'danger', err.errores);
  }
});

// ============================================================
// Notificaciones — badge con polling cada 30s
// ============================================================
async function actualizarBadgeNotificaciones() {
  try {
    const resp    = await notificaciones.listar();
    const noLeidas = resp.data.no_leidas;
    const badge   = document.getElementById('badgeNotif');
    if (!badge) return;

    if (noLeidas > 0) {
      badge.textContent   = noLeidas > 99 ? '99+' : noLeidas;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch { /* silenciar errores de red */ }
}

function iniciarPollingNotificaciones() {
  actualizarBadgeNotificaciones();
  setInterval(actualizarBadgeNotificaciones, 30000);
}

document.getElementById('btnNotificaciones')?.addEventListener('click', async () => {
  try {
    const resp  = await notificaciones.listar();
    const lista = resp.data.notificaciones;

    const filaNotif = (n) => `
      <div id="notif-row-${n.id}" style="display:flex;gap:.6rem;align-items:flex-start;padding:.6rem 0;border-bottom:1px solid var(--gray-100);">
        <i class="bi bi-${n.leida ? 'bell' : 'bell-fill'}" style="color:${n.leida ? 'var(--gray-300)' : 'var(--blue)'};font-size:1rem;margin-top:.1rem;flex-shrink:0;"></i>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.8rem;color:${n.leida ? 'var(--gray-500)' : 'var(--navy)'};font-weight:${n.leida ? '400' : '600'};">${n.mensaje}</div>
          <div style="font-size:.72rem;color:var(--gray-400);margin-top:.15rem;" title="${new Date(n.created_at).toLocaleString('es-ES')}">${dayjs(n.created_at).fromNow()}</div>
        </div>
        <button class="btn-borrar-notif" data-id="${n.id}"
                style="background:none;border:none;color:var(--gray-300);cursor:pointer;font-size:.85rem;padding:.1rem .25rem;flex-shrink:0;"
                title="Eliminar notificación">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>`;

    const sinNotifs = '<p id="notif-vacio" style="text-align:center;color:var(--gray-400);padding:1rem 0;">Sin notificaciones</p>';
    const itemsHtml = lista.length === 0 ? sinNotifs : lista.slice(0, 10).map(filaNotif).join('');

    const panelHtml = `
      <div style="max-width:320px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
          <strong>Notificaciones</strong>
          ${lista.length > 0 ? '<button id="btn-borrar-todas-notif" style="font-size:.75rem;background:none;border:none;color:#ef4444;cursor:pointer;padding:0;">Borrar todas</button>' : ''}
        </div>
        <div id="notif-lista-panel">${itemsHtml}</div>
      </div>`;

    mostrarToast(panelHtml, 'light', 15000);

    setTimeout(() => {
      // Borrar notificación individual
      document.querySelectorAll('.btn-borrar-notif').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.dataset.id);
          try {
            await notificaciones.eliminar(id);
            document.getElementById(`notif-row-${id}`)?.remove();
            actualizarBadgeNotificaciones();
            const panel = document.getElementById('notif-lista-panel');
            if (panel && !panel.querySelector('[id^="notif-row-"]')) {
              panel.innerHTML = sinNotifs;
              document.getElementById('btn-borrar-todas-notif')?.remove();
            }
          } catch (err) { mostrarToast(err.message, 'danger'); }
        });
      });

      // Borrar todas
      document.getElementById('btn-borrar-todas-notif')?.addEventListener('click', async () => {
        try {
          await notificaciones.eliminarTodas();
          const panel = document.getElementById('notif-lista-panel');
          if (panel) panel.innerHTML = sinNotifs;
          document.getElementById('btn-borrar-todas-notif')?.remove();
          actualizarBadgeNotificaciones();
        } catch (err) { mostrarToast(err.message, 'danger'); }
      });
    }, 100);

    await notificaciones.marcarTodasLeidas();
    actualizarBadgeNotificaciones();
  } catch (err) {
    mostrarToast(err.message, 'danger');
  }
});

// ============================================================
// Cerrar sesión
// ============================================================
document.getElementById('btnLogout')?.addEventListener('click', async () => {
  await auth.logout();
  window.location.href = 'login.html';
});

// ============================================================
// Helpers de UI
// ============================================================
function mostrarToast(mensaje, tipo = 'info', delay = 2000) {
  const container = document.getElementById('toastContainer');
  const id        = `toast-${Date.now()}`;
  const esLight   = tipo === 'light';
  const html      = `
    <div id="${id}" class="toast align-items-center ${esLight ? 'bg-white border shadow' : `text-bg-${tipo} border-0`}" role="alert">
      <div class="d-flex">
        <div class="toast-body">${mensaje}</div>
        <button type="button" class="btn-close ${esLight ? '' : 'btn-close-white'} me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`;
  container.insertAdjacentHTML('beforeend', html);
  const toast = new bootstrap.Toast(document.getElementById(id), { delay });
  toast.show();
}

function mostrarAlerta(id, mensaje, tipo, errores = []) {
  const el = document.getElementById(id);
  if (!el) return;
  let html = `<div class="alert alert-${tipo}"><strong>${mensaje}</strong>`;
  if (errores.length) html += '<ul class="mt-1 mb-0">' + errores.map(e => `<li>${e}</li>`).join('') + '</ul>';
  html += '</div>';
  el.innerHTML = html;
}

function limpiarAlerta(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '';
}

function formatearFecha(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function formatearFechaHora(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('es-ES');
}

function formatearEstado(estado) {
  const mapa = {
    pendiente: 'Pendiente', en_revision: 'En revisión', aprobada: 'Aprobada',
    rechazada: 'Rechazada', en_instalacion: 'En instalación', completada: 'Completada',
  };
  return mapa[estado] ?? estado;
}

function capitalizar(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

// ============================================================
// Arrancar
// ============================================================
inicializar();

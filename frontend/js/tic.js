/**
 * tic.js — Lógica del dashboard del personal TIC
 * Gestiona: lista de solicitudes, cambio de estado, asignación de técnicos,
 * gestión de aulas y software.
 */

import { solicitudes, aulas, software, asignaciones, usuarios, auth, notificaciones, estadisticas, chat } from './api.js';

// Day.js (cargado vía CDN antes que este módulo)
dayjs.extend(dayjs_plugin_relativeTime);
dayjs.locale('es');
import { inicializarChat, detenerChat } from './tic-chat.js';
import { inicializarChatbot } from './chatbot.js';
import { renderizarMapaTIC } from './aula-mapa.js';
import { inicializarInventario } from './inventario.js';

let usuarioActual    = null;
let listaTecnicos    = [];
let todasSolicitudes = [];
let todasAulas       = [];
let todosSoftware    = [];
let todosUsuarios    = [];
let chartsInstancias = {}; // Chart.js instances keyed by canvas id
let estadisticasCache = null;
let sortableInstancias = {}; // Sortable.js instances keyed by column id
let _aulaIdMapa     = null;
let _aulaNombreMapa  = '';

// Mapa columna kanban → estado de la solicitud
const COLUMNA_ESTADO = {
  'col-pendiente':  'pendiente',
  'col-revision':   'en_revision',
  'col-aprobada':   'aprobada',
  'col-instalacion':'en_instalacion',
};

// ============================================================
// Inicializar: verificar sesión y rol
// ============================================================
async function inicializar() {
  try {
    const resp    = await auth.me();
    usuarioActual = resp.data;

    if (!['tic', 'admin'].includes(usuarioActual.rol)) {
      window.location.href = window.location.origin + '/rekestme/panel';
      return;
    }

    document.getElementById('nombreUsuario').textContent =
      `${usuarioActual.nombre} ${usuarioActual.apellidos}`;

    // Si es admin, mostrar secciones de gestión de usuarios
    if (usuarioActual.rol === 'admin') {
      document.querySelectorAll('.solo-admin').forEach(el => el.classList.remove('d-none'));
    }

    await cargarDashboard();
    iniciarPollingNotificaciones();
    inicializarChatbot(usuarioActual);

    // Inicializar chat al activar la pestaña (lazy, una sola vez)
    document.getElementById('chat-tab')?.addEventListener('shown.bs.tab', () => {
      inicializarChat(usuarioActual);
    });

    // Inicializar inventario al activar la pestaña (lazy, una sola vez)
    let _inventarioInicializado = false;
    document.getElementById('inventario-tab')?.addEventListener('shown.bs.tab', () => {
      if (!_inventarioInicializado) {
        _inventarioInicializado = true;
        inicializarInventario();
      }
    });
  } catch {
    window.location.href = window.location.origin + '/rekestme/login';
  }
}

// ============================================================
// Cargar todo el dashboard
// ============================================================
async function cargarDashboard() {
  const [respSolicitudes, respAulas, respSoftware, respUsuarios] = await Promise.all([
    solicitudes.listar(),
    aulas.listar(),
    software.listar(),
    usuarioActual.rol === 'admin' ? usuarios.listar() : Promise.resolve({ data: [] }),
  ]);

  todasSolicitudes = respSolicitudes.data;
  todasAulas       = respAulas.data;
  todosSoftware    = respSoftware.data;
  todosUsuarios    = respUsuarios.data;
  listaTecnicos    = todosUsuarios.filter(u => ['tic', 'admin'].includes(u.rol));

  actualizarEstadisticas(todasSolicitudes);
  renderizarKanban(todasSolicitudes);
  renderizarTablaAulas(todasAulas);
  renderizarGridAulasTIC(todasAulas);
  renderizarTablaSoftware(todosSoftware);
  renderizarTablaUsuarios(todosUsuarios);
}

// ============================================================
// Estadísticas
// ============================================================
function actualizarEstadisticas(lista) {
  document.getElementById('statTotal').textContent       = lista.length;
  document.getElementById('statPendientes').textContent  = lista.filter(s => s.estado === 'pendiente').length;
  document.getElementById('statUrgentes').textContent    = lista.filter(s => s.estado === 'en_instalacion').length;
  document.getElementById('statCompletadas').textContent = lista.filter(s => s.estado === 'completada').length;
}

// ============================================================
// Kanban de solicitudes (solo activas, sin completadas ni rechazadas)
// ============================================================
function renderizarKanban(lista) {
  const activas = lista.filter(s => s.estado !== 'completada' && s.estado !== 'rechazada');

  const grupos = {
    pendiente:  activas.filter(s => s.estado === 'pendiente'),
    revision:   activas.filter(s => s.estado === 'en_revision'),
    aprobada:   activas.filter(s => s.estado === 'aprobada'),
    instalacion:activas.filter(s => s.estado === 'en_instalacion'),
  };

  const totalActivas = activas.length;
  const el = document.getElementById('kanbanTotalActivas');
  if (el) el.textContent = totalActivas === 0 ? 'Sin solicitudes activas' : `${totalActivas} solicitud${totalActivas !== 1 ? 'es' : ''} activa${totalActivas !== 1 ? 's' : ''}`;

  Object.entries(grupos).forEach(([key, items]) => {
    const col   = document.getElementById(`col-${key}`);
    const count = document.getElementById(`count-${key}`);
    if (!col) return;

    count.textContent = items.length;

    if (!items.length) {
      col.innerHTML = '<div class="kanban-empty">Sin solicitudes</div>';
      return;
    }

    col.innerHTML = items.map(s => tarjetaKanban(s)).join('');

    col.querySelectorAll('.kanban-card').forEach(card =>
      card.addEventListener('click', () => abrirGestion(parseInt(card.dataset.id))));

    col.querySelectorAll('.kanban-del-btn').forEach(btn =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmarEliminarSolicitud(parseInt(btn.dataset.id), btn.dataset.estado);
      }));
  });

  inicializarSortableKanban();
}

function tarjetaKanban(s) {
  const palabras  = (s.profesor_nombre ?? '?').trim().split(' ');
  const iniciales = palabras.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const tecnicoHtml = s.tecnico_nombre
    ? `<span><i class="bi bi-wrench" style="font-size:.7rem;margin-right:.2rem;"></i><span class="text-muted" style="font-size:.65rem;">Técnico:</span> ${s.tecnico_nombre}</span>`
    : '';

  return `
    <div class="kanban-card" data-id="${s.id}">
      <div class="d-flex align-items-start justify-content-between gap-1 mb-1">
        <div class="kanban-card-title">${s.software_nombre}</div>
        <button class="kanban-del-btn btn-eliminar-sol" data-id="${s.id}" data-estado="${s.estado}" title="Eliminar solicitud">
          <i class="bi bi-trash3"></i>
        </button>
      </div>
      <div class="kanban-card-meta">
        <span><i class="bi bi-person" style="font-size:.7rem;margin-right:.2rem;"></i><span class="text-muted" style="font-size:.65rem;">Solicitante:</span> ${s.profesor_nombre}</span>
        <span><i class="bi bi-building" style="font-size:.7rem;margin-right:.2rem;"></i>${s.aula_nombre}</span>
        ${tecnicoHtml}
      </div>
      <div class="kanban-card-footer">
        <span style="font-size:.72rem;color:var(--gray-400);">
          <i class="bi bi-calendar3" style="font-size:.65rem;margin-right:.2rem;"></i><span style="font-size:.65rem;">Límite:</span> ${formatearFecha(s.fecha_necesaria)}
        </span>
        <div class="kanban-avatar" title="${s.profesor_nombre}">${iniciales}</div>
      </div>
    </div>`;
}


function inicializarSortableKanban() {
  Object.entries(COLUMNA_ESTADO).forEach(([colId, estado]) => {
    const col = document.getElementById(colId);
    if (!col) return;

    // Destruir instancia previa si existe
    if (sortableInstancias[colId]) {
      sortableInstancias[colId].destroy();
      delete sortableInstancias[colId];
    }

    sortableInstancias[colId] = new Sortable(col, {
      group:          'kanban',
      animation:      150,
      ghostClass:     'kanban-ghost',
      dragClass:      'kanban-drag',
      filter:         '.kanban-del-btn',
      preventOnFilter: false,
      onEnd: async (evt) => {
        if (evt.from === evt.to) return; // reorden dentro de la misma columna, sin acción

        const card          = evt.item;
        const id            = parseInt(card.dataset.id);
        const estadoOrigen  = COLUMNA_ESTADO[evt.from.id];
        const estadoDestino = COLUMNA_ESTADO[evt.to.id];

        const validos = obtenerEstadosSiguientes(estadoOrigen);
        if (!validos.includes(estadoDestino)) {
          // Transición no permitida → revertir devolviendo la tarjeta al origen
          evt.from.insertBefore(card, evt.from.children[evt.oldIndex] ?? null);
          mostrarToast(`No se puede mover de "${formatearEstado(estadoOrigen)}" a "${formatearEstado(estadoDestino)}".`, 'warning');
          return;
        }

        // La transición aprobada → en_instalacion requiere técnico asignado
        if (estadoOrigen === 'aprobada' && estadoDestino === 'en_instalacion') {
          const solicitud = todasSolicitudes.find(s => s.id === id);
          if (!solicitud?.tecnico_nombre) {
            evt.from.insertBefore(card, evt.from.children[evt.oldIndex] ?? null);
            mostrarToast('Asigna un técnico desde el modal para iniciar la instalación.', 'info');
            await abrirGestion(id);
            return;
          }
          // Ya tiene técnico → permitir el cambio de estado directamente
        }

        try {
          await solicitudes.cambiarEstado(id, estadoDestino, null);
          mostrarToast(`Solicitud movida a "${formatearEstado(estadoDestino)}".`, 'success');
          await cargarDashboard();
        } catch (err) {
          evt.from.insertBefore(card, evt.from.children[evt.oldIndex] ?? null);
          mostrarToast(err.message, 'danger');
        }
      },
    });
  });
}

let _filtroMisSolicitudes = false;

function aplicarFiltros() {
  const texto = (document.getElementById('buscadorSolicitudes')?.value ?? '').toLowerCase().trim();

  const filtradas = todasSolicitudes.filter(s => {
    if (_filtroMisSolicitudes) {
      const miNombre = `${usuarioActual.nombre} ${usuarioActual.apellidos}`.toLowerCase();
      if ((s.tecnico_nombre ?? '').toLowerCase() !== miNombre) return false;
    }
    if (!texto) return true;
    return (s.profesor_nombre  ?? '').toLowerCase().includes(texto) ||
           (s.software_nombre  ?? '').toLowerCase().includes(texto) ||
           (s.aula_nombre      ?? '').toLowerCase().includes(texto);
  });

  renderizarKanban(filtradas);
}

document.getElementById('buscadorSolicitudes')?.addEventListener('input', aplicarFiltros);

document.getElementById('btnMisSolicitudes')?.addEventListener('click', function () {
  _filtroMisSolicitudes = !_filtroMisSolicitudes;
  this.classList.toggle('btn-outline-primary', !_filtroMisSolicitudes);
  this.classList.toggle('btn-primary', _filtroMisSolicitudes);
  aplicarFiltros();
});

document.getElementById('buscadorAulas')?.addEventListener('input', function () {
  const texto = this.value.toLowerCase().trim();
  const filtradas = texto
    ? todasAulas.filter(a =>
        (a.nombre   ?? '').toLowerCase().includes(texto) ||
        (a.edificio ?? '').toLowerCase().includes(texto) ||
        (a.planta   ?? '').toLowerCase().includes(texto))
    : todasAulas;
  renderizarTablaAulas(filtradas);
  renderizarGridAulasTIC(filtradas);
});

document.getElementById('buscadorSoftware')?.addEventListener('input', function () {
  const texto = this.value.toLowerCase().trim();
  const filtrados = texto
    ? todosSoftware.filter(s =>
        (s.nombre   ?? '').toLowerCase().includes(texto) ||
        (s.version  ?? '').toLowerCase().includes(texto) ||
        (s.tipo     ?? '').toLowerCase().includes(texto))
    : todosSoftware;
  renderizarTablaSoftware(filtrados);
});

document.getElementById('buscadorUsuarios')?.addEventListener('input', function () {
  const texto = this.value.toLowerCase().trim();
  const filtrados = texto
    ? todosUsuarios.filter(u =>
        (u.nombre      ?? '').toLowerCase().includes(texto) ||
        (u.apellidos   ?? '').toLowerCase().includes(texto) ||
        (u.email       ?? '').toLowerCase().includes(texto) ||
        (u.rol         ?? '').toLowerCase().includes(texto) ||
        (u.departamento ?? '').toLowerCase().includes(texto))
    : todosUsuarios;
  renderizarTablaUsuarios(filtrados);
});


// ============================================================
// Modal de gestión de una solicitud
// ============================================================
function obtenerEstadosSiguientes(estadoActual) {
  const flujo = {
    pendiente:      ['en_revision', 'rechazada'],
    en_revision:    ['aprobada', 'rechazada'],
    aprobada:       ['en_instalacion', 'rechazada'],
    en_instalacion: ['completada'],
    completada:     [],
    rechazada:      [],
  };
  return flujo[estadoActual] ?? [];
}

function actualizarLabelTecnico(estadoSiguiente, estadoActual) {
  const wrapper = document.getElementById('wrapperTecnico');
  const label   = document.getElementById('labelTecnico');
  const select  = document.getElementById('selectTecnico');
  if (!label || !select || !wrapper) return;

  if (estadoActual !== 'aprobada') {
    wrapper.classList.add('d-none');
    return;
  }
  wrapper.classList.remove('d-none');

  if (estadoSiguiente === 'en_instalacion') {
    label.innerHTML = 'Técnico encargado <span style="color:#ef4444;font-weight:700;">*</span>';
    select.classList.add('border-danger');
  } else {
    label.innerHTML = 'Técnico encargado <span class="text-muted fw-normal" style="font-size:.8rem;">(opcional)</span>';
    select.classList.remove('border-danger');
  }
}

async function abrirGestion(id) {
  // Cerrar historial si estaba abierto para evitar stacking de modales
  bootstrap.Modal.getInstance(document.getElementById('modalHistorial'))?.hide();

  // Pre-resetear estado del select antes del await para evitar estado stale si la petición falla
  const selectEstadoPre = document.getElementById('nuevoEstado');
  if (selectEstadoPre) selectEstadoPre.disabled = false;
  const btnGuardarPre = document.querySelector('#formGestion [type="submit"]');
  if (btnGuardarPre) btnGuardarPre.disabled = false;

  const resp = await solicitudes.obtener(id);
  const s    = resp.data;

  // Rellenar info en el modal
  document.getElementById('gestionInfo').innerHTML = `
    <table class="table table-sm">
      <tr><th>ID</th><td>${s.id}</td></tr>
      <tr><th>Profesor</th><td>${s.profesor_nombre} (${s.departamento ?? '—'})</td></tr>
      <tr><th>Software</th><td>${s.software_nombre} v${s.version}</td></tr>
      <tr><th>Tipo</th><td>${s.tipo}</td></tr>
      <tr><th>Aula</th><td>${s.aula_nombre} — ${s.edificio}, ${s.planta}</td></tr>
      <tr><th>Fecha límite</th><td>${formatearFecha(s.fecha_necesaria)}</td></tr>
      <tr><th>Motivo</th><td>${s.motivo}</td></tr>
      <tr><th>Estado actual</th><td><span class="badge badge-${s.estado}">${formatearEstado(s.estado)}</span></td></tr>
      <tr><th>Ordenadores</th><td>${
        s.ordenadores && s.ordenadores.length > 0
          ? `<span class="fw-semibold">${s.ordenadores.length} PC${s.ordenadores.length > 1 ? 's' : ''}</span>
             <span class="text-muted ms-1" style="font-size:.8rem;">(${s.ordenadores.map(o => o.nombre).join(', ')})</span>`
          : '<span class="text-muted">Sin ordenadores asignados</span>'
      }</td></tr>
      ${s.comentario_tic ? `<tr><th>Comentario TIC</th><td>${s.comentario_tic}</td></tr>` : ''}
    </table>
  `;

  // Rellenar select de estado con flujo secuencial
  const selectEstado = document.getElementById('nuevoEstado');
  const todosEstados = [
    { value: 'pendiente',      label: 'Pendiente' },
    { value: 'en_revision',    label: 'En revisión' },
    { value: 'aprobada',       label: 'Aprobada' },
    { value: 'rechazada',      label: 'Rechazada' },
    { value: 'en_instalacion', label: 'En instalación' },
    { value: 'completada',     label: 'Completada' },
  ];
  const siguientes = obtenerEstadosSiguientes(s.estado);
  const esTerminal = siguientes.length === 0;
  if (esTerminal) {
    selectEstado.innerHTML = `<option value="${s.estado}">${formatearEstado(s.estado)}</option>`;
    selectEstado.disabled = true;
  } else {
    selectEstado.disabled = false;
    selectEstado.innerHTML =
      `<option value="${s.estado}" selected>${formatearEstado(s.estado)} (actual)</option>` +
      siguientes.map(v => {
        const est = todosEstados.find(e => e.value === v);
        return `<option value="${v}">${est?.label ?? v}</option>`;
      }).join('');
  }
  const btnGuardar = document.querySelector('#formGestion [type="submit"]');
  if (btnGuardar) btnGuardar.disabled = esTerminal;

  document.getElementById('comentarioTic').value      = s.comentario_tic ?? '';
  document.getElementById('gestionId').value          = s.id;
  document.getElementById('gestionEstadoActual').value = s.estado;

  // Rellenar técnicos disponibles
  const selectTecnico = document.getElementById('selectTecnico');
  selectTecnico.innerHTML = '<option value="">— Sin asignar —</option>' +
    listaTecnicos.map(t => `<option value="${t.id}">${t.nombre} ${t.apellidos}</option>`).join('');

  // Actualizar label técnico según estado seleccionado (solo visible en en_revision)
  actualizarLabelTecnico(selectEstado.value, s.estado);
  selectEstado.onchange = () => actualizarLabelTecnico(selectEstado.value, s.estado);

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalGestion')).show();
}

// Guardar cambios de estado
document.getElementById('formGestion')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id         = parseInt(document.getElementById('gestionId').value);
  const estado     = document.getElementById('nuevoEstado').value;
  const comentario = document.getElementById('comentarioTic').value.trim() || null;
  const tecnicoId  = parseInt(document.getElementById('selectTecnico').value) || null;

  const estadoActualHidden = document.getElementById('gestionEstadoActual')?.value;
  if (estadoActualHidden === 'aprobada' && estado === 'en_instalacion' && !tecnicoId) {
    mostrarToast('Debes asignar un técnico para iniciar la instalación.', 'danger');
    document.getElementById('selectTecnico')?.focus();
    return;
  }

  try {
    // Primero crear la asignación (mientras el estado sigue en 'aprobada')
    // Si falla, el estado NO cambia — evita dejar la solicitud en en_instalacion sin técnico
    if (tecnicoId) {
      await asignaciones.asignar(id, tecnicoId, comentario);
    }

    await solicitudes.cambiarEstado(id, estado, comentario);

    bootstrap.Modal.getInstance(document.getElementById('modalGestion')).hide();
    mostrarToast('Solicitud actualizada correctamente.', 'success');
    await cargarDashboard();
  } catch (err) {
    mostrarToast(err.message, 'danger');
  }
});

// ============================================================
// Gestión de Usuarios (solo admin)
// ============================================================
function renderizarTablaUsuarios(lista) {
  const contenedor = document.getElementById('tablaUsuarios');
  if (!contenedor) return;

  if (!lista.length) {
    contenedor.innerHTML = `
      <tr><td colspan="6">
        <div style="text-align:center;padding:48px 0;color:var(--gray-400);">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:.4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <div style="font-size:.9rem;">No hay usuarios.</div>
        </div>
      </td></tr>`;
    return;
  }

  const rolConfig = {
    profesor: { label: 'Profesor',  color: '#2563eb', bg: 'rgba(37,99,235,0.1)'  },
    tic:      { label: 'TIC',       color: '#059669', bg: 'rgba(5,150,105,0.1)'  },
    admin:    { label: 'Admin',     color: '#dc2626', bg: 'rgba(220,38,38,0.1)'  },
  };

  const avatarColors = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
  const avatarColor  = (id) => avatarColors[id % avatarColors.length];
  const iniciales    = (u) => ((u.nombre?.[0] ?? '') + (u.apellidos?.[0] ?? '')).toUpperCase();

  contenedor.innerHTML = lista.map(u => {
    const rc  = rolConfig[u.rol] ?? { label: capitalizar(u.rol), color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
    const col = avatarColor(u.id);
    const ini = iniciales(u);
    const fecha = new Date(u.created_at).toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' });
    return `
    <tr style="border-bottom:1px solid #f1f5f9;transition:background .15s" onmouseenter="this.style.background='#f8faff'" onmouseleave="this.style.background=''">
      <td style="padding:14px 16px;width:52px;">
        <div style="width:38px;height:38px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:700;color:#fff;letter-spacing:.5px;flex-shrink:0;">${ini}</div>
      </td>
      <td style="padding:14px 8px;">
        <div style="font-weight:600;font-size:.9rem;color:#0f172a;line-height:1.3;">${u.nombre} ${u.apellidos}</div>
        <div style="font-size:.78rem;color:#94a3b8;margin-top:2px;">${u.email}</div>
      </td>
      <td style="padding:14px 8px;">
        <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:.75rem;font-weight:600;color:${rc.color};background:${rc.bg};letter-spacing:.3px;">${rc.label}</span>
      </td>
      <td style="padding:14px 8px;font-size:.82rem;color:#475569;">${u.departamento ? `<span style="background:#f1f5f9;padding:3px 8px;border-radius:6px;">${u.departamento}</span>` : '<span style="color:#cbd5e1;">—</span>'}</td>
      <td style="padding:14px 8px;font-size:.78rem;color:#94a3b8;white-space:nowrap;">${fecha}</td>
      <td style="padding:14px 8px;white-space:nowrap;">
        <button class="btn btn-sm btn-outline-primary btn-editar-usuario" data-id="${u.id}" title="Editar usuario" style="padding:3px 8px;font-size:.78rem;">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-eliminar-usuario ms-1" data-id="${u.id}" title="Eliminar usuario" style="padding:3px 8px;font-size:.78rem;">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

// Variable modular para el id del usuario que se está editando
let _editandoUsuarioId = null;

// Delegación de eventos en la tabla de usuarios
document.getElementById('tablaUsuarios')?.addEventListener('click', e => {
  const btnEditar = e.target.closest('.btn-editar-usuario');
  if (btnEditar) { abrirEditarUsuario(Number(btnEditar.dataset.id)); return; }

  const btnEliminar = e.target.closest('.btn-eliminar-usuario');
  if (btnEliminar) { borrarUsuario(Number(btnEliminar.dataset.id)); }
});

async function borrarUsuario(id) {
  let resp;
  try { resp = await usuarios.vinculos(id); } catch { resp = { data: {} }; }
  const v = resp.data ?? {};
  const activas   = v.solicitudes_activas   ?? 0;
  const historial = v.solicitudes_historial ?? 0;

  const asignaciones    = v.asignaciones     ?? 0;
  const historialEstados = v.historial_estados ?? 0;
  const comentarios      = v.comentarios       ?? 0;

  const bloqueantes = [];
  if (activas > 0)          bloqueantes.push(`${activas} solicitud${activas !== 1 ? 'es' : ''} activa${activas !== 1 ? 's' : ''}`);
  if (asignaciones > 0)     bloqueantes.push(`${asignaciones} asignación${asignaciones !== 1 ? 'es' : ''} como técnico`);
  if (historialEstados > 0) bloqueantes.push(`${historialEstados} cambio${historialEstados !== 1 ? 's' : ''} de estado registrado${historialEstados !== 1 ? 's' : ''}`);;

  if (bloqueantes.length > 0) {
    abrirModalConfirmar(
      'No se puede eliminar',
      `<p class="mb-2 text-danger fw-semibold">Este usuario no se puede eliminar porque tiene:</p><ul class="mb-0">${bloqueantes.map(b => `<li>${b}</li>`).join('')}</ul>`,
      null, 'Entendido'
    );
    return;
  }

  let aviso = '';
  if (historial > 0) aviso += `<li>${historial} solicitud${historial !== 1 ? 'es' : ''} en historial</li>`;
  const msg = aviso
    ? `<p class="mb-2">¿Seguro que quieres eliminar este usuario? Tiene:</p><ul class="mb-0 text-warning">${aviso}</ul>`
    : '¿Seguro que quieres eliminar este usuario? Esta acción no se puede deshacer.';

  abrirModalConfirmar('Eliminar usuario', msg, async () => {
    try {
      await usuarios.eliminar(id);
      mostrarToast('Usuario eliminado.', 'success');
      await cargarDashboard();
    } catch (err) {
      mostrarToast(err.message, 'danger');
    }
  });
}

function abrirEditarUsuario(id) {
  const u = todosUsuarios.find(x => x.id === id);
  if (!u) return;

  _editandoUsuarioId = id;

  document.getElementById('editNombre').value       = u.nombre       ?? '';
  document.getElementById('editApellidos').value    = u.apellidos    ?? '';
  document.getElementById('editEmail').value        = u.email        ?? '';
  document.getElementById('editRol').value          = u.rol          ?? 'profesor';
  document.getElementById('editDepartamento').value = u.departamento ?? '';
  document.getElementById('errorEditarUsuario').innerHTML = '';
  document.getElementById('errorResetPassword').innerHTML = '';

  // Resetear estado de confirmación contraseña
  document.getElementById('wrapperResetConfirm').classList.remove('d-none');
  document.getElementById('wrapperResetConfirmacion').classList.add('d-none');

  // Asegurar que el footer (con botón Guardar) sea visible al abrir
  document.getElementById('footerEditarUsuario').classList.remove('d-none');

  // Activar tab Datos
  const tabDatos = document.querySelector('#pillsEditarUsuario [data-bs-target="#tabEditDatos"]');
  bootstrap.Tab.getOrCreateInstance(tabDatos).show();

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEditarUsuario')).show();
}

document.getElementById('btnGuardarEditarUsuario')?.addEventListener('click', async () => {
  if (_editandoUsuarioId === null) return;

  const datos = {
    nombre:       document.getElementById('editNombre').value.trim(),
    apellidos:    document.getElementById('editApellidos').value.trim(),
    email:        document.getElementById('editEmail').value.trim(),
    rol:          document.getElementById('editRol').value,
    departamento: document.getElementById('editDepartamento').value.trim() || null,
  };

  const errorEl = document.getElementById('errorEditarUsuario');
  errorEl.innerHTML = '';

  document.getElementById('btnGuardarTexto').classList.add('d-none');
  document.getElementById('btnGuardarSpinner').classList.remove('d-none');
  document.getElementById('btnGuardarEditarUsuario').disabled = true;

  try {
    const resp = await usuarios.actualizar(_editandoUsuarioId, datos);
    const idx = todosUsuarios.findIndex(u => u.id === _editandoUsuarioId);
    if (idx !== -1) todosUsuarios[idx] = resp.data;
    renderizarTablaUsuarios(todosUsuarios);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEditarUsuario')).hide();
    mostrarToast('Usuario actualizado correctamente.', 'success');
  } catch (err) {
    const msg = err.errores?.length
      ? err.errores.join('<br>')
      : (err.message || 'Error al actualizar el usuario.');
    errorEl.innerHTML = `<div class="alert alert-danger py-2" style="font-size:.82rem;">${msg}</div>`;
  } finally {
    document.getElementById('btnGuardarTexto').classList.remove('d-none');
    document.getElementById('btnGuardarSpinner').classList.add('d-none');
    document.getElementById('btnGuardarEditarUsuario').disabled = false;
  }
});

document.getElementById('btnIniciarReset')?.addEventListener('click', () => {
  document.getElementById('wrapperResetConfirm').classList.add('d-none');
  document.getElementById('wrapperResetConfirmacion').classList.remove('d-none');
});

document.getElementById('btnCancelarReset')?.addEventListener('click', () => {
  document.getElementById('wrapperResetConfirm').classList.remove('d-none');
  document.getElementById('wrapperResetConfirmacion').classList.add('d-none');
});

document.getElementById('btnConfirmarReset')?.addEventListener('click', async () => {
  if (_editandoUsuarioId === null) return;

  const errorEl = document.getElementById('errorResetPassword');
  errorEl.innerHTML = '';

  document.getElementById('btnResetTexto').classList.add('d-none');
  document.getElementById('btnResetSpinner').classList.remove('d-none');
  document.getElementById('btnConfirmarReset').disabled = true;
  document.getElementById('btnCancelarReset').disabled  = true;

  try {
    const resp = await usuarios.resetPassword(_editandoUsuarioId);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEditarUsuario')).hide();
    mostrarToast(resp.message, 'success');
  } catch (err) {
    errorEl.innerHTML = `<div class="alert alert-danger py-2" style="font-size:.82rem;">${err.message || 'Error al enviar la nueva contraseña.'}</div>`;
    document.getElementById('wrapperResetConfirm').classList.remove('d-none');
    document.getElementById('wrapperResetConfirmacion').classList.add('d-none');
  } finally {
    document.getElementById('btnResetTexto').classList.remove('d-none');
    document.getElementById('btnResetSpinner').classList.add('d-none');
    document.getElementById('btnConfirmarReset').disabled = false;
    document.getElementById('btnCancelarReset').disabled  = false;
  }
});

document.querySelectorAll('#pillsEditarUsuario [data-bs-toggle="pill"]').forEach(btn => {
  btn.addEventListener('shown.bs.tab', e => {
    const esPassword = e.target.dataset.bsTarget === '#tabEditPassword';
    document.getElementById('footerEditarUsuario').classList.toggle('d-none', esPassword);
  });
});

// ============================================================
// Crear Usuario (solo admin)
// ============================================================
(function inicializarCrearUsuario() {
  const btnAbrir = document.getElementById('btnCrearUsuario');
  if (!btnAbrir) return;

  const modal      = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCrearUsuario'));
  const btnConfirm = document.getElementById('btnConfirmarCrearUsuario');
  const errorEl    = document.getElementById('errorCrearUsuario');

  btnAbrir.addEventListener('click', () => {
    document.getElementById('formCrearUsuario').reset();
    errorEl.innerHTML = '';
    modal.show();
  });

  btnConfirm.addEventListener('click', async () => {
    errorEl.innerHTML = '';

    const datos = {
      nombre:       document.getElementById('cuNombre').value.trim(),
      apellidos:    document.getElementById('cuApellidos').value.trim(),
      email:        document.getElementById('cuEmail').value.trim(),
      rol:          document.getElementById('cuRol').value,
      departamento: document.getElementById('cuDepartamento').value.trim() || null,
    };

    // Validación rápida en cliente
    if (!datos.nombre || !datos.apellidos || !datos.email) {
      errorEl.innerHTML = '<div class="alert alert-danger py-2" style="font-size:.82rem;">Nombre, apellidos y email son obligatorios.</div>';
      return;
    }

    // Mostrar spinner
    document.getElementById('btnCrearUsuarioTexto').classList.add('d-none');
    document.getElementById('btnCrearUsuarioSpinner').classList.remove('d-none');
    btnConfirm.disabled = true;

    try {
      const resp = await usuarios.crear(datos);
      todosUsuarios = [...todosUsuarios, resp.data];
      renderizarTablaUsuarios(todosUsuarios);
      modal.hide();
      mostrarToast(`Usuario creado. Credenciales enviadas a ${datos.email}.`);
    } catch (err) {
      const msg = err.errores?.length
        ? err.errores.join('<br>')
        : (err.message || 'Error al crear el usuario.');
      errorEl.innerHTML = `<div class="alert alert-danger py-2" style="font-size:.82rem;">${msg}</div>`;
    } finally {
      document.getElementById('btnCrearUsuarioTexto').classList.remove('d-none');
      document.getElementById('btnCrearUsuarioSpinner').classList.add('d-none');
      btnConfirm.disabled = false;
    }
  });
})();

// ============================================================
// Gestión de Aulas
// ============================================================
function renderizarTablaAulas(lista) {
  const tbody = document.getElementById('tablaAulas');
  if (!tbody) return;

  tbody.innerHTML = lista.map(a => {
    const resumen = a.ordenadores_resumen ?? {};
    const total   = resumen.total ?? 0;
    const badgeColor = resumen.averiado > 0 ? 'danger' : (total > 0 ? 'success' : 'secondary');
    return `
    <tr>
      <td>${a.id}</td>
      <td>${a.nombre}</td>
      <td>${a.edificio}</td>
      <td>${a.planta}</td>
      <td>${a.capacidad}</td>
      <td>${a.tiene_proyector ? '✓' : '✗'}</td>
      <td>${a.tiene_red ? '✓' : '✗'}</td>
      <td>
        <span class="badge bg-${badgeColor} rounded-pill me-1" title="Ordenadores registrados"
              style="font-size:.7rem;">${total} PCs</span>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-info btn-mapa-aula" data-id="${a.id}" data-nombre="${a.nombre}"
                title="Ver mapa de PCs">
          <i class="bi bi-grid-3x3-gap"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary btn-editar-aula" data-id="${a.id}" data-nombre="${a.nombre}"
          data-edificio="${a.edificio}" data-planta="${a.planta}" data-capacidad="${a.capacidad}"
          data-proyector="${a.tiene_proyector}" data-red="${a.tiene_red}" title="Editar aula">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-borrar-aula" data-id="${a.id}" title="Eliminar aula">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-mapa-aula').forEach(btn =>
    btn.addEventListener('click', () => abrirMapaAula(parseInt(btn.dataset.id), btn.dataset.nombre)));

  tbody.querySelectorAll('.btn-editar-aula').forEach(btn =>
    btn.addEventListener('click', () => editarAula(btn.dataset)));

  tbody.querySelectorAll('.btn-borrar-aula').forEach(btn =>
    btn.addEventListener('click', () => borrarAula(parseInt(btn.dataset.id))));
}

// ============================================================
// Vista centro: grid de tarjetas de aulas (modo TIC)
// ============================================================
function renderizarGridAulasTIC(lista) {
  const contenedor = document.getElementById('gridAulasTICInner');
  if (!contenedor) return;

  if (!lista.length) {
    contenedor.innerHTML = '<div class="col-12"><p class="text-muted text-center py-3">No hay aulas registradas.</p></div>';
    return;
  }

  contenedor.innerHTML = lista.map(a => `
    <div class="col-6 col-md-4 col-lg-3">
      <div class="card aula-card-tic h-100 p-3" data-aula-id="${a.id}"
           style="cursor:pointer;border:1px solid var(--gray-200);transition:box-shadow .18s,border-color .18s;"
           onmouseover="this.style.boxShadow='0 4px 16px rgba(99,102,241,.13)';this.style.borderColor='var(--blue)'"
           onmouseout="this.style.boxShadow='';this.style.borderColor='var(--gray-200)'">
        <div style="font-size:.65rem;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:.05em;">${a.edificio ?? ''}</div>
        <div style="font-weight:700;color:var(--navy);font-size:.95rem;margin:.1rem 0;">${a.nombre}</div>
        <div style="font-size:.75rem;color:var(--gray-500);">${a.planta ?? ''}</div>
        <div class="mt-2" style="font-size:.75rem;color:var(--gray-400);">
          <i class="bi bi-grid-3x3-gap me-1"></i>Ver mapa de PCs
        </div>
      </div>
    </div>
  `).join('');

  contenedor.querySelectorAll('.aula-card-tic').forEach((card, i) => {
    card.addEventListener('click', () => abrirMapaAula(lista[i].id, lista[i].nombre));
  });
}

// Abrir modal del mapa de PCs de un aula
async function abrirMapaAula(aulaId, nombreAula) {
  _aulaIdMapa     = Number(aulaId);
  _aulaNombreMapa  = nombreAula;

  // Resetear panel filtros PDF
  const panel = document.getElementById('panelFiltrosPDF');
  if (panel) panel.style.display = 'none';
  const btnPDF = document.getElementById('btnExportarPDFMapa');
  if (btnPDF) btnPDF.setAttribute('aria-expanded', 'false');
  document.querySelectorAll('.filtro-estado-pdf').forEach(cb => {
    cb.checked = cb.value === 'averiado' || cb.value === 'sin_monitor';
  });

  document.getElementById('mapaAulaNombre').textContent = nombreAula;
  const contenedor = document.getElementById('mapaAulaContenido');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalMapaAula')).show();
  await renderizarMapaTIC(aulaId, contenedor);
}

// Crear aula
document.getElementById('formNuevaAula')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const numOrd = parseInt(document.getElementById('aulaNumOrdenadores')?.value || '0');
  const datos = {
    nombre:           document.getElementById('aulaNombre').value.trim(),
    edificio:         document.getElementById('aulaEdificio').value.trim(),
    planta:           document.getElementById('aulaPlanta').value.trim(),
    capacidad:        parseInt(document.getElementById('aulaCapacidad').value),
    tiene_proyector:  document.getElementById('aulaProyector').checked,
    tiene_red:        document.getElementById('aulaRed').checked,
    num_ordenadores:  numOrd > 0 ? numOrd : undefined,
  };
  try {
    await aulas.crear(datos);
    mostrarToast('Aula creada correctamente.', 'success');
    e.target.reset();
    await cargarDashboard();
  } catch (err) {
    mostrarToast(err.message, 'danger');
  }
});

function editarAula(datos) {
  document.getElementById('editarAulaId').value        = datos.id;
  document.getElementById('editarAulaNombre').value    = datos.nombre;
  document.getElementById('editarAulaEdificio').value  = datos.edificio;
  const selectPlanta = document.getElementById('editarAulaPlanta');
  selectPlanta.value = datos.planta;
  if (selectPlanta.value !== datos.planta && datos.planta) {
    const opt = new Option(datos.planta, datos.planta, true, true);
    selectPlanta.prepend(opt);
  }
  document.getElementById('editarAulaCapacidad').value = datos.capacidad;
  document.getElementById('editarAulaProyector').checked = datos.proyector === '1';
  document.getElementById('editarAulaRed').checked       = datos.red === '1';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEditarAula')).show();
}

document.getElementById('formEditarAula')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = parseInt(document.getElementById('editarAulaId').value);
  const datos = {
    nombre:          document.getElementById('editarAulaNombre').value.trim(),
    edificio:        document.getElementById('editarAulaEdificio').value.trim(),
    planta:          document.getElementById('editarAulaPlanta').value.trim(),
    capacidad:       parseInt(document.getElementById('editarAulaCapacidad').value),
    tiene_proyector: document.getElementById('editarAulaProyector').checked,
    tiene_red:       document.getElementById('editarAulaRed').checked,
  };
  try {
    await aulas.actualizar(id, datos);
    bootstrap.Modal.getInstance(document.getElementById('modalEditarAula')).hide();
    mostrarToast('Aula actualizada.', 'success');
    await cargarDashboard();
  } catch (err) {
    mostrarToast(err.message, 'danger');
  }
});

async function borrarAula(id) {
  let resp;
  try { resp = await aulas.vinculos(id); } catch { resp = { data: {} }; }
  const v = resp.data ?? {};
  const activas   = v.solicitudes_activas   ?? 0;
  const historial = v.solicitudes_historial ?? 0;
  const ords      = v.ordenadores           ?? 0;

  if (activas > 0) {
    abrirModalConfirmar(
      'No se puede eliminar',
      `<span class="text-danger fw-semibold">Esta aula tiene ${activas} solicitud${activas !== 1 ? 'es' : ''} activa${activas !== 1 ? 's' : ''}.</span><br>Resuelve las solicitudes antes de eliminarla.`,
      null, 'Entendido'
    );
    return;
  }

  let aviso = '';
  if (historial > 0) aviso += `<li>${historial} solicitud${historial !== 1 ? 'es' : ''} en historial</li>`;
  if (ords > 0)      aviso += `<li>${ords} ordenador${ords !== 1 ? 'es' : ''} asociado${ords !== 1 ? 's' : ''}</li>`;
  const msg = aviso
    ? `<p class="mb-2">¿Seguro que quieres eliminar esta aula? También se eliminará:</p><ul class="mb-0 text-warning">${aviso}</ul>`
    : '¿Seguro que quieres eliminar esta aula? Se eliminarán también sus ordenadores asociados.';

  abrirModalConfirmar('Eliminar aula', msg, async () => {
    try {
      await aulas.eliminar(id);
      mostrarToast('Aula eliminada.', 'success');
      await cargarDashboard();
    } catch (err) {
      mostrarToast(err.message, 'danger');
    }
  });
}

// ============================================================
// Gestión de Software
// ============================================================
function renderizarTablaSoftware(lista) {
  const tbody = document.getElementById('tablaSoftware');
  if (!tbody) return;

  tbody.innerHTML = lista.map(sw => `
    <tr style="cursor:pointer" data-sw-id="${sw.id}">
      <td>${sw.id}</td>
      <td>${sw.nombre}</td>
      <td>${sw.version}</td>
      <td><span class="badge bg-secondary">${sw.tipo}</span></td>
      <td>${sw.url_descarga ? `<a href="${sw.url_descarga}" target="_blank" onclick="event.stopPropagation()">Enlace</a>` : '—'}</td>
      <td>
        <button class="btn btn-sm btn-outline-danger btn-borrar-sw" data-id="${sw.id}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.onclick = (e) => {
    if (e.target.closest('.btn-borrar-sw')) return;
    const tr = e.target.closest('tr[data-sw-id]');
    if (!tr) return;
    const sw = lista.find(s => s.id == tr.dataset.swId);
    if (sw) abrirDetalleSoftware(sw);
  };

  tbody.querySelectorAll('.btn-borrar-sw').forEach(btn =>
    btn.addEventListener('click', () => borrarSoftware(parseInt(btn.dataset.id))));
}

function abrirDetalleSoftware(sw) {
  const tipoLabel = { gratuito: 'Gratuito', open_source: 'Open Source', licencia: 'De licencia' };

  document.getElementById('detalleSWNombre').textContent  = sw.nombre;
  document.getElementById('detalleSWVersion').textContent = `v${sw.version}`;
  document.getElementById('detalleSWTipo').innerHTML =
    `<span class="badge bg-secondary">${tipoLabel[sw.tipo] ?? sw.tipo}</span>`;

  const urlWrapper  = document.getElementById('detalleSWUrlWrapper');
  const urlEl       = document.getElementById('detalleSWUrl');
  const btnDescarga = document.getElementById('detalleSWBtnDescarga');
  if (sw.url_descarga) {
    urlEl.href        = sw.url_descarga;
    urlEl.textContent = sw.url_descarga;
    urlWrapper.classList.remove('d-none');
    btnDescarga.href  = sw.url_descarga;
    btnDescarga.classList.remove('d-none');
  } else {
    urlWrapper.classList.add('d-none');
    btnDescarga.classList.add('d-none');
  }

  const reqWrapper = document.getElementById('detalleSWReqWrapper');
  const sinReq     = document.getElementById('detalleSWSinReq');
  if (sw.requisitos) {
    document.getElementById('detalleSWRequisitos').textContent = sw.requisitos;
    reqWrapper.classList.remove('d-none');
    sinReq.classList.add('d-none');
  } else {
    reqWrapper.classList.add('d-none');
    sinReq.classList.remove('d-none');
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDetalleSoftware')).show();
}

document.getElementById('formNuevoSoftware')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = {
    nombre:       document.getElementById('swNombre').value.trim(),
    version:      document.getElementById('swVersion').value.trim(),
    tipo:         document.getElementById('swTipo').value,
    url_descarga: document.getElementById('swUrl').value.trim() || null,
    requisitos:   document.getElementById('swRequisitos').value.trim() || null,
  };
  try {
    await software.crear(datos);
    mostrarToast('Software añadido correctamente.', 'success');
    e.target.reset();
    await cargarDashboard();
  } catch (err) {
    mostrarToast(err.message, 'danger');
  }
});

async function borrarSoftware(id) {
  let resp;
  try { resp = await software.vinculos(id); } catch { resp = { data: {} }; }
  const v = resp.data ?? {};
  const activas   = v.solicitudes_activas   ?? 0;
  const historial = v.solicitudes_historial ?? 0;

  if (activas > 0) {
    abrirModalConfirmar(
      'No se puede eliminar',
      `<span class="text-danger fw-semibold">Este software tiene ${activas} solicitud${activas !== 1 ? 'es' : ''} activa${activas !== 1 ? 's' : ''}.</span><br>Resuelve las solicitudes antes de eliminarlo.`,
      null, 'Entendido'
    );
    return;
  }

  let aviso = '';
  if (historial > 0) aviso += `<li>${historial} solicitud${historial !== 1 ? 'es' : ''} en historial</li>`;
  const msg = aviso
    ? `<p class="mb-2">¿Seguro que quieres eliminar este software del catálogo? Está vinculado a:</p><ul class="mb-0 text-warning">${aviso}</ul>`
    : '¿Seguro que quieres eliminar este software del catálogo?';

  abrirModalConfirmar('Eliminar software', msg, async () => {
    try {
      await software.eliminar(id);
      mostrarToast('Software eliminado.', 'success');
      await cargarDashboard();
    } catch (err) {
      mostrarToast(err.message, 'danger');
    }
  });
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
  bootstrap.Tab.getOrCreateInstance(infoTabBtn).show();

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
          <div class="detail-cell-value" style="font-weight:500;color:var(--gray-600);">${new Date(u.created_at).toLocaleString('es-ES')}</div>
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
    document.getElementById('nombreUsuario').textContent       = `${datos.nombre} ${datos.apellidos}`;
    document.getElementById('perfilNombreDisplay').textContent = `${datos.nombre} ${datos.apellidos}`;
    document.getElementById('perfilAvatar').textContent        = datos.nombre.charAt(0) + datos.apellidos.charAt(0);
    mostrarAlerta('alertaEditarPerfil', 'Perfil actualizado correctamente.', 'success');
  } catch (err) {
    mostrarAlerta('alertaEditarPerfil', err.message, 'danger', err.errores ?? []);
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
    mostrarAlerta('alertaCambiarPassword', err.message, 'danger', err.errores ?? []);
  }
});

// ============================================================
// Logout
// ============================================================
document.getElementById('btnLogout')?.addEventListener('click', async () => {
  detenerChat();
  await auth.logout();
  window.location.href = 'login.html';
});

// ============================================================
// Notificaciones — badge + panel
// ============================================================
async function actualizarBadgeNotificaciones() {
  try {
    const resp    = await notificaciones.listar();
    const noLeidas = resp.data.no_leidas;
    const badge   = document.getElementById('badgeNotif');
    if (badge) {
      if (noLeidas > 0) {
        badge.textContent   = noLeidas > 99 ? '99+' : noLeidas;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch { /* silenciar errores de red en polling */ }

  // Badge del chat (no leídos)
  try {
    const respChat  = await chat.noLeidos();
    const noLeidos  = respChat.data.count;
    const chatBadge = document.getElementById('chat-badge');
    if (chatBadge) {
      if (noLeidos > 0) {
        chatBadge.textContent = noLeidos;
        chatBadge.classList.remove('d-none');
      } else {
        chatBadge.classList.add('d-none');
      }
    }
  } catch { /* silenciar */ }
}

function iniciarPollingNotificaciones() {
  actualizarBadgeNotificaciones(); // Primera llamada inmediata
  setInterval(actualizarBadgeNotificaciones, 30000); // Cada 30 segundos
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
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;gap:.5rem;">
          <strong>Notificaciones</strong>
          <div style="display:flex;gap:.75rem;">
            ${lista.some(n => !n.leida) ? '<button id="btn-leer-todas-notif" style="font-size:.75rem;background:none;border:none;color:var(--blue);cursor:pointer;padding:0;">Marcar leídas</button>' : ''}
            ${lista.length > 0 ? '<button id="btn-borrar-todas-notif" style="font-size:.75rem;background:none;border:none;color:#ef4444;cursor:pointer;padding:0;">Borrar todas</button>' : ''}
          </div>
        </div>
        <div id="notif-lista-panel">${itemsHtml}</div>
      </div>`;

    mostrarToast(panelHtml, 'light', 15000);

    setTimeout(() => {
      // Marcar todas leídas
      document.getElementById('btn-leer-todas-notif')?.addEventListener('click', async () => {
        await notificaciones.marcarTodasLeidas();
        actualizarBadgeNotificaciones();
        document.getElementById('btn-leer-todas-notif')?.remove();
      });

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
              document.getElementById('btn-leer-todas-notif')?.remove();
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
          document.getElementById('btn-leer-todas-notif')?.remove();
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
// Estadísticas — Tab con Chart.js
// ============================================================

// ============================================================
// Exportar estadísticas a PDF
// ============================================================
function exportarPDF() {
  if (!estadisticasCache) return;
  if (!window.jspdf?.jsPDF) { mostrarToast('Librería PDF no disponible.', 'danger'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Cabecera
  doc.setFillColor(13, 43, 91);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ReKestMe — Informe de Estadísticas', 14, 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('es-ES', { dateStyle: 'long' }), 196, 14, { align: 'right' });

  let y = 32;

  // KPIs
  const r = estadisticasCache.resumen;
  const kpis = [
    ['Total solicitudes', r.total],
    ['Pendientes',        r.pendientes],
    ['En curso',         r.en_curso],
    ['Completadas',      r.completadas],
    ['Rechazadas',       r.rechazadas],
    ['Tiempo medio resolución', estadisticasCache.tiempo_medio_resolucion !== null ? estadisticasCache.tiempo_medio_resolucion + ' días' : '—'],
  ];
  doc.setTextColor(13, 43, 91);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen', 14, y);
  y += 5;

  doc.autoTable({
    startY: y,
    head: [['Indicador', 'Valor']],
    body: kpis,
    theme: 'striped',
    headStyles: { fillColor: [29, 106, 232] },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Solicitudes por estado
  if (estadisticasCache.total_por_estado?.length) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 43, 91);
    doc.text('Solicitudes por estado', 14, y);
    y += 2;
    doc.autoTable({
      startY: y,
      head: [['Estado', 'Total']],
      body: estadisticasCache.total_por_estado.map(e => [formatearEstado(e.estado), e.total]),
      theme: 'striped',
      headStyles: { fillColor: [29, 106, 232] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Software más solicitado
  if (estadisticasCache.software_mas_solicitado?.length) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 43, 91);
    doc.text('Top software más solicitado', 14, y);
    y += 2;
    doc.autoTable({
      startY: y,
      head: [['Software', 'Solicitudes']],
      body: estadisticasCache.software_mas_solicitado.map(s => [s.nombre, s.total]),
      theme: 'striped',
      headStyles: { fillColor: [29, 106, 232] },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save(`rekestme-estadisticas-${new Date().toISOString().slice(0,10)}.pdf`);
}

document.getElementById('btnExportarPDF')?.addEventListener('click', exportarPDF);

// ============================================================
// Exportar historial a Excel (SheetJS)
// ============================================================
function exportarExcel() {
  if (!window.XLSX) { mostrarToast('Librería Excel no disponible.', 'danger'); return; }
  const lista = todasSolicitudes;
  if (!lista.length) { mostrarToast('No hay solicitudes para exportar.', 'warning'); return; }

  const filas = lista.map(s => ({
    'ID':              s.id,
    'Profesor':        s.profesor_nombre ?? '',
    'Software':        s.software_nombre ?? '',
    'Versión':         s.version ?? '',
    'Aula':            s.aula_nombre ?? '',
    'Estado':          formatearEstado(s.estado),
    'Prioridad':       s.prioridad ?? '',
    'Fecha límite':    s.fecha_necesaria ?? '',
    'Técnico':         s.tecnico_nombre ?? '',
    'Motivo':          s.motivo ?? '',
  }));

  const ws  = XLSX.utils.json_to_sheet(filas);
  const wb  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes');
  XLSX.writeFile(wb, `rekestme-solicitudes-${new Date().toISOString().slice(0,10)}.xlsx`);
}

document.getElementById('btnExportarExcel')?.addEventListener('click', exportarExcel);

// Cargar estadísticas cuando se activa el tab
document.getElementById('tabsPanel')?.addEventListener('shown.bs.tab', async (e) => {
  if (e.target.dataset.bsTarget !== '#tabEstadisticas') return;
  if (estadisticasCache) return; // Ya cargadas

  document.getElementById('statsLoader').style.display = '';
  document.getElementById('statsContenido').style.display = 'none';

  try {
    const resp = await estadisticas.obtener();
    estadisticasCache = resp.data;
    renderizarEstadisticas(estadisticasCache);
  } catch (err) {
    mostrarToast('Error al cargar estadísticas: ' + err.message, 'danger');
  }
});

function renderizarEstadisticas(data) {
  // KPIs
  const r = data.resumen;
  document.getElementById('kpiRow').innerHTML = [
    { val: r.total,       lbl: 'Total solicitudes' },
    { val: r.pendientes,  lbl: 'Pendientes' },
    { val: r.en_curso,    lbl: 'En curso' },
    { val: r.completadas, lbl: 'Completadas' },
    { val: r.rechazadas,  lbl: 'Rechazadas' },
    { val: data.tiempo_medio_resolucion !== null ? data.tiempo_medio_resolucion + ' días' : '—', lbl: 'Tiempo medio resolución' },
  ].map(k => `
    <div class="kpi-mini">
      <div class="kpi-val">${k.val ?? 0}</div>
      <div class="kpi-lbl">${k.lbl}</div>
    </div>`).join('');

  // Paleta consistente
  const COLORES = {
    pendiente:      '#f59e0b',
    en_revision:    '#6366f1',
    aprobada:       '#10b981',
    rechazada:      '#ef4444',
    en_instalacion: '#3b82f6',
    completada:     '#22c55e',
  };

  // ---- Donut: estados ----
  const estados = data.total_por_estado;
  crearOActualizarChart('chartEstados', 'doughnut', {
    labels: estados.map(e => formatearEstado(e.estado)),
    datasets: [{
      data: estados.map(e => e.total),
      backgroundColor: estados.map(e => COLORES[e.estado] ?? '#94a3b8'),
      borderWidth: 2,
      borderColor: '#fff',
    }]
  }, {
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 12, padding: 16, font: { size: 12 } } },
    },
    cutout: '62%',
  });

  // ---- Bar horizontal: software ----
  const sw = data.software_mas_solicitado;
  crearOActualizarChart('chartSoftware', 'bar', {
    labels: sw.map(s => s.nombre),
    datasets: [{
      label: 'Solicitudes',
      data: sw.map(s => s.total),
      backgroundColor: '#1d6ae8cc',
      borderRadius: 6,
    }]
  }, {
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  });

  // ---- Line: evolución mensual ----
  const meses = data.solicitudes_por_mes;
  crearOActualizarChart('chartMeses', 'line', {
    labels: meses.map(m => m.mes),
    datasets: [{
      label: 'Solicitudes',
      data: meses.map(m => m.total),
      borderColor: '#1d6ae8',
      backgroundColor: '#1d6ae820',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#1d6ae8',
      pointRadius: 5,
    }]
  }, {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } },
      y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } },
    },
  });

  // ---- Bar: aulas ----
  const au = data.aulas_con_mas_solicitudes;
  crearOActualizarChart('chartAulas', 'bar', {
    labels: au.map(a => a.aula),
    datasets: [{
      label: 'Solicitudes',
      data: au.map(a => a.total),
      backgroundColor: '#0f2b5bcc',
      borderRadius: 6,
    }]
  }, {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } },
    },
  });

  document.getElementById('statsLoader').style.display  = 'none';
  document.getElementById('statsContenido').style.display = '';
}

function crearOActualizarChart(canvasId, tipo, datos, opciones = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destruir instancia previa si existe
  if (chartsInstancias[canvasId]) {
    chartsInstancias[canvasId].destroy();
  }

  chartsInstancias[canvasId] = new Chart(canvas, {
    type: tipo,
    data: datos,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...opciones,
    },
  });
}

// ============================================================
// Helpers de UI (igual que en profesor.js)
// ============================================================
function mostrarToast(mensaje, tipo = 'info', delay = 2000) {
  const container = document.getElementById('toastContainer');
  const id        = `toast-${Date.now()}`;
  const esLight   = tipo === 'light';
  container.insertAdjacentHTML('beforeend', `
    <div id="${id}" class="toast align-items-center ${esLight ? 'bg-white border shadow' : `text-bg-${tipo} border-0`}" role="alert">
      <div class="d-flex">
        <div class="toast-body">${mensaje}</div>
        <button type="button" class="btn-close ${esLight ? '' : 'btn-close-white'} me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`);
  new bootstrap.Toast(document.getElementById(id), { delay }).show();
}

function formatearFecha(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
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

// ============================================================
// Modal de confirmación genérico (reemplaza confirm() del navegador)
// ============================================================
let _confirmarCallback = null;

function abrirModalConfirmar(titulo, mensaje, callback, textoBoton = 'Eliminar') {
  document.getElementById('modalConfirmarTitulo').innerHTML =
    `<i class="bi bi-exclamation-triangle me-2" style="color:#ef4444;"></i>${titulo}`;
  document.getElementById('modalConfirmarMensaje').innerHTML = mensaje;
  const btn = document.getElementById('modalConfirmarBtn');
  btn.innerHTML = callback
    ? `<i class="bi bi-trash me-1"></i>${textoBoton}`
    : `<i class="bi bi-check me-1"></i>${textoBoton}`;
  btn.className = callback ? 'btn btn-danger' : 'btn btn-secondary';
  _confirmarCallback = callback;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConfirmar')).show();
}

document.getElementById('modalConfirmarBtn')?.addEventListener('click', async () => {
  bootstrap.Modal.getInstance(document.getElementById('modalConfirmar')).hide();
  if (_confirmarCallback) {
    await _confirmarCallback();
    _confirmarCallback = null;
  }
});

// ============================================================
// Modal historial (completadas + rechazadas)
// ============================================================
function abrirModalHistorial() {
  renderizarTablaHistorial();
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalHistorial')).show();
}

function renderizarTablaHistorial() {
  const filtroEstado = document.getElementById('historialFiltroEstado')?.value ?? '';
  const texto = (document.getElementById('historialBuscador')?.value ?? '').toLowerCase().trim();

  let lista = todasSolicitudes.filter(s =>
    s.estado === 'completada' || s.estado === 'rechazada'
  );

  if (filtroEstado) {
    lista = lista.filter(s => s.estado === filtroEstado);
  }

  if (texto) {
    lista = lista.filter(s =>
      (s.profesor_nombre ?? '').toLowerCase().includes(texto) ||
      (s.software_nombre ?? '').toLowerCase().includes(texto) ||
      (s.aula_nombre     ?? '').toLowerCase().includes(texto)
    );
  }

  const contador = document.getElementById('historialContador');
  if (contador) contador.textContent = `${lista.length} solicitud${lista.length !== 1 ? 'es' : ''}`;

  const tbody = document.getElementById('historialTbody');
  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Sin resultados.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${s.profesor_nombre}</td>
      <td>${s.software_nombre}</td>
      <td>${s.aula_nombre}</td>
      <td><span class="badge badge-${s.estado}">${formatearEstado(s.estado)}</span></td>
      <td>${formatearFecha(s.fecha_necesaria)}</td>
      <td class="d-flex gap-1">
        <button class="btn btn-sm btn-primary btn-hist-ver" data-id="${s.id}" title="Ver detalle">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-hist-eliminar" data-id="${s.id}" data-estado="${s.estado}" title="Eliminar">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-hist-ver').forEach(btn =>
    btn.addEventListener('click', () => abrirGestion(parseInt(btn.dataset.id))));

  tbody.querySelectorAll('.btn-hist-eliminar').forEach(btn =>
    btn.addEventListener('click', () => confirmarEliminarHistorial(parseInt(btn.dataset.id))));
}

function confirmarEliminarHistorial(id) {
  bootstrap.Modal.getInstance(document.getElementById('modalHistorial'))?.hide();
  abrirModalConfirmar(
    'Eliminar solicitud del historial',
    'Esta acción eliminará permanentemente la solicitud y toda su información asociada (historial de estados, comentarios). <strong>Esta información no se podrá recuperar.</strong>',
    async () => {
      try {
        await solicitudes.eliminar(id);
        mostrarToast('Solicitud eliminada del historial.', 'success');
        await cargarDashboard();
        abrirModalHistorial();
      } catch (err) {
        mostrarToast(err.message, 'danger');
        abrirModalHistorial();
      }
    },
    'Eliminar permanentemente'
  );
}

document.getElementById('btnHistorial')?.addEventListener('click', abrirModalHistorial);
document.getElementById('historialFiltroEstado')?.addEventListener('change', renderizarTablaHistorial);
document.getElementById('historialBuscador')?.addEventListener('input', renderizarTablaHistorial);

// ============================================================
// Eliminar solicitud (TIC/admin)
// ============================================================
function confirmarEliminarSolicitud(id, estado) {
  const avisos = {
    pendiente:      '¿Eliminar esta solicitud pendiente?',
    en_revision:    'Esta solicitud está <strong>en revisión</strong>. ¿Seguro que quieres eliminarla?',
    aprobada:       'Esta solicitud ya fue <strong>aprobada</strong>. ¿Seguro que quieres eliminarla?',
    rechazada:      '¿Eliminar esta solicitud rechazada?',
    en_instalacion: 'Esta solicitud está <strong>en instalación</strong>. ¿Seguro que quieres eliminarla?',
  };
  const mensaje = avisos[estado] ?? '¿Eliminar esta solicitud?';

  abrirModalConfirmar('Eliminar solicitud', mensaje, async () => {
    try {
      await solicitudes.eliminar(id);
      mostrarToast('Solicitud eliminada.', 'success');
      await cargarDashboard();
    } catch (err) {
      mostrarToast(err.message, 'danger');
    }
  });
}

// ============================================================
// Exportar PDF de PCs del mapa
// ============================================================
document.getElementById('btnExportarPDFMapa')?.addEventListener('click', () => {
  const panel = document.getElementById('panelFiltrosPDF');
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : '';
  document.getElementById('btnExportarPDFMapa').setAttribute('aria-expanded', String(!visible));
});

document.getElementById('btnCancelarFiltrosPDF')?.addEventListener('click', () => {
  document.getElementById('panelFiltrosPDF').style.display = 'none';
});

document.getElementById('modalMapaAula')?.addEventListener('hidden.bs.modal', () => {
  const panel = document.getElementById('panelFiltrosPDF');
  if (panel) panel.style.display = 'none';
});

document.getElementById('btnDescargarPDFMapa')?.addEventListener('click', exportarPDFMapa);

async function exportarPDFMapa() {
  if (!_aulaIdMapa) {
    mostrarToast('No hay aula seleccionada.', 'warning');
    return;
  }

  const btn = document.getElementById('btnDescargarPDFMapa');
  if (btn) btn.disabled = true;
  try {
    const estadosSeleccionados = [...document.querySelectorAll('.filtro-estado-pdf:checked')]
      .map(cb => cb.value);

    if (!estadosSeleccionados.length) {
      mostrarToast('Selecciona al menos un estado.', 'warning');
      return;
    }

    if (!window.jspdf?.jsPDF) {
      mostrarToast('Librería PDF no disponible.', 'danger');
      return;
    }

    let respOrdenadores;
    try {
      respOrdenadores = await aulas.obtenerOrdenadores(_aulaIdMapa);
    } catch (err) {
      mostrarToast('Error al obtener los PCs: ' + err.message, 'danger');
      return;
    }

    const LABEL_ESTADO = {
      operativo:     'Operativo',
      averiado:      'Averiado',
      sin_monitor:   'Sin monitor',
      mantenimiento: 'Mantenimiento',
    };

    const pcsFiltrados = (respOrdenadores.data?.ordenadores ?? [])
      .filter(pc => estadosSeleccionados.includes(pc.estado));

    if (!pcsFiltrados.length) {
      mostrarToast('No hay PCs con los estados seleccionados.', 'warning');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Cabecera azul
    doc.setFillColor(13, 43, 91);
    doc.rect(0, 0, 210, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`PCs — ${_aulaNombreMapa}`, 14, 14);

    // Subtítulo: edificio, planta, fecha
    const aulaInfo = todasAulas.find(a => a.id === _aulaIdMapa);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    const detalle = aulaInfo ? `${aulaInfo.edificio ?? ''} · ${aulaInfo.planta ?? ''}` : '';
    const fecha = new Date().toLocaleDateString('es-ES');
    doc.text(`${detalle}   Generado: ${fecha}`, 14, 20);

    // Filtros aplicados
    doc.setTextColor(13, 43, 91);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Filtro aplicado: ${estadosSeleccionados.map(e => LABEL_ESTADO[e]).join(', ')}`,
      14,
      30
    );

    // Tabla de PCs
    doc.autoTable({
      startY: 34,
      head: [['Nombre PC', 'Fila', 'Columna', 'Estado', 'Software instalado']],
      body: pcsFiltrados.map(pc => [
        pc.nombre ?? '',
        pc.fila    != null ? pc.fila    + 1 : '—',
        pc.columna != null ? pc.columna + 1 : '—',
        LABEL_ESTADO[pc.estado] ?? pc.estado,
        pc.software?.length ? pc.software.map(s => s.nombre).join(', ') : '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [29, 106, 232] },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
      columnStyles: { 4: { cellWidth: 70 } },
    });

    const nombreArchivo = `PCs_${_aulaNombreMapa.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(nombreArchivo);
    mostrarToast(`PDF descargado: ${nombreArchivo}`, 'success');
    document.getElementById('panelFiltrosPDF').style.display = 'none';
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// Arrancar
// ============================================================
inicializar();

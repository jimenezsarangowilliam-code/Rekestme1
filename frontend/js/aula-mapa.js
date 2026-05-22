/**
 * aula-mapa.js — Módulo de mapa visual de ordenadores por aula
 *
 * Exporta dos funciones principales:
 *   renderizarMapaTIC(aulaId, contenedor, opciones)
 *     → Vista de gestión TIC: editar nombre, cambiar estado, añadir/eliminar PCs
 *
 *   renderizarMapaProfesor(aulaId, contenedor, onSeleccionCambia)
 *     → Vista de selección para el profesor: click para seleccionar/deseleccionar
 */

import { aulas, ordenadores, software as catalogoSw } from './api.js';

// ============================================================
// Constantes de estado
// ============================================================
const ESTADOS = {
  operativo:     { label: 'Operativo',     css: 'pc-operativo',     icon: 'bi-display' },
  averiado:      { label: 'Averiado',      css: 'pc-averiado',      icon: 'bi-display-slash' },
  sin_monitor:   { label: 'Sin monitor',   css: 'pc-sin-monitor',   icon: 'bi-exclamation-triangle' },
  mantenimiento: { label: 'Mantenimiento', css: 'pc-mantenimiento', icon: 'bi-wrench' },
};

// ============================================================
// renderizarMapaTIC
// Renderiza la cuadrícula con panel lateral de edición.
// contenedor: elemento DOM donde se inyecta el HTML
// ============================================================
export async function renderizarMapaTIC(aulaId, contenedor) {
  contenedor.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
    </div>`;

  let datos;
  try {
    const resp = await aulas.obtenerOrdenadores(aulaId);
    datos = resp.data;
  } catch (err) {
    contenedor.innerHTML = `<div class="alert alert-danger">Error al cargar: ${err.message}</div>`;
    return;
  }

  _renderTIC(aulaId, contenedor, datos);
}

function _renderTIC(aulaId, contenedor, datos) {
  const { ordenadores: pcs, resumen } = datos;

  contenedor.innerHTML = `
    <div class="mapa-wrapper">
      <!-- Resumen de estado -->
      <div class="mapa-resumen">
        <span class="mapa-resumen-chip pc-operativo">
          <i class="bi bi-circle-fill"></i> ${resumen.operativo} operativos
        </span>
        <span class="mapa-resumen-chip pc-averiado">
          <i class="bi bi-circle-fill"></i> ${resumen.averiado} averiados
        </span>
        <span class="mapa-resumen-chip pc-sin-monitor">
          <i class="bi bi-circle-fill"></i> ${resumen.sin_monitor} sin monitor
        </span>
        <span class="mapa-resumen-chip pc-mantenimiento">
          <i class="bi bi-circle-fill"></i> ${resumen.mantenimiento} mantenimiento
        </span>
        <span class="mapa-resumen-chip" style="background:var(--gray-100);color:var(--gray-600);">
          <i class="bi bi-pc-display-horizontal"></i> ${resumen.total} total
        </span>
      </div>

      <!-- Leyenda + botón añadir -->
      <div class="mapa-toolbar">
        <div class="mapa-leyenda">
          ${Object.entries(ESTADOS).map(([k, v]) =>
            `<span class="leyenda-item"><span class="leyenda-dot ${v.css}"></span>${v.label}</span>`
          ).join('')}
        </div>
        <button class="btn btn-sm btn-primary btn-add-pc" data-aula-id="${aulaId}">
          <i class="bi bi-plus-circle me-1"></i>Añadir PC
        </button>
      </div>

      <!-- Cuadrícula de PCs -->
      <div class="mapa-grid" id="mapaGrid-${aulaId}">
        ${pcs.length === 0
          ? `<div class="mapa-vacio">
               <i class="bi bi-grid" style="font-size:2rem;color:var(--gray-300);"></i>
               <p style="color:var(--gray-400);margin-top:.5rem;">Sin ordenadores. Pulsa "Añadir PC".</p>
             </div>`
          : pcs.map(pc => _pcCardTIC(pc)).join('')}
      </div>

      <!-- Panel lateral de edición (oculto por defecto) -->
      <div class="mapa-panel" id="mapaPanel-${aulaId}" style="display:none;">
        <div class="mapa-panel-header">
          <span id="mapaPanelTitulo-${aulaId}">PC</span>
          <button class="btn-close btn-close-sm" id="mapaPanelCerrar-${aulaId}"></button>
        </div>
        <div class="mapa-panel-body">
          <input type="hidden" id="mapaPanelId-${aulaId}" />
          <div class="mb-3">
            <label class="form-label">Nombre</label>
            <div class="input-group input-group-sm">
              <input type="text" id="mapaPanelNombre-${aulaId}" class="form-control" />
              <button class="btn btn-outline-primary" id="mapaPanelGuardarNombre-${aulaId}">
                <i class="bi bi-floppy"></i>
              </button>
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label">Estado</label>
            <div class="d-flex flex-wrap gap-1" id="mapaPanelEstados-${aulaId}">
              ${Object.entries(ESTADOS).map(([k, v]) => `
                <button class="btn btn-sm btn-estado ${v.css}-btn" data-estado="${k}">
                  <i class="bi ${v.icon} me-1"></i>${v.label}
                </button>`).join('')}
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label">Software instalado</label>
            <div id="mapaPanelSoftware-${aulaId}" class="mapa-software-list mb-2">—</div>
            <div class="d-flex gap-1 mt-1">
              <button class="btn btn-xs btn-outline-success flex-fill" id="mapaPanelBtnAnadir-${aulaId}" style="font-size:.75rem;">
                <i class="bi bi-plus-circle me-1"></i>Añadir
              </button>
              <button class="btn btn-xs btn-outline-primary flex-fill" id="mapaPanelBtnImportar-${aulaId}" style="font-size:.75rem;">
                <i class="bi bi-arrow-left-right me-1"></i>Importar
              </button>
            </div>
          </div>
          <hr />
          <button class="btn btn-sm btn-outline-danger w-100" id="mapaPanelEliminar-${aulaId}">
            <i class="bi bi-trash me-1"></i>Eliminar este PC
          </button>
        </div>
      </div>
    </div>`;

  _bindEventsTIC(aulaId, contenedor, pcs);
}

function _pcCardTIC(pc) {
  const est = ESTADOS[pc.estado] || ESTADOS.operativo;
  return `
    <div class="pc-card ${est.css}" data-pc-id="${pc.id}" title="${pc.nombre} — ${est.label}">
      <i class="bi ${est.icon} pc-icon"></i>
      <span class="pc-nombre">${pc.nombre}</span>
    </div>`;
}

// ============================================================
// Helpers de UI: modales propios del mapa (sin confirm/prompt/alert)
// ============================================================
let _confirmarCb  = null;
let _anadirPCCb   = null;
let _anadirSwCb   = null;
let _importarSwCb = null;
let _modalesInyectados = false;

function _asegurarModales() {
  if (_modalesInyectados) return;
  _modalesInyectados = true;

  document.body.insertAdjacentHTML('beforeend', `
    <!-- Modal confirmar acción de mapa -->
    <div class="modal fade" id="mapaModalConfirmar" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content border-0 shadow">
          <div class="modal-header border-0 pb-1">
            <h6 class="modal-title fw-bold d-flex align-items-center gap-2">
              <i class="bi bi-exclamation-triangle-fill text-danger"></i>
              <span id="mapaModalConfirmarTitulo"></span>
            </h6>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body pt-1 pb-2">
            <p class="text-muted mb-0" style="font-size:.875rem;" id="mapaModalConfirmarMsg"></p>
          </div>
          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-danger btn-sm" id="mapaModalConfirmarBtn">
              <i class="bi bi-trash me-1"></i>Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal añadir PC -->
    <div class="modal fade" id="mapaModalAnadirPC" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content border-0 shadow">
          <div class="modal-header border-0 pb-1">
            <h6 class="modal-title fw-bold d-flex align-items-center gap-2">
              <i class="bi bi-plus-circle-fill text-primary"></i>
              Añadir nuevo PC
            </h6>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body py-3">
            <label class="form-label fw-semibold" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;">Nombre del PC</label>
            <input type="text" id="mapaModalNombrePC" class="form-control form-control-sm" placeholder="PC-01" maxlength="50">
            <div class="invalid-feedback">Introduce un nombre para el PC.</div>
          </div>
          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary btn-sm" id="mapaModalAnadirBtn">
              <i class="bi bi-plus-circle me-1"></i>Añadir
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal añadir software manualmente -->
    <div class="modal fade" id="mapaModalAnadirSoftware" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content border-0 shadow">
          <div class="modal-header border-0 pb-1">
            <h6 class="modal-title fw-bold d-flex align-items-center gap-2">
              <i class="bi bi-plus-circle-fill text-success"></i>
              Añadir software
            </h6>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body py-3">
            <label class="form-label fw-semibold" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;">Software del catálogo</label>
            <select id="mapaModalSwSelect" class="form-select form-select-sm">
              <option value="">— Selecciona software —</option>
            </select>
            <div class="invalid-feedback">Selecciona un software.</div>
          </div>
          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-success btn-sm" id="mapaModalAnadirSwBtn">
              <i class="bi bi-plus-circle me-1"></i>Añadir
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal importar software de otro PC -->
    <div class="modal fade" id="mapaModalImportarSoftware" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow">
          <div class="modal-header border-0 pb-1">
            <h6 class="modal-title fw-bold d-flex align-items-center gap-2">
              <i class="bi bi-arrow-left-right text-primary"></i>
              Importar software de otro PC
            </h6>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body py-2">
            <label class="form-label fw-semibold" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;">PC origen</label>
            <select id="mapaModalImportarPcSelect" class="form-select form-select-sm mb-3">
              <option value="">— Selecciona un PC —</option>
            </select>
            <div id="mapaModalImportarLista" class="d-flex flex-wrap gap-2" style="min-height:2rem;">
              <span class="text-muted" style="font-size:.8rem;">Selecciona un PC para ver su software.</span>
            </div>
          </div>
          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary btn-sm" id="mapaModalImportarBtn">
              <i class="bi bi-arrow-left-right me-1"></i>Importar seleccionados
            </button>
          </div>
        </div>
      </div>
    </div>
  `);

  document.getElementById('mapaModalConfirmarBtn').addEventListener('click', async () => {
    bootstrap.Modal.getInstance(document.getElementById('mapaModalConfirmar'))?.hide();
    if (_confirmarCb) { await _confirmarCb(); _confirmarCb = null; }
  });

  const inputNombre = document.getElementById('mapaModalNombrePC');
  const btnAnadir   = document.getElementById('mapaModalAnadirBtn');

  const _ejecutarAnadir = () => {
    const nombre = inputNombre.value.trim();
    if (!nombre) { inputNombre.classList.add('is-invalid'); inputNombre.focus(); return; }
    inputNombre.classList.remove('is-invalid');
    bootstrap.Modal.getInstance(document.getElementById('mapaModalAnadirPC'))?.hide();
    if (_anadirPCCb) { _anadirPCCb(nombre); _anadirPCCb = null; }
  };

  btnAnadir.addEventListener('click', _ejecutarAnadir);
  inputNombre.addEventListener('keydown', (e) => { if (e.key === 'Enter') _ejecutarAnadir(); });

  document.getElementById('mapaModalAnadirPC').addEventListener('hidden.bs.modal', () => {
    inputNombre.classList.remove('is-invalid');
    _anadirPCCb = null;
  });

  // ---- Modal añadir software ----
  const selectSw    = document.getElementById('mapaModalSwSelect');
  const btnAnadirSw = document.getElementById('mapaModalAnadirSwBtn');

  const _ejecutarAnadirSw = () => {
    const swId = parseInt(selectSw.value);
    if (!swId) { selectSw.classList.add('is-invalid'); selectSw.focus(); return; }
    selectSw.classList.remove('is-invalid');
    bootstrap.Modal.getInstance(document.getElementById('mapaModalAnadirSoftware'))?.hide();
    if (_anadirSwCb) { _anadirSwCb(swId); _anadirSwCb = null; }
  };

  btnAnadirSw.addEventListener('click', _ejecutarAnadirSw);
  document.getElementById('mapaModalAnadirSoftware').addEventListener('hidden.bs.modal', () => {
    selectSw.classList.remove('is-invalid');
    _anadirSwCb = null;
  });

  // ---- Modal importar software ----
  const selectPcOrigen = document.getElementById('mapaModalImportarPcSelect');
  const listaImportar  = document.getElementById('mapaModalImportarLista');
  const btnImportar    = document.getElementById('mapaModalImportarBtn');

  selectPcOrigen.addEventListener('change', () => {
    const pcId = parseInt(selectPcOrigen.value);
    if (!pcId || !_importarSwCb) {
      listaImportar.innerHTML = '<span class="text-muted" style="font-size:.8rem;">Selecciona un PC para ver su software.</span>';
      return;
    }
    const pcOrigen  = _importarSwCb.pcsMapa[pcId];
    const swDestino = _importarSwCb.swActual;
    const disponibles = (pcOrigen?.software || []).filter(s => !swDestino.some(d => d.id === s.id));
    if (disponibles.length === 0) {
      listaImportar.innerHTML = '<span class="text-muted" style="font-size:.8rem;">Este PC no tiene software adicional que importar.</span>';
      return;
    }
    listaImportar.innerHTML = disponibles.map(s => `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${s.id}" id="swImport-${s.id}" checked>
        <label class="form-check-label" style="font-size:.85rem;" for="swImport-${s.id}">
          ${s.nombre} <span class="text-muted">v${s.version}</span>
        </label>
      </div>
    `).join('');
  });

  btnImportar.addEventListener('click', () => {
    const ids = [...listaImportar.querySelectorAll('input[type=checkbox]:checked')].map(c => parseInt(c.value));
    if (ids.length === 0) return;
    bootstrap.Modal.getInstance(document.getElementById('mapaModalImportarSoftware'))?.hide();
    if (_importarSwCb) { _importarSwCb.fn(ids); _importarSwCb = null; }
  });

  document.getElementById('mapaModalImportarSoftware').addEventListener('hidden.bs.modal', () => {
    selectPcOrigen.value = '';
    listaImportar.innerHTML = '<span class="text-muted" style="font-size:.8rem;">Selecciona un PC para ver su software.</span>';
    _importarSwCb = null;
  });
}

function _confirmar(titulo, mensaje, callback) {
  _asegurarModales();
  document.getElementById('mapaModalConfirmarTitulo').textContent = titulo;
  document.getElementById('mapaModalConfirmarMsg').textContent    = mensaje;
  _confirmarCb = callback;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('mapaModalConfirmar')).show();
}

function _pedirNombrePC(valorPorDefecto, callback) {
  _asegurarModales();
  const input = document.getElementById('mapaModalNombrePC');
  input.value = valorPorDefecto;
  input.classList.remove('is-invalid');
  _anadirPCCb = callback;
  const modal = document.getElementById('mapaModalAnadirPC');
  bootstrap.Modal.getOrCreateInstance(modal).show();
  modal.addEventListener('shown.bs.modal', () => { input.select(); input.focus(); }, { once: true });
}

function _mostrarErrorMapa(contenedor, mensaje) {
  let toast = contenedor.querySelector('.mapa-toast-error');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'mapa-toast-error alert alert-danger alert-dismissible py-2 mb-2';
    toast.style.fontSize = '.85rem';
    contenedor.querySelector('.mapa-wrapper')?.prepend(toast);
  }
  toast.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>${mensaje}
    <button type="button" class="btn-close py-2" data-bs-dismiss="alert"></button>`;
}

function _renderSoftwarePanel(panelSoftware, swList) {
  const ORIGEN_BADGE = {
    solicitud: 'bg-secondary',
    manual:    'bg-success',
    importado: 'bg-primary',
  };
  const ORIGEN_LABEL = {
    solicitud: 'Solicitud',
    manual:    'Manual',
    importado: 'Importado',
  };

  if (!swList || swList.length === 0) {
    panelSoftware.innerHTML = '<span style="color:var(--gray-400);font-size:.8rem;">Ninguno registrado</span>';
    return;
  }

  panelSoftware.innerHTML = swList.map(s => `
    <div class="d-flex align-items-center gap-1 mb-1 sw-badge-row" data-sw-id="${s.id}">
      <span class="badge bg-light text-dark border">${s.nombre} v${s.version}</span>
      <span class="badge ${ORIGEN_BADGE[s.origen] || 'bg-secondary'}" style="font-size:.65rem;">${ORIGEN_LABEL[s.origen] || s.origen}</span>
      <button class="btn btn-link btn-sm p-0 ms-1 text-danger btn-del-sw" data-sw-id="${s.id}" title="Eliminar software" style="font-size:.8rem;">
        <i class="bi bi-x-circle"></i>
      </button>
    </div>
  `).join('');
}

function _bindEventsTIC(aulaId, contenedor, pcsIniciales) {
  let pcActual = null;

  const grid       = contenedor.querySelector(`#mapaGrid-${aulaId}`);
  const panel      = contenedor.querySelector(`#mapaPanel-${aulaId}`);
  const panelTitulo = contenedor.querySelector(`#mapaPanelTitulo-${aulaId}`);
  const panelId    = contenedor.querySelector(`#mapaPanelId-${aulaId}`);
  const panelNombre = contenedor.querySelector(`#mapaPanelNombre-${aulaId}`);
  const panelSoftware = contenedor.querySelector(`#mapaPanelSoftware-${aulaId}`);
  const btnCerrar  = contenedor.querySelector(`#mapaPanelCerrar-${aulaId}`);
  const btnGuardarNombre = contenedor.querySelector(`#mapaPanelGuardarNombre-${aulaId}`);
  const btnEliminar = contenedor.querySelector(`#mapaPanelEliminar-${aulaId}`);
  const btnAnadirSw   = contenedor.querySelector(`#mapaPanelBtnAnadir-${aulaId}`);
  const btnImportarSw = contenedor.querySelector(`#mapaPanelBtnImportar-${aulaId}`);

  // Mapa en memoria de pcs actuales
  let pcsMapa = Object.fromEntries(pcsIniciales.map(p => [p.id, p]));

  // Abrir panel al hacer click en un PC
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.pc-card');
    if (!card) return;

    const id = parseInt(card.dataset.pcId);
    pcActual = pcsMapa[id];
    if (!pcActual) return;

    // Destacar selección
    grid.querySelectorAll('.pc-card').forEach(c => c.classList.remove('pc-seleccionado-tic'));
    card.classList.add('pc-seleccionado-tic');

    panelId.value         = id;
    panelTitulo.textContent = pcActual.nombre;
    panelNombre.value     = pcActual.nombre;

    // Software instalado
    _renderSoftwarePanel(panelSoftware, pcActual.software);

    // Marcar botón de estado activo
    panel.querySelectorAll('.btn-estado').forEach(btn => {
      btn.classList.toggle('activo', btn.dataset.estado === pcActual.estado);
    });

    panel.style.display = '';
  });

  // Cerrar panel
  btnCerrar.addEventListener('click', () => {
    panel.style.display = 'none';
    grid.querySelectorAll('.pc-card').forEach(c => c.classList.remove('pc-seleccionado-tic'));
    pcActual = null;
  });

  // Guardar nombre
  btnGuardarNombre.addEventListener('click', async () => {
    if (!pcActual) return;
    const nuevoNombre = panelNombre.value.trim();
    if (!nuevoNombre) return;
    try {
      await ordenadores.actualizar(pcActual.id, { nombre: nuevoNombre });
      pcsMapa[pcActual.id].nombre = nuevoNombre;
      pcActual.nombre = nuevoNombre;
      panelTitulo.textContent = nuevoNombre;
      const card = grid.querySelector(`[data-pc-id="${pcActual.id}"] .pc-nombre`);
      if (card) card.textContent = nuevoNombre;
      _flashSuccess(btnGuardarNombre);
    } catch (err) {
      _mostrarErrorMapa(contenedor, err.message);
    }
  });

  // Cambiar estado
  panel.querySelector(`#mapaPanelEstados-${aulaId}`).addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-estado');
    if (!btn || !pcActual) return;
    const nuevoEstado = btn.dataset.estado;
    try {
      await ordenadores.actualizar(pcActual.id, { estado: nuevoEstado });
      pcsMapa[pcActual.id].estado = nuevoEstado;
      pcActual.estado = nuevoEstado;

      // Actualizar estilos del panel
      panel.querySelectorAll('.btn-estado').forEach(b =>
        b.classList.toggle('activo', b.dataset.estado === nuevoEstado));

      // Actualizar card en grid
      const card = grid.querySelector(`[data-pc-id="${pcActual.id}"]`);
      if (card) {
        Object.values(ESTADOS).forEach(v => card.classList.remove(v.css));
        const est = ESTADOS[nuevoEstado];
        card.classList.add(est.css);
        card.title = `${pcActual.nombre} — ${est.label}`;
        const icon = card.querySelector('.pc-icon');
        if (icon) { icon.className = `bi ${est.icon} pc-icon`; }
      }

      _actualizarResumen(contenedor, pcsMapa);
    } catch (err) {
      _mostrarErrorMapa(contenedor, err.message);
    }
  });

  // Eliminar PC
  btnEliminar.addEventListener('click', () => {
    if (!pcActual) return;
    _confirmar(
      `Eliminar ${pcActual.nombre}`,
      'Esta acción no se puede deshacer. El ordenador se eliminará permanentemente del aula.',
      async () => {
        try {
          await ordenadores.eliminar(pcActual.id);
          delete pcsMapa[pcActual.id];
          const card = grid.querySelector(`[data-pc-id="${pcActual.id}"]`);
          if (card) card.remove();
          panel.style.display = 'none';
          pcActual = null;
          _actualizarResumen(contenedor, pcsMapa);
          if (Object.keys(pcsMapa).length === 0) {
            grid.innerHTML = `<div class="mapa-vacio">
              <i class="bi bi-grid" style="font-size:2rem;color:var(--gray-300);"></i>
              <p style="color:var(--gray-400);margin-top:.5rem;">Sin ordenadores. Pulsa "Añadir PC".</p>
            </div>`;
          }
        } catch (err) {
          _mostrarErrorMapa(contenedor, err.message);
        }
      }
    );
  });

  // Eliminar software individual
  panelSoftware.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-del-sw');
    if (!btn || !pcActual) return;
    const swId = parseInt(btn.dataset.swId);
    try {
      const resp = await ordenadores.eliminarSoftware(pcActual.id, swId);
      pcsMapa[pcActual.id].software = resp.data.software;
      pcActual.software = resp.data.software;
      _renderSoftwarePanel(panelSoftware, pcActual.software);
    } catch (err) {
      _mostrarErrorMapa(contenedor, err.message);
    }
  });

  // Añadir software manualmente
  btnAnadirSw.addEventListener('click', async () => {
    if (!pcActual) return;
    _asegurarModales();

    let catalogo = [];
    try {
      const resp = await catalogoSw.listar();
      const instaladosIds = new Set((pcActual.software || []).map(s => s.id));
      catalogo = resp.data.filter(s => !instaladosIds.has(s.id));
    } catch (err) {
      _mostrarErrorMapa(contenedor, err.message);
      return;
    }

    const selectSw = document.getElementById('mapaModalSwSelect');
    selectSw.innerHTML = '<option value="">— Selecciona software —</option>' +
      catalogo.map(s => `<option value="${s.id}">${s.nombre} v${s.version}</option>`).join('');

    _anadirSwCb = async (swId) => {
      try {
        const resp = await ordenadores.añadirSoftware(pcActual.id, swId);
        pcsMapa[pcActual.id].software = resp.data.software;
        pcActual.software = resp.data.software;
        _renderSoftwarePanel(panelSoftware, pcActual.software);
      } catch (err) {
        _mostrarErrorMapa(contenedor, err.message);
      }
    };

    bootstrap.Modal.getOrCreateInstance(document.getElementById('mapaModalAnadirSoftware')).show();
  });

  // Importar software de otro PC del mismo aula
  btnImportarSw.addEventListener('click', () => {
    if (!pcActual) return;
    _asegurarModales();

    const selectPcOrigen = document.getElementById('mapaModalImportarPcSelect');
    const otrosPcs = Object.values(pcsMapa).filter(p => p.id !== pcActual.id);
    selectPcOrigen.innerHTML = '<option value="">— Selecciona un PC —</option>' +
      otrosPcs.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

    document.getElementById('mapaModalImportarLista').innerHTML =
      '<span class="text-muted" style="font-size:.8rem;">Selecciona un PC para ver su software.</span>';

    _importarSwCb = {
      pcsMapa,
      swActual: pcActual.software || [],
      fn: async (ids) => {
        try {
          const resp = await ordenadores.importarSoftware(pcActual.id, ids);
          pcsMapa[pcActual.id].software = resp.data.software;
          pcActual.software = resp.data.software;
          _renderSoftwarePanel(panelSoftware, pcActual.software);
        } catch (err) {
          _mostrarErrorMapa(contenedor, err.message);
        }
      }
    };

    bootstrap.Modal.getOrCreateInstance(document.getElementById('mapaModalImportarSoftware')).show();
  });

  // Añadir PC
  contenedor.querySelector('.btn-add-pc').addEventListener('click', () => {
    const siguiente = `PC-${String(Object.keys(pcsMapa).length + 1).padStart(2,'0')}`;
    _pedirNombrePC(siguiente, async (nombre) => {
      try {
        const pcsList  = Object.values(pcsMapa);
        const maxPos   = pcsList.length;
        const columnas = pcsList.length > 0
          ? (Math.max(...pcsList.map(p => p.columna ?? 0)) + 1)
          : 11;
        const fila = Math.floor(maxPos / columnas);
        const col  = maxPos % columnas;

        const resp = await aulas.crearOrdenadores(aulaId, { nombre, fila, columna: col });
        const nuevoPc = resp.data;
        nuevoPc.software = [];
        pcsMapa[nuevoPc.id] = nuevoPc;

        const vacio = grid.querySelector('.mapa-vacio');
        if (vacio) vacio.remove();

        grid.insertAdjacentHTML('beforeend', _pcCardTIC(nuevoPc));
        _actualizarResumen(contenedor, pcsMapa);
      } catch (err) {
        _mostrarErrorMapa(contenedor, err.message);
      }
    });
  });
}

// Recalcular chips del resumen sin recargar toda la vista
function _actualizarResumen(contenedor, pcsMapa) {
  const pcs = Object.values(pcsMapa);
  const cuenta = { operativo: 0, averiado: 0, sin_monitor: 0, mantenimiento: 0 };
  pcs.forEach(p => { if (cuenta[p.estado] !== undefined) cuenta[p.estado]++; });
  const chips = contenedor.querySelectorAll('.mapa-resumen-chip');
  const textos = [
    `<i class="bi bi-circle-fill"></i> ${cuenta.operativo} operativos`,
    `<i class="bi bi-circle-fill"></i> ${cuenta.averiado} averiados`,
    `<i class="bi bi-circle-fill"></i> ${cuenta.sin_monitor} sin monitor`,
    `<i class="bi bi-circle-fill"></i> ${cuenta.mantenimiento} mantenimiento`,
    `<i class="bi bi-pc-display-horizontal"></i> ${pcs.length} total`,
  ];
  chips.forEach((c, i) => { c.innerHTML = textos[i]; });
}

function _flashSuccess(btn) {
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="bi bi-check-lg"></i>';
  btn.classList.add('btn-success');
  setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('btn-success'); }, 1200);
}


// ============================================================
// renderizarMapaLectura
// Vista de solo lectura: muestra PCs con estado y software
// instalado. Sin botones de edición ni selección.
// ============================================================
export async function renderizarMapaLectura(aulaId, contenedor) {
  contenedor.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
    </div>`;

  let datos;
  try {
    const resp = await aulas.obtenerOrdenadores(aulaId);
    datos = resp.data;
  } catch (err) {
    contenedor.innerHTML = `<div class="alert alert-danger">Error al cargar: ${err.message}</div>`;
    return;
  }

  _renderLectura(aulaId, contenedor, datos);
}

function _renderLectura(aulaId, contenedor, datos) {
  const { ordenadores: pcs, resumen } = datos;

  if (pcs.length === 0) {
    contenedor.innerHTML = `<p class="text-muted text-center py-3">Esta aula no tiene ordenadores registrados.</p>`;
    return;
  }

  contenedor.innerHTML = `
    <div class="mapa-wrapper">
      <div class="mapa-resumen mb-2">
        <span class="mapa-resumen-chip pc-operativo"><i class="bi bi-circle-fill"></i> ${resumen.operativo} operativos</span>
        <span class="mapa-resumen-chip pc-averiado"><i class="bi bi-circle-fill"></i> ${resumen.averiado} averiados</span>
        <span class="mapa-resumen-chip pc-sin-monitor"><i class="bi bi-circle-fill"></i> ${resumen.sin_monitor} sin monitor</span>
        <span class="mapa-resumen-chip pc-mantenimiento"><i class="bi bi-circle-fill"></i> ${resumen.mantenimiento} mantenimiento</span>
      </div>
      <div class="mapa-toolbar mb-2">
        <div class="mapa-leyenda">
          ${Object.entries(ESTADOS).map(([, v]) =>
            `<span class="leyenda-item"><span class="leyenda-dot ${v.css}"></span>${v.label}</span>`
          ).join('')}
        </div>
      </div>
      <div class="mapa-grid" id="mapaGridLec-${aulaId}">
        ${pcs.map(pc => _pcCardTIC(pc)).join('')}
      </div>
      <div class="mapa-panel" id="mapaPanelLec-${aulaId}" style="display:none;">
        <div class="mapa-panel-header">
          <span id="mapaPanelLecTitulo-${aulaId}">PC</span>
          <button class="btn-close btn-close-sm" id="mapaPanelLecCerrar-${aulaId}"></button>
        </div>
        <div class="mapa-panel-body">
          <div class="mb-3">
            <label class="form-label" style="font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;">Estado</label>
            <div id="mapaPanelLecEstado-${aulaId}"></div>
          </div>
          <div>
            <label class="form-label" style="font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;">Software instalado</label>
            <div id="mapaPanelLecSoftware-${aulaId}" class="mapa-software-list">—</div>
          </div>
        </div>
      </div>
    </div>`;

  const grid  = contenedor.querySelector(`#mapaGridLec-${aulaId}`);
  const panel = contenedor.querySelector(`#mapaPanelLec-${aulaId}`);

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.pc-card');
    if (!card) return;
    const id = parseInt(card.dataset.pcId);
    const pc = pcs.find(p => p.id === id);
    if (!pc) return;

    grid.querySelectorAll('.pc-card').forEach(c => c.classList.remove('pc-seleccionado-tic'));
    card.classList.add('pc-seleccionado-tic');

    const est = ESTADOS[pc.estado] || ESTADOS.operativo;
    contenedor.querySelector(`#mapaPanelLecTitulo-${aulaId}`).textContent = pc.nombre;
    contenedor.querySelector(`#mapaPanelLecEstado-${aulaId}`).innerHTML =
      `<span class="badge ${est.css}-btn px-2 py-1"><i class="bi ${est.icon} me-1"></i>${est.label}</span>`;
    contenedor.querySelector(`#mapaPanelLecSoftware-${aulaId}`).innerHTML = pc.software?.length
      ? pc.software.map(s =>
          `<span class="badge bg-light text-dark border me-1 mb-1">${s.nombre} v${s.version}</span>`
        ).join('')
      : '<span style="color:var(--gray-400);font-size:.8rem;">Ninguno instalado</span>';

    panel.style.display = '';
  });

  contenedor.querySelector(`#mapaPanelLecCerrar-${aulaId}`).addEventListener('click', () => {
    panel.style.display = 'none';
    grid.querySelectorAll('.pc-card').forEach(c => c.classList.remove('pc-seleccionado-tic'));
  });
}

// ============================================================
// renderizarMapaProfesor
// Vista de selección para el profesor al crear/editar solicitud.
// onSeleccionCambia(idsSeleccionados) se llama en cada cambio.
// ============================================================
export async function renderizarMapaProfesor(aulaId, contenedor, onSeleccionCambia) {
  contenedor.innerHTML = `
    <div class="text-center py-3">
      <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
      <span class="ms-2 text-muted" style="font-size:.85rem;">Cargando mapa del aula...</span>
    </div>`;

  let datos;
  try {
    const resp = await aulas.obtenerOrdenadores(aulaId);
    datos = resp.data;
  } catch (err) {
    contenedor.innerHTML = `<div class="alert alert-warning py-2" style="font-size:.85rem;">No se pudo cargar el mapa.</div>`;
    return;
  }

  _renderProfesor(aulaId, contenedor, datos, onSeleccionCambia);
}

function _renderProfesor(aulaId, contenedor, datos, onSeleccionCambia) {
  const { ordenadores: pcs } = datos;
  let seleccionados = new Set();

  if (pcs.length === 0) {
    contenedor.innerHTML = `<p class="text-muted" style="font-size:.85rem;">Esta aula no tiene ordenadores registrados.</p>`;
    return;
  }

  contenedor.innerHTML = `
    <div class="mapa-profesor-wrapper">
      <!-- Barra de herramientas -->
      <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
        <div class="mapa-leyenda" style="font-size:.75rem;">
          ${Object.entries(ESTADOS).map(([k, v]) =>
            `<span class="leyenda-item"><span class="leyenda-dot ${v.css}"></span>${v.label}</span>`
          ).join('')}
          <span class="leyenda-item"><span class="leyenda-dot pc-seleccionado"></span>Seleccionado</span>
        </div>
        <div class="d-flex gap-1">
          <button type="button" class="btn btn-outline-primary btn-xs" id="btnSelTodos-${aulaId}">
            <i class="bi bi-check-all me-1"></i>Todos
          </button>
          <button type="button" class="btn btn-outline-secondary btn-xs" id="btnLimpiarSel-${aulaId}">
            <i class="bi bi-x-lg me-1"></i>Limpiar
          </button>
        </div>
      </div>

      <!-- Contador -->
      <div class="mapa-contador mb-2" id="mapaContador-${aulaId}">
        0 de ${pcs.filter(p => p.estado !== 'averiado' && p.estado !== 'mantenimiento').length} ordenadores seleccionados
      </div>

      <!-- Cuadrícula de selección -->
      <div class="mapa-grid mapa-grid-sm" id="mapaGridProf-${aulaId}">
        ${pcs.map(pc => {
          const est = ESTADOS[pc.estado] || ESTADOS.operativo;
          const disabled = pc.estado === 'averiado' || pc.estado === 'mantenimiento';
          const disabledRazon = pc.estado === 'averiado' ? 'averiado' : pc.estado === 'mantenimiento' ? 'en mantenimiento' : '';
          return `<div class="pc-card ${est.css}${disabled ? ' pc-deshabilitado' : ''}"
                       data-pc-id="${pc.id}"
                       data-disabled="${disabled ? '1' : '0'}"
                       title="${pc.nombre}${disabled ? ` (${disabledRazon} — no seleccionable)` : ''}">
            <i class="bi ${est.icon} pc-icon"></i>
            <span class="pc-nombre">${pc.nombre}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  const grid    = contenedor.querySelector(`#mapaGridProf-${aulaId}`);
  const contador = contenedor.querySelector(`#mapaContador-${aulaId}`);
  const disponibles = pcs.filter(p => p.estado !== 'averiado' && p.estado !== 'mantenimiento').length;

  const actualizarContador = () => {
    contador.textContent = `${seleccionados.size} de ${disponibles} ordenadores seleccionados`;
    onSeleccionCambia([...seleccionados]);
  };

  // Click en PC → toggle selección
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.pc-card');
    if (!card || card.dataset.disabled === '1') return;

    const id = parseInt(card.dataset.pcId);
    if (seleccionados.has(id)) {
      seleccionados.delete(id);
      card.classList.remove('pc-seleccionado');
    } else {
      seleccionados.add(id);
      card.classList.add('pc-seleccionado');
    }
    actualizarContador();
  });

  // Seleccionar todos los disponibles
  contenedor.querySelector(`#btnSelTodos-${aulaId}`).addEventListener('click', () => {
    grid.querySelectorAll('.pc-card:not(.pc-deshabilitado)').forEach(card => {
      seleccionados.add(parseInt(card.dataset.pcId));
      card.classList.add('pc-seleccionado');
    });
    actualizarContador();
  });

  // Limpiar selección
  contenedor.querySelector(`#btnLimpiarSel-${aulaId}`).addEventListener('click', () => {
    seleccionados.clear();
    grid.querySelectorAll('.pc-card').forEach(c => c.classList.remove('pc-seleccionado'));
    actualizarContador();
  });
}

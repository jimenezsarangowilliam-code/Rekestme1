/**
 * inventario.js — Gestión del tab de inventario (solo TIC/admin)
 */

import { inventario as api } from './api.js';

let _categorias = [];
let _categoriaSeleccionada = null;

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

const ESTADO_BADGE = {
  operativo:     'bg-success',
  averiado:      'bg-danger',
  en_reparacion: 'bg-warning text-dark',
  dado_de_baja:  'bg-secondary',
};

const ESTADO_LABEL = {
  operativo:     'Operativo',
  averiado:      'Averiado',
  en_reparacion: 'En reparación',
  dado_de_baja:  'Dado de baja',
};

// ============================================================
// Entrada pública
// ============================================================
export async function inicializarInventario() {
  document.getElementById('btnNuevaCategoria')
    ?.addEventListener('click', () => abrirModalCategoria());

  document.getElementById('formCategoria')
    ?.addEventListener('submit', guardarCategoria);

  document.getElementById('formAddUnidades')
    ?.addEventListener('submit', guardarAddUnidades);

  document.getElementById('formItem')
    ?.addEventListener('submit', guardarItem);

  document.getElementById('btnNuevoItem')
    ?.addEventListener('click', () => {
      if (_categoriaSeleccionada) abrirModalAddUnidades(_categoriaSeleccionada);
    });

  await cargarCategorias();
}

// ============================================================
// Categorías — carga y render
// ============================================================
async function cargarCategorias() {
  const contenedor = document.getElementById('invListaCategorias');
  if (!contenedor) return;

  contenedor.innerHTML =
    '<div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div>';

  try {
    const resp  = await api.listarCategorias();
    _categorias = resp.data;
    renderizarCategorias(_categorias);
  } catch (err) {
    contenedor.innerHTML = `<div class="text-danger small p-2">${esc(err.message)}</div>`;
  }
}

function renderizarCategorias(lista) {
  const contenedor = document.getElementById('invListaCategorias');
  if (!contenedor) return;

  if (!lista.length) {
    contenedor.innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="bi bi-inbox fs-2 d-block mb-2"></i>
        Sin categorías. Crea la primera con el botón de arriba.
      </div>`;
    return;
  }

  contenedor.innerHTML = lista.map((c, idx) => `
    <div class="inv-cat-card${_categoriaSeleccionada?.id === c.id ? ' active' : ''}" data-idx="${idx}">
      <div class="inv-cat-info">
        <div class="inv-cat-nombre">${esc(c.nombre)}</div>
        <div class="inv-cat-stock">
          <span class="badge bg-secondary">${c.total ?? 0} total</span>
          <span class="badge bg-success">${c.disponible ?? 0} op</span>
          ${(c.averiado > 0) ? `<span class="badge bg-danger">${c.averiado} av</span>` : ''}
          ${(c.en_reparacion > 0) ? `<span class="badge bg-warning text-dark">${c.en_reparacion} rep</span>` : ''}
          ${(c.dado_de_baja > 0) ? `<span class="badge bg-secondary">${c.dado_de_baja} baja</span>` : ''}
        </div>
        ${c.creado_por ? `<div class="inv-cat-creador"><i class="bi bi-person"></i> ${esc(c.creado_por)}</div>` : ''}
      </div>
      <div class="inv-cat-actions">
        <button class="btn btn-sm btn-outline-success btn-add-unidades" data-idx="${idx}" title="Añadir unidades">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary btn-editar-cat" data-idx="${idx}" title="Editar nombre">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-eliminar-cat" data-idx="${idx}" title="Eliminar">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>`).join('');

  contenedor.querySelectorAll('.inv-cat-card').forEach((card, idx) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      seleccionarCategoria(lista[idx]);
    });
  });

  contenedor.querySelectorAll('.btn-add-unidades').forEach(btn => {
    btn.addEventListener('click', () => abrirModalAddUnidades(lista[parseInt(btn.dataset.idx)]));
  });

  contenedor.querySelectorAll('.btn-editar-cat').forEach(btn => {
    btn.addEventListener('click', () => abrirModalCategoria(lista[parseInt(btn.dataset.idx)]));
  });

  contenedor.querySelectorAll('.btn-eliminar-cat').forEach(btn => {
    btn.addEventListener('click', () => confirmarEliminarCategoria(lista[parseInt(btn.dataset.idx)].id));
  });
}

function seleccionarCategoria(cat) {
  _categoriaSeleccionada = cat;
  renderizarCategorias(_categorias);

  document.getElementById('invPlaceholderItems')?.classList.add('d-none');
  document.getElementById('invPanelItems')?.classList.remove('d-none');
  document.getElementById('invItemsHeader').textContent = cat.nombre;

  cargarItems();
}

// ============================================================
// Modal categoría (crear / editar)
// ============================================================
function abrirModalCategoria(cat = null) {
  const form   = document.getElementById('formCategoria');
  const titulo = document.getElementById('modalCategoriaTitulo');
  if (!form) return;

  form.reset();
  form.dataset.id = cat ? cat.id : '';
  titulo.textContent = cat ? 'Editar categoría' : 'Nueva categoría';

  const wrapperCantidad = document.getElementById('wrapperCantidad');
  if (cat) {
    form.elements['catNombre'].value = cat.nombre;
    wrapperCantidad?.classList.add('d-none');
  } else {
    form.elements['catCantidad'].value = 1;
    wrapperCantidad?.classList.remove('d-none');
  }

  document.getElementById('errorCategoria')?.classList.add('d-none');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCategoria')).show();
}

async function guardarCategoria(e) {
  e.preventDefault();
  const form = e.target;
  const id   = form.dataset.id ? parseInt(form.dataset.id) : null;
  const btn  = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    if (id) {
      await api.actualizarCategoria(id, { nombre: form.elements['catNombre'].value.trim() });
    } else {
      await api.crearCategoria({
        nombre:   form.elements['catNombre'].value.trim(),
        cantidad: parseInt(form.elements['catCantidad'].value) || 1,
      });
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCategoria')).hide();
    await cargarCategorias();

    if (_categoriaSeleccionada) {
      const actualizada = _categorias.find(c => c.id === _categoriaSeleccionada.id);
      if (actualizada) {
        _categoriaSeleccionada = actualizada;
        document.getElementById('invItemsHeader').textContent = actualizada.nombre;
      }
    }
  } catch (err) {
    const errDiv = document.getElementById('errorCategoria');
    errDiv.textContent = err.message;
    errDiv.classList.remove('d-none');
  } finally {
    btn.disabled = false;
  }
}

function confirmarEliminarCategoria(id) {
  const cat = _categorias.find(c => c.id === id);
  if (!cat) return;

  const modal = document.getElementById('modalConfirmarInv');
  document.getElementById('confirmarInvTexto').textContent =
    `¿Eliminar la categoría "${cat.nombre}"? Se eliminarán también todas sus unidades.`;

  const btnConfirmar = document.getElementById('confirmarInvBtn');
  const clone        = btnConfirmar.cloneNode(true);
  btnConfirmar.parentNode.replaceChild(clone, btnConfirmar);

  clone.addEventListener('click', async () => {
    bootstrap.Modal.getOrCreateInstance(modal).hide();
    try {
      await api.eliminarCategoria(id);
      if (_categoriaSeleccionada?.id === id) {
        _categoriaSeleccionada = null;
        document.getElementById('invPanelItems')?.classList.add('d-none');
        document.getElementById('invPlaceholderItems')?.classList.remove('d-none');
      }
      await cargarCategorias();
    } catch (err) {
      alert(err.message);
    }
  });

  bootstrap.Modal.getOrCreateInstance(modal).show();
}

// ============================================================
// Modal añadir unidades
// ============================================================
function abrirModalAddUnidades(cat) {
  _categoriaSeleccionada = cat;
  const form = document.getElementById('formAddUnidades');
  if (!form) return;

  form.reset();
  form.dataset.catId = cat.id;
  form.elements['addCantidad'].value = 1;
  document.getElementById('errorAddUnidades')?.classList.add('d-none');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalAddUnidades')).show();
}

async function guardarAddUnidades(e) {
  e.preventDefault();
  const form   = e.target;
  const catId  = parseInt(form.dataset.catId);
  const btn    = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    await api.añadirItems(catId, { cantidad: parseInt(form.elements['addCantidad'].value) || 1 });
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalAddUnidades')).hide();
    await cargarCategorias();
    if (_categoriaSeleccionada?.id === catId) {
      const actualizada = _categorias.find(c => c.id === catId);
      if (actualizada) _categoriaSeleccionada = actualizada;
      await cargarItems();
    }
  } catch (err) {
    const errDiv = document.getElementById('errorAddUnidades');
    errDiv.textContent = err.message;
    errDiv.classList.remove('d-none');
  } finally {
    btn.disabled = false;
  }
}

// ============================================================
// Items de la categoría seleccionada
// ============================================================
async function cargarItems() {
  if (!_categoriaSeleccionada) return;
  const contenedor = document.getElementById('invListaItems');
  if (!contenedor) return;

  contenedor.innerHTML =
    '<div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div>';

  try {
    const resp = await api.listarItems(_categoriaSeleccionada.id);
    renderizarItems(resp.data);
  } catch (err) {
    contenedor.innerHTML = `<div class="text-danger small p-2">${esc(err.message)}</div>`;
  }
}

function renderizarItems(lista) {
  const contenedor = document.getElementById('invListaItems');
  if (!contenedor) return;

  if (!lista.length) {
    contenedor.innerHTML = `
      <div class="text-center text-muted py-3 small">
        Sin unidades registradas para esta categoría.
      </div>`;
    return;
  }

  contenedor.innerHTML = `
    <table class="table table-sm table-hover mb-0">
      <thead class="table-light">
        <tr>
          <th>Nombre</th>
          <th>Estado</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${lista.map((item, idx) => `
          <tr>
            <td>${esc(item.nombre)}</td>
            <td><span class="badge ${ESTADO_BADGE[item.estado]}">${ESTADO_LABEL[item.estado]}</span></td>
            <td class="text-end" style="white-space:nowrap;">
              <button class="btn btn-sm btn-outline-secondary btn-editar-item me-1"
                      data-idx="${idx}" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger btn-eliminar-item"
                      data-idx="${idx}" title="Eliminar">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  contenedor.querySelectorAll('.btn-editar-item').forEach(btn => {
    btn.addEventListener('click', () => abrirModalItem(lista[parseInt(btn.dataset.idx)]));
  });

  contenedor.querySelectorAll('.btn-eliminar-item').forEach(btn => {
    btn.addEventListener('click', () => confirmarEliminarItem(lista[parseInt(btn.dataset.idx)], lista));
  });
}

// ============================================================
// Modal item (editar)
// ============================================================
function abrirModalItem(item) {
  const form = document.getElementById('formItem');
  if (!form) return;

  form.reset();
  form.dataset.id = item.id;
  form.elements['itemNombre'].value = item.nombre;
  form.elements['itemEstado'].value = item.estado;
  document.getElementById('errorItem')?.classList.add('d-none');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalItem')).show();
}

async function guardarItem(e) {
  e.preventDefault();
  const form = e.target;
  const id   = parseInt(form.dataset.id);
  const btn  = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    await api.actualizarItem(id, {
      nombre: form.elements['itemNombre'].value.trim(),
      estado: form.elements['itemEstado'].value,
    });
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalItem')).hide();
    await cargarItems();
    await cargarCategorias();
    if (_categoriaSeleccionada) {
      const actualizada = _categorias.find(c => c.id === _categoriaSeleccionada.id);
      if (actualizada) _categoriaSeleccionada = actualizada;
    }
  } catch (err) {
    const errDiv = document.getElementById('errorItem');
    errDiv.textContent = err.message;
    errDiv.classList.remove('d-none');
  } finally {
    btn.disabled = false;
  }
}

function confirmarEliminarItem(item, lista) {
  const modal = document.getElementById('modalConfirmarInv');
  document.getElementById('confirmarInvTexto').textContent = `¿Eliminar "${item.nombre}"?`;

  const btnConfirmar = document.getElementById('confirmarInvBtn');
  const clone        = btnConfirmar.cloneNode(true);
  btnConfirmar.parentNode.replaceChild(clone, btnConfirmar);

  clone.addEventListener('click', async () => {
    bootstrap.Modal.getOrCreateInstance(modal).hide();
    try {
      await api.eliminarItem(item.id);
      await cargarItems();
      await cargarCategorias();
      if (_categoriaSeleccionada) {
        const actualizada = _categorias.find(c => c.id === _categoriaSeleccionada.id);
        if (actualizada) _categoriaSeleccionada = actualizada;
      }
    } catch (err) {
      alert(err.message);
    }
  });

  bootstrap.Modal.getOrCreateInstance(modal).show();
}

/**
 * auth.js — Lógica de login y registro
 * Se usa en login.html
 */

import { auth } from './api.js';

// ============================================================
// Utilidades de UI compartidas
// ============================================================

/** Muestra un mensaje de error bajo el formulario */
function mostrarError(contenedorId, mensaje, errores = []) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;
  let html = `<div class="alert alert-danger" role="alert"><strong>${mensaje}</strong>`;
  if (errores.length) {
    html += '<ul class="mb-0 mt-1">' + errores.map(e => `<li>${e}</li>`).join('') + '</ul>';
  }
  html += '</div>';
  contenedor.innerHTML = html;
}

function limpiarError(contenedorId) {
  const contenedor = document.getElementById(contenedorId);
  if (contenedor) contenedor.innerHTML = '';
}

function setBotonCargando(btn, cargando) {
  btn.disabled = cargando;
  btn.innerHTML = cargando
    ? '<span class="spinner-border spinner-border-sm me-2"></span>Espera...'
    : btn.dataset.texto;
}

// ============================================================
// Helper de redirección según rol
// ============================================================
function redirigirSegunRol(usuario) {
  const base = window.location.origin + '/rekestme';
  if (usuario.rol === 'profesor') {
    window.location.href = base + '/panel';
  } else {
    window.location.href = base + '/panel-tic';
  }
}


// ============================================================
// LOGIN
// ============================================================
const formLogin = document.getElementById('formLogin');
if (formLogin) {
  // Guardar el texto original del botón
  const btnLogin = formLogin.querySelector('[type="submit"]');
  btnLogin.dataset.texto = btnLogin.innerHTML;

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarError('errorLogin');

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setBotonCargando(btnLogin, true);

    try {
      const respuesta = await auth.login(email, password);
      const usuario   = respuesta.data;

      sessionStorage.setItem('usuario', JSON.stringify(usuario));
      redirigirSegunRol(usuario);
    } catch (err) {
      mostrarError('errorLogin', err.message, err.errores ?? []);
      setBotonCargando(btnLogin, false);
    }
  });
}

// ============================================================
// REGISTRO
// ============================================================
const formRegistro = document.getElementById('formRegistro');
if (formRegistro) {
  const btnRegistrar = formRegistro.querySelector('[type="submit"]');
  btnRegistrar.dataset.texto = btnRegistrar.innerHTML;

  formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarError('errorRegistro');

    // Recoger los campos del formulario
    const datos = {
      nombre:       document.getElementById('nombre').value.trim(),
      apellidos:    document.getElementById('apellidos').value.trim(),
      email:        document.getElementById('email').value.trim(),
      password:     document.getElementById('password').value,
      rol:          document.getElementById('rol').value,
      departamento: document.getElementById('departamento').value.trim() || null,
    };

    // Validación mínima del lado cliente
    const pass2 = document.getElementById('password2').value;
    if (datos.password !== pass2) {
      mostrarError('errorRegistro', 'Las contraseñas no coinciden.');
      return;
    }

    setBotonCargando(btnRegistrar, true);

    try {
      await auth.register(datos);
      // Registro correcto → redirigir al login con mensaje de éxito
      sessionStorage.setItem('registroExito', '1');
      window.location.href = window.location.origin + '/rekestme/login';
    } catch (err) {
      mostrarError('errorRegistro', err.message, err.errores ?? []);
      setBotonCargando(btnRegistrar, false);
    }
  });
}

// ============================================================
// Mostrar mensaje de éxito si venimos de un registro
// ============================================================
if (document.getElementById('formLogin')) {
  const exito = sessionStorage.getItem('registroExito');
  if (exito) {
    sessionStorage.removeItem('registroExito');
    const alerta = document.createElement('div');
    alerta.className = 'alert alert-success';
    alerta.textContent = '¡Cuenta creada correctamente! Inicia sesión.';
    document.getElementById('formLogin').prepend(alerta);
  }
}

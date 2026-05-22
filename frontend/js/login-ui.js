const API_BASE = `${window.location.origin}/rekestme/backend/api`;

async function handleGoogleLogin(response) {
  const errorEl = document.getElementById('errorLogin');
  if (errorEl) errorEl.innerHTML = '';
  try {
    const res  = await fetch(`${API_BASE}/auth/google`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ token: response.credential }),
    });
    const datos = await res.json();
    if (!datos.success) throw new Error(datos.message || 'Error al iniciar sesión con Google.');
    const usuario = datos.data;
    if (usuario.token) localStorage.setItem('rekestme_token', usuario.token);
    sessionStorage.setItem('usuario', JSON.stringify(usuario));
    const base = window.location.origin + '/rekestme';
    window.location.href = usuario.rol === 'profesor'
      ? base + '/panel'
      : base + '/panel-tic';
  } catch (err) {
    if (errorEl) errorEl.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

let pwdVisible = false;

function togglePwd() {
  pwdVisible = !pwdVisible;
  const input = document.getElementById('password');
  input.type = pwdVisible ? 'text' : 'password';
  document.getElementById('eye-icon').innerHTML = pwdVisible
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
}

function validateEmail(blur = false) {
  const val = document.getElementById('email').value;
  const input = document.getElementById('email');
  const errEl = document.getElementById('email-error');
  const errText = document.getElementById('email-error-text');
  const validIcon = document.getElementById('email-valid-icon');
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!val && !blur) { input.className = 'field-input'; validIcon.style.display='none'; errEl.className='field-error'; return; }
  if (!val) { showErr(input, errEl, errText, 'El correo es obligatorio'); validIcon.style.display='none'; return; }
  if (!emailRe.test(val)) { showErr(input, errEl, errText, 'Introduce un correo válido'); validIcon.style.display='none'; return; }
  input.className = 'field-input valid';
  errEl.className = 'field-error';
  validIcon.style.display = 'flex';
}

function validatePwd(blur = false) {
  const val = document.getElementById('password').value;
  const input = document.getElementById('password');
  const errEl = document.getElementById('pwd-error');
  const errText = document.getElementById('pwd-error-text');
  if (!val && !blur) return;
  if (!val) { showErr(input, errEl, errText, 'La contraseña es obligatoria'); return; }
  input.className = 'field-input';
  errEl.className = 'field-error';
}

function showErr(input, errEl, errText, msg) {
  input.className = 'field-input error';
  errText.textContent = msg;
  errEl.className = 'field-error show';
}

function handleForgot(e) {
  e.preventDefault();
  document.getElementById('forgot-modal').style.display = 'flex';
}

function closeForgot() {
  document.getElementById('forgot-modal').style.display = 'none';
}

async function sendReset() {
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) return;

  const btn = document.querySelector('#forgot-modal button:last-child');
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const API_BASE = `${window.location.origin}/rekestme/backend/api`;
    await fetch(`${API_BASE}/auth/forgot-password`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ email }),
    });
  } catch (_) { /* ignorar errores de red, la respuesta es siempre genérica */ }

  closeForgot();
  const el = document.getElementById('errorLogin');
  el.innerHTML = `<div class="alert alert-success">Si el correo está registrado, recibirás una nueva contraseña en breve.</div>`;
  btn.disabled = false;
  btn.textContent = textoOriginal;
}

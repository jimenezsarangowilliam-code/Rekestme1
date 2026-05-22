/**
 * api.js — Módulo central de comunicación con la API REST
 * Todas las llamadas fetch del frontend pasan por aquí.
 * Exporta funciones agrupadas por recurso.
 *
 * Autenticación dual:
 *   - Sesión PHP (cookie) — siempre activa con credentials:'include'
 *   - JWT — se almacena en localStorage tras el login y se envía en Authorization header
 */

// URL base de la API — usa la misma origen que el frontend para evitar problemas CORS
const API_BASE = `${window.location.origin}/rekestme/backend/api`;

// ============================================================
// Gestión del token JWT en localStorage
// ============================================================
const TOKEN_KEY = 'rekestme_token';

export function guardarToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function obtenerToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function eliminarToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ============================================================
// Helper principal: realiza la petición fetch y gestiona errores
// ============================================================
async function peticion(endpoint, metodo = 'GET', cuerpo = null) {
  const cabeceras = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };

  // Añadir JWT si existe
  const token = obtenerToken();
  if (token) {
    cabeceras['Authorization'] = `Bearer ${token}`;
  }

  const opciones = {
    method:      metodo,
    credentials: 'include', // Mantener cookie de sesión como fallback
    headers:     cabeceras,
  };

  if (cuerpo !== null) {
    opciones.body = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch(`${API_BASE}${endpoint}`, opciones);
  const datos     = await respuesta.json();

  // Si el servidor devuelve error, lo lanzamos como excepción
  if (!datos.success) {
    const error    = new Error(datos.message || 'Error desconocido de la API');
    error.errores  = datos.errors ?? [];
    error.httpCode = respuesta.status;
    throw error;
  }

  return datos; // { success, data, message, errors }
}

// ============================================================
// AUTH
// ============================================================
export const auth = {
  /** Iniciar sesión. Almacena el JWT devuelto y devuelve { data: usuario } */
  login: async (email, password) => {
    const resp = await peticion('/auth/login', 'POST', { email, password });
    if (resp.data?.token) {
      guardarToken(resp.data.token);
    }
    return resp;
  },

  /** Registrar nuevo usuario */
  register: (datos) =>
    peticion('/auth/register', 'POST', datos),

  /** Iniciar sesión con Google (token ID de Google Identity Services) */
  loginGoogle: async (token) => {
    const resp = await peticion('/auth/google', 'POST', { token });
    if (resp.data?.token) {
      guardarToken(resp.data.token);
    }
    return resp;
  },

  /** Solicitar nueva contraseña por email */
  forgotPassword: (email) =>
    peticion('/auth/forgot-password', 'POST', { email }),

  /** Cerrar sesión: limpia JWT local y cierra sesión en el servidor */
  logout: async () => {
    eliminarToken();
    return peticion('/auth/logout', 'POST');
  },

  /** Obtener el usuario de sesión actual */
  me: () =>
    peticion('/auth/me'),
};

// ============================================================
// SOLICITUDES
// ============================================================
export const solicitudes = {
  /** Lista de solicitudes (filtrada por rol en el backend) */
  listar: () =>
    peticion('/solicitudes'),

  /** Detalle de una solicitud */
  obtener: (id) =>
    peticion(`/solicitudes/${id}`),

  /** Crear nueva solicitud (solo profesores) */
  crear: (datos) =>
    peticion('/solicitudes', 'POST', datos),

  /** Actualizar campos de una solicitud */
  actualizar: (id, datos) =>
    peticion(`/solicitudes/${id}`, 'PUT', datos),

  /** Cambiar el estado (solo TIC/admin) */
  cambiarEstado: (id, estado, comentario_tic = null) =>
    peticion(`/solicitudes/${id}/estado`, 'PUT', { estado, comentario_tic }),

  /** Eliminar solicitud (solo si está pendiente) */
  eliminar: (id) =>
    peticion(`/solicitudes/${id}`, 'DELETE'),

  /** Comentarios de una solicitud */
  comentarios: {
    listar: (solicitudId) =>
      peticion(`/solicitudes/${solicitudId}/comentarios`),
    crear: (solicitudId, mensaje, es_interno = false) =>
      peticion(`/solicitudes/${solicitudId}/comentarios`, 'POST', { mensaje, es_interno }),
  },
};

// ============================================================
// AULAS
// ============================================================
export const aulas = {
  listar:    ()          => peticion('/aulas'),
  obtener:   (id)        => peticion(`/aulas/${id}`),
  crear:     (datos)     => peticion('/aulas', 'POST', datos),
  actualizar:(id, datos) => peticion(`/aulas/${id}`, 'PUT', datos),
  eliminar:  (id)        => peticion(`/aulas/${id}`, 'DELETE'),
  vinculos:  (id)        => peticion(`/aulas/${id}/vinculos`),

  /** Obtener ordenadores de un aula con su software instalado */
  obtenerOrdenadores: (aulaId) =>
    peticion(`/aulas/${aulaId}/ordenadores`),

  /** Crear ordenador(es) en un aula.
   *  Modo lote:       { cantidad, columnas }
   *  Modo individual: { nombre, fila, columna } */
  crearOrdenadores: (aulaId, datos) =>
    peticion(`/aulas/${aulaId}/ordenadores`, 'POST', datos),
};

// ============================================================
// ORDENADORES
// ============================================================
export const ordenadores = {
  /** Actualizar estado y/o nombre de un PC */
  actualizar: (id, datos) =>
    peticion(`/ordenadores/${id}`, 'PUT', datos),

  /** Eliminar un PC del aula */
  eliminar: (id) =>
    peticion(`/ordenadores/${id}`, 'DELETE'),

  /** Añadir software del catálogo a un PC (origen: manual) */
  añadirSoftware: (id, softwareId) =>
    peticion(`/ordenadores/${id}/software`, 'POST', { software_id: softwareId }),

  /** Eliminar software instalado en un PC */
  eliminarSoftware: (id, swId) =>
    peticion(`/ordenadores/${id}/software/${swId}`, 'DELETE'),

  /** Importar software seleccionado de otro PC del mismo aula */
  importarSoftware: (id, softwareIds) =>
    peticion(`/ordenadores/${id}/importar`, 'POST', { software_ids: softwareIds }),
};

// ============================================================
// SOFTWARE
// ============================================================
export const software = {
  listar:    ()          => peticion('/software'),
  obtener:   (id)        => peticion(`/software/${id}`),
  crear:     (datos)     => peticion('/software', 'POST', datos),
  actualizar:(id, datos) => peticion(`/software/${id}`, 'PUT', datos),
  eliminar:  (id)        => peticion(`/software/${id}`, 'DELETE'),
  vinculos:  (id)        => peticion(`/software/${id}/vinculos`),
};

// ============================================================
// ASIGNACIONES
// ============================================================
export const asignaciones = {
  /** Asignar técnico a una solicitud */
  asignar: (solicitudId, tecnicoId, notas = null) =>
    peticion('/asignaciones', 'POST', { solicitud_id: solicitudId, tecnico_id: tecnicoId, notas }),

  /** Marcar asignación como completada */
  completar: (id, notas = null) =>
    peticion(`/asignaciones/${id}/completar`, 'PUT', { notas }),
};

// ============================================================
// USUARIOS (admin)
// ============================================================
export const usuarios = {
  listar:           ()          => peticion('/users'),
  crear:            (datos)     => peticion('/users', 'POST', datos),
  obtener:          (id)        => peticion(`/users/${id}`),
  actualizar:       (id, datos) => peticion(`/users/${id}`, 'PUT', datos),
  eliminar:         (id)        => peticion(`/users/${id}`, 'DELETE'),
  vinculos:         (id)        => peticion(`/users/${id}/vinculos`),
  resetPassword:    (id)        => peticion(`/users/${id}/reset-password`, 'POST'),
  perfil:           ()          => peticion('/users/me'),
  actualizarPerfil: (datos)     => peticion('/users/me', 'PUT', datos),
  cambiarPassword:  (datos)     => peticion('/users/me/password', 'PUT', datos),
};

// ============================================================
// NOTIFICACIONES
// ============================================================
export const notificaciones = {
  /** Obtener notificaciones + count no leídas */
  listar: () =>
    peticion('/notificaciones'),

  /** Marcar una notificación como leída */
  marcarLeida: (id) =>
    peticion(`/notificaciones/${id}/leer`, 'PUT'),

  /** Marcar todas como leídas */
  marcarTodasLeidas: () =>
    peticion('/notificaciones/leer-todas', 'PUT'),

  /** Eliminar una notificación */
  eliminar: (id) =>
    peticion(`/notificaciones/${id}`, 'DELETE'),

  /** Eliminar todas las notificaciones */
  eliminarTodas: () =>
    peticion('/notificaciones', 'DELETE'),
};

// ============================================================
// ESTADÍSTICAS
// ============================================================
export const estadisticas = {
  obtener: () =>
    peticion('/estadisticas'),
};

// ============================================================
// CHAT PRIVADO TIC (solo tic/admin)
// ============================================================
export const chat = {
  /** Lista de contactos TIC/admin con último mensaje y no leídos */
  usuarios: () =>
    peticion('/chat/usuarios'),

  /** Mensajes de la conversación con un usuario (desdeId=0: todos) */
  conversacion: (otroId, desdeId = 0) =>
    peticion(`/chat/${otroId}/mensajes?desde_id=${desdeId}`),

  /** Enviar mensaje a un usuario */
  enviar: (otroId, mensaje) =>
    peticion(`/chat/${otroId}/mensajes`, 'POST', { mensaje }),

  /** Marcar como leídos todos los mensajes recibidos de un usuario */
  leer: (otroId) =>
    peticion(`/chat/${otroId}/leer`, 'PUT'),

  /** Total de mensajes no leídos (para badge global) */
  noLeidos: () =>
    peticion('/chat/no-leidos'),
};

// ============================================================
// CHATBOT IA
// ============================================================
export const chatbot = {
  /** Enviar historial al chatbot y recibir respuesta de la IA */
  enviar: (mensajes) =>
    peticion('/chatbot', 'POST', { mensajes }),
};

// ============================================================
// INVENTARIO
// ============================================================
export const inventario = {
  listarCategorias:    ()             => peticion('/inventario/categorias'),
  crearCategoria:      (datos)        => peticion('/inventario/categorias', 'POST', datos),
  actualizarCategoria: (id, datos)    => peticion(`/inventario/categorias/${id}`, 'PUT', datos),
  eliminarCategoria:   (id)           => peticion(`/inventario/categorias/${id}`, 'DELETE'),
  listarItems:         (catId)        => peticion(`/inventario/categorias/${catId}/items`),
  añadirItems:         (catId, datos) => peticion(`/inventario/categorias/${catId}/items`, 'POST', datos),
  actualizarItem:      (id, datos)    => peticion(`/inventario/items/${id}`, 'PUT', datos),
  eliminarItem:        (id)           => peticion(`/inventario/items/${id}`, 'DELETE'),
};

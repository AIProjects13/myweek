'use strict';
/* Núcleo: sesión, llamadas al servidor (api), estado global S, arranque y enrutador por #/ruta.
 * Al cargar este archivo empieza el arranque (sesión + datos) sin esperar al resto de la página;
 * app.js (el último script) escucha Arranque y pinta. */

/* ================================ ESTADO ================================= */
const S = {
  user: null, cfg: {}, hoy: '', instructores: [], planes: [], alumnos: [], ventas: [], citas: [], pagosSemana: [], caja: null,
  app: null, ruta: { nombre: '', params: {} }, desfaseMs: 0,
};
const CLAVES_DATOS = ['user', 'cfg', 'hoy', 'instructores', 'planes', 'alumnos', 'ventas', 'citas', 'pagosSemana', 'caja'];

/** Hora actual según el reloj del servidor (corrige un equipo con la hora mal puesta). */
const ahoraMs = () => Date.now() + S.desfaseMs;

/** Copia al estado los datos de auth.bootstrap (todas las claves o solo las pedidas). */
function aplicarDatos(d, claves) {
  (claves && claves.length ? claves : CLAVES_DATOS).forEach((k) => {
    if (k === 'caja') S.caja = d.caja || null;
    else if (d[k] !== undefined) S[k] = d[k];
  });
  if (d.hoy) S.hoy = d.hoy;
  if (d.app) S.app = d.app;
  if (typeof d.ahoraMs === 'number') S.desfaseMs = d.ahoraMs - Date.now();
}

/* ================================ SESIÓN ================================= */
const Sesion = {
  // Solo existe en el servidor local (tests/dev-server.js agrega CONFIG.DEV_AS a config.js). Nunca en producción.
  dev: typeof CONFIG.DEV_AS === 'string',
  fb: null,
  configurada() {
    if (Sesion.dev) return true;
    return !!(CONFIG.API_URL && CONFIG.FIREBASE && CONFIG.FIREBASE.apiKey && typeof firebase !== 'undefined');
  },
  /** alCambiar(hayUsuario) se llama al conocer la sesión y en cada entrada/salida. */
  iniciar(alCambiar) {
    if (Sesion.dev) { alCambiar(!!CONFIG.DEV_AS); return; }
    firebase.initializeApp(CONFIG.FIREBASE);
    Sesion.fb = firebase.auth();
    Sesion.fb.languageCode = 'es';
    Sesion.fb.onAuthStateChanged((u) => alCambiar(!!u));
  },
  token() {
    if (Sesion.dev) return CONFIG.DEV_AS ? Promise.resolve(CONFIG.DEV_AS) : Promise.reject(errorApp('UNAUTHENTICATED'));
    const u = Sesion.fb && Sesion.fb.currentUser;
    if (!u) return Promise.reject(errorApp('UNAUTHENTICATED'));
    return u.getIdToken(); // se renueva solo si está por vencer
  },
  entrar(correo, clave) {
    if (Sesion.dev) { location.search = '?as=' + encodeURIComponent(correo); return new Promise(() => {}); }
    return Sesion.fb.signInWithEmailAndPassword(correo, clave);
  },
  recuperar(correo) {
    if (Sesion.dev) return Promise.resolve();
    return Sesion.fb.sendPasswordResetEmail(correo);
  },
  salir() {
    if (Sesion.dev) { location.href = location.pathname; return Promise.resolve(); }
    return Sesion.fb ? Sesion.fb.signOut() : Promise.resolve();
  },
  /** Mensaje para errores del acceso (sin nombrar la tecnología). */
  mensaje(e) {
    const c = e && e.code;
    if (c === 'auth/invalid-credential' || c === 'auth/invalid-login-credentials' || c === 'auth/wrong-password' || c === 'auth/user-not-found') return 'Correo o contraseña incorrectos.';
    if (c === 'auth/invalid-email') return 'Ese correo no es válido.';
    if (c === 'auth/user-disabled') return 'Esta cuenta está desactivada. Habla con el administrador.';
    if (c === 'auth/too-many-requests') return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
    if (c === 'auth/network-request-failed') return 'Sin conexión. Revisa tu internet.';
    return 'No se pudo completar. Intenta de nuevo.';
  },
};

/* ================================== API ================================== */
const MENSAJES = {
  NETWORK: 'No se pudo conectar. Revisa tu internet e intenta de nuevo.',
  NETWORK_ESCRITURA: 'Se perdió la conexión y no se sabe si se guardó. Revisa antes de repetirlo.',
  UNAUTHENTICATED: 'Tu sesión terminó. Vuelve a entrar.',
  FORBIDDEN: 'No tienes permiso para hacer esto.',
  CONFLICT: 'Alguien más cambió esto. Actualiza e intenta de nuevo.',
  VALIDATION: 'Revisa los datos e intenta de nuevo.',
  DECISION_REQUIRED: 'Falta indicar qué hacer con esta clase.',
  DUPLICATE: 'Ese registro ya existe.',
  NOT_FOUND: 'No se encontró. Puede que ya no exista.',
  RATE_LIMITED: 'Demasiadas solicitudes seguidas. Espera un momento.',
  BUSY: 'Hay otra operación en curso. Intenta de nuevo en unos segundos.',
  CONFIG: 'Falta completar la configuración de la escuela. Avísale al administrador.',
  QUOTA: 'Se alcanzó el límite de envíos de hoy. Intenta mañana.',
  NOT_SETUP: 'La aplicación todavía no está lista. Avísale al administrador.',
  INTERNAL: 'Algo salió mal. Intenta de nuevo.',
  BAD_REQUEST: 'No se pudo procesar. Recarga la página e intenta de nuevo.',
};
// Códigos cuyo mensaje del servidor habla del trabajo ("Hay choque de horario…") y conviene mostrar tal cual.
const MENSAJE_DEL_SERVIDOR = { FORBIDDEN: 1, CONFLICT: 1, VALIDATION: 1, DECISION_REQUIRED: 1, DUPLICATE: 1, NOT_FOUND: 1, RATE_LIMITED: 1, QUOTA: 1 };
// Por si acaso: un mensaje con aspecto técnico nunca llega a la pantalla.
const TECNICO = /firebase|apps?\s*script|google|sheets?\b|spreadsheet|\bhojas?\b|\bdrive\b|\bscript|exception|stack|undefined|\bnull\b|typeerror|referenceerror|\bat\s+\S+\s*\(|https?:/i;
// Lecturas: se pueden repetir sin riesgo si falla la red. Una escritura no se repite sola (podría duplicar un pago).
const LECTURA = /^(auth\.bootstrap|progreso\.get|config\.get|[a-z]+\.(list|get|history|receipt))$/;

function errorApp(code, mensajeServidor) {
  let m = MENSAJES[code] || MENSAJES.INTERNAL;
  if (MENSAJE_DEL_SERVIDOR[code] && mensajeServidor && !TECNICO.test(mensajeServidor)) m = String(mensajeServidor).slice(0, 300);
  const e = new Error(m);
  e.code = code;
  return e;
}

async function enviar_(req) {
  const r = await fetch(CONFIG.API_URL, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(req), redirect: 'follow', cache: 'no-store',
  });
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}

/** Llama una acción del servidor. → data, o lanza Error con .code y un mensaje para mostrar.
 *  .code es uno de los del servidor (VALIDATION, CONFLICT, …) o uno de la página:
 *  NETWORK (no hubo conexión; lecturas ya reintentadas) y NETWORK_ESCRITURA (se perdió la conexión en una
 *  escritura: no se sabe si se guardó; nunca se repite sola para no duplicar un pago o una cita). */
async function api(action, payload) {
  let token;
  try { token = await Sesion.token(); }
  catch (e) {
    if (e.code === 'UNAUTHENTICATED') throw e;
    try { token = await Sesion.token(); } catch (e2) { throw errorApp(e2.code === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'NETWORK'); }
  }
  const req = { action, token, payload: payload || {} };
  let res;
  try { res = await enviar_(req); }
  catch (e) {
    if (!LECTURA.test(action)) throw errorApp('NETWORK_ESCRITURA');
    try { res = await enviar_(req); } catch (e2) { throw errorApp('NETWORK'); }
  }
  if (res && res.ok) return res.data;
  const er = (res && res.error) || {};
  const code = MENSAJES[er.code] ? er.code : 'INTERNAL';
  if (code === 'UNAUTHENTICATED') Arranque.sesionVencida();
  throw errorApp(code, er.message);
}

/** Vuelve a pedir los datos del arranque y repinta la pantalla actual. claves: ['citas','ventas',…] o todas. */
async function refresh(claves) {
  const d = await api('auth.bootstrap');
  aplicarDatos(d, claves);
  Router.render({ conservarScroll: true });
  return d;
}

/* =============================== ARRANQUE ================================ */
// fase: 'inicio' → 'login' | 'cargando' → 'listo' | 'error' | 'sin-config'. app.js asigna oyente.
const Arranque = {
  fase: 'inicio', error: null, aviso: '', oyente: null,
  cambiar(f) { Arranque.fase = f; if (Arranque.oyente) Arranque.oyente(f); },
  cargar() {
    Arranque.error = null;
    Arranque.cambiar('cargando');
    api('auth.bootstrap')
      .then((d) => { aplicarDatos(d); Arranque.cambiar('listo'); })
      .catch((e) => { if (e.code === 'UNAUTHENTICATED') return; Arranque.error = e; Arranque.cambiar('error'); });
  },
  sesionVencida() {
    Arranque.aviso = MENSAJES.UNAUTHENTICATED;
    Sesion.salir();
  },
  iniciar() {
    if (!Sesion.configurada()) { Arranque.cambiar('sin-config'); return; }
    try {
      Sesion.iniciar((hay) => {
        if (hay) Arranque.cargar();
        else { CLAVES_DATOS.forEach((k) => { S[k] = Array.isArray(S[k]) ? [] : k === 'cfg' ? {} : null; }); Arranque.cambiar('login'); }
      });
    } catch (e) {
      Arranque.error = errorApp('INTERNAL');
      Arranque.cambiar('error');
    }
  },
};

/* =============================== ENRUTADOR =============================== */
const Views = Object.create(null); // sin prototipo: #/constructor o #/__proto__ no son pantallas

/** registerView('hoy', {titulo, icono, soloAdmin, render(el, params), subtitulo?, seccion?}).
 *  Con icono aparece en los menús; seccion = entrada del menú que se marca (p. ej. 'alumno' → 'alumnos'). */
function registerView(nombre, def) {
  Views[nombre] = Object.assign({ nombre: nombre }, def);
  if (S.user && typeof Nav !== 'undefined') Nav.pintar();
}

const permitida = (v) => !!v && (!v.soloAdmin || !!(S.user && S.user.isAdmin));

/** '#/agenda?vista=semana&fecha=2026-10-28' → {nombre:'agenda', params:{vista, fecha}}; '#/alumno/A123' → {nombre:'alumno', params:{id:'A123'}} */
function leerRuta(hash) {
  const h = String(hash || '').replace(/^#\/?/, '');
  const q = h.indexOf('?');
  const camino = q >= 0 ? h.slice(0, q) : h;
  const params = {};
  new URLSearchParams(q >= 0 ? h.slice(q + 1) : '').forEach((v, k) => { params[k] = v; });
  const seg = camino.split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch (e) { return ''; } });
  if (seg[1]) params.id = seg[1];
  return { nombre: seg[0] || '', params };
}

function hashDe(nombre, params) {
  const p = Object.assign({}, params || {});
  let h = '#/' + encodeURIComponent(nombre);
  if (p.id !== undefined && p.id !== null && p.id !== '') h += '/' + encodeURIComponent(p.id);
  delete p.id;
  const qs = new URLSearchParams();
  Object.keys(p).forEach((k) => { if (p[k] !== undefined && p[k] !== null && p[k] !== '') qs.set(k, p[k]); });
  const s = qs.toString();
  return s ? h + '?' + s : h;
}

/** Navega a una pantalla. go('alumno', {id:'A123'}) · go('agenda', {vista:'semana', fecha:'2026-10-28'}) */
function go(ruta, params) {
  const h = hashDe(ruta, params);
  if (location.hash === h) Router.render();
  else location.hash = h;
}

const Router = {
  inicio() {
    if (permitida(Views.hoy)) return 'hoy';
    const v = Object.keys(Views).filter((k) => Views[k].icono && permitida(Views[k]))[0];
    return v || '';
  },
  render(o) {
    o = o || {};
    if (!S.user) return;
    let r = leerRuta(location.hash);
    if (!permitida(Views[r.nombre])) {
      // Ruta desconocida o de administrador para Recepción → Hoy.
      const dest = Router.inicio();
      if (!dest) return;
      history.replaceState(null, '', location.pathname + location.search + '#/' + dest);
      r = { nombre: dest, params: {} };
    }
    const cambio = r.nombre !== S.ruta.nombre;
    S.ruta = r;
    const v = Views[r.nombre];
    const sub = typeof v.subtitulo === 'function' ? v.subtitulo(r.params) : (v.subtitulo || '');
    document.getElementById('tituloVista').textContent = v.titulo || '';
    document.getElementById('subtituloVista').textContent = sub;
    document.title = (v.titulo ? v.titulo + ' · ' : '') + CONFIG.APP_NAME;
    if (typeof Nav !== 'undefined') Nav.marcar(r.nombre);
    const el = document.getElementById('view');
    const y = window.scrollY;
    el.className = 'vista vista-' + r.nombre + (cambio ? ' entra' : '');
    el.innerHTML = '';
    try { v.render(el, r.params); }
    catch (e) {
      console.error('[vista ' + r.nombre + ']', e);
      el.innerHTML = '<div class="vacio">' + icon('alert', 28) + '<b>No se pudo mostrar esta pantalla</b><p>Intenta de nuevo o vuelve a Hoy.</p></div>';
    }
    if (o.conservarScroll) window.scrollTo(0, y);
    else if (cambio) window.scrollTo(0, 0);
    if (cambio && o.enfocar !== false) document.getElementById('tituloVista').focus({ preventScroll: true });
    if (typeof Nav !== 'undefined') Nav.actualizarCampana();
  },
};

Arranque.iniciar();

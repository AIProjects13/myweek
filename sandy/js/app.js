'use strict';
/* Arranque de la página: tema, acceso, pantalla de carga, eventos globales y primera pantalla. Va al final. */

const BootUI = {
  esqueleto: '',
  el: () => document.getElementById('boot'),
  mostrar() { const b = BootUI.el(); b.hidden = false; b.classList.remove('saliendo'); },
  ocultar(despues) {
    const b = BootUI.el();
    if (b.hidden) { if (despues) despues(); return; }
    b.classList.add('saliendo');
    setTimeout(() => { b.hidden = true; b.classList.remove('saliendo'); if (despues) despues(); }, 200);
  },
  paso(n) { BootUI.el().dataset.paso = String(n); },
};

const Login = {
  msg(texto, tipo) {
    const m = document.getElementById('lgMsg');
    m.hidden = !texto;
    m.textContent = texto || '';
    m.className = 'aviso' + (tipo ? ' aviso-' + tipo : '');
  },
  ocupado(on) {
    const b = document.getElementById('lgEntrar');
    b.disabled = on;
    b.textContent = on ? 'Entrando…' : 'Entrar';
  },
  mostrar(puerta) {
    document.getElementById('app').hidden = true;
    document.getElementById('login').hidden = false;
    document.getElementById('loginForm').hidden = !!puerta;
    document.getElementById('lgPuerta').hidden = !puerta;
    if (puerta) {
      document.getElementById('lgPuertaMsg').textContent = puerta.texto;
      document.getElementById('lgReintentar').hidden = !puerta.reintentar;
      document.getElementById('lgSalir').hidden = !puerta.salir;
    }
    Login.ocupado(false);
    document.getElementById('lgReintentar').disabled = false;
    BootUI.ocultar(() => { const f = document.getElementById(puerta ? 'lgPuertaMsg' : 'lgCorreo'); if (!puerta && f) f.focus(); });
  },
};

/** Fases del arranque (core.js). */
function alCambiarFase(f) {
  if (f === 'inicio') return;
  if (f === 'cargando') { BootUI.paso(2); BootUI.mostrar(); document.getElementById('login').hidden = true; return; }
  if (f === 'login') {
    Capas.cerrarTodas();
    Login.mostrar(null);
    Login.msg(Arranque.aviso, 'error');
    Arranque.aviso = '';
    if (Sesion.dev) Login.msg('Servidor local: escribe un correo de prueba (admin@t.com o rec@t.com); la contraseña no se revisa.', 'info');
    return;
  }
  if (f === 'sin-config') { Login.mostrar({ texto: 'La aplicación aún no está configurada. Avísale al administrador.' }); return; }
  if (f === 'error') {
    const e = Arranque.error || {};
    Login.mostrar({ texto: e.message || MENSAJES.INTERNAL, reintentar: e.code !== 'FORBIDDEN', salir: true });
    return;
  }
  if (f === 'listo') {
    BootUI.paso(3);
    document.getElementById('login').hidden = true;
    document.getElementById('app').hidden = false;
    document.getElementById('view').innerHTML = BootUI.esqueleto; // esqueletos de Hoy mientras se pinta
    S.ruta = { nombre: '', params: {} };
    if (typeof Hoy !== 'undefined') Hoy.iniciarReloj(); // recordatorios y campana, sin importar la pantalla
    Nav.pintar();
    BootUI.ocultar(() => Router.render({ enfocar: false }));
  }
}

/* ================================ EVENTOS ================================ */
function conectarEventos() {
  document.getElementById('btnCampana').insertAdjacentHTML('afterbegin', icon('bell', 20));
  document.getElementById('lgVer').innerHTML = icon('eye', 20);

  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const correo = document.getElementById('lgCorreo').value.trim();
    const clave = document.getElementById('lgClave').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { Login.msg('Escribe tu correo completo.', 'error'); return; }
    if (!clave && !Sesion.dev) { Login.msg('Escribe tu contraseña.', 'error'); return; }
    Login.msg('');
    Login.ocupado(true);
    Sesion.entrar(correo, clave).catch((err) => { Login.ocupado(false); Login.msg(Sesion.mensaje(err), 'error'); });
  });
  document.getElementById('lgVer').addEventListener('click', (e) => {
    const b = e.currentTarget, i = document.getElementById('lgClave');
    const ver = i.type === 'password';
    i.type = ver ? 'text' : 'password';
    b.innerHTML = icon(ver ? 'eyeoff' : 'eye', 20);
    b.setAttribute('aria-pressed', String(ver));
    b.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
  document.getElementById('lgOlvide').addEventListener('click', () => {
    const correo = document.getElementById('lgCorreo').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { Login.msg('Escribe tu correo arriba y vuelve a tocar «¿Olvidaste tu contraseña?».', 'info'); document.getElementById('lgCorreo').focus(); return; }
    const listo = () => Login.msg('Si ese correo tiene una cuenta, te llegará un enlace para crear una contraseña nueva.', 'ok');
    Sesion.recuperar(correo).then(listo).catch((err) => {
      if (err && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')) listo(); // no revela si existe
      else Login.msg(Sesion.mensaje(err), 'error');
    });
  });
  document.getElementById('lgReintentar').addEventListener('click', (e) => { e.currentTarget.disabled = true; Arranque.cargar(); });
  document.getElementById('lgSalir').addEventListener('click', () => Sesion.salir());
  document.getElementById('btnTema').addEventListener('click', () => Tema.cambiar());
  document.getElementById('btnCampana').addEventListener('click', () => {
    if (typeof abrirAlertas === 'function') abrirAlertas();
    else toast('No hay avisos por ahora.', 'info');
  });

  // Botones con data-accion (menús y hojas).
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    const a = b.dataset.accion;
    if (a === 'nuevo') Nav.abrirNuevo();
    else if (a === 'mas') Nav.abrirMas();
    else if (a === 'retraer') Nav.retraer();
    else if (a === 'tema') { Tema.cambiar(); Nav.abrirMas(); }
    else if (a === 'salir') {
      if (hojaActual) hojaActual.cerrar();
      if (await confirmar('¿Quieres cerrar tu sesión en este equipo?', { titulo: 'Cerrar sesión', si: 'Cerrar sesión' })) Sesion.salir();
    } else if (ACCIONES_NUEVO[a]) accionNuevo(a);
  });

  const sb = document.getElementById('sidebar');
  sb.addEventListener('pointerover', (e) => { const a = e.target.closest('[data-tip]'); if (a) Tip.mostrar(a); });
  sb.addEventListener('pointerout', (e) => { if (!e.relatedTarget || !sb.contains(e.relatedTarget) || !e.relatedTarget.closest('[data-tip]')) Tip.ocultar(); });
  sb.addEventListener('focusin', (e) => { const a = e.target.closest('[data-tip]'); if (a && a.matches(':focus-visible')) Tip.mostrar(a); });
  sb.addEventListener('focusout', Tip.ocultar);
  window.addEventListener('scroll', Tip.ocultar, { passive: true });

  window.addEventListener('hashchange', () => Router.render());
}

/* ================================= INICIO ================================ */
BootUI.esqueleto = document.getElementById('view').innerHTML;
BootUI.paso(1);
Tema.iniciar();
conectarEventos();
Arranque.oyente = alCambiarFase;
alCambiarFase(Arranque.fase);

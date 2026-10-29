'use strict';
/* Alumnos: lista (búsqueda en vivo + filtros), ficha del alumno (ventas, avance, cuotas, clases, pagos) y edición de sus datos.
 * form-venta.js (nuevo alumno / venta) y detalle-venta.js (editar / anular venta) usan los ayudantes de este archivo. */

/* ------------------------- ayudantes compartidos -------------------------- */
const digitos_ = (v) => String(v === null || v === undefined ? '' : v).replace(/\D/g, '');
/** Teléfono sin el código del país (igual que el servidor) para detectar repetidos. */
function telNorm_(v) {
  let d = digitos_(v);
  const cc = digitos_(S.cfg.DEFAULT_COUNTRY_CODE || '502');
  if (cc && d.indexOf(cc) === 0 && d.length - cc.length >= 7) d = d.slice(cc.length);
  return d;
}
/** https://wa.me/502… (con 502 si el número tiene 8 dígitos); '' si no hay un número usable. */
function waLink_(tel) {
  let d = digitos_(tel);
  if (d.length === 8) d = '502' + d;
  return d.length >= 10 ? 'https://wa.me/' + d : '';
}
const COBRO_CHIP = { Pagado: 'chip-verde', 'Al día': 'chip-azul', 'Por vencer': 'chip-ambar', Vencido: 'chip-rojo' };
const COBRO_ORDEN = ['Vencido', 'Por vencer', 'Al día', 'Pagado'];
const chipCobro_ = (e) => e ? '<span class="chip ' + (COBRO_CHIP[e.estado] || '') + '">' + esc(e.estado) + (e.estado === 'Vencido' && e.diasVencido ? ' · ' + esc(e.diasVencido) + ' d' : '') + '</span>' : '';
const clasesTxt_ = (n) => n + (n === 1 ? ' clase' : ' clases');
const horasTxt_ = (h) => (Math.round(Number(h) * 100) / 100) + (Number(h) === 1 ? ' hora' : ' horas');

/* ================================ ALUMNOS ================================= */
const AL = {
  q: '', filtro: 'todos', n: 30,
  lista: null, listaRef: null, listaErr: '', cargandoLista: false,
  f: null,   // ficha en pantalla: {id, d, ref, t, err, cargando}
  gen: 0,

  hoy: () => Hoy.hoy(),
  /** Todo lo guardado deja de servir tras una escritura: se vuelve a pedir al servidor. */
  limpiar() { AL.gen++; AL.lista = null; AL.f = null; Agenda.limpiar(); },
  async tras(claves) {
    AL.limpiar();
    try { await refresh(claves || ['alumnos', 'ventas', 'citas', 'pagosSemana', 'caja']); } catch (e) { Router.render({ conservarScroll: true }); }
  },

  /* ----------------------------- lista ----------------------------- */
  fresca: (c) => c && c.ref === S.alumnos && c.ventas === S.ventas,
  cargarLista() {
    if (AL.cargandoLista) return;
    AL.cargandoLista = true; AL.listaErr = '';
    const gen = AL.gen;
    api('alumnos.list').then((l) => { if (gen === AL.gen) AL.lista = { d: l, ref: S.alumnos, ventas: S.ventas }; })
      .catch((e) => { if (gen === AL.gen) AL.listaErr = e.message || MENSAJES.INTERNAL; })
      .then(() => { AL.cargandoLista = false; if (S.ruta.nombre === 'alumnos') Router.render({ conservarScroll: true }); });
  },
  principal(a) {
    const vs = a.ventas || [];
    return vs.filter((v) => v.avance && v.avance.libres + v.avance.agendadas > 0)[0] || vs[vs.length - 1] || null;
  },
  peorCobro(a) {
    const vs = (a.ventas || []).filter((v) => v.estado);
    for (let i = 0; i < COBRO_ORDEN.length; i++) { const v = vs.filter((x) => x.estado.estado === COBRO_ORDEN[i])[0]; if (v) return v.estado; }
    return null;
  },
  coincide(a) {
    const q = norm_(AL.q).trim(), dig = digitos_(AL.q);
    if (q && norm_(a.nombre).indexOf(q) < 0 && !(dig.length >= 2 && digitos_(a.telefono).indexOf(dig) >= 0)) return false;
    const vs = a.ventas || [];
    if (AL.filtro === 'pend') return vs.some((v) => v.avance && v.avance.libres + v.avance.agendadas > 0);
    if (AL.filtro === 'venc') return vs.some((v) => v.estado && v.estado.estado === 'Vencido');
    return true;
  },
  tarjeta(a) {
    const v = AL.principal(a), av = v && v.avance, e = AL.peorCobro(a);
    const tot = av ? av.consumidas + av.agendadas + av.libres : 0;
    const sub = v ? esc(v.planNombre) + ' · ' + av.consumidas + ' de ' + tot + (a.ventas.length > 1 ? ' · +' + (a.ventas.length - 1) : '') : (a.telefono ? esc(a.telefono) : 'Sin plan todavía');
    return '<button type="button" class="al-card" data-al="abrir" data-id="' + esc(a.id) + '"><span class="av" aria-hidden="true">' + esc(iniciales(a.nombre)) + '</span>' +
      '<span class="al-txt"><b>' + esc(a.nombre) + '</b><small>' + sub + '</small></span>' + (e ? chipCobro_(e) : '<span class="chip">Sin plan</span>') + '</button>';
  },
  resultados() {
    const todos = AL.lista.d, l = todos.filter(AL.coincide);
    if (!todos.length) return '<div class="vacio">' + icon('users', 28) + '<b>Aún no hay alumnos</b><p>Registra al primero con su plan.</p><button type="button" class="btn btn-primario" data-al="nuevo">' + icon('userPlus', 18) + 'Nuevo alumno / venta</button></div>';
    if (!l.length) return '<div class="vacio">' + icon('search', 28) + '<b>Nada por aquí</b><p>Ningún alumno coincide con la búsqueda o el filtro.</p></div>';
    return '<div class="al-lista">' + l.slice(0, AL.n).map(AL.tarjeta).join('') + '</div>' +
      (l.length > AL.n ? '<button type="button" class="btn btn-suave btn-bloque al-mas" data-al="mas">Ver más (' + (l.length - AL.n) + ' restantes)</button>' : '') +
      '<p class="ayuda al-cuenta">' + l.length + (l.length === 1 ? ' alumno' : ' alumnos') + '</p>';
  },
  renderLista(el) {
    const barra = '<div class="al-barra"><div class="campo al-buscar"><label for="alQ" class="solo-lector">Buscar alumno</label><input id="alQ" class="input" type="search" placeholder="Buscar por nombre o teléfono" autocomplete="off" data-al-in="q" value="' + esc(AL.q) + '"></div>' +
      '<button type="button" class="btn btn-primario al-nuevo" data-al="nuevo">' + icon('userPlus', 18) + '<span>Nuevo</span></button></div>' +
      '<div class="chips-ins" role="group" aria-label="Filtrar">' + [['todos', 'Todos'], ['pend', 'Con clases pendientes'], ['venc', 'Vencidos']].map((f) =>
        '<button type="button" class="chip-ins' + (AL.filtro === f[0] ? ' activo' : '') + '" data-al="filtro" data-f="' + f[0] + '" aria-pressed="' + (AL.filtro === f[0]) + '">' + f[1] + '</button>').join('') + '</div>';
    let cuerpo;
    if (!AL.lista) {
      if (AL.listaErr) cuerpo = '<div class="vacio">' + icon('alert', 28) + '<b>No se pudo cargar</b><p>' + esc(AL.listaErr) + '</p><button type="button" class="btn btn-suave" data-al="reintentar-lista">Reintentar</button></div>';
      else { cuerpo = '<div class="esq esq-fila"></div><div class="esq esq-fila"></div><div class="esq esq-fila"></div>'; AL.cargarLista(); }
    } else {
      if (!AL.fresca(AL.lista) && !AL.cargandoLista) AL.cargarLista(); // se muestra lo anterior mientras llega lo nuevo
      cuerpo = AL.resultados();
    }
    el.innerHTML = barra + '<div id="alRes">' + cuerpo + '</div>';
  },

  /* ------------------------------ ficha ----------------------------- */
  cargarFicha(id) {
    const f = AL.f;
    if (f.cargando) return;
    f.cargando = true;
    const gen = AL.gen;
    api('alumnos.get', { id }).then((d) => {
      if (gen !== AL.gen || AL.f !== f) return;
      f.d = d; f.ref = S.ventas; f.t = Date.now(); f.err = '';
      Agenda.ext['alumno|' + id] = d.citas || []; // así abrirCita encuentra las clases aunque estén fuera de lo cargado
    }).catch((e) => { if (gen === AL.gen && AL.f === f) f.err = e.message || MENSAJES.INTERNAL; })
      .then(() => { f.cargando = false; if (gen === AL.gen && AL.f === f && S.ruta.nombre === 'alumno' && S.ruta.params.id === id) Router.render({ conservarScroll: true }); });
  },
  cita(c) {
    const e = c.estado, cl = e === 'Dada' ? 'chip-verde' : e === 'Programada' ? 'chip-azul' : e === 'No se presentó' ? 'chip-ambar' : '';
    return '<button type="button" class="al-cita" data-al="cita" data-id="' + esc(c.id) + '"><span><b>' + esc(cap(fechaCorta(c.fecha))) + ' · ' + esc(c.hora) + '</b><small>' + esc(c.instructor || 'Sin instructor') + '</small></span>' +
      '<span class="chip ' + cl + '">' + esc(e) + (e !== 'Programada' && e !== 'Dada' && c.descuenta ? ' · descontada' : '') + '</span></button>';
  },
  cuota(q, hoy) {
    const pend = Calc.round2(q.monto - q.pagado), pagada = pend <= 0.005;
    const chip = pagada ? '<span class="chip chip-verde">Pagada</span>' : q.vence < hoy ? '<span class="chip chip-rojo">Vencida</span>' : q.pagado > 0 ? '<span class="chip chip-ambar">Parcial</span>' : '<span class="chip">Pendiente</span>';
    return '<li class="al-q"><span class="prev-n">' + esc(q.numero) + '</span><span class="prev-t"><b>' + esc(money(q.monto)) + '</b><small class="al-gris">Vence ' + esc(fechaCorta(q.vence)) +
      (!pagada && q.pagado > 0 ? ' · pagó ' + esc(money(q.pagado)) + ', falta ' + esc(money(pend)) : '') + '</small></span>' + chip + '</li>';
  },
  pago(p) {
    return '<li class="al-q"><span class="prev-t"><b>' + esc(money(p.monto)) + ' · ' + esc(p.metodo) + '</b><small class="al-gris">' + esc(fechaCorta(p.fechaPago)) + (p.reciboNo ? ' · recibo ' + esc(p.reciboNo) : '') + '</small></span>' +
      (p.anulado ? '<span class="chip chip-rojo">Anulado</span>' : '') + '</li>';
  },
  venta(v, d) {
    const av = v.avance, hoy = AL.hoy(), admin = S.user && S.user.isAdmin;
    if (v.anulada) return '<section class="card al-venta al-anulada"><div class="dt-cab"><h3>' + esc(v.planNombre) + '</h3><span class="chip chip-rojo">Anulada</span></div><p class="ayuda">Venta anulada. ' + esc(money(v.precio)) + '.</p></section>';
    const citas = d.citas.filter((c) => c.idVenta === v.id).sort((a, b) => (a.fecha + a.hora < b.fecha + b.hora ? -1 : 1));
    const prox = citas.filter((c) => c.estado === 'Programada'), ant = citas.filter((c) => c.estado !== 'Programada').reverse();
    const pagos = d.pagos.filter((p) => p.idVenta === v.id).sort((a, b) => (a.fechaPago < b.fechaPago ? 1 : -1));
    const hr = av.horasRestantes;
    return '<section class="card al-venta"><div class="dt-cab"><h3>' + esc(v.planNombre) + '</h3>' + chipCobro_(v.estado) + '</div>' +
      '<p class="ayuda">A nombre de ' + esc(v.aNombreDe) + ' · ' + esc(money(v.precio)) + (v.precio !== v.precioPlan ? ' (el plan cuesta ' + esc(money(v.precioPlan)) + ')' : '') + ' · ' + esc(v.formaPago) + '</p>' +
      '<div class="al-avance"><div class="al-avance-t"><b>' + av.consumidas + ' de ' + v.citas + ' clases</b><small>' + (av.agendadas ? av.agendadas + ' agendadas · ' : '') + 'quedan ' + Math.max(0, av.libres) + ' por agendar</small></div>' +
      '<progress class="al-prog" max="' + Math.max(1, v.citas) + '" value="' + Math.min(av.consumidas, v.citas) + '" aria-label="Clases dadas"></progress>' +
      '<small class="al-gris">' + esc(horasTxt_(av.horasUsadas)) + ' usadas' + (hr === null || hr === undefined ? '' : ' · ' + esc(horasTxt_(hr)) + ' restantes') + '</small></div>' +
      '<div class="dt-acc">' + (av.libres > 0 ? '<button type="button" class="btn btn-primario" data-al="agendar" data-id="' + esc(v.id) + '">' + icon('calPlus', 18) + 'Agendar</button>' : '') +
      (v.estado.saldo > 0 ? '<button type="button" class="btn btn-suave" data-al="pagar" data-id="' + esc(v.id) + '">' + icon('cash', 18) + 'Registrar pago</button>' : '') +
      '<button type="button" class="btn btn-suave" data-al="editv" data-id="' + esc(v.id) + '">' + icon('edit', 18) + 'Editar venta</button>' +
      (admin ? '<button type="button" class="btn btn-suave al-anular" data-al="anular" data-id="' + esc(v.id) + '">' + icon('trash', 18) + 'Anular venta</button>' : '') + '</div>' +
      '<h4 class="dt-sub">Cuotas · saldo ' + esc(money(v.estado.saldo)) + '</h4><ul class="prev">' + v.cuotas.map((q) => AL.cuota(q, hoy)).join('') + '</ul>' +
      '<h4 class="dt-sub">Clases próximas</h4>' + (prox.length ? '<div class="al-citas">' + prox.slice(0, 8).map(AL.cita).join('') + '</div>' + (prox.length > 8 ? '<p class="ayuda">Y ' + (prox.length - 8) + ' más en la agenda.</p>' : '') : '<p class="dia-vacio">No hay clases agendadas.</p>') +
      (ant.length ? '<details class="al-det"><summary>Clases anteriores (' + ant.length + ')</summary><div class="al-citas">' + ant.slice(0, 20).map(AL.cita).join('') + '</div>' + (ant.length > 20 ? '<p class="ayuda">Se muestran las 20 más recientes.</p>' : '') + '</details>' : '') +
      '<h4 class="dt-sub">Pagos</h4>' + (pagos.length ? '<ul class="prev">' + pagos.slice(0, 10).map(AL.pago).join('') + '</ul>' : '<p class="dia-vacio">' + (admin ? 'Sin pagos registrados.' : 'Sin pagos esta semana.') + '</p>') +
      (!admin ? '<p class="ayuda">Historial completo disponible para el administrador.</p>' : '') + '</section>';
  },
  renderFicha(el, id) {
    if (!AL.f || AL.f.id !== id) AL.f = { id, d: null, ref: null, t: 0, err: '', cargando: false };
    const f = AL.f;
    if (!f.cargando && (!f.d || f.ref !== S.ventas || Date.now() - f.t > 60000)) { f.err = ''; AL.cargarFicha(id); }
    const atras = '<a class="btn btn-enlace al-atras" href="#/alumnos">' + icon('left', 18) + 'Alumnos</a>';
    if (!f.d) {
      el.innerHTML = atras + (f.err ? '<div class="vacio">' + icon('alert', 28) + '<b>No se pudo abrir la ficha</b><p>' + esc(f.err) + '</p><button type="button" class="btn btn-suave" data-al="reintentar-ficha">Reintentar</button></div>' : '<div class="esq esq-fila"></div><div class="esq esq-fila"></div><div class="esq esq-fila"></div>');
      return;
    }
    const a = f.d.alumno, wa = waLink_(a.telefono);
    const vs = f.d.ventas.slice().sort((x, y) => (x.anulada === y.anulada ? (x.fechaVenta < y.fechaVenta ? 1 : -1) : x.anulada ? 1 : -1));
    el.innerHTML = atras + '<section class="card al-ficha"><div class="al-ficha-cab"><span class="av av-grande" aria-hidden="true">' + esc(iniciales(a.nombre)) + '</span><div class="al-txt"><h2>' + esc(a.nombre) + '</h2>' +
      '<p class="ayuda">' + (a.telefono ? esc(a.telefono) : 'Sin teléfono') + (a.email ? ' · ' + esc(a.email) : '') + '</p></div></div>' +
      (a.nota ? '<p class="al-nota">' + esc(a.nota) + '</p>' : '') +
      '<div class="dt-acc">' + (wa ? '<a class="btn btn-suave" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">' + icon('whatsapp', 18) + 'WhatsApp</a>' : '') +
      '<button type="button" class="btn btn-suave" data-al="editar">' + icon('edit', 18) + 'Editar datos</button>' +
      '<button type="button" class="btn btn-primario" data-al="nuevav">' + icon('plus', 18) + 'Nueva venta</button></div></section>' +
      (vs.length ? vs.map((v) => AL.venta(v, f.d)).join('') : '<div class="vacio">' + icon('plan', 28) + '<b>Todavía no tiene plan</b><p>Registra su primera venta.</p></div>');
  },

  /* ------------------------- editar datos del alumno ------------------------- */
  editar() {
    const a = AL.f && AL.f.d && AL.f.d.alumno;
    if (!a) return;
    const campo = (id, et, v, extra) => '<div class="campo"><label for="' + id + '">' + et + '</label><input id="' + id + '" class="input" ' + extra + ' value="' + esc(v) + '"></div>';
    modal({
      titulo: 'Datos del alumno',
      cuerpoHtml: '<div class="form-ag">' + campo('eaNombre', 'Nombre', a.nombre, 'maxlength="100" autocomplete="off"') +
        campo('eaTel', 'Teléfono', a.telefono, 'type="tel" inputmode="tel" maxlength="30" autocomplete="off" placeholder="8 dígitos (código 502 por defecto)"') +
        campo('eaMail', 'Correo (opcional)', a.email, 'type="email" inputmode="email" maxlength="100" autocomplete="off"') +
        '<div class="campo"><label for="eaNota">Nota (opcional)</label><textarea id="eaNota" class="input" rows="2" maxlength="500">' + esc(a.nota) + '</textarea></div>' +
        '<div id="eaErr" class="aviso aviso-error" role="alert" hidden></div></div>',
      acciones: [{ texto: 'Cancelar', estilo: 'suave' }, {
        texto: 'Guardar', estilo: 'primario',
        async accion(c) {
          const v = (id) => c.el.querySelector('#' + id).value, err = c.el.querySelector('#eaErr');
          const nombre = v('eaNombre').trim();
          err.hidden = true;
          if (!nombre) { err.textContent = 'Escribe el nombre.'; err.hidden = false; return false; }
          try { await api('alumnos.save', { id: a.id, nombre, telefono: v('eaTel').trim(), email: v('eaMail').trim(), nota: v('eaNota').trim() }); }
          catch (e) { err.textContent = e.message || MENSAJES.INTERNAL; err.hidden = false; return false; }
          toast('Se guardaron los datos.', 'ok');
          AL.tras();
        },
      }],
    });
  },
};

/* =============================== EVENTOS ================================== */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-al]');
  if (!b) return;
  const a = b.dataset.al, id = b.dataset.id;
  const venta = () => AL.f && AL.f.d && AL.f.d.ventas.filter((v) => v.id === id)[0];
  if (a === 'abrir') go('alumno', { id });
  else if (a === 'nuevo') abrirNuevoAlumnoVenta();
  else if (a === 'mas') { AL.n += 30; Router.render({ conservarScroll: true }); }
  else if (a === 'filtro') { AL.filtro = b.dataset.f; AL.n = 30; Router.render({ conservarScroll: true }); }
  else if (a === 'reintentar-lista') { AL.listaErr = ''; Router.render({ conservarScroll: true }); }
  else if (a === 'reintentar-ficha') { if (AL.f) AL.f.err = ''; Router.render({ conservarScroll: true }); }
  else if (a === 'editar') AL.editar();
  else if (a === 'nuevav') { if (AL.f && AL.f.d) abrirNuevoAlumnoVenta({ idAlumno: AL.f.id }); }
  else if (a === 'cita') abrirCita(id);
  else if (a === 'agendar') { const v = venta(); if (v) abrirNuevaCita({ idAlumno: v.idAlumno, idVenta: v.id }); }
  else if (a === 'pagar') { if (typeof abrirRegistrarPago === 'function') abrirRegistrarPago({ idVenta: id }); else toast('Disponible pronto', 'info'); }
  else if (a === 'editv') { const v = venta(); if (v) abrirEditarVenta(v); }
  else if (a === 'anular') { const v = venta(); if (v) anularVenta(v); }
});
document.addEventListener('input', (e) => {
  const el = e.target.closest ? e.target.closest('[data-al-in="q"]') : null;
  if (!el || !AL.lista) return;
  AL.q = el.value; AL.n = 30;
  const r = document.getElementById('alRes');
  if (r) r.innerHTML = AL.resultados();
});

/** Abre la ficha del alumno. */
function abrirAlumno(id) { if (id) go('alumno', { id: String(id) }); }

registerView('alumnos', { titulo: 'Alumnos', icono: 'users', render(el) { AL.renderLista(el); } });
registerView('alumno', {
  titulo: 'Alumno', seccion: 'alumnos',
  subtitulo: (p) => (AL.f && AL.f.id === p.id && AL.f.d ? AL.f.d.alumno.nombre : ''),
  render(el, p) { AL.renderFicha(el, String(p.id || '')); },
});

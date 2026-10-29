'use strict';
/* Pantalla Hoy (pestañas Día / Semana), la lista de avisos de la campana y los recordatorios de clases próximas.
 * Los cálculos de alertas viven en alerts.js (puro); aquí solo se pinta y se marcan las clases como dadas / no presentadas. */

const Hoy = {
  tab: 'dia',          // 'dia' | 'semana'
  abierta: '',         // id de la cita con los botones desplegados
  enCurso: {},         // id de cita → true mientras se guarda su estado
  avisadas: {},        // id de cita → true una vez mostrado el recordatorio de 15 min (solo en memoria)
  timer: null,

  ahora: () => ahoraMs(),
  hoy: () => Alerts.fechaDe(ahoraMs()),
  alertas: () => Alerts.calcular(S, ahoraMs()),

  /** "3 de 8" solo si es seguro; si no, "8 clases" del paquete. */
  posicion(c) {
    const p = Alerts.posicion(c, S);
    if (p) return p.n + ' de ' + p.total;
    const v = S.ventas.filter((x) => x.id === c.idVenta)[0];
    return v && v.citas ? v.citas + ' clases' : '';
  },

  /** Ajusta localmente el avance de la venta cuando una cita pasa de Programada a otro estado (y al revés con signo -1). */
  moverAvance(c, consume, signo) {
    const v = S.ventas.filter((x) => x.id === c.idVenta)[0];
    if (!v || !v.avance) return;
    const a = v.avance;
    a.agendadas -= signo;
    if (consume) {
      a.consumidas += signo;
      a.horasUsadas = Calc.round2((a.horasUsadas || 0) + signo * (Number(c.minutos) || 0) / 60);
      if (a.horasRestantes !== null && a.horasRestantes !== undefined) a.horasRestantes = Calc.round2(a.horasRestantes - signo * (Number(c.minutos) || 0) / 60);
    }
    a.libres = v.citas - a.consumidas - a.agendadas;
  },

  /** Busca la cita en lo cargado al arranque o en lo que trajo la agenda. */
  citaPorId(id) {
    return S.citas.filter((x) => x.id === id)[0] || (typeof Agenda !== 'undefined' ? Agenda.buscar(id) : null);
  },

  /** Marca la clase. Optimista: la tarjeta cambia al instante y vuelve atrás si el servidor falla. */
  async marcar(id, estado, descontar) {
    const c = Hoy.citaPorId(id);
    if (!c || c.estado !== 'Programada' || Hoy.enCurso[id]) return;
    Hoy.enCurso[id] = true;
    const antes = { estado: c.estado, descuenta: c.descuenta };
    const consume = estado === 'Dada' || descontar === true;
    c.estado = estado;
    c.descuenta = estado === 'Dada' ? true : descontar === true;
    Hoy.moverAvance(c, consume, 1);
    if (Hoy.abierta === id) Hoy.abierta = '';
    Router.render({ conservarScroll: true });
    try {
      const payload = { id, estado };
      if (estado === 'No se presentó') payload.descontar = descontar;
      const r = await api('citas.mark', payload);
      if (r && r.id === id) Object.assign(c, r);
      toast(estado === 'Dada' ? 'Clase marcada como dada.' : 'Se guardó que no se presentó.', 'ok');
      delete Hoy.enCurso[id];
      refresh(['ventas', 'citas', 'caja']).catch(() => {}); // datos oficiales; si falla se queda lo local
    } catch (e) {
      delete Hoy.enCurso[id];
      Hoy.moverAvance(c, consume, -1);
      c.estado = antes.estado;
      c.descuenta = antes.descuenta;
      toast(e.code === 'NETWORK_ESCRITURA' ? 'No se pudo confirmar el cambio. Revisa la conexión y mira la clase antes de repetirlo.' : (e.message || MENSAJES.INTERNAL), 'error');
      Router.render({ conservarScroll: true });
    }
  },

  /** Pregunta si la clase de un alumno que no se presentó se descuenta. */
  preguntarNoPresento(id) {
    const c = Hoy.citaPorId(id);
    if (!c) return;
    const m = modal({
      titulo: 'No se presentó',
      cuerpoHtml: '<p class="modal-texto">' + esc(c.alumno) + ' no llegó a la clase de las ' + esc(c.hora) + '. ¿Se le descuenta esta clase de su paquete?</p>' +
        '<div class="decision">' +
        '<button type="button" class="btn btn-primario btn-grande" data-desc="1">Descontar la clase</button>' +
        '<button type="button" class="btn btn-suave btn-grande" data-desc="0">No descontar</button></div>',
    });
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-desc]');
      if (!b) return;
      m.cerrar();
      Hoy.marcar(id, 'No se presentó', b.dataset.desc === '1');
    });
  },

  reagendar(id) {
    if (typeof abrirCita === 'function') abrirCita(id, { reagendar: true });
    else toast('Disponible pronto', 'info');
  },

  /** Abre lo que señala una alerta (alumno, o la cita en Hoy). */
  abrirRef(a) {
    if (hojaActual) hojaActual.cerrar();
    if (a.ref && a.ref.ruta === 'alumno') {
      if (typeof abrirAlumno === 'function') abrirAlumno(a.ref.params.id);
      else toast('Disponible pronto', 'info');
      return;
    }
    if (a.idCita) { Hoy.abierta = a.idCita; Hoy.tab = a.fecha <= Hoy.hoy() ? 'dia' : 'semana'; go('hoy'); }
  },

  /* ------------------------------ pintado ------------------------------ */
  cita(c, tipos, hoy, ahoraMs_) {
    const t = tipos[c.id] || '';
    const programada = c.estado === 'Programada';
    const empezo = Calc.citaMs(c.fecha, c.hora) <= ahoraMs_;
    const abierta = Hoy.abierta === c.id;
    const pos = Hoy.posicion(c);
    const estado = c.estado === 'Dada' ? '<span class="chip chip-verde">Dada</span>'
      : c.estado === 'No se presentó' ? '<span class="chip chip-ambar">No se presentó</span>'
        : t === 'sin_confirmar' ? '<span class="chip chip-rojo">Sin confirmar</span>'
          : t === 'proxima' ? '<span class="chip chip-azul">Pronto</span>' : '';
    let acciones = '';
    if (programada && abierta) {
      acciones = '<div class="cita-acciones">' +
        (empezo ? '<button type="button" class="btn btn-primario" data-hoy="dada" data-id="' + esc(c.id) + '">' + icon('circleCheck', 18) + 'Dada</button>' +
          '<button type="button" class="btn btn-suave" data-hoy="nopresento" data-id="' + esc(c.id) + '">' + icon('circleX', 18) + 'No se presentó</button>' : '') +
        '<button type="button" class="btn btn-suave" data-hoy="reagendar" data-id="' + esc(c.id) + '">' + icon('cal', 18) + 'Reagendar</button></div>';
    }
    return '<div class="cita' + (t ? ' cita-' + esc(t) : '') + (c.estado !== 'Programada' ? ' cita-cerrada' : '') + (Hoy.enCurso[c.id] ? ' cita-guardando' : '') + '">' +
      '<button type="button" class="cita-cab" data-hoy="cita" data-id="' + esc(c.id) + '"' + (programada ? ' aria-expanded="' + abierta + '"' : '') + '>' +
      '<span class="cita-hora">' + esc(c.hora) + ((c.fecha !== hoy && Hoy.tab === 'dia') || c.fecha < Calc.weekRange(hoy).start ? '<small>' + esc(fechaCorta(c.fecha)) + '</small>' : '') + '</span>' +
      '<span class="cita-txt"><b>' + esc(c.alumno || 'Alumno') + '</b><small>' + esc(c.instructor || 'Sin instructor') + ' · ' + esc(c.minutos) + ' min' + '</small></span>' +
      '<span class="cita-der">' + (pos ? '<span class="chip">' + esc(pos) + '</span>' : '') + estado + '</span></button>' + acciones + '</div>';
  },

  alerta(a, act, i) {
    const ic = { vencida: 'alert', por_vencer: 'clock', pocas_clases: 'wheel', sin_confirmar: 'alert', proxima: 'clock', cita: 'cal' }[a.tipo] || 'info';
    return '<button type="button" class="alerta alerta-' + esc(a.nivel) + '" data-hoy="' + act + '" data-i="' + i + '">' +
      '<span class="alerta-ic">' + icon(ic, 20) + '</span><span class="alerta-txt"><b>' + esc(a.titulo) + '</b><small>' + esc(a.detalle) + '</small></span>' +
      icon('right', 18) + '</button>';
  },

  kpi(ic, color, valor, txt) {
    return '<div class="kpi"><span class="kpi-ic kpi-ic-' + color + '">' + icon(ic, 22) + '</span><div><b>' + esc(valor) + '</b><small>' + esc(txt) + '</small></div></div>';
  },

  vacio(ic, titulo, txt) { return '<div class="vacio">' + icon(ic, 28) + '<b>' + esc(titulo) + '</b><p>' + esc(txt) + '</p></div>'; },

  render(el) {
    const ahora = Hoy.ahora(), hoy = Hoy.hoy();
    const al = Hoy.alertas();
    const sem = Calc.weekRange(hoy);
    const tipos = {};
    al.semana.concat(al.dia).forEach((a) => { if (a.idCita) tipos[a.idCita] = a.tipo; });

    const vivas = S.citas.filter((c) => c.estado !== 'Cancelada');
    const deHoy = vivas.filter((c) => c.fecha === hoy);
    const dadas = deHoy.filter((c) => c.estado === 'Dada').length;
    const porCobrar = al.dia.reduce((n, a) => n + (a.tipo === 'vencida' || a.tipo === 'por_vencer' ? a.cuotas || 1 : 0), 0);

    let citasHtml;
    const ord = (l) => l.slice().sort((a, b) => (a.fecha + ' ' + a.hora < b.fecha + ' ' + b.hora ? -1 : a.fecha + ' ' + a.hora > b.fecha + ' ' + b.hora ? 1 : 0));
    if (Hoy.tab === 'dia') {
      const l = ord(vivas.filter((c) => c.fecha === hoy || (c.fecha < hoy && c.estado === 'Programada')));
      citasHtml = '<section class="card"><h2 class="card-titulo">Clases de hoy</h2>' + (l.length ? '<div class="citas">' + l.map((c) => Hoy.cita(c, tipos, hoy, ahora)).join('') + '</div>'
        : Hoy.vacio('cal', 'Sin clases hoy', 'Las citas agendadas aparecerán aquí.')) + '</section>';
    } else {
      const l = ord(vivas.filter((c) => c.fecha >= sem.start && c.fecha <= sem.end));
      const previas = ord(vivas.filter((c) => c.fecha < sem.start && c.estado === 'Programada'));
      let dias = previas.length ? '<section class="card"><h2 class="card-titulo">Sin confirmar de semanas anteriores</h2><div class="citas">' +
        previas.map((c) => Hoy.cita(c, tipos, hoy, ahora)).join('') + '</div></section>' : '';
      for (let i = 0; i < 7; i++) {
        const f = Calc.addDays(sem.start, i);
        const delDia = l.filter((c) => c.fecha === f);
        dias += '<section class="card"><h2 class="card-titulo">' + esc(cap(fechaCorta(f))) + (f === hoy ? ' · hoy' : '') + '</h2>' +
          (delDia.length ? '<div class="citas">' + delDia.map((c) => Hoy.cita(c, tipos, hoy, ahora)).join('') + '</div>' : '<p class="dia-vacio">Sin clases</p>') + '</section>';
      }
      citasHtml = dias;
    }

    const lista = Hoy.tab === 'dia' ? al.dia : al.semana;
    const dinero = lista.filter((a) => a.tipo === 'vencida' || a.tipo === 'por_vencer');
    const alumnos = lista.filter((a) => a.tipo === 'pocas_clases');
    Hoy.lista = dinero.concat(alumnos); // los toques se resuelven por posición en esta lista
    const bloque = (titulo, l, vacio) => '<section class="card"><h2 class="card-titulo">' + titulo + '</h2>' +
      (l.length ? '<div class="alertas">' + l.map((a) => Hoy.alerta(a, 'alerta', Hoy.lista.indexOf(a))).join('') + '</div>' : '<p class="dia-vacio">' + esc(vacio) + '</p>') + '</section>';

    el.innerHTML = '<div class="hoy-tabs"><div class="seg" role="tablist" aria-label="Periodo">' +
      '<button type="button" role="tab" aria-selected="' + (Hoy.tab === 'dia') + '" class="' + (Hoy.tab === 'dia' ? 'activo' : '') + '" data-hoy="tab" data-tab="dia">Día</button>' +
      '<button type="button" role="tab" aria-selected="' + (Hoy.tab === 'semana') + '" class="' + (Hoy.tab === 'semana' ? 'activo' : '') + '" data-hoy="tab" data-tab="semana">Semana</button></div></div>' +
      '<div class="kpis">' + Hoy.kpi('cal', 'azul', deHoy.length, 'Citas hoy') + Hoy.kpi('circleCheck', 'verde', dadas, 'Clases dadas hoy') +
      Hoy.kpi('alert', 'ambar', porCobrar, 'Cuotas por cobrar') + (S.caja ? Hoy.kpi('cash', 'violeta', money(S.caja.total), 'Caja del día') : '') + '</div>' +
      citasHtml +
      bloque('Dinero', dinero, 'No hay cuotas vencidas ni por vencer.') +
      bloque('Alumnos', alumnos, 'Ningún alumno está por terminar su paquete.');
    Hoy.recordar(al);
  },

  /* --------------------------- recordatorios --------------------------- */
  /** Toast 15 min antes de cada cita (una vez por cita mientras la página sigue abierta). */
  recordar(al) {
    al = al || Hoy.alertas();
    const ahora = Hoy.ahora();
    al.dia.forEach((a) => {
      if (a.tipo !== 'proxima' || !a.idCita || Hoy.avisadas[a.idCita]) return;
      const min = Math.ceil((Calc.citaMs(a.fecha, a.hora) - ahora) / 6e4);
      if (min > 15) return;
      Hoy.avisadas[a.idCita] = true;
      toast('A las ' + a.hora + ': ' + a.titulo + (min > 0 ? ' (en ' + min + ' min)' : ' (ahora)'), 'aviso');
    });
  },

  tic() {
    if (!S.user) return;
    Hoy.recordar();
    if (typeof Nav !== 'undefined') Nav.actualizarCampana();
    // Repinta Hoy para que las clases pasen a "sin confirmar" sin recargar, salvo que haya algo abierto encima.
    if (S.ruta.nombre === 'hoy' && !Capas.pila.length && !Object.keys(Hoy.enCurso).length && document.visibilityState !== 'hidden') Router.render({ conservarScroll: true });
  },
  iniciarReloj() { if (!Hoy.timer) Hoy.timer = setInterval(Hoy.tic, 60000); },
};

/* Toques dentro de Hoy y de la hoja de avisos (delegación). */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-hoy]');
  if (!b) return;
  const a = b.dataset.hoy, id = b.dataset.id;
  if (a === 'tab') { Hoy.tab = b.dataset.tab === 'semana' ? 'semana' : 'dia'; Router.render({ conservarScroll: true }); }
  else if (a === 'cita') { const c = S.citas.filter((x) => x.id === id)[0]; if (c && c.estado === 'Programada') { Hoy.abierta = Hoy.abierta === id ? '' : id; Router.render({ conservarScroll: true }); } }
  else if (a === 'dada') Hoy.marcar(id, 'Dada');
  else if (a === 'nopresento') Hoy.preguntarNoPresento(id);
  else if (a === 'reagendar') Hoy.reagendar(id);
  else if (a === 'alerta') { const x = Hoy.lista && Hoy.lista[+b.dataset.i]; if (x) Hoy.abrirRef(x); }
  else if (a === 'alerta-hoja') { const x = Hoy.listaHoja && Hoy.listaHoja[+b.dataset.i]; if (x) Hoy.abrirRef(x); }
});

/** La campana: la misma lista de avisos del día, en una hoja. */
function abrirAlertas() {
  const al = Hoy.alertas();
  Hoy.listaHoja = al.dia;
  const html = al.dia.length
    ? '<div class="alertas">' + al.dia.map((a, i) => Hoy.alerta(a, 'alerta-hoja', i)).join('') + '</div>'
    : Hoy.vacio('circleCheck', 'Todo en orden', 'No hay avisos por ahora.');
  hoja(html, { titulo: 'Avisos de hoy' });
}

registerView('hoy', {
  titulo: 'Hoy', icono: 'home',
  subtitulo: () => cap(fechaLarga(Hoy.hoy())),
  render(el) { Hoy.iniciarReloj(); Hoy.render(el); },
});

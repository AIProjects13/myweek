'use strict';
/* Agenda (Mes / Semana / Día / Lista), formulario de nueva cita y hoja de detalle de la cita (reagendar, cancelar, historial).
 * Marcar "Dada" / "No se presentó" reutiliza Hoy.marcar y Hoy.preguntarNoPresento (views-hoy.js). */

const PX_MIN = 1.2; // alto en píxeles de un minuto en la línea de tiempo
const norm_ = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const horaTxt_ = (m) => Calc.pad(Math.floor(m / 60)) + ':' + Calc.pad(m % 60);
const finTxt_ = (c) => horaTxt_(Calc.finCita(c.hora, c.minutos));
const diasAtencion_ = () => String(S.cfg.DIAS_ATENCION === undefined ? '1,2,3,4,5,6' : S.cfg.DIAS_ATENCION).split(',').map((x) => Number(x.trim())).filter((n) => n >= 0 && n <= 6);
const horaIni_ = () => S.cfg.HORA_INICIO || '06:00';
const horaFin_ = () => S.cfg.HORA_FIN || '20:00';
const colorIns_ = (id) => { const i = S.instructores.findIndex((x) => String(x.id) === String(id)); return 'ci' + ((i < 0 ? 0 : i) % 6); };
const mesTitulo_ = (f) => { const p = partesFecha(f); return p ? cap(MESES[p.m - 1]) + ' ' + p.y : ''; };

/** Hoja con dueño: si ya hay una hoja de este dueño solo cambia su contenido (no se pierde el foco ni el desplazamiento). */
function hojaPintar_(dueno, html, titulo, alCerrar) {
  if (hojaActual && hojaActual.owner === dueno) {
    hojaActual.panel.querySelector('.hoja-cuerpo').innerHTML = html;
    const t = hojaActual.panel.querySelector('#hojaTitulo');
    if (t) t.textContent = titulo;
    return hojaActual;
  }
  const h = hoja(html, { titulo, alCerrar });
  h.owner = dueno;
  return h;
}

/* ================================== AGENDA ================================= */
const Agenda = {
  vistas: ['mes', 'semana', 'dia', 'lista'],
  ext: {},        // "desde|hasta" → citas traídas del servidor fuera de lo que cargó el arranque
  cargando: {},
  fallo: {},
  ins: '',        // filtro por instructor ('' = todos)
  actual: { vista: 'semana', fecha: '' },

  hoy: () => Hoy.hoy(),

  todas() {
    const vistos = {}, out = [];
    S.citas.concat([].concat.apply([], Object.keys(Agenda.ext).map((k) => Agenda.ext[k]))).forEach((c) => { if (!vistos[c.id]) { vistos[c.id] = 1; out.push(c); } });
    return out;
  },
  buscar(id) { return Agenda.todas().filter((c) => c.id === id)[0] || null; },
  gen: 0, // sube con cada limpiar(): una carga que empezó antes ya no escribe
  limpiar() { Agenda.gen++; Agenda.ext = {}; Agenda.cargando = {}; Agenda.fallo = {}; },

  /** Rango de fechas que pinta cada vista. */
  rango(vista, fecha) {
    if (vista === 'dia') return { desde: fecha, hasta: fecha };
    if (vista === 'semana') { const w = Calc.weekRange(fecha); return { desde: w.start, hasta: w.end }; }
    const m = Calc.monthRange(fecha);
    if (vista === 'lista') return { desde: m.start, hasta: m.end };
    return { desde: Calc.weekRange(m.start).start, hasta: Calc.weekRange(m.end).end };
  },
  /** Lo que trae el arranque (igual que Code.gs: semana actual o mes para Admin, hasta 60 días). */
  cobertura() {
    const hoy = Agenda.hoy(), sem = Calc.weekRange(hoy).start;
    return { desde: S.user && S.user.isAdmin ? (Calc.monthRange(hoy).start < sem ? Calc.monthRange(hoy).start : sem) : sem, hasta: Calc.addDays(hoy, 60) };
  },
  cubierto(r) {
    const c = Agenda.cobertura();
    const d = S.user && S.user.isAdmin ? r.desde : (r.desde < c.desde ? c.desde : r.desde);
    return d >= c.desde && r.hasta <= c.hasta;
  },
  paso(vista, fecha, dir) {
    if (vista === 'mes' || vista === 'lista') return Calc.addMonths(Calc.monthRange(fecha).start, dir);
    return Calc.addDays(fecha, (vista === 'semana' ? 7 : 1) * dir);
  },
  /** Recepción no ve semanas pasadas: ‹ se apaga cuando el periodo anterior queda entero antes de la semana actual. */
  puedeRetroceder(vista, fecha) {
    if (S.user && S.user.isAdmin) return true;
    const ant = Agenda.rango(vista, Agenda.paso(vista, fecha, -1));
    return ant.hasta >= Calc.weekRange(Agenda.hoy()).start;
  },
  citasDe(r, conCanceladas) {
    return Agenda.todas().filter((c) => c.fecha >= r.desde && c.fecha <= r.hasta && (conCanceladas || c.estado !== 'Cancelada') &&
      (!Agenda.ins || String(c.idInstructor) === Agenda.ins))
      .sort((a, b) => (a.fecha + ' ' + a.hora < b.fecha + ' ' + b.hora ? -1 : a.fecha + ' ' + a.hora > b.fecha + ' ' + b.hora ? 1 : 0));
  },

  titulo(vista, fecha) {
    if (vista === 'mes' || vista === 'lista') return mesTitulo_(fecha);
    if (vista === 'dia') return cap(fechaLarga(fecha));
    const w = Calc.weekRange(fecha), a = partesFecha(w.start), b = partesFecha(w.end);
    return a.d + ' ' + MESES_CORTOS[a.m - 1] + ' – ' + b.d + ' ' + MESES_CORTOS[b.m - 1] + ' ' + b.y;
  },

  chipEstado(c) {
    if (c.estado === 'Dada') return '<span class="chip chip-verde">Dada</span>';
    if (c.estado === 'No se presentó') return '<span class="chip chip-ambar">No se presentó</span>';
    if (c.estado === 'Cancelada') return '<span class="chip chip-rojo">Cancelada' + (c.descuenta ? ' · descontada' : '') + '</span>';
    return '';
  },

  /* ------------------------------- pintado -------------------------------- */
  barra(vista, fecha) {
    const ant = Agenda.puedeRetroceder(vista, fecha);
    const seg = Agenda.vistas.map((v) => '<button type="button" role="tab" aria-selected="' + (v === vista) + '" class="' + (v === vista ? 'activo' : '') + '" data-ag="vista" data-v="' + v + '">' +
      { mes: 'Mes', semana: 'Semana', dia: 'Día', lista: 'Lista' }[v] + '</button>').join('');
    const chips = '<button type="button" class="chip-ins' + (!Agenda.ins ? ' activo' : '') + '" data-ag="ins" data-id="" aria-pressed="' + !Agenda.ins + '">Todos</button>' +
      S.instructores.filter((i) => i.activo).map((i) => '<button type="button" class="chip-ins ' + colorIns_(i.id) + (Agenda.ins === String(i.id) ? ' activo' : '') + '" data-ag="ins" data-id="' + esc(i.id) + '" aria-pressed="' + (Agenda.ins === String(i.id)) + '">' +
        '<i class="ins-punto"></i>' + esc(i.nombre) + '</button>').join('');
    return '<div class="ag-barra"><div class="ag-nav">' +
      '<button type="button" class="btn-icono" data-ag="paso" data-d="-1" aria-label="Anterior"' + (ant ? '' : ' disabled') + '>' + icon('left', 20) + '</button>' +
      '<h2 class="ag-titulo">' + esc(Agenda.titulo(vista, fecha)) + '</h2>' +
      '<button type="button" class="btn-icono" data-ag="paso" data-d="1" aria-label="Siguiente">' + icon('right', 20) + '</button>' +
      '<button type="button" class="btn btn-suave" data-ag="hoy">Hoy</button></div>' +
      '<div class="ag-fila2"><div class="seg seg-ancho" role="tablist" aria-label="Vista">' + seg + '</div>' +
      '<button type="button" class="btn btn-primario ag-nueva" data-ag="nueva">' + icon('plus', 18) + 'Nueva cita</button></div>' +
      '<div class="chips-ins" role="group" aria-label="Instructor">' + chips + '</div></div>';
  },

  esqueleto() { return '<div class="esq esq-linea"></div><div class="esq esq-fila"></div><div class="esq esq-fila"></div><div class="esq esq-fila"></div>'; },

  vacio(ic, t, p) { return '<div class="vacio">' + icon(ic, 28) + '<b>' + esc(t) + '</b><p>' + esc(p) + '</p></div>'; },

  /** Fila de una cita en listas (celular y Lista). */
  fila(c, conFecha) {
    const pos = Hoy.posicion(c);
    return '<button type="button" class="cita ag-fila ' + colorIns_(c.idInstructor) + (c.estado !== 'Programada' ? ' cita-cerrada' : '') + '" data-ag="cita" data-id="' + esc(c.id) + '">' +
      '<span class="cita-hora">' + esc(c.hora) + (conFecha ? '<small>' + esc(fechaCorta(c.fecha)) + '</small>' : '') + '</span>' +
      '<span class="cita-txt"><b>' + esc(c.alumno || 'Alumno') + '</b><small>' + esc(c.instructor || 'Sin instructor') + ' · ' + esc(c.hora) + '–' + esc(finTxt_(c)) + '</small></span>' +
      '<span class="cita-der">' + (pos && c.estado === 'Programada' ? '<span class="chip">' + esc(pos) + '</span>' : '') + Agenda.chipEstado(c) + '</span></button>';
  },

  porDias(citas, dias, vacios) {
    return dias.map((f) => {
      const l = citas.filter((c) => c.fecha === f);
      if (!l.length && !vacios) return '';
      return '<section class="card ag-dia' + (f === Agenda.hoy() ? ' ag-hoy' : '') + '"><h3 class="card-titulo">' + esc(cap(fechaCorta(f))) + (f === Agenda.hoy() ? ' · hoy' : '') + '</h3>' +
        (l.length ? '<div class="citas">' + l.map((c) => Agenda.fila(c, false)).join('') + '</div>' : '<p class="dia-vacio">Sin clases</p>') + '</section>';
    }).join('');
  },

  /* Mes */
  mes(fecha, r) {
    const citas = Agenda.citasDe(r), hoy = Agenda.hoy(), m = Calc.monthRange(fecha);
    const por = {};
    citas.forEach((c) => { (por[c.fecha] = por[c.fecha] || []).push(c); });
    let h = '<div class="mes-cab">' + DIAS_CORTOS.map((d) => '<span>' + esc(d) + '</span>').join('') + '</div><div class="mes">';
    for (let f = r.desde; f <= r.hasta; f = Calc.addDays(f, 1)) {
      const l = por[f] || [], dentro = f >= m.start && f <= m.end;
      h += '<button type="button" class="mes-dia' + (f === hoy ? ' hoy' : '') + (dentro ? '' : ' fuera') + '" data-ag="dia" data-f="' + f + '" aria-label="' + esc(fechaLarga(f) + ', ' + l.length + (l.length === 1 ? ' clase' : ' clases')) + '">' +
        '<span class="mes-n">' + partesFecha(f).d + '</span>' +
        '<span class="mes-puntos">' + l.slice(0, 4).map((c) => '<i class="pt ' + colorIns_(c.idInstructor) + '"></i>').join('') + '</span>' +
        '<span class="mes-lin">' + l.slice(0, 3).map((c) => '<em class="' + colorIns_(c.idInstructor) + '">' + esc(c.hora) + ' ' + esc((c.alumno || '').split(' ')[0]) + '</em>').join('') + '</span>' +
        (l.length ? '<span class="mes-cuenta">' + l.length + '</span>' : '') + '</button>';
    }
    return h + '</div>' + (citas.length ? '' : '<p class="dia-vacio ag-nota">No hay clases en este mes.</p>');
  },

  /* Línea de tiempo (día y semana en computadora) */
  horas(citas) {
    let ini = Math.floor(Calc.finCita(horaIni_(), 0) / 60), fin = Math.ceil(Calc.finCita(horaFin_(), 0) / 60);
    citas.forEach((c) => { ini = Math.min(ini, Math.floor(Calc.finCita(c.hora, 0) / 60)); fin = Math.max(fin, Math.ceil(Math.min(Calc.finCita(c.hora, c.minutos), 1440) / 60)); });
    return { ini, fin };
  },
  /** Reparte en carriles las citas que se empalman (otro instructor a la misma hora). */
  carriles(citas) {
    const items = citas.map((c) => { const ini = Calc.finCita(c.hora, 0), fin = Calc.finCita(c.hora, c.minutos); return { c, ini, fin, efin: Math.max(fin, ini + 25) }; })
      .sort((a, b) => a.ini - b.ini || a.fin - b.fin);
    let grupo = [], finG = 0, carr = [];
    const cerrar = () => { grupo.forEach((x) => { x.n = carr.length; }); grupo = []; carr = []; };
    items.forEach((x) => {
      if (grupo.length && x.ini >= finG) cerrar();
      let l = 0;
      while (carr[l] !== undefined && carr[l] > x.ini) l++;
      carr[l] = x.efin; x.l = l; grupo.push(x);
      finG = grupo.length === 1 ? x.efin : Math.max(finG, x.efin);
    });
    cerrar();
    return items;
  },
  columna(citas, h, compacto) {
    const bl = Agenda.carriles(citas).map((x) => {
      const c = x.c;
      return '<button type="button" class="blq ' + colorIns_(c.idInstructor) + ' blq-' + (c.estado === 'Dada' ? 'dada' : c.estado === 'No se presentó' ? 'np' : 'prog') + '" data-ag="cita" data-id="' + esc(c.id) + '"' +
        ' data-t="' + ((x.ini - h.ini * 60) * PX_MIN) + '" data-a="' + ((x.efin - x.ini) * PX_MIN) + '" data-l="' + x.l + '" data-n="' + x.n + '">' +
        (compacto ? '<b>' + esc(c.hora) + ' ' + esc(c.alumno || '') + '</b><small>' + esc(c.instructor || '') + '</small>'
          : '<b>' + esc(c.alumno || 'Alumno') + '</b><small>' + esc(c.instructor || '') + ' · ' + esc(c.hora) + '–' + esc(finTxt_(c)) + '</small>') + '</button>';
    }).join('');
    return '<div class="tl-col" data-hh="' + ((h.fin - h.ini) * 60 * PX_MIN) + '">' + bl + '</div>';
  },
  gutter(h) {
    let s = '<div class="tl-gut">';
    for (let i = h.ini; i < h.fin; i++) s += '<div class="tl-h"><span>' + Calc.pad(i) + ':00</span></div>';
    return s + '</div>';
  },
  dia(fecha, r) {
    const citas = Agenda.citasDe(r), h = Agenda.horas(citas);
    return '<div class="card tl-card"><div class="tl tlg-1">' + Agenda.gutter(h) + Agenda.columna(citas, h, false) + '</div></div>' +
      (citas.length ? '' : '<p class="dia-vacio ag-nota">Sin clases este día.</p>');
  },
  semana(fecha, r) {
    const citas = Agenda.citasDe(r), hoy = Agenda.hoy(), h = Agenda.horas(citas);
    const dias = []; for (let i = 0; i < 7; i++) dias.push(Calc.addDays(r.desde, i));
    const cab = '<span></span>' + dias.map((f) => '<button type="button" class="tl-cab' + (f === hoy ? ' hoy' : '') + '" data-ag="dia" data-f="' + f + '"><small>' + esc(DIAS_CORTOS[Calc.dow(f)]) + '</small><b>' + partesFecha(f).d + '</b></button>').join('');
    const cols = dias.map((f) => Agenda.columna(citas.filter((c) => c.fecha === f), h, true)).join('');
    return '<div class="sem-cols card tl-card"><div class="tl-cabs">' + cab + '</div><div class="tl tlg-7">' + Agenda.gutter(h) + cols + '</div></div>' +
      '<div class="sem-lista">' + (citas.length ? '' : '<p class="dia-vacio ag-nota">Sin clases esta semana.</p>') + Agenda.porDias(citas, dias, true) + '</div>';
  },
  lista(fecha, r) {
    const citas = Agenda.citasDe(r, true), dias = [];
    for (let f = r.desde; f <= r.hasta; f = Calc.addDays(f, 1)) dias.push(f);
    return citas.length ? Agenda.porDias(citas, dias, false) : Agenda.vacio('cal', 'Sin clases', 'No hay clases agendadas en este mes.');
  },

  /** Las posiciones se asignan desde JS (la CSP no admite style= en el HTML). */
  posicionar(el) {
    $$('[data-hh]', el).forEach((c) => { c.style.height = c.dataset.hh + 'px'; });
    $$('[data-t]', el).forEach((b) => {
      const n = +b.dataset.n || 1, l = +b.dataset.l || 0;
      b.style.top = b.dataset.t + 'px'; b.style.height = b.dataset.a + 'px';
      b.style.left = (l * 100 / n) + '%'; b.style.width = (100 / n) + '%';
    });
    $$('.tl-h', el).forEach((x) => { x.style.height = (60 * PX_MIN) + 'px'; });
  },

  render(el, params) {
    let vista = params.vista;
    if (Agenda.vistas.indexOf(vista) < 0) vista = store.get('ae-ag-vista');
    if (Agenda.vistas.indexOf(vista) < 0) vista = 'semana';
    store.set('ae-ag-vista', vista);
    const hoy = Agenda.hoy();
    let fecha = partesFecha(params.fecha) ? params.fecha : hoy;
    Agenda.actual = { vista, fecha };
    const r = Agenda.rango(vista, fecha);
    const key = r.desde + '|' + r.hasta;
    let cuerpo;
    if (!Agenda.cubierto(r) && !Agenda.ext[key]) {
      if (Agenda.fallo[key]) {
        cuerpo = Agenda.vacio('alert', 'No se pudo cargar', Agenda.fallo[key]) + '<div class="ag-reint"><button type="button" class="btn btn-suave" data-ag="reintentar">Reintentar</button></div>';
      } else {
        cuerpo = Agenda.esqueleto();
        if (!Agenda.cargando[key]) {
          Agenda.cargando[key] = true;
          const gen = Agenda.gen;
          api('citas.list', { desde: r.desde, hasta: r.hasta }).then((l) => { if (gen === Agenda.gen) Agenda.ext[key] = l; })
            .catch((e) => { if (gen === Agenda.gen) Agenda.fallo[key] = e.message || MENSAJES.INTERNAL; })
            .then(() => { if (gen !== Agenda.gen) return; delete Agenda.cargando[key]; if (S.ruta.nombre === 'agenda') Router.render({ conservarScroll: true }); });
        }
      }
    } else {
      cuerpo = vista === 'mes' ? Agenda.mes(fecha, r) : vista === 'semana' ? Agenda.semana(fecha, r) : vista === 'dia' ? Agenda.dia(fecha, r) : Agenda.lista(fecha, r);
    }
    el.innerHTML = Agenda.barra(vista, fecha) + '<div class="ag-cuerpo ag-' + vista + '">' + cuerpo + '</div>';
    Agenda.posicionar(el);
  },
};


/* ================================= EVENTOS ================================= */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ag]');
  if (!b) return;
  const a = b.dataset.ag, id = b.dataset.id;
  const A = Agenda.actual;
  if (a === 'cita') abrirCita(id);
  else if (a === 'dia') go('agenda', { vista: 'dia', fecha: b.dataset.f });
  else if (a === 'vista') go('agenda', { vista: b.dataset.v, fecha: A.fecha });
  else if (a === 'paso') { if (!b.disabled) go('agenda', { vista: A.vista, fecha: Agenda.paso(A.vista, A.fecha, +b.dataset.d) }); }
  else if (a === 'hoy') go('agenda', { vista: A.vista, fecha: Agenda.hoy() });
  else if (a === 'ins') { Agenda.ins = id || ''; Router.render({ conservarScroll: true }); }
  else if (a === 'nueva') abrirNuevaCita({ fecha: A.vista === 'dia' && A.fecha >= Agenda.hoy() ? A.fecha : undefined });
  else if (a === 'reintentar') { Agenda.fallo = {}; Router.render({ conservarScroll: true }); }
});

registerView('agenda', {
  titulo: 'Agenda', icono: 'cal',
  render(el, params) { Agenda.render(el, params); },
});

'use strict';
/* Recibos (administrador): todos los pagos de un rango, con búsqueda (número, alumno, a nombre de), filtro por método,
 * páginas de 25, ver el recibo y anular con motivo. La búsqueda y el filtro se hacen aquí sobre el rango ya cargado. */

const Rc = {
  POR_PAGINA: 25,
  desde: '', hasta: '', q: '', metodo: '', pag: 0,
  lista: null, err: '', cargando: false, gen: 0, abriendo: false,

  iniciar() {
    if (Rc.desde) return;
    const m = Calc.monthRange(Hoy.hoy());
    Rc.desde = m.start; Rc.hasta = m.end;
  },
  cargar() {
    if (Rc.hasta < Rc.desde) { Rc.err = 'La fecha final es anterior a la inicial.'; return; }
    const gen = ++Rc.gen;
    Rc.cargando = true; Rc.err = ''; Rc.lista = null;
    api('pagos.list', { desde: Rc.desde, hasta: Rc.hasta })
      .then((d) => { if (gen === Rc.gen) Rc.lista = d.slice().reverse(); }) // el servidor ordena de más antiguo a más reciente
      .catch((e) => { if (gen === Rc.gen) Rc.err = e.message || MENSAJES.INTERNAL; })
      .then(() => { if (gen === Rc.gen) { Rc.cargando = false; if (S.ruta.nombre === 'recibos') Router.render({ conservarScroll: true }); } });
  },
  filtrados() {
    const q = norm_(Rc.q).trim();
    return (Rc.lista || []).filter((p) => (!Rc.metodo || p.metodo === Rc.metodo) &&
      (!q || norm_(p.reciboNo).indexOf(q) >= 0 || norm_(p.alumno).indexOf(q) >= 0 || norm_(p.aNombreDe).indexOf(q) >= 0));
  },

  fila(p) {
    const nom = p.alumno || p.aNombreDe || 'Alumno';
    return '<div class="rc-item"><button type="button" class="cb-fila' + (p.anulado ? ' cb-anulado' : '') + '" data-rc="ver" data-id="' + esc(p.id) + '" data-v="' + esc(p.idVenta) + '">' +
      '<span class="av" aria-hidden="true">' + esc(iniciales(nom)) + '</span>' +
      '<span class="al-txt"><b>' + esc(nom) + '</b><small>' + esc(p.reciboNo) + ' · ' + esc(p.metodo) + ' · ' + esc(fechaCorta(p.fechaPago)) +
      (p.aNombreDe && p.aNombreDe !== nom ? ' · a nombre de ' + esc(p.aNombreDe) : '') + '</small></span>' +
      '<span class="cb-der"><b>' + esc(money(p.monto)) + '</b>' + (p.anulado ? '<span class="chip chip-rojo">Anulado</span>' : '') + '</span></button>' +
      (p.anulado ? '' : '<button type="button" class="btn-icono" data-rc="anular" data-id="' + esc(p.id) + '" aria-label="Anular recibo ' + esc(p.reciboNo) + '">' + icon('trash', 20) + '</button>') + '</div>';
  },
  /** Solo la parte que cambia al escribir: contador, lista y páginas. */
  cuerpo() {
    if (Rc.err) return '<div class="vacio">' + icon('alert', 28) + '<b>No se pudo cargar</b><p>' + esc(Rc.err) + '</p><button type="button" class="btn btn-suave" data-rc="reintentar">Reintentar</button></div>';
    if (!Rc.lista) return '<div class="esq esq-fila"></div><div class="esq esq-fila"></div><div class="esq esq-fila"></div>';
    const l = Rc.filtrados(), n = Math.max(1, Math.ceil(l.length / Rc.POR_PAGINA));
    if (Rc.pag >= n) Rc.pag = n - 1;
    const vigentes = l.filter((p) => !p.anulado);
    const total = vigentes.reduce((s, p) => s + Dinero.centavos(p.monto), 0);
    const pagina = l.slice(Rc.pag * Rc.POR_PAGINA, (Rc.pag + 1) * Rc.POR_PAGINA);
    return '<p class="ayuda rc-resumen">' + esc(l.length + (l.length === 1 ? ' recibo' : ' recibos') + ' · vigentes: ' + money(total / 100)) + '</p>' +
      (pagina.length ? '<div class="al-lista">' + pagina.map(Rc.fila).join('') + '</div>' : Hoy.vacio('receipt', 'Sin recibos', 'No hay recibos con esos filtros en este rango.')) +
      (n > 1 ? '<div class="rc-pags"><button type="button" class="btn btn-suave" data-rc="pag" data-d="-1"' + (Rc.pag === 0 ? ' disabled' : '') + ' aria-label="Página anterior">' + icon('left', 18) + '</button>' +
        '<span aria-live="polite">Página ' + (Rc.pag + 1) + ' de ' + n + '</span>' +
        '<button type="button" class="btn btn-suave" data-rc="pag" data-d="1"' + (Rc.pag >= n - 1 ? ' disabled' : '') + ' aria-label="Página siguiente">' + icon('right', 18) + '</button></div>' : '');
  },
  pintarCuerpo() { const c = document.getElementById('rcCuerpo'); if (c) c.innerHTML = Rc.cuerpo(); },

  render(el) {
    Rc.iniciar();
    if (el.classList.contains('entra') || (!Rc.lista && !Rc.cargando && !Rc.err)) Rc.cargar();
    el.innerHTML = '<div class="rc-filtros"><div class="campo rc-buscar"><label for="rcQ" class="solo-lector">Buscar</label>' +
      '<input id="rcQ" class="input" type="search" placeholder="Buscar por número, alumno o a nombre de" autocomplete="off" data-rc-in="q" value="' + esc(Rc.q) + '"></div>' +
      '<div class="cb-fechas"><div class="campo"><label for="rcDesde">Desde</label><input id="rcDesde" class="input" type="date" data-rc-in="desde" value="' + esc(Rc.desde) + '"></div>' +
      '<div class="campo"><label for="rcHasta">Hasta</label><input id="rcHasta" class="input" type="date" data-rc-in="hasta" value="' + esc(Rc.hasta) + '"></div></div></div>' +
      '<div class="chips-ins rc-metodos" role="group" aria-label="Método de pago">' +
      [['', 'Todos']].concat(Calc.METODOS.map((m) => [m, m])).map((m) => '<button type="button" class="chip-ins' + (Rc.metodo === m[0] ? ' activo' : '') + '" data-rc="metodo" data-m="' + esc(m[0]) + '" aria-pressed="' + (Rc.metodo === m[0]) + '">' + esc(m[1]) + '</button>').join('') + '</div>' +
      '<div id="rcCuerpo">' + Rc.cuerpo() + '</div>';
  },

  async ver(id, idVenta) {
    if (Rc.abriendo) return;
    Rc.abriendo = true;
    try { Recibo.ver(await api('pagos.receipt', { id }), id, { idVenta }); }
    catch (e) { toast(e.message || MENSAJES.INTERNAL, 'error'); }
    finally { Rc.abriendo = false; }
  },

  anular(id) {
    const p = (Rc.lista || []).filter((x) => x.id === id)[0];
    if (!p) return;
    modal({
      titulo: '¿Anular el recibo ' + p.reciboNo + '?',
      cuerpoHtml: '<p class="modal-texto">Se anula el pago de ' + esc(money(p.monto)) + ' de ' + esc(p.alumno || p.aNombreDe) + '. La cuota vuelve a quedar pendiente y esto no se puede deshacer.</p>' +
        '<div class="campo"><label for="rcMotivo">Motivo (obligatorio)</label><textarea id="rcMotivo" class="input" rows="3" maxlength="300"></textarea></div>' +
        '<p id="rcMotivoErr" class="aviso aviso-error" role="alert" hidden></p>',
      acciones: [
        { texto: 'No anular', estilo: 'suave' },
        { texto: 'Sí, anular recibo', estilo: 'peligro', async accion() {
          const motivo = document.getElementById('rcMotivo').value.trim(), err = document.getElementById('rcMotivoErr');
          const mostrar = (t) => { err.hidden = !t; err.textContent = t; };
          if (!motivo) { mostrar('Escribe el motivo de la anulación.'); return false; }
          try {
            const r = await api('pagos.void', { id, motivo });
            Rc.lista = Rc.lista.map((x) => (x.id === id ? Object.assign({}, x, r) : x));
            toast('Recibo anulado.', 'ok');
            AL.tras(['ventas', 'pagosSemana', 'caja']); // repinta; la lista local ya quedó actualizada
          } catch (e) {
            if (e.code === 'CONFLICT') { Rc.cargar(); Router.render({ conservarScroll: true }); } // ya estaba anulado: se muestra al día
            mostrar(e.message || MENSAJES.INTERNAL);
            return e.code === 'CONFLICT' ? undefined : false;
          }
        } },
      ],
    });
  },
};

document.addEventListener('click', (e) => {
  const b = e.target.closest ? e.target.closest('[data-rc]') : null;
  if (!b) return;
  const a = b.dataset.rc;
  if (a === 'ver') Rc.ver(b.dataset.id, b.dataset.v);
  else if (a === 'anular') Rc.anular(b.dataset.id);
  else if (a === 'metodo') { Rc.metodo = b.dataset.m; Rc.pag = 0; Router.render({ conservarScroll: true }); }
  else if (a === 'pag') { Rc.pag = Math.max(0, Rc.pag + Number(b.dataset.d)); Rc.pintarCuerpo(); }
  else if (a === 'reintentar') { Rc.err = ''; Rc.cargar(); Router.render({ conservarScroll: true }); }
});
document.addEventListener('input', (e) => {
  const el = e.target.closest ? e.target.closest('[data-rc-in="q"]') : null;
  if (el) { Rc.q = el.value; Rc.pag = 0; Rc.pintarCuerpo(); }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest ? e.target.closest('[data-rc-in="desde"],[data-rc-in="hasta"]') : null;
  if (!el || !el.value) return;
  Rc[el.dataset.rcIn] = el.value; Rc.pag = 0;
  Rc.cargar();
  Router.render({ conservarScroll: true });
});

registerView('recibos', { titulo: 'Recibos', icono: 'receipt', soloAdmin: true, render: (el) => Rc.render(el) });

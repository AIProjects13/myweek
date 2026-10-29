'use strict';
/* Registrar un pago: alumno/venta → cuota → monto → método → referencia → a nombre de → Guardar → abre el recibo.
 * abrirRegistrarPago({idVenta?, idCuota?}) lo usan la ficha del alumno, Cobros y el botón "+". Usa Dinero (dinero.js) y Recibo. */

const METODOS_PAGO = [['Efectivo', 'cash'], ['Tarjeta', 'card'], ['Transferencia', 'phone'], ['Depósito', 'wallet']];
const MSG_INCIERTO = 'No sabemos si el pago se guardó. Revisa los pagos de la semana antes de repetir.';

const FP = {
  s: null,

  /** Ventas activas a las que todavía les falta pagar alguna cuota. */
  ventas: () => S.ventas.filter((v) => !v.anulada && v.cuotas.some((q) => Dinero.pendiente(q) > 0)),
  nombre: (v) => (S.alumnos.filter((a) => a.id === v.idAlumno)[0] || {}).nombre || v.aNombreDe || 'Alumno',
  venta: () => FP.s && S.ventas.filter((v) => v.id === FP.s.idVenta)[0],
  cuotas: (v) => v.cuotas.slice().sort((a, b) => a.numero - b.numero).filter((q) => Dinero.pendiente(q) > 0),
  cuota() { const v = FP.venta(); return v && v.cuotas.filter((q) => q.id === FP.s.idCuota)[0]; },

  abrir(o) {
    o = o || {};
    FP.s = { idVenta: '', idCuota: '', q: '', monto: '', metodo: 'Efectivo', ref: '', nombre: '', err: '', guardando: false, incierto: false };
    if (o.idVenta) {
      const v = S.ventas.filter((x) => x.id === o.idVenta)[0];
      if (v && !v.anulada && FP.cuotas(v).length) FP.elegirVenta(v, o.idCuota);
      else toast('Esa venta no tiene cuotas pendientes.', 'info');
    }
    FP.pintar();
  },
  elegirVenta(v, idCuota) {
    const s = FP.s, cs = FP.cuotas(v);
    s.idVenta = v.id; s.nombre = v.aNombreDe || FP.nombre(v); s.err = '';
    FP.elegirCuota((cs.filter((q) => q.id === idCuota)[0] || cs[0]).id);
  },
  elegirCuota(id) {
    const q = FP.venta().cuotas.filter((x) => x.id === id)[0];
    FP.s.idCuota = id; FP.s.monto = Dinero.aTexto(Dinero.pendiente(q)); FP.s.err = '';
  },
  lectura() { const q = FP.cuota(); return Dinero.parseMonto(FP.s.monto, q ? Dinero.pendiente(q) : 0); },
  valido() { const s = FP.s; return !!(FP.venta() && FP.cuota() && FP.lectura().ok && s.nombre.trim() && !s.guardando && !s.incierto); },

  /* ------------------------------ pintado ------------------------------ */
  resultados() {
    const q = norm_(FP.s.q).trim();
    const l = FP.ventas().filter((v) => !q || norm_(FP.nombre(v)).indexOf(q) >= 0 || norm_(v.aNombreDe).indexOf(q) >= 0).slice(0, 12);
    if (!l.length) return '<p class="dia-vacio">' + (FP.ventas().length ? 'Ningún alumno coincide con la búsqueda.' : 'No hay ventas con cuotas pendientes.') + '</p>';
    return '<div class="opciones">' + l.map((v) => '<button type="button" class="opcion" data-fp="venta" data-id="' + esc(v.id) + '"><span><b>' + esc(FP.nombre(v)) + '</b>' +
      '<small>' + esc(v.planNombre) + ' · saldo ' + esc(money(v.estado.saldo)) + '</small></span>' + chipCobro_(v.estado) + '</button>').join('') + '</div>';
  },
  pasoVenta() {
    return '<section class="paso"><h3>¿Quién paga?</h3><div class="campo"><label for="fpQ" class="solo-lector">Buscar alumno</label>' +
      '<input id="fpQ" class="input" type="search" placeholder="Buscar alumno por nombre" autocomplete="off" data-fp-in="q" value="' + esc(FP.s.q) + '"></div>' +
      '<div id="fpRes">' + FP.resultados() + '</div></section>';
  },
  montoMsg() {
    const q = FP.cuota(), r = FP.lectura();
    return r.ok ? 'Pendiente de la cuota: ' + money(Dinero.pendiente(q) / 100) : r.mensaje;
  },
  pasoPago() {
    const s = FP.s, v = FP.venta(), hoy = Hoy.hoy(), r = FP.lectura();
    const cuotas = FP.cuotas(v).map((q) => '<button type="button" class="opcion' + (q.id === s.idCuota ? ' sel' : '') + '" data-fp="cuota" data-id="' + esc(q.id) + '" aria-pressed="' + (q.id === s.idCuota) + '">' +
      '<span><b>Cuota ' + esc(q.numero) + ' de ' + v.cuotas.length + ' · falta ' + esc(money(Dinero.pendiente(q) / 100)) + '</b><small>Vence ' + esc(fechaCorta(q.vence)) +
      (q.pagado > 0 ? ' · ya pagó ' + esc(money(q.pagado)) : '') + '</small></span>' + (q.vence < hoy ? '<span class="chip chip-rojo">Vencida</span>' : '') + '</button>').join('');
    return '<section class="paso"><div class="dt-cab"><div><h3>' + esc(FP.nombre(v)) + '</h3><p class="ayuda">' + esc(v.planNombre) + ' · saldo ' + esc(money(v.estado.saldo)) + '</p></div>' +
      '<button type="button" class="btn btn-suave" data-fp="cambiar">Cambiar</button></div></section>' +
      '<section class="paso"><h3>Cuota a pagar</h3><div class="opciones">' + cuotas + '</div></section>' +
      '<section class="paso"><div class="campo"><label for="fpMonto">Monto (Q)</label><input id="fpMonto" class="input" inputmode="decimal" autocomplete="off" data-fp-in="monto" value="' + esc(s.monto) + '" aria-describedby="fpMontoMsg"></div>' +
      '<small id="fpMontoMsg" class="ayuda' + (r.ok ? '' : ' fp-mal') + '">' + esc(FP.montoMsg()) + '</small></section>' +
      '<section class="paso"><h3>Método de pago</h3><div class="dos">' + METODOS_PAGO.map((m) => '<button type="button" class="opcion fp-metodo' + (m[0] === s.metodo ? ' sel' : '') + '" data-fp="metodo" data-m="' + m[0] + '" aria-pressed="' + (m[0] === s.metodo) + '">' +
        icon(m[1], 22) + '<b>' + m[0] + '</b></button>').join('') + '</div>' +
      (s.metodo !== 'Efectivo' ? '<div class="campo"><label for="fpRef">Referencia (opcional)</label><input id="fpRef" class="input" maxlength="100" autocomplete="off" placeholder="Número de boleta o transacción" data-fp-in="ref" value="' + esc(s.ref) + '"></div>' : '') + '</section>' +
      '<section class="paso"><div class="campo"><label for="fpNom">Recibo a nombre de</label><input id="fpNom" class="input" maxlength="100" autocomplete="off" data-fp-in="nombre" value="' + esc(s.nombre) + '"></div></section>';
  },
  cuerpo() {
    const s = FP.s, v = FP.venta();
    const aviso = s.incierto
      ? '<div class="aviso aviso-error" role="alert">' + esc(MSG_INCIERTO) + '</div><div class="dt-acc"><button type="button" class="btn btn-primario" data-fp="semana">' + icon('list', 18) + 'Ver pagos de la semana</button></div>'
      : s.err ? '<div class="aviso aviso-error" role="alert">' + esc(s.err) + '</div>' : '';
    return '<div class="form-ag nv">' + (v ? FP.pasoPago() : FP.pasoVenta()) + aviso +
      '<div class="nv-pie"><button type="button" class="btn btn-suave btn-grande" data-fp="cerrar">Cancelar</button>' +
      (v ? '<button type="button" id="fpGuardar" class="btn btn-primario btn-grande" data-fp="guardar"' + (FP.valido() ? '' : ' disabled') + '>' + (s.guardando ? 'Guardando…' : 'Guardar pago') + '</button>' : '') + '</div></div>';
  },
  pintar() {
    if (!FP.s) return;
    const h = hojaPintar_(FP, FP.cuerpo(), 'Registrar pago', () => { FP.s = null; });
    h.panel.classList.add('hoja-full');
  },
  /** Escribir en un campo no repinta (se perdería el foco): solo actualiza lo que depende de él. */
  entrada(nom, el) {
    const s = FP.s;
    s[nom] = el.value; s.err = '';
    if (nom === 'q') { const r = document.getElementById('fpRes'); if (r) r.innerHTML = FP.resultados(); return; }
    if (nom === 'monto') {
      const m = document.getElementById('fpMontoMsg');
      if (m) { m.textContent = FP.montoMsg(); m.classList.toggle('fp-mal', !FP.lectura().ok); }
    }
    const b = document.getElementById('fpGuardar');
    if (b) b.disabled = !FP.valido();
  },

  async guardar() {
    const s = FP.s;
    if (!s || !FP.valido()) return;
    const m = FP.lectura(), idVenta = s.idVenta;
    s.guardando = true; s.err = ''; FP.pintar();
    try {
      const r = await api('pagos.create', {
        idVenta, idCuota: s.idCuota, monto: m.centavos / 100, metodo: s.metodo,
        referencia: s.metodo === 'Efectivo' ? '' : s.ref.trim(), aNombreDe: s.nombre.trim(),
      });
      AL.tras(['ventas', 'pagosSemana', 'caja']);
      if (FP.s !== s) { toast('Pago registrado. Su recibo está en Recibos.', 'ok'); return; } // la hoja se cerró mientras se guardaba
      FP.s = null;
      toast('Pago registrado.', 'ok');
      Recibo.ver(r.recibo, r.pago.id, { idVenta });
    } catch (e) {
      s.guardando = false;
      const incierto = e.code === 'NETWORK_ESCRITURA'; // no se sabe si se guardó: nunca se deja repetir sin revisar
      if (incierto) AL.tras(['ventas', 'pagosSemana', 'caja']);
      if (FP.s !== s) { toast(incierto ? MSG_INCIERTO : e.message || MENSAJES.INTERNAL, incierto ? 'aviso' : 'error'); return; } // hoja ya cerrada: igual se avisa
      if (incierto) { s.incierto = true; s.err = MSG_INCIERTO; }
      else s.err = e.message || MENSAJES.INTERNAL;
      FP.pintar();
    }
  },
};

/** Abre la hoja para registrar un pago. {idVenta?, idCuota?}: con venta salta directo a la cuota. */
function abrirRegistrarPago(o) { FP.abrir(o); }

document.addEventListener('click', (e) => {
  const b = e.target.closest ? e.target.closest('[data-fp]') : null;
  if (!b || !FP.s) return;
  const a = b.dataset.fp, s = FP.s;
  if (a === 'venta') { const v = S.ventas.filter((x) => x.id === b.dataset.id)[0]; if (v) { FP.elegirVenta(v); FP.pintar(); } }
  else if (a === 'cambiar') { s.idVenta = ''; s.idCuota = ''; s.err = ''; FP.pintar(); }
  else if (a === 'cuota') { FP.elegirCuota(b.dataset.id); FP.pintar(); }
  else if (a === 'metodo') { s.metodo = b.dataset.m; s.err = ''; FP.pintar(); }
  else if (a === 'guardar') FP.guardar();
  else if (a === 'semana') { if (hojaActual) hojaActual.cerrar(); go('cobros', { tab: 'semana' }); }
  else if (a === 'cerrar' && hojaActual) hojaActual.cerrar();
});
document.addEventListener('input', (e) => {
  const el = e.target.closest ? e.target.closest('[data-fp-in]') : null;
  if (el && FP.s) FP.entrada(el.dataset.fpIn, el);
});

/* Reglas puras compartidas: fechas, horarios, cuotas, avance de paquete y dinero.
 * Sin DOM ni zona del equipo: solo texto AAAA-MM-DD / HH:MM y Date.UTC.
 * El MISMO algoritmo vive en Code.gs (funciones calc*_): tests/test-calc.js comprueba que den igual.
 * Si cambias uno, cambia el otro. Zona de las citas: UTC−6 fijo (Guatemala, sin horario de verano). */
const Calc = {
  ESTADOS_CITA: ['Programada', 'Dada', 'No se presentó', 'Cancelada'],
  METODOS: ['Efectivo', 'Tarjeta', 'Transferencia', 'Depósito'],
  FORMAS_PAGO: ['Contado', 'Cuotas'],

  pad(n) { return (n < 10 ? '0' : '') + n; },
  round2(x) { return Math.round(x * 100) / 100; },

  parts(s) { return String(s).split('-').map(Number); },

  /** Días entre dos fechas AAAA-MM-DD (b − a). */
  dias(a, b) {
    const pa = Calc.parts(a), pb = Calc.parts(b);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5);
  },

  addDays(s, n) {
    const p = Calc.parts(s);
    const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.getUTCFullYear() + '-' + Calc.pad(d.getUTCMonth() + 1) + '-' + Calc.pad(d.getUTCDate());
  },

  /** Fecha + n meses; si el día no existe en ese mes cae en el último (31 ene → 28 feb). */
  addMonths(s, n) {
    const p = Calc.parts(s);
    const total = p[1] - 1 + n;
    const y = p[0] + Math.floor(total / 12);
    const m = (((total % 12) + 12) % 12) + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return y + '-' + Calc.pad(m) + '-' + Calc.pad(Math.min(p[2], last));
  },

  /** Día de la semana 0 (domingo) … 6 (sábado). */
  dow(s) {
    const p = Calc.parts(s);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  },

  /** Semana domingo–sábado que contiene la fecha. */
  weekRange(s) {
    const start = Calc.addDays(s, -Calc.dow(s));
    return { start, end: Calc.addDays(start, 6) };
  },

  monthRange(s) {
    const p = Calc.parts(s);
    const last = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
    return { start: p[0] + '-' + Calc.pad(p[1]) + '-01', end: p[0] + '-' + Calc.pad(p[1]) + '-' + Calc.pad(last) };
  },

  /** Instante (ms epoch) de una cita; la hora se interpreta en UTC−6. */
  citaMs(fecha, hora) {
    const p = Calc.parts(fecha), h = String(hora).split(':').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2], h[0] + 6, h[1]);
  },

  horasHasta(fecha, hora, nowMs) { return (Calc.citaMs(fecha, hora) - nowMs) / 36e5; },

  requiereDecision(fecha, hora, nowMs) { return Calc.horasHasta(fecha, hora, nowMs) < 24; },

  /** Minutos desde las 00:00 en que termina la cita (puede pasar de 1440). */
  finCita(hora, minutos) {
    const h = String(hora).split(':').map(Number);
    return h[0] * 60 + h[1] + Number(minutos);
  },

  cruzaMedianoche(hora, minutos) { return Calc.finCita(hora, minutos) > 1440; },

  /** a, b = {fecha, hora, minutos}: misma fecha e intervalos [ini, fin) que se tocan en más de 0 min. */
  seCruzan(a, b) {
    if (a.fecha !== b.fecha) return false;
    const ia = Calc.finCita(a.hora, 0), fa = Calc.finCita(a.hora, a.minutos);
    const ib = Calc.finCita(b.hora, 0), fb = Calc.finCita(b.hora, b.minutos);
    return ia < fb && ib < fa;
  },

  /** Fechas de un paquete de citas según el patrón. */
  fechasPatron(tipo, inicio, cantidad, opts) {
    opts = opts || {};
    const out = [];
    if (tipo === 'sueltas') {
      const seen = {};
      (opts.fechas || []).forEach((f) => { seen[f] = true; });
      return Object.keys(seen).sort();
    }
    if (tipo === 'semanal') {
      for (let i = 0; i < cantidad; i++) out.push(Calc.addDays(inicio, 7 * i));
      return out;
    }
    if (tipo === 'seguidas') {
      const dias = opts.dias || [0, 1, 2, 3, 4, 5, 6];
      if (!dias.length) return out;
      let f = inicio, guard = 0;
      while (out.length < cantidad && guard++ < 3700) {
        if (dias.indexOf(Calc.dow(f)) >= 0) out.push(f);
        f = Calc.addDays(f, 1);
      }
      return out;
    }
    return out;
  },

  /** Cuotas mensuales iguales; la última absorbe la diferencia de centavos. */
  cuotasDefecto(total, n, primera) {
    n = Math.max(1, Math.floor(Number(n)) || 1);
    const base = Calc.round2(total / n);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        numero: i + 1,
        vence: Calc.addMonths(primera, i),
        monto: i === n - 1 ? Calc.round2(total - base * (n - 1)) : base,
      });
    }
    return out;
  },

  /** Suma de pagos vigentes (no anulados) de una cuota. */
  pagadoCuota(cuotaId, pagos) {
    let s = 0;
    (pagos || []).forEach((p) => { if (!p.anulado && p.idCuota === cuotaId) s += Number(p.monto) || 0; });
    return Calc.round2(s);
  },

  /** Estado de cobro de una venta. Sin cuotas → Pagado. */
  estadoVenta(cuotas, pagos, hoy, diasPronto) {
    const orden = (cuotas || []).slice().sort((a, b) => a.numero - b.numero);
    let saldo = 0, pagado = 0, vencidas = 0, masVieja = null, proxima = null;
    orden.forEach((q) => {
      const pg = Calc.pagadoCuota(q.id, pagos);
      pagado += pg;
      if (pg >= q.monto - 0.005) return;
      saldo += q.monto - pg;
      if (!proxima) proxima = { numero: q.numero, vence: q.vence, falta: Calc.round2(q.monto - pg) };
      if (q.vence < hoy) {
        vencidas++;
        if (masVieja === null || q.vence < masVieja) masVieja = q.vence;
      }
    });
    let estado = 'Pagado';
    if (proxima) {
      if (vencidas > 0) estado = 'Vencido';
      else if (Calc.dias(hoy, proxima.vence) <= diasPronto) estado = 'Por vencer';
      else estado = 'Al día';
    }
    return {
      estado, saldo: Calc.round2(saldo), pagado: Calc.round2(pagado), vencidas,
      diasVencido: masVieja === null ? 0 : Calc.dias(masVieja, hoy), proxima,
    };
  },

  /** Avance del paquete de clases de una venta. */
  avance(venta, citas) {
    let consumidas = 0, agendadas = 0, min = 0;
    (citas || []).forEach((c) => {
      if (c.estado === 'Dada' || ((c.estado === 'Cancelada' || c.estado === 'No se presentó') && c.descuenta)) {
        consumidas++;
        min += Number(c.minutos) || 0;
      } else if (c.estado === 'Programada') agendadas++;
    });
    const horasUsadas = Calc.round2(min / 60);
    const tiene = venta.horas !== undefined && venta.horas !== null && venta.horas !== '';
    return {
      consumidas, agendadas, libres: venta.citas - consumidas - agendadas, horasUsadas,
      horasRestantes: tiene ? Calc.round2(Number(venta.horas) - horasUsadas) : null,
    };
  },

  /** SOLO PÁGINA (sin espejo en Code.gs; test-calc.js la excluye de la paridad).
   *  Lee un monto o número escrito por la persona → número, o NaN si no es claro.
   *  Acepta "Q" inicial y espacios; 1500 / 1500.5 / 1500.50; miles "1,500.50"; coma decimal "1500,50" / "7,5".
   *  Con exactamente 3 dígitos tras una coma gana miles ("1,000" = 1000). Rechaza signos, exponentes, hex y mezclas. */
  parseNumero(texto) {
    if (typeof texto === 'number') return isFinite(texto) && texto >= 0 ? texto : NaN;
    const s = String(texto === null || texto === undefined ? '' : texto).trim().replace(/^Q\s*/i, '');
    if (/^\d+(\.\d{1,2})?$/.test(s)) return Number(s);
    if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) return Number(s.replace(/,/g, ''));
    if (/^\d+,\d{1,2}$/.test(s)) return Number(s.replace(',', '.'));
    return NaN;
  },

  /** 1250 → 'Q 1,250.00' */
  money(n) {
    const c = Math.round(Math.abs(Number(n) || 0) * 100);
    const ent = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 && c > 0 ? '-' : '') + 'Q ' + ent + '.' + Calc.pad(c % 100);
  },
};
if (typeof module !== 'undefined') module.exports = Calc;

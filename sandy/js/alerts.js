'use strict';
/* Alertas de la pantalla Hoy y de la campana. Cálculo puro (sin DOM): Alerts.calcular(S, nowMs).
 * Usa Calc para las fechas y la zona (UTC−6 fijo). Se carga en la página y en Node (tests/test-alerts.js). */
const Alerts = (function () {
  const C = typeof Calc !== 'undefined' ? Calc : require('./calc.js');
  const MIN_PROXIMA = 60;

  /** Fecha AAAA-MM-DD en Guatemala de un instante, y minutos desde las 00:00 de ese día. */
  function fechaDe(ms) {
    const d = new Date(ms - 6 * 36e5);
    return d.getUTCFullYear() + '-' + C.pad(d.getUTCMonth() + 1) + '-' + C.pad(d.getUTCDate());
  }

  const num = (v, def) => { const n = Number(v); return isFinite(n) && v !== '' && v !== null && v !== undefined ? n : def; };
  const clave = (a) => (a.fecha ? a.fecha + ' ' + (a.hora || '') : '\uffff');

  function calcular(S, nowMs) {
    S = S || {};
    const cfg = S.cfg || {};
    const diasPronto = num(cfg.DIAS_POR_VENCER, 7);
    const umbral = num(cfg.ALERTA_CLASES_RESTANTES, 2);
    const hoy = fechaDe(nowMs);
    const sem = C.weekRange(hoy);
    const nombre = {};
    (S.alumnos || []).forEach((a) => { nombre[a.id] = a.nombre; });

    const citas = [], dinero = [];
    (S.citas || []).forEach((c) => {
      if (c.estado !== 'Programada') return;
      const dif = C.citaMs(c.fecha, c.hora) - nowMs;
      const base = {
        titulo: c.alumno || nombre[c.idAlumno] || 'Clase', hora: c.hora, fecha: c.fecha,
        ref: { ruta: 'agenda', params: { vista: 'dia', fecha: c.fecha } }, idCita: c.id,
      };
      const det = (c.instructor ? 'con ' + c.instructor : 'Clase agendada');
      if (dif < 0) {
        citas.push(Object.assign(base, { tipo: 'sin_confirmar', nivel: 'peligro', detalle: 'Sin confirmar si se dio la clase' + (c.instructor ? ' · ' + det : '') }));
      } else if (c.fecha === hoy && dif <= MIN_PROXIMA * 6e4) {
        citas.push(Object.assign(base, { tipo: 'proxima', nivel: 'info', detalle: 'Empieza pronto · ' + det }));
      } else if (c.fecha >= sem.start && c.fecha <= sem.end) {
        citas.push(Object.assign(base, { tipo: 'cita', nivel: 'info', detalle: det }));
      }
    });

    (S.ventas || []).forEach((v) => {
      if (v.anulada) return;
      const quien = nombre[v.idAlumno] || v.aNombreDe || 'Alumno';
      const ref = { ruta: 'alumno', params: { id: v.idAlumno } };
      const e = v.estado || {}, p = e.proxima;
      if (e.estado === 'Vencido' && p) {
        const d = Number(e.diasVencido) || 0, n = Number(e.vencidas) || 1;
        dinero.push({
          tipo: 'vencida', nivel: 'peligro', titulo: quien, ref, cuotas: n, dias: d,
          detalle: 'Cuota ' + p.numero + ': falta ' + C.money(p.falta) + ' · venció hace ' + d + (d === 1 ? ' día' : ' días') +
            (n > 1 ? ' · ' + n + ' cuotas vencidas' : ''),
        });
      } else if ((e.estado === 'Por vencer' || e.estado === 'Al día') && p && C.dias(hoy, p.vence) <= diasPronto && C.dias(hoy, p.vence) >= 0) {
        const d = C.dias(hoy, p.vence);
        dinero.push({
          tipo: 'por_vencer', nivel: 'aviso', titulo: quien, ref, cuotas: 1, dias: 0,
          detalle: 'Cuota ' + p.numero + ': falta ' + C.money(p.falta) + ' · vence ' + (d === 0 ? 'hoy' : d === 1 ? 'mañana' : 'en ' + d + ' días'),
        });
      }
      const av = v.avance || {};
      const quedan = (Number(av.libres) || 0) + (Number(av.agendadas) || 0);
      if (quedan > 0 && quedan <= umbral) {
        dinero.push({ tipo: 'pocas_clases', nivel: 'aviso', titulo: quien, ref, detalle: 'Le ' + (quedan === 1 ? 'queda 1 clase' : 'quedan ' + quedan + ' clases') + ' · ' + (v.planNombre || 'Plan') });
      }
    });

    const orden = { vencida: 0, por_vencer: 1, pocas_clases: 2 };
    citas.sort((a, b) => (clave(a) < clave(b) ? -1 : clave(a) > clave(b) ? 1 : 0));
    dinero.sort((a, b) => orden[a.tipo] - orden[b.tipo] || (b.dias || 0) - (a.dias || 0));

    const dia = citas.filter((a) => a.fecha <= hoy).concat(dinero);
    const semana = citas.concat(dinero); // incluye las sin confirmar de semanas anteriores, igual que la campana
    const contador = dia.filter((a) => a.nivel === 'aviso' || a.nivel === 'peligro' || a.tipo === 'proxima').length;
    return { dia, semana, contador };
  }

  /** "X de N" de una cita, o null si no se puede asegurar: solo cuando las citas cargadas de esa venta que cuentan
   *  (dadas, descontadas o programadas) coinciden con avance.consumidas + avance.agendadas. */
  function posicion(c, S) {
    const v = ((S && S.ventas) || []).filter((x) => x.id === c.idVenta)[0];
    const cuenta = (x) => x.estado === 'Programada' || x.estado === 'Dada' || ((x.estado === 'Cancelada' || x.estado === 'No se presentó') && x.descuenta);
    if (!v || !v.avance || !cuenta(c)) return null;
    const mias = ((S && S.citas) || []).filter((x) => x.idVenta === c.idVenta && cuenta(x));
    if (mias.length !== (Number(v.avance.consumidas) || 0) + (Number(v.avance.agendadas) || 0)) return null;
    const key = (x) => x.fecha + ' ' + x.hora;
    const n = mias.filter((x) => key(x) < key(c) || (key(x) === key(c) && x.id <= c.id)).length;
    return n >= 1 && n <= v.citas ? { n, total: v.citas } : null;
  }

  return { calcular, fechaDe, posicion };
})();
if (typeof module !== 'undefined') module.exports = Alerts;

'use strict';
/* Editar una venta (clases, horas, precio, a nombre de, nota y cuotas) y anularla (solo administrador).
 * Se abre desde la ficha del alumno: abrirEditarVenta(venta), anularVenta(venta). Usa CuotasEd de form-venta.js. */

const EV = {
  s: null,

  abrir(v) {
    const pagos = v.cuotas.some((q) => q.pagado > 0);
    EV.s = {
      v, bloqueado: pagos, citas: String(v.citas), horas: String(v.horas), precio: Number(v.precio).toFixed(2), aNombreDe: v.aNombreDe, nota: v.nota || '',
      cuo: { precio: Number(v.precio).toFixed(2), n: v.cuotas.length, primera: v.cuotas.length ? v.cuotas[0].vence : v.fechaVenta, cuotas: v.cuotas.map((q) => ({ vence: q.vence, monto: Number(q.monto).toFixed(2) })), cuPrecio: centavos_(v.precio) },
      err: '', guardando: false,
    };
    EV.pintar();
  },
  usadas() { const a = EV.s.v.avance; return a.consumidas + a.agendadas; },

  validar() {
    const s = EV.s, c = Number(s.citas), h = dineroNum_(s.horas), p = dineroNum_(s.precio);
    if (!(c >= 1 && c <= 200) || c !== Math.floor(c)) return 'Las clases deben ser un número entero entre 1 y 200.';
    if (c < EV.usadas()) return 'Ya hay ' + EV.usadas() + ' clases usadas o agendadas; no puedes dejar la venta en ' + c + '.';
    if (!(h > 0 && h <= 500)) return 'Las horas deben ser mayores que 0 y hasta 500.';
    if (h < s.v.avance.horasUsadas) return 'Ya se usaron ' + horasTxt_(s.v.avance.horasUsadas) + '; no puedes dejar la venta en menos.';
    if (!(p > 0)) return 'El precio debe ser mayor que Q 0.00.';
    if (!s.aNombreDe.trim()) return 'Indica a nombre de quién va el recibo.';
    if (!s.bloqueado) { const e = CuotasEd.estado(s.cuo); if (!e.ok) return e.malos ? 'Revisa las cuotas: cada una necesita fecha y un monto mayor que Q 0.00.' : 'La suma de las cuotas debe ser igual al precio.'; }
    return '';
  },
  cuotasCambiaron() {
    const s = EV.s, a = s.v.cuotas, b = s.cuo.cuotas;
    return a.length !== b.length || a.some((q, i) => q.vence !== b[i].vence || centavos_(q.monto) !== centavos_(dineroNum_(b[i].monto)));
  },
  difHtml() {
    const s = EV.s, d = Calc.round2((dineroNum_(s.precio) || 0) - s.v.precioPlan);
    return '<b>Precio del plan ' + esc(money(s.v.precioPlan)) + '</b>' + (d ? '<span class="' + (d < 0 ? 'cu-menos' : 'cu-mas') + '">' + (d < 0 ? 'Descuento de ' + esc(money(-d)) : 'Aumento de ' + esc(money(d))) + '</span>' : '<span>Sin cambios sobre el plan.</span>');
  },

  cuerpo() {
    const s = EV.s, v = s.v, a = v.avance;
    let cuotas;
    if (s.bloqueado) {
      cuotas = '<div class="aviso">Esta venta ya tiene pagos, así que el precio y las cuotas no se pueden cambiar. Para cambiarlos, primero hay que anular los pagos.</div><ul class="prev">' +
        v.cuotas.map((q) => '<li class="al-q"><span class="prev-n">' + esc(q.numero) + '</span><span class="prev-t"><b>' + esc(money(q.monto)) + '</b><small class="al-gris">Vence ' + esc(fechaCorta(q.vence)) + '</small></span></li>').join('') + '</ul>';
    } else {
      CuotasEd.activo = s.cuo; CuotasEd.alCambiar = EV.actualizar;
      cuotas = CuotasEd.html(s.cuo, 'Primera cuota');
    }
    return '<div class="form-ag nv"><p class="ayuda">Plan <b>' + esc(v.planNombre) + '</b> · a nombre de ' + esc(v.aNombreDe) + '.</p><section class="paso"><div class="dos">' +
      '<div class="campo"><label for="evCitas">Clases</label><input id="evCitas" class="input" type="number" inputmode="numeric" min="' + Math.max(1, EV.usadas()) + '" max="200" data-ev-in="citas" value="' + esc(s.citas) + '"><small class="ayuda">Ya hay ' + EV.usadas() + ' usadas o agendadas.</small></div>' +
      '<div class="campo"><label for="evHoras">Horas</label><input id="evHoras" class="input" inputmode="decimal" data-ev-in="horas" value="' + esc(s.horas) + '"><small class="ayuda">' + esc(horasTxt_(a.horasUsadas)) + ' usadas.</small></div></div>' +
      '<div class="campo"><label for="evPrecio">Precio (Q)</label><input id="evPrecio" class="input" inputmode="decimal" data-ev-in="precio" value="' + esc(s.precio) + '"' + (s.bloqueado ? ' disabled' : '') + '></div>' +
      '<div id="evDif" class="nv-dif">' + EV.difHtml() + '</div>' +
      '<div class="campo"><label for="evNom">Recibo a nombre de</label><input id="evNom" class="input" maxlength="100" autocomplete="off" data-ev-in="aNombreDe" value="' + esc(s.aNombreDe) + '"></div>' +
      '<div class="campo"><label for="evNota">Nota (opcional)</label><textarea id="evNota" class="input" rows="2" maxlength="500" data-ev-in="nota">' + esc(s.nota) + '</textarea></div></section>' +
      '<section class="paso"><h3>Cuotas</h3>' + cuotas + '</section>' +
      (s.err ? '<div class="aviso aviso-error" role="alert">' + esc(s.err) + '</div>' : '') +
      '<div class="nv-pie"><button type="button" class="btn btn-suave btn-grande" data-ev="cerrar">Cancelar</button>' +
      '<button type="button" id="evGuardar" class="btn btn-primario btn-grande" data-ev="guardar"' + (s.guardando || EV.validar() ? ' disabled' : '') + '>' + (s.guardando ? 'Guardando…' : 'Guardar cambios') + '</button></div></div>';
  },
  actualizar() { const b = document.getElementById('evGuardar'); if (b && EV.s) b.disabled = EV.s.guardando || !!EV.validar(); },
  pintar() {
    if (!EV.s) return;
    CuotasEd.activo = null; CuotasEd.alCambiar = null;
    const html = EV.cuerpo();
    const h = hojaPintar_(EV, html, 'Editar venta', () => { EV.s = null; CuotasEd.activo = null; CuotasEd.alCambiar = null; });
    h.panel.classList.add('hoja-full');
  },
  entrada(nom, el) {
    const s = EV.s;
    s[nom] = el.value; s.err = '';
    if (nom === 'precio') {
      const d = document.getElementById('evDif');
      if (d) d.innerHTML = EV.difHtml();
      s.cuo.precio = s.precio;
      if (!s.bloqueado && dineroNum_(s.precio) > 0) { CuotasEd.regenerar(s.cuo, s.cuo.cuotas.map((q) => q.vence)); CuotasEd.pintarTabla(); return; }
      CuotasEd.pintarSuma();
    }
    EV.actualizar();
  },
  async guardar() {
    const s = EV.s;
    if (!s || s.guardando) return;
    s.err = EV.validar();
    if (s.err) { EV.pintar(); return; }
    s.guardando = true; EV.pintar();
    const p = { id: s.v.id, citas: Number(s.citas), horas: dineroNum_(s.horas), precio: Calc.round2(dineroNum_(s.precio)), aNombreDe: s.aNombreDe.trim(), nota: s.nota.trim() };
    if (!s.bloqueado && (EV.cuotasCambiaron() || p.precio !== s.v.precio)) p.cuotas = s.cuo.cuotas.map((q) => ({ vence: q.vence, monto: Calc.round2(dineroNum_(q.monto)) }));
    try {
      await api('ventas.update', p);
      if (hojaActual) hojaActual.cerrar();
      toast('Se guardaron los cambios de la venta.', 'ok');
      AL.tras();
    } catch (e) {
      s.guardando = false; s.err = e.message || MENSAJES.INTERNAL;
      EV.pintar();
    }
  },
};

/** Abre la hoja para editar una venta (objeto de alumnos.get). */
function abrirEditarVenta(v) { EV.abrir(v); }

/** Anular una venta: pide el motivo; las clases programadas se cancelan sin descontar (solo administrador). */
function anularVenta(v) {
  if (!S.user || !S.user.isAdmin) return;
  modal({
    titulo: 'Anular venta',
    cuerpoHtml: '<p class="modal-texto">Se anula el plan <b>' + esc(v.planNombre) + '</b> de ' + esc(v.aNombreDe) + '. Las clases programadas se cancelan sin descontar y la venta deja de contar. Esto no se puede deshacer.</p>' +
      '<div class="campo"><label for="avMotivo">Motivo (obligatorio)</label><textarea id="avMotivo" class="input" rows="2" maxlength="300"></textarea></div>' +
      '<div id="avErr" class="aviso aviso-error" role="alert" hidden></div>',
    acciones: [{ texto: 'Cancelar', estilo: 'suave' }, {
      texto: 'Anular venta', estilo: 'peligro',
      async accion(c) {
        const motivo = c.el.querySelector('#avMotivo').value.trim(), err = c.el.querySelector('#avErr');
        err.hidden = true;
        if (!motivo) { err.textContent = 'Escribe el motivo de la anulación.'; err.hidden = false; return false; }
        try { await api('ventas.void', { id: v.id, motivo }); }
        catch (e) { err.textContent = e.message || MENSAJES.INTERNAL; err.hidden = false; return false; }
        toast('La venta quedó anulada.', 'ok');
        AL.tras();
      },
    }],
  });
}

document.addEventListener('click', (e) => {
  const b = e.target.closest ? e.target.closest('[data-ev]') : null;
  if (!b || !EV.s) return;
  if (b.dataset.ev === 'guardar') EV.guardar();
  else if (b.dataset.ev === 'cerrar' && hojaActual) hojaActual.cerrar();
});
document.addEventListener('input', (e) => {
  const el = e.target.closest ? e.target.closest('[data-ev-in]') : null;
  if (el && EV.s) EV.entrada(el.dataset.evIn, el);
});

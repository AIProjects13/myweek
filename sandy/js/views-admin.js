'use strict';
/* Pantallas del administrador (1/4): ayudante de formularios en hoja, Planes e Instructores.
 * Usuarios está en views-usuarios.js, Configuración en views-config.js, Recibos en views-recibos.js y Progreso en views-progreso.js. */

const Adm = {
  cur: null,   // {guardar: async () => void} del formulario abierto
  busy: false,

  /** Casilla grande (44 px) con etiqueta. */
  chk(id, texto, on) {
    return '<label class="chk" for="' + esc(id) + '"><input type="checkbox" id="' + esc(id) + '"' + (on ? ' checked' : '') + '><span>' + esc(texto) + '</span></label>';
  },
  campo(id, etiqueta, valor, extra) {
    return '<div class="campo"><label for="' + esc(id) + '">' + esc(etiqueta) + '</label><input id="' + esc(id) + '" class="input" autocomplete="off" value="' + esc(valor) + '" ' + (extra || '') + '></div>';
  },
  /** Abre una hoja con el cuerpo y los botones Cancelar / Guardar. guardar() lanza Error(mensaje) si algo falla. */
  abrir(titulo, cuerpoHtml, guardar, textoGuardar) {
    Adm.cur = { guardar };
    hoja('<div class="form-ag nv">' + cuerpoHtml + '<p id="admErr" class="aviso aviso-error" role="alert" hidden></p>' +
      '<div class="nv-pie"><button type="button" class="btn btn-suave btn-grande" data-adm="cerrar">Cancelar</button>' +
      '<button type="button" id="admOk" class="btn btn-primario btn-grande" data-adm="guardar">' + esc(textoGuardar || 'Guardar') + '</button></div></div>',
    { titulo, alCerrar: () => { Adm.cur = null; } });
  },
  error(msg) { const e = $('#admErr'); if (e) { e.hidden = !msg; e.textContent = msg || ''; } },
  async guardar() {
    if (!Adm.cur || Adm.busy) return;
    const b = $('#admOk'), txt = b ? b.textContent : '';
    Adm.busy = true; Adm.error('');
    if (b) { b.disabled = true; b.textContent = 'Guardando…'; }
    try { await Adm.cur.guardar(); if (hojaActual) hojaActual.cerrar(); }
    catch (e) { Adm.error(e.message || MENSAJES.INTERNAL); if (b) { b.disabled = false; b.textContent = txt; } }
    finally { Adm.busy = false; }
  },
  /** Vuelve a pedir datos; si falla la red el guardado ya ocurrió, así que no es un error del formulario. */
  recargar(claves) { return refresh(claves).catch(() => toast('Se guardó, pero no se pudo actualizar la pantalla. Recarga la página.', 'aviso')); },
  num: (v) => Calc.parseNumero(v), // número escrito → número o NaN (misma regla que montos y ventas)
  /** activos primero, luego por nombre */
  orden: (a, b) => (a.activo === b.activo ? norm_(a.nombre).localeCompare(norm_(b.nombre)) : (a.activo ? -1 : 1)),
  vacio: (t) => '<div class="vacio">' + icon('info', 28) + '<b>' + esc(t) + '</b></div>',
};

document.addEventListener('click', (e) => {
  const b = e.target.closest ? e.target.closest('[data-adm]') : null;
  if (!b) return;
  if (b.dataset.adm === 'guardar') Adm.guardar();
  else if (b.dataset.adm === 'cerrar' && hojaActual) hojaActual.cerrar();
});

/* ================================= PLANES ================================= */
const Planes = {
  fila(p) {
    return '<button type="button" class="cb-fila' + (p.activo ? '' : ' cb-anulado') + '" data-plan="' + esc(p.id) + '"><span class="kpi-ic kpi-ic-azul">' + icon('plan', 20) + '</span>' +
      '<span class="al-txt"><b>' + esc(p.nombre) + '</b><small>' + esc(clasesTxt_(p.citas)) + ' · ' + esc(horasTxt_(p.horas)) + '</small></span>' +
      '<span class="cb-der"><b>' + esc(money(p.precio)) + '</b>' + (p.activo ? '' : '<span class="chip">Inactivo</span>') + '</span></button>';
  },
  render(el) {
    const l = S.planes.slice().sort(Adm.orden);
    el.innerHTML = '<div class="cb-barra"><p class="ayuda adm-nota">Los planes no se borran: si ya no se vende uno, desactívalo.</p>' +
      '<button type="button" class="btn btn-primario" data-plan="nuevo">' + icon('plus', 18) + '<span>Nuevo plan</span></button></div>' +
      (l.length ? '<div class="al-lista">' + l.map(Planes.fila).join('') + '</div>' : Adm.vacio('Aún no hay planes'));
  },
  abrir(id) {
    const p = id === 'nuevo' ? null : S.planes.filter((x) => x.id === id)[0];
    if (id !== 'nuevo' && !p) return;
    Adm.abrir(p ? 'Editar plan' : 'Nuevo plan',
      '<section class="paso">' + Adm.campo('plNombre', 'Nombre', p ? p.nombre : '', 'maxlength="100"') +
      '<div class="dos">' + Adm.campo('plCitas', 'Citas', p ? p.citas : '', 'inputmode="numeric"') + Adm.campo('plHoras', 'Horas', p ? p.horas : '', 'inputmode="decimal"') + '</div>' +
      Adm.campo('plPrecio', 'Precio (Q)', p ? p.precio : '', 'inputmode="decimal"') + Adm.chk('plActivo', 'Plan activo (se puede vender)', p ? p.activo : true) + '</section>',
    async () => {
      const citas = Adm.num($('#plCitas').value), horas = Adm.num($('#plHoras').value), precio = Adm.num($('#plPrecio').value), nombre = $('#plNombre').value.trim();
      if (!nombre) throw new Error('Escribe el nombre del plan.');
      if (!(citas >= 1 && citas <= 200) || citas !== Math.floor(citas)) throw new Error('Las citas deben ser un número entero entre 1 y 200.');
      if (!(horas > 0 && horas <= 500)) throw new Error('Las horas deben ser mayores que 0 y hasta 500.');
      if (!(precio >= 0)) throw new Error('El precio debe ser un número igual o mayor que 0.');
      await api('planes.save', { id: p ? p.id : undefined, nombre, citas, horas, precio, activo: $('#plActivo').checked });
      toast('Plan guardado.', 'ok');
      await Adm.recargar(['planes']);
    });
  },
};
document.addEventListener('click', (e) => {
  const b = e.target.closest ? e.target.closest('[data-plan]') : null;
  if (b) Planes.abrir(b.dataset.plan);
});

/* =============================== INSTRUCTORES ============================== */
const Instr = {
  fila(i) {
    return '<button type="button" class="cb-fila' + (i.activo ? '' : ' cb-anulado') + '" data-instr="' + esc(i.id) + '"><span class="av" aria-hidden="true">' + esc(iniciales(i.nombre)) + '</span>' +
      '<span class="al-txt"><b>' + esc(i.nombre) + '</b><small>' + esc(i.telefono || 'Sin teléfono') + '</small></span>' +
      '<span class="cb-der">' + (i.activo ? '<span class="chip chip-verde">Activo</span>' : '<span class="chip">Inactivo</span>') + '</span></button>';
  },
  render(el) {
    const l = S.instructores.slice().sort(Adm.orden);
    el.innerHTML = '<div class="cb-barra"><p class="ayuda adm-nota">Un instructor desactivado deja de aparecer al agendar, pero su historial se conserva.</p>' +
      '<button type="button" class="btn btn-primario" data-instr="nuevo">' + icon('plus', 18) + '<span>Nuevo instructor</span></button></div>' +
      (l.length ? '<div class="al-lista">' + l.map(Instr.fila).join('') + '</div>' : Adm.vacio('Aún no hay instructores'));
  },
  abrir(id) {
    const i = id === 'nuevo' ? null : S.instructores.filter((x) => x.id === id)[0];
    if (id !== 'nuevo' && !i) return;
    Adm.abrir(i ? 'Editar instructor' : 'Nuevo instructor',
      '<section class="paso">' + Adm.campo('inNombre', 'Nombre', i ? i.nombre : '', 'maxlength="100"') +
      Adm.campo('inTel', 'Teléfono (opcional)', i ? i.telefono : '', 'type="tel" inputmode="tel" maxlength="30"') + Adm.chk('inActivo', 'Instructor activo', i ? i.activo : true) + '</section>',
    async () => {
      const nombre = $('#inNombre').value.trim();
      if (!nombre) throw new Error('Escribe el nombre del instructor.');
      await api('instructores.save', { id: i ? i.id : undefined, nombre, telefono: $('#inTel').value.trim(), activo: $('#inActivo').checked });
      toast('Instructor guardado.', 'ok');
      await Adm.recargar(['instructores']);
    });
  },
};
document.addEventListener('click', (e) => {
  const b = e.target.closest ? e.target.closest('[data-instr]') : null;
  if (b) Instr.abrir(b.dataset.instr);
});

registerView('planes', { titulo: 'Planes', icono: 'plan', soloAdmin: true, render: (el) => Planes.render(el) });
registerView('instructores', { titulo: 'Instructores', icono: 'wheel', soloAdmin: true, render: (el) => Instr.render(el) });

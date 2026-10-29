'use strict';
/* Configuración (administrador): datos de la escuela para recibos, correo del recibo, horario de atención y avisos.
 * Solo las claves que acepta el servidor. Se valida aquí igual que validateConfigValue_, pero el servidor decide. */

const Cf = {
  d: null, err: '', cargando: false, guardando: false, msg: '',

  cargar() {
    if (Cf.cargando) return;
    Cf.cargando = true; Cf.err = '';
    api('config.get').then((d) => { Cf.d = d; }).catch((e) => { Cf.err = e.message || MENSAJES.INTERNAL; })
      .then(() => { Cf.cargando = false; if (S.ruta.nombre === 'configuracion') Router.render({ conservarScroll: true }); });
  },
  txt(k, etiqueta, extra, ayuda) {
    return '<div class="campo"><label for="cf_' + k + '">' + esc(etiqueta) + '</label><input id="cf_' + k + '" class="input" data-cf="' + k + '" autocomplete="off" value="' + esc(Cf.d[k]) + '" ' + (extra || '') + '>' +
      (ayuda ? '<small class="ayuda">' + esc(ayuda) + '</small>' : '') + '</div>';
  },
  area(k, etiqueta, ayuda) {
    return '<div class="campo"><label for="cf_' + k + '">' + esc(etiqueta) + '</label><textarea id="cf_' + k + '" class="input" data-cf="' + k + '" rows="3" maxlength="1000">' + esc(Cf.d[k]) + '</textarea>' +
      (ayuda ? '<small class="ayuda">' + esc(ayuda) + '</small>' : '') + '</div>';
  },
  dias() {
    const sel = String(Cf.d.DIAS_ATENCION).split(',').map((x) => x.trim());
    return '<div class="campo"><span class="etq" id="cfDiasT">Días de atención</span><div class="chips-ins cf-dias" role="group" aria-labelledby="cfDiasT">' +
      DIAS_CORTOS.map((n, i) => '<label class="chip-ins"><input type="checkbox" class="solo-lector" data-cf-dia="' + i + '"' + (sel.indexOf(String(i)) >= 0 ? ' checked' : '') + '><span>' + esc(cap(n)) + '</span></label>').join('') + '</div></div>';
  },

  render(el) {
    if (!Cf.d) {
      if (!Cf.cargando && !Cf.err) Cf.cargar();
      el.innerHTML = Cf.err ? '<div class="vacio">' + icon('alert', 28) + '<b>No se pudo cargar</b><p>' + esc(Cf.err) + '</p><button type="button" class="btn btn-suave" data-cfa="reintentar">Reintentar</button></div>'
        : '<div class="esq esq-fila"></div><div class="esq esq-fila"></div><div class="esq esq-fila"></div>';
      return;
    }
    const card = (t, c) => '<section class="card"><h2 class="card-titulo">' + esc(t) + '</h2><div class="cf-grid">' + c + '</div></section>';
    el.innerHTML = '<form id="cfForm" class="cf" novalidate>' +
      card('La escuela (aparece en los recibos)',
        // TODO-NOMBRE: nombre provisional de la escuela; el administrador lo cambia aquí.
        Cf.txt('ESCUELA_NOMBRE', 'Nombre de la escuela', 'maxlength="100"') + Cf.txt('ESCUELA_TELEFONO', 'Teléfono', 'type="tel" inputmode="tel" maxlength="30"') +
        Cf.txt('ESCUELA_DIRECCION', 'Dirección', 'maxlength="200"') + Cf.txt('LOGO_URL', 'Logo (dirección https)', 'type="url" inputmode="url" placeholder="https://…" spellcheck="false"', 'Opcional. Si no hay logo, el recibo muestra el nombre.')) +
      card('Correo del recibo',
        Cf.txt('REMITENTE_NOMBRE', 'Nombre del remitente', 'maxlength="100"') + Cf.txt('REPLY_TO', 'Correo de respuesta (opcional)', 'type="email" inputmode="email" spellcheck="false"') +
        Cf.txt('RECIBO_ASUNTO', 'Asunto', 'maxlength="150"', 'Puedes usar {{nombre}}, {{numero}} y {{monto}}.') + Cf.area('RECIBO_MENSAJE', 'Mensaje', 'Puedes usar {{nombre}}, {{numero}} y {{monto}}.')) +
      card('Horario de atención',
        '<div class="dos">' + Cf.txt('HORA_INICIO', 'Abre', 'type="time"') + Cf.txt('HORA_FIN', 'Cierra', 'type="time"') + '</div>' + Cf.dias()) +
      card('Avisos',
        Cf.txt('DIAS_POR_VENCER', 'Días para avisar que una cuota está por vencer', 'inputmode="numeric" maxlength="4"') +
        Cf.txt('ALERTA_CLASES_RESTANTES', 'Avisar cuando a un alumno le queden estas clases o menos', 'inputmode="numeric" maxlength="4"')) +
      '<p id="cfMsg" class="aviso" role="alert" hidden></p>' +
      '<div class="cf-pie"><button type="submit" id="cfGuardar" class="btn btn-primario btn-grande">Guardar cambios</button></div></form>';
  },

  /** Lee el formulario → {CLAVE: valor} o lanza Error con el primer problema. */
  leer() {
    const v = {};
    $$('[data-cf]').forEach((i) => { v[i.dataset.cf] = i.value.trim(); });
    v.DIAS_ATENCION = $$('[data-cf-dia]').filter((i) => i.checked).map((i) => i.dataset.cfDia).join(',');
    if (!v.ESCUELA_NOMBRE) throw new Error('Escribe el nombre de la escuela.');
    if (!v.REMITENTE_NOMBRE) throw new Error('Escribe el nombre del remitente.');
    if (v.LOGO_URL && !/^https:\/\/[^\s<>"']+$/i.test(v.LOGO_URL)) throw new Error('El logo debe ser una dirección https.');
    if (v.REPLY_TO && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.REPLY_TO)) throw new Error('El correo de respuesta no es válido.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.HORA_INICIO) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.HORA_FIN)) throw new Error('Indica la hora de apertura y de cierre.');
    if (v.HORA_INICIO >= v.HORA_FIN) throw new Error('La hora de inicio debe ser anterior a la hora de cierre.');
    if (!v.DIAS_ATENCION) throw new Error('Elige al menos un día de atención.');
    if (!/^\d{1,4}$/.test(v.DIAS_POR_VENCER) || !/^\d{1,4}$/.test(v.ALERTA_CLASES_RESTANTES)) throw new Error('Los días y las clases deben ser números enteros, 0 o más.');
    return v;
  },
  aviso(texto, tipo) { const m = $('#cfMsg'); if (m) { m.hidden = !texto; m.textContent = texto || ''; m.className = 'aviso aviso-' + (tipo || 'error'); } },

  async guardar() {
    if (Cf.guardando) return;
    let v;
    try { v = Cf.leer(); } catch (e) { Cf.aviso(e.message); return; }
    Cf.guardando = true; Cf.aviso('');
    const b = $('#cfGuardar'); b.disabled = true; b.textContent = 'Guardando…';
    try {
      Cf.d = await api('config.save', v);
      // El resto de las pantallas (Agenda, recibos, avisos) leen S.cfg: se actualiza sin recargar la página.
      try { await refresh(['cfg']); } catch (e) { Object.keys(v).forEach((k) => { S.cfg[k] = Cf.d[k]; }); Router.render({ conservarScroll: true }); }
      toast('Configuración guardada.', 'ok');
    } catch (e) { Cf.aviso(e.message || MENSAJES.INTERNAL); b.disabled = false; b.textContent = 'Guardar cambios'; }
    finally { Cf.guardando = false; }
  },
};
document.addEventListener('submit', (e) => { if (e.target.id === 'cfForm') { e.preventDefault(); Cf.guardar(); } });
document.addEventListener('click', (e) => {
  const b = e.target.closest ? e.target.closest('[data-cfa]') : null;
  if (b) { Cf.err = ''; Router.render({ conservarScroll: true }); }
});

registerView('configuracion', {
  titulo: 'Configuración', icono: 'gear', soloAdmin: true,
  render(el) { if (el.classList.contains('entra')) Cf.d = null; Cf.render(el); }, // al entrar se pide de nuevo: otro administrador pudo cambiarla
});

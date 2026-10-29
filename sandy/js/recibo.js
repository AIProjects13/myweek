'use strict';
/* Recibo: vista en iframe aislado, imagen PNG (recibo-img.js), compartir, correo e impresión.
 *   Recibo.html(data)            HTML completo del recibo, todo escapado (estilos en css/recibo.css: la CSP no permite en línea).
 *   Recibo.canvas(data)          Promise<canvas> de 1080 px dibujado a mano.
 *   Recibo.ver(data, idPago, ctx) hoja con el recibo y los botones Compartir · Correo · Imprimir. ctx = {idVenta?}.
 *   Recibo.compartir(data, idPago, ctx)  hoja nativa de compartir o, si no hay, menú WhatsApp / Descargar / Imprimir. */
const Recibo = {
  cur: null,      // {d, id, ctx, archivo: Promise<File>} del recibo abierto
  ocupado: false,

  html(d) {
    const e = d.escuela || {};
    const logo = /^https:\/\//i.test(String(e.logoUrl || '')) ? '<img src="' + esc(e.logoUrl) + '" alt="' + esc(e.nombre) + '">' : esc(e.nombre);
    const fila = (k, v) => '<div class="rc-fila"><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>';
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Recibo ' + esc(d.numero) + '</title><link rel="stylesheet" href="css/recibo.css"></head><body><main class="rc">' +
      '<header class="rc-cab">' + logo + '</header><div class="rc-cuerpo">' +
      '<p class="rc-tit">Recibo de pago</p><p class="rc-num">' + esc(d.numero) + (d.anulado ? '<span class="rc-anulado">ANULADO</span>' : '') + '</p>' +
      '<p class="rc-monto">' + esc(money(d.monto)) + '</p><dl>' +
      fila('Alumno', d.alumno) + fila('A nombre de', d.aNombreDe) + fila('Concepto', d.concepto) + fila('Fecha de pago', fechaLarga(d.fecha)) + fila('Método', d.metodo) +
      (d.referencia ? fila('Referencia', d.referencia) : '') + fila('Saldo de la venta', money(d.saldo)) + fila('Registrado por', d.registradoPor) +
      '</dl></div><footer class="rc-pie">' + esc([e.nombre, e.telefono, e.direccion].filter(Boolean).join(' · ')) + '<br>Comprobante interno, no es factura.</footer>' +
      (d.anulado ? '<div class="rc-sello">ANULADO</div>' : '') + '</main></body></html>';
  },

  /** Resumen en texto para WhatsApp y para acompañar la imagen al compartir. */
  texto(d) {
    const e = d.escuela || {};
    return ['Recibo ' + d.numero + (d.anulado ? ' (ANULADO)' : ''), e.nombre, 'A nombre de: ' + d.aNombreDe, d.concepto,
      'Monto: ' + money(d.monto) + ' (' + d.metodo + ')' + (d.referencia ? ' · Ref. ' + d.referencia : ''),
      'Fecha: ' + fechaLarga(d.fecha), 'Saldo de la venta: ' + money(d.saldo), 'Comprobante interno, no es factura.'].filter(Boolean).join('\n');
  },

  canvas: (d) => ReciboImg.canvas(d),

  /** Alumno (teléfono y correo) del recibo abierto: por la venta o, si no, por nombre único. */
  contacto(cur) {
    const v = cur.ctx && cur.ctx.idVenta ? S.ventas.filter((x) => x.id === cur.ctx.idVenta)[0] : null;
    let a = v ? S.alumnos.filter((x) => x.id === v.idAlumno)[0] : null;
    if (!a) { const m = S.alumnos.filter((x) => x.nombre === cur.d.alumno); if (m.length === 1) a = m[0]; }
    return a || { telefono: '', email: '' };
  },

  /** Promise<File> con el PNG del recibo (se prepara al abrirlo, para que Compartir responda al toque). */
  archivo(d) {
    return Recibo.canvas(d).then((cv) => new Promise((ok, mal) => {
      cv.toBlob((b) => (b ? ok(new File([b], 'Recibo-' + d.numero + '.png', { type: 'image/png' })) : mal(new Error('sin imagen'))), 'image/png');
    }));
  },

  /** Anota el canal en el servidor. Un fallo aquí no estorba: el recibo ya salió. */
  async registrar(id, canal, d) {
    if (!id || (d && d.anulado)) return;
    try { await api('pagos.logReceipt', { id, canal }); refresh(['pagosSemana']).catch(() => {}); }
    catch (e) { toast('Se envió, pero no se pudo anotar el envío del recibo.', 'aviso'); }
  },

  /** Imprime el recibo con un iframe oculto. allow-same-origin deja al padre llamar print() y allow-modals permite el diálogo;
   *  sin allow-scripts el contenido no ejecuta nada (además todo va escapado). */
  imprimir(d) {
    const f = document.createElement('iframe');
    f.className = 'rc-oculto'; f.setAttribute('sandbox', 'allow-same-origin allow-modals'); f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    const quitar = () => { if (f.parentNode) f.remove(); };
    f.addEventListener('load', () => {
      try { f.contentWindow.focus(); f.contentWindow.addEventListener('afterprint', () => setTimeout(quitar, 500)); f.contentWindow.print(); }
      catch (e) { quitar(); toast('No se pudo abrir la impresión.', 'error'); }
    });
    f.srcdoc = Recibo.html(d);
    document.body.appendChild(f);
    setTimeout(quitar, 10 * 60 * 1000);
  },

  ver(d, id, ctx) {
    const cur = Recibo.cur = { d, id, ctx: ctx || {}, archivo: null };
    cur.archivo = Recibo.archivo(d); cur.archivo.catch(() => {});
    const bt = (a, ic, tx, extra) => '<button type="button" class="btn ' + (a === 'compartir' ? 'btn-primario' : 'btn-suave') + '" data-rc="' + a + '"' + (extra || '') + '>' + icon(ic, 18) + tx + '</button>';
    const h = hoja('<div class="rc-marco"><iframe class="rc-frame" title="Recibo ' + esc(d.numero) + '" sandbox="allow-same-origin allow-modals" srcdoc="' + esc(Recibo.html(d)) + '"></iframe></div>' +
      (d.anulado ? '<p class="aviso aviso-error">Este recibo está anulado: no se puede enviar por correo.</p>' : '') +
      '<div class="dt-acc rc-acc">' + bt('compartir', 'share', 'Compartir') + bt('correo', 'mail', 'Correo', d.anulado ? ' disabled' : '') + bt('imprimir', 'printer', 'Imprimir') + '</div>',
    { titulo: 'Recibo ' + d.numero, alCerrar: () => { if (Recibo.cur === cur) Recibo.cur = null; } });
    h.owner = Recibo; h.panel.classList.remove('hoja-full'); // si se reutilizó la hoja del formulario de pago
  },

  async compartir(d, id, ctx) {
    if (Recibo.ocupado) return;
    Recibo.ocupado = true;
    try {
      const cur = Recibo.cur && Recibo.cur.d === d ? Recibo.cur : { d, id, ctx: ctx || {}, archivo: Recibo.archivo(d) };
      const file = await cur.archivo;
      const texto = Recibo.texto(d);
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Recibo ' + d.numero, text: texto });
          Recibo.registrar(id, 'Compartido', d);
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return; // la persona cerró la hoja de compartir: no se anota nada
          /* otro fallo: se ofrece el menú alterno */
        }
      }
      Recibo.menu(cur, file, texto);
    } catch (e) { toast('No se pudo preparar la imagen del recibo. Intenta de nuevo.', 'error'); }
    finally { Recibo.ocupado = false; }
  },

  /** Menú alterno cuando el equipo no sabe compartir archivos. */
  menu(cur, file, texto) {
    const op = (a, ic, color, t, s) => '<button type="button" class="mas-fila nuevo-op" data-rcm="' + a + '"><span class="kpi-ic kpi-ic-' + color + '">' + icon(ic, 22) + '</span><span><b>' + t + '</b><small>' + s + '</small></span>' + icon('right', 18) + '</button>';
    const m = modal({
      titulo: 'Compartir recibo',
      cuerpoHtml: '<div class="mas-lista">' + op('wa', 'whatsapp', 'verde', 'WhatsApp', 'Envía el resumen del recibo en texto') +
        op('bajar', 'download', 'azul', 'Descargar imagen', 'Para adjuntarla en Messenger u otra aplicación') + op('imprimir', 'printer', 'gris', 'Imprimir', 'Abre la impresión del recibo') + '</div>',
    });
    m.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-rcm]');
      if (!b) return;
      const d = cur.d;
      if (b.dataset.rcm === 'wa') {
        window.open(Dinero.waUrl(Recibo.contacto(cur).telefono, texto), '_blank', 'noopener,noreferrer');
        Recibo.registrar(cur.id, 'WhatsApp', d);
      } else if (b.dataset.rcm === 'bajar') {
        const url = URL.createObjectURL(file), a = document.createElement('a');
        a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15000);
        Recibo.registrar(cur.id, 'Descargado', d);
      } else { Recibo.imprimir(d); Recibo.registrar(cur.id, 'Impreso', d); }
      m.cerrar();
    });
  },

  /** Pide el correo (prellenado con el del alumno) y lo envía. */
  correo() {
    const cur = Recibo.cur;
    if (!cur || cur.d.anulado) return;
    const al = Recibo.contacto(cur);
    const m = modal({
      titulo: 'Enviar recibo por correo',
      cuerpoHtml: '<div class="form-ag"><div class="campo"><label for="rcMail">Correo</label><input id="rcMail" class="input" type="email" inputmode="email" autocomplete="off" maxlength="100" value="' + esc(al.email) + '" placeholder="alumno@correo.com"></div>' +
        '<div id="rcErr" class="aviso aviso-error" role="alert" hidden></div></div>',
      acciones: [{ texto: 'Cancelar', estilo: 'suave' }, {
        texto: 'Enviar', estilo: 'primario',
        async accion(c) {
          const email = c.el.querySelector('#rcMail').value.trim(), err = c.el.querySelector('#rcErr');
          err.hidden = true;
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Escribe un correo válido.'; err.hidden = false; return false; }
          let r;
          try { r = await api('pagos.sendReceipt', { id: cur.id, email }); }
          catch (e) { err.textContent = e.message || MENSAJES.INTERNAL; err.hidden = false; return false; }
          if (r && r.registrado === false) toast('Correo enviado (no se pudo registrar el envío)', 'aviso');
          else toast('Correo enviado.', 'ok');
          refresh(['pagosSemana']).catch(() => {});
        },
      }],
    });
    // La lista de alumnos del arranque no trae el correo: se pide la ficha y se prellena si la persona aún no escribió nada.
    if (al.id && !al.email) {
      api('alumnos.get', { id: al.id }).then((f) => { const i = m.el.querySelector('#rcMail'); if (i && !i.value && f.alumno && f.alumno.email) i.value = f.alumno.email; }).catch(() => {});
    }
  },
};

document.addEventListener('click', (e) => {
  const b = e.target.closest ? e.target.closest('[data-rc]') : null;
  if (!b || !Recibo.cur) return;
  const c = Recibo.cur;
  if (b.dataset.rc === 'compartir') Recibo.compartir(c.d, c.id, c.ctx);
  else if (b.dataset.rc === 'correo') Recibo.correo();
  else if (b.dataset.rc === 'imprimir') { Recibo.imprimir(c.d); Recibo.registrar(c.id, 'Impreso', c.d); }
});

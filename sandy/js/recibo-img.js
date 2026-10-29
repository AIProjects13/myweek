'use strict';
/* Imagen del recibo (PNG para WhatsApp / Messenger), dibujada a mano con la API de canvas, sin librerías.
 * ReciboImg.canvas(data) → Promise<HTMLCanvasElement> de 1080 px de ancho. */
const ReciboImg = {
  W: 1080, PAD: 64,
  FUENTE: '"Plus Jakarta Sans", system-ui, "Segoe UI", Roboto, Arial, sans-serif',
  C: { azul: '#16235e', tinta: '#121a3d', gris: '#5f6b8c', linea: '#e1e6f2', suave: '#f4f7fe', rojo: '#d92d33', blanco: '#ffffff' },

  /** Espera a que las fuentes de la página estén listas (máx. ~1.5 s); si no llegan se usa la fuente del sistema. */
  async fuentes() {
    try {
      if (!document.fonts) return;
      const espera = new Promise((r) => setTimeout(r, 1500));
      await Promise.race([Promise.all([document.fonts.load('700 30px "Plus Jakarta Sans"'), document.fonts.load('500 30px "Plus Jakarta Sans"'), document.fonts.ready]), espera]);
    } catch (e) { /* se queda con la fuente del sistema */ }
  },

  /** Carga el logo (solo https) con crossOrigin anónimo; → Image o null si falla o tarda más de 3 s. */
  cargarLogo(url) {
    if (!/^https:\/\//i.test(String(url || ''))) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      let h = null;
      const fin = (v) => { clearTimeout(h); img.onload = img.onerror = null; resolve(v); };
      h = setTimeout(() => fin(null), 3000);
      img.crossOrigin = 'anonymous';
      img.onload = () => fin(img.naturalWidth > 0 ? img : null);
      img.onerror = () => fin(null);
      img.src = url;
    });
  },

  /** Parte un texto en líneas que quepan en ancho (rompe palabras muy largas). */
  lineas(ctx, texto, ancho) {
    const out = [];
    String(texto === null || texto === undefined ? '' : texto).split(/\n/).forEach((par) => {
      let cur = '';
      par.split(/\s+/).filter(Boolean).forEach((p) => {
        while (ctx.measureText(p).width > ancho) { // palabra más ancha que la línea
          let n = p.length;
          while (n > 1 && ctx.measureText(p.slice(0, n)).width > ancho) n--;
          if (cur) { out.push(cur); cur = ''; }
          out.push(p.slice(0, n)); p = p.slice(n);
        }
        const t = cur ? cur + ' ' + p : p;
        if (cur && ctx.measureText(t).width > ancho) { out.push(cur); cur = p; } else cur = t;
      });
      out.push(cur);
    });
    return out;
  },

  rect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  },

  /** Dibuja todo el recibo en ctx y devuelve el alto usado. */
  pintar(ctx, d, logo) {
    const R = ReciboImg, c = R.C, W = R.W, P = R.PAD, F = R.FUENTE, e = d.escuela || {};
    const fuente = (px, peso) => { ctx.font = peso + ' ' + px + 'px ' + F; };
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = c.blanco; ctx.fillRect(0, 0, W, 4000);
    // Encabezado: logo o nombre de la escuela
    ctx.fillStyle = c.azul; ctx.fillRect(0, 0, W, 210);
    if (logo) {
      const k = Math.min(520 / logo.naturalWidth, 130 / logo.naturalHeight, 1.5), w = logo.naturalWidth * k, h = logo.naturalHeight * k;
      ctx.drawImage(logo, P, (210 - h) / 2, w, h);
    } else {
      ctx.fillStyle = c.blanco; fuente(46, 800);
      const l = R.lineas(ctx, e.nombre || '', W - P * 2).slice(0, 2);
      const y0 = 105 - (l.length - 1) * 30 + 16;
      l.forEach((t, i) => ctx.fillText(t, P, y0 + i * 60));
    }
    let y = 290;
    ctx.fillStyle = c.gris; fuente(28, 700); ctx.fillText('RECIBO DE PAGO', P, y);
    y += 70; ctx.fillStyle = c.tinta; fuente(64, 800); ctx.fillText(String(d.numero || ''), P, y);
    // Monto
    y += 50;
    ctx.fillStyle = c.suave; R.rect(ctx, P, y, W - P * 2, 150, 28); ctx.fill();
    ctx.fillStyle = c.tinta; fuente(88, 800); ctx.textAlign = 'center'; ctx.fillText(Calc.money(d.monto), W / 2, y + 102); ctx.textAlign = 'left';
    y += 150 + 30;
    // Filas
    const filas = [['Alumno', d.alumno], ['A nombre de', d.aNombreDe], ['Concepto', d.concepto], ['Fecha de pago', fechaLarga(d.fecha)], ['Método', d.metodo]];
    if (d.referencia) filas.push(['Referencia', d.referencia]);
    filas.push(['Saldo de la venta', Calc.money(d.saldo)], ['Registrado por', d.registradoPor]);
    filas.forEach((f) => {
      ctx.fillStyle = c.linea; ctx.fillRect(P, y, W - P * 2, 2);
      ctx.fillStyle = c.gris; fuente(26, 600); ctx.fillText(f[0], P, y + 44);
      ctx.fillStyle = c.tinta; fuente(34, 700);
      const l = R.lineas(ctx, f[1], W - P * 2);
      l.forEach((t, i) => ctx.fillText(t, P, y + 92 + i * 44));
      y += 92 + (l.length - 1) * 44 + 28;
    });
    // Pie
    ctx.fillStyle = c.linea; ctx.fillRect(P, y, W - P * 2, 2); y += 56;
    ctx.fillStyle = c.gris; fuente(26, 500);
    R.lineas(ctx, [e.nombre, e.telefono, e.direccion].filter(Boolean).join(' · '), W - P * 2).forEach((t) => { ctx.fillText(t, P, y); y += 38; });
    y += 6; fuente(24, 500); ctx.fillText('Comprobante interno, no es factura.', P, y);
    return y + 60;
  },

  /** Canvas del recibo ya dibujado (con o sin logo). Primero se mide en un canvas auxiliar para fijar el alto. */
  dibujar(d, logo) {
    const R = ReciboImg;
    const medida = document.createElement('canvas'); medida.width = R.W; medida.height = 4000;
    const alto = Math.ceil(R.pintar(medida.getContext('2d'), d, logo));
    const cv = document.createElement('canvas'); cv.width = R.W; cv.height = alto;
    const ctx = cv.getContext('2d');
    R.pintar(ctx, d, logo);
    if (d.anulado) { // sello ANULADO
      ctx.save(); ctx.translate(R.W / 2, alto * 0.45); ctx.rotate(-0.35);
      ctx.globalAlpha = 0.78; ctx.strokeStyle = R.C.rojo; ctx.fillStyle = R.C.rojo; ctx.lineWidth = 14;
      ctx.font = '800 170px ' + R.FUENTE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText('ANULADO').width + 90;
      R.rect(ctx, -w / 2, -125, w, 250, 36); ctx.stroke();
      ctx.fillText('ANULADO', 0, 6);
      ctx.restore();
    }
    return cv;
  },

  /** → Promise<HTMLCanvasElement>. Si el logo ensucia el canvas (sin permiso CORS), se vuelve a dibujar sin logo. */
  async canvas(d) {
    const R = ReciboImg;
    await R.fuentes();
    const logo = await R.cargarLogo(d.escuela && d.escuela.logoUrl);
    let cv = R.dibujar(d, logo);
    if (logo) { try { cv.getContext('2d').getImageData(0, 0, 1, 1); } catch (e) { cv = R.dibujar(d, null); } }
    return cv;
  },
};

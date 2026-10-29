/* MyWeek · manual de uso: índice que sigue la lectura (lateral en computadora, desplegable en el celular),
 * WhatsApp con mensaje escrito y año del pie. */
(function () {
  var MSG = '¡Hola! Leí el manual de MyWeek y me gustaría verlo con los planes e instructores de mi escuela de manejo.';
  document.querySelectorAll('[data-wa]').forEach(function (a) { a.href = 'https://wa.me/50258253416?text=' + encodeURIComponent(MSG); });

  var hdr = document.querySelector('.hdr');
  addEventListener('scroll', function () { hdr.classList.toggle('scrolled', scrollY > 8); }, { passive: true });

  // Índice: abierto siempre en computadora; en el celular arranca cerrado y se cierra al elegir un capítulo
  var toc = document.getElementById('indice');
  var celular = matchMedia('(max-width: 1000px)');
  var ajustar = function () { toc.open = !celular.matches; };
  ajustar();
  celular.addEventListener('change', ajustar);
  toc.addEventListener('click', function (e) { if (e.target.closest('a') && celular.matches) toc.open = false; });

  // Marca el capítulo que se está leyendo (y lo muestra en la barra del desplegable)
  var enlaces = [].slice.call(toc.querySelectorAll('a'));
  var secciones = enlaces.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
  var actualTxt = document.getElementById('tocActual');
  var marcar = function () {
    var actual = secciones[0];
    var umbral = Math.max(200, innerHeight * 0.45); // se activa cuando el título llega a la mitad superior de la pantalla
    secciones.forEach(function (s) { if (s.getBoundingClientRect().top < umbral) actual = s; });
    enlaces.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + actual.id;
      a.classList.toggle('on', on);
      if (on) { a.setAttribute('aria-current', 'true'); actualTxt.textContent = a.textContent; } else a.removeAttribute('aria-current');
    });
  };
  var raf = 0;
  addEventListener('scroll', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(marcar); }, { passive: true });
  marcar();

  var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
})();

/* MyWeek · impide que otra web muestre estas páginas dentro de la suya.
 * Solo se permite estar dentro de un marco del mismo sitio (la demo dentro de la página). */
(function () {
  if (window.top === window.self) return;
  var mismo = false;
  try { mismo = window.top.location.origin === window.location.origin; } catch (e) { mismo = false; }
  if (!mismo) {
    document.documentElement.style.display = 'none';
    try { window.top.location = window.self.location.href; } catch (e) { /* el navegador lo impide: la página queda oculta */ }
  }
})();

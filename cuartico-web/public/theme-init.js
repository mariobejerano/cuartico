// Tema elegido con el botón sol/luna (design system §7.12): se aplica ANTES de pintar para que no haya destello.
// Es un archivo y no un <script> en línea porque la CSP (script-src 'self') prohíbe los scripts en línea.
try {
  var t = localStorage.getItem("cuartico.theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}

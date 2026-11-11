(function () {
  "use strict";
  /* Datos y ajustes de Trapani Salon.
     El contenido visible está escrito en index.html; esto solo configura el comportamiento. */
  window.__BRAND__ = {
    name: "Trapani Salon",
    bookingUrl: "https://web.bewe.co/trapani/services",

    /* Horario (hora de Argentina). 0 = domingo … 6 = sábado. null = cerrado. */
    timezone: "America/Argentina/Buenos_Aires",
    hours: { 0: null, 1: null, 2: [10, 19], 3: [10, 19], 4: [10, 19], 5: [10, 19], 6: [10, 19] },

    /* Modo propuesta: distintivo, ventana "qué incluye" y aviso de videos de muestra.
       Para entregar la web como definitiva: on: false.
       whatsapp: solo números con código de país (ej. 5493415551234). Vacío = sin botón. */
    pitch: { on: true, name: "Álvaro", whatsapp: "" },

    /* Videos de trabajos. Para cambiar uno, reemplazar el archivo con el mismo nombre
       (assets/video/trabajo-01.mp4 …) y su imagen fija (assets/img/trabajo-01.webp). */
    clips: {
      "01": "assets/video/trabajo-01.mp4",
      "02": "assets/video/trabajo-02.mp4",
      "03": "assets/video/trabajo-03.mp4",
      "04": "assets/video/trabajo-04.mp4",
      "05": "assets/video/trabajo-05.mp4",
      "06": "assets/video/trabajo-06.mp4",
      "07": "assets/video/trabajo-07.mp4",
      "08": "assets/video/trabajo-08.mp4",
      "09": "assets/video/trabajo-09.mp4"
    }
  };
})();

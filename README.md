# Trapani Salon — web

Web estática (HTML, CSS y JavaScript sin dependencias). Se abre directamente con `index.html` o se sube tal cual a cualquier hosting.

## Estructura

- `index.html` — todo el contenido: servicios, horarios, contacto.
- `styles.css` — diseño.
- `main.js` — animaciones e interacción.
- `lib/manifest.js` — ajustes: horario, enlace de reservas, modo propuesta.
- `assets/video/` y `assets/img/` — videos y sus imágenes fijas.

## Cambiar los videos de trabajos

Los videos actuales son de muestra (ver `assets/credits.json`). Para usar trabajos reales:

1. Reemplazar `assets/video/trabajo-01.mp4` … `trabajo-09.mp4` (vertical 9:16, sin audio, 5–8 s, 540×960).
2. Reemplazar la imagen fija de cada uno en `assets/img/trabajo-01.webp` … `trabajo-09.webp`.
3. Si cambia el servicio que muestra, editar el título en `index.html` (sección Trabajos).

## Entregar como definitiva

En `lib/manifest.js`, poner `pitch: { on: false, … }`. Desaparecen el distintivo de propuesta y el aviso de videos de muestra.

# ListeningClassroom — AdSense compliance remediation

## Alcance y cautela

Esta auditoría identifica discrepancias locales verificables entre el código, las páginas públicas y las señales enviadas por el sitio. No demuestra por qué Google rechazó la solicitud por “Dishonest declarations”; no se atribuye ese rechazo a ningún hallazgo concreto. No se modificó la cuenta de Google, no se solicitó una nueva revisión y no se desplegó el sitio.

Las políticas describen el comportamiento técnico observado; no constituyen una opinión legal ni una garantía de aprobación. La rama de trabajo es `audit/adsense-compliance-remediation`.

## A. Problemas encontrados

| ID | Problema | Archivo | Gravedad | Evidencia |
|---|---|---|---|---|
| A-01 | Las declaraciones sobre anuncios y consentimiento no describían de forma verificable cuándo se descargaba AdSense. | `README.md`, `privacy.html`, `terms.html`, `consent.js`, `scripts/build.mjs` | Alta | Las páginas de recursos incluían el tag de AdSense antes de que el visitante eligiera; el texto anterior decía o sugería que los anuncios no se servían o que Google solo se cargaba tras aceptar. El tag por sí solo no prueba que un anuncio llegue a mostrarse; eso depende también de ajustes externos. |
| A-02 | Las afirmaciones amplias de que no se recopilaban datos personales omitían datos técnicos que pueden acompañar las solicitudes a terceros. | `about.html`, `index.html`, `privacy.html` | Alta | Google Fonts, AdSense, GTM/GA4 y el hosting reciben solicitudes web; la IP y datos del navegador pueden ser tratados por esos proveedores. El código local no permite afirmar que ningún tercero reciba datos técnicos. |
| A-03 | La política de privacidad tenía una referencia incorrecta a la sección de contacto. | `privacy.html`, `es/privacy.html` (generado) | Baja | La referencia dirigía a la sección 7 cuando el contacto está en la sección 8. |
| A-04 | Las señales Consent Mode v2 no se establecían explícitamente antes de descargar el tag de AdSense. | `scripts/build.mjs` y HTML generado | Alta | El tag se incluía antes de que `consent.js` procesara una elección; no había una llamada predeterminada `consent` previa al tag. |
| A-05 | Faltaba una verificación automatizada común de publisher, `ads.txt`, etiquetas, metadatos y sitemap. | `scripts/` | Media | La inspección manual no impedía que una futura generación introdujera IDs antiguos, tags duplicados o URLs canónicas divergentes. |
| A-06 | Las páginas institucionales no exponían todas las relaciones idiomáticas en metadatos de forma uniforme. | `about.html`, `contact.html`, `privacy.html`, `terms.html`, sus versiones ES | Baja | La revisión de fuentes encontró `hreflang` incompleto/inconsistente entre páginas institucionales. |
| A-07 | La interfaz del generador ofrecía cinco voces pese a que el proyecto tiene seis voces Kokoro locales. | `generator/index.html`, pruebas de actividades/assets | Media (regresión funcional) | `am_adam.bin` estaba disponible, pero Adam no figuraba en el selector. |
| A-08 | No se encontró una CMP certificada por Google integrada con IAB TCF; la interfaz propia puede conceder `ad_personalization` al aceptar. | `consent.js` y configuración del sitio | Alta, pendiente externo | El código no implementa TCF ni identifica una CMP certificada. Google indica que hace falta una CMP certificada integrada con TCF para servir anuncios personalizados en EEE, Reino Unido y Suiza. La elegibilidad de anuncios no personalizados o limitados depende de Google y de la configuración aplicable. |
| A-09 | No es posible confirmar si GTM inicializa otra etiqueta GA4 ni cómo están configurados los anuncios automáticos. | Configuración remota de GTM/AdSense | Pendiente de acceso | Los IDs y scripts locales pueden inspeccionarse; las etiquetas y opciones configuradas dentro de las cuentas remotas no están en el repositorio. |
| A-10 | No se encontró un control visible y verificable “Do Not Sell or Share” para California. | `consent.js`, `privacy.html` | Alta, requiere revisión | Existe código para una barra CCPA, pero la revisión no encontró una ruta que la muestre. Rechazar cookies deniega señales publicitarias en Consent Mode, pero el tag de AdSense aún puede cargarse. No se afirma que esto satisfaga derechos legales de California. |

### Comprobaciones sin discrepancia local confirmada

- `ads.txt` contiene únicamente `google.com, pub-7086938365759492, DIRECT, f08c47fec0942fa0`; coincide con el publisher configurado en el tag.
- No se encontró otro publisher ID en los archivos revisados. La prueba cubre todos los HTML del árbol, `ads.txt` y duplicados del tag.
- `CNAME`, las URLs canónicas, Open Graph, `robots.txt` y el sitemap usan `https://listeningclassroom.com`. El sitemap tiene URLs únicas y locales existentes.
- En la inspección de producción previa, `/ads.txt` respondió correctamente con el publisher actual; HTTP y el host `www` redirigían al dominio canónico. Esta comprobación no valida todos los recursos ni el estado de producción posterior al próximo despliegue.
- No se encontró un segundo tag directo de AdSense en las páginas generadas. La existencia de Auto ads u otras opciones remotas sigue sin poder verificarse.
- `tools/benchmark-kokoro.html` es una utilidad local ignorada por `.gitignore`, junto con su worker; no está versionada ni forma parte del sitio desplegable. Por ello no se trataron sus solicitudes a Hugging Face como tráfico del sitio público y se excluyó del inventario de cumplimiento.

## B. Correcciones realizadas

| ID | Corrección | Archivos modificados | Validación |
|---|---|---|---|
| C-01 | Reescritas las declaraciones EN/ES para distinguir el texto procesado localmente de los datos técnicos que podrían recibir hosting y terceros. | `about.html`, `index.html`, `privacy.html`, `terms.html`, `README.md`; páginas `es/` generadas | `scripts/test-adsense-compliance.mjs`; build y revisión de texto bilingüe |
| C-02 | Documentado que AdSense puede descargarse antes de elegir, con señales predeterminadas denegadas; se aclara que denegar señales no bloquea la descarga ni prueba que no haya solicitudes. | `privacy.html`, `terms.html`, `index.html`, `consent.js`, `README.md`; páginas generadas | `scripts/test-consent.mjs`, `scripts/test-adsense-compliance.mjs` |
| C-03 | Añadido Consent Mode v2 predeterminado antes del tag de AdSense. `accepted` concede las cuatro señales; `limited` deniega las tres publicitarias y concede analítica; `rejected` las deniega todas. GTM/GA4 se insertan tras aceptar o permitir analítica. | `scripts/build.mjs`, `consent.js` | `scripts/test-consent.mjs`; comprobación del orden y los cuatro estados en cada página con AdSense |
| C-04 | Corregida la referencia a la sección 8 y añadidos landmarks `<main>` a las páginas legales; se verifican idioma, encabezado principal y nombres de enlaces no vacíos. | `privacy.html`, `terms.html`; versiones `es/` generadas; `scripts/test-adsense-compliance.mjs` | Prueba automatizada estática; no equivale a una auditoría WCAG completa |
| C-05 | Normalizados los metadatos `hreflang` EN/ES/x-default para las páginas revisadas. | `about.html`, `contact.html`, `privacy.html`, `terms.html`, `generator/index.html`, `scripts/build.mjs`, páginas `es/` generadas | Validación de canonical, Open Graph y alternates en las 94 URLs del sitemap |
| C-06 | Añadida la sexta voz Adam al selector y a las comprobaciones de assets/actividades. | `generator/index.html`, `scripts/test-kokoro-assets.mjs`, `scripts/test-activities-browser.mjs`, `es/generator/index.html` generado | Assets locales verificados y prueba de actividades EN/ES |
| C-07 | Añadida una prueba de regresión de cumplimiento para IDs, `ads.txt`, tags duplicados, Consent Mode, textos EN/ES, páginas legales y sitemap. | `scripts/test-adsense-compliance.mjs` | `node scripts/test-adsense-compliance.mjs` |

Las páginas españolas y los HTML de recursos son resultados generados. Se deben regenerar con `node scripts/build.mjs`; no se deben editar manualmente las copias generadas cuando exista una fuente mantenida.

## C. Pendientes

1. **CMP/TCF y geografía:** decidir y configurar una CMP certificada por Google con integración IAB TCF antes de servir anuncios personalizados a usuarios del EEE, Reino Unido o Suiza. Verificar el estado y la lista vigente en [Google: requisitos de gestión del consentimiento](https://support.google.com/adsense/answer/13554116?hl=en). El repositorio no puede confirmar ni suplir la configuración de una CMP.
2. **California:** obtener revisión legal sobre si el tratamiento de datos de publicidad/analítica activa derechos de opt-out. Implementar y probar el control apropiado si corresponde; no presentar el rechazo genérico de cookies como cumplimiento demostrado.
3. **Configuración remota:** revisar GTM `GTM-KTXQJMMH` para detectar etiquetas GA4 duplicadas y confirmar activadores/señales; revisar Google Analytics `G-E1D8VDYM6D` y opciones de AdSense/Auto ads en sus respectivas cuentas.
4. **Identidad y condiciones:** revisar legalmente la política y los términos, incluyendo qué identidad/contacto del operador debe publicarse. No se añadieron nombre, empresa ni domicilio porque no se proporcionaron datos verificables.
5. **Producción:** después de un despliegue autorizado, verificar el HTML realmente servido en páginas con y sin anuncios, las redirecciones, canonical/alternates, `/ads.txt`, sitemap, solicitudes de red y comportamiento del banner en EN/ES y en las regiones relevantes.
6. **Prueba de anuncios:** confirmar mediante herramientas de Google y observación autorizada qué anuncios se sirven y bajo qué modo. La inspección local no puede probar si AdSense muestra anuncios, si hay Auto ads habilitados ni qué mensajes remotos aparecen.

No se envió solicitud de aprobación ni se desplegó ningún cambio.

## D. Pruebas ejecutadas

| Comando / comprobación | Resultado |
|---|---|
| `node scripts/build.mjs` | Correcto: 15 ejercicios, 7 guías, 94 URLs en sitemap y 96 HTML validados en build. La utilidad independiente `tools/benchmark-kokoro.html` queda fuera de ese validador. |
| `node scripts/test-adsense-compliance.mjs` | Correcto: 96 HTML versionados/parte del sitio inspeccionados, 82 con AdSense, 94 URLs canónicas verificadas. Excluye la utilidad local ignorada en `tools/`. |
| `node scripts/test-consent.mjs` | Correcto: estados por opción y Consent Mode predeterminado. |
| `node scripts/test-kokoro-assets.mjs` | Correcto: 10 assets locales verificados. |
| `node scripts/test-activities-browser.mjs` | Correcto: flujos EN/ES, voces, audio simple/diálogo, MP3, actividades, teclado/ratón y responsive. |
| `node scripts/browser-qa.mjs` | Correcto en la auditoría previa: 15 ejercicios, desktop y mobile, contra servidor local. |
| `node scripts/audio-benchmark.mjs` | Correcto en la auditoría previa contra servidor local; WebGPU disponible, previews generadas y cero errores. |
| Pruebas de contenido, calidad editorial y word search | Correctas en la auditoría previa. |
| `git diff --check` | Reporta los caracteres CR de líneas CRLF como whitespace en archivos modificados; no se normalizaron masivamente los finales de línea para evitar alterar cambios existentes. |
| Verificación HTTP de producción previa | `/ads.txt` accesible con el publisher actual; HTTP y `www` redirigían al host canónico. No es una validación de la versión aún no desplegada. |

La prueba automática de accesibilidad es limitada a idioma declarado, landmark principal, encabezado y nombres no vacíos de enlaces en Privacy/Terms. No se ejecutó axe, una auditoría WCAG integral ni pruebas con lector de pantalla.

## E. Riesgos residuales

- **El motivo “Dishonest declarations” no queda explicado:** los hallazgos son discrepancias verificables, pero no hay evidencia que conecte causalmente ninguno con la decisión de AdSense.
- **Solicitudes antes de elegir:** AdSense se carga en páginas de recursos aun con consentimiento por defecto denegado. El consentimiento limita señales, pero no impide la descarga del tag ni demuestra ausencia de solicitudes.
- **CMP y anuncios personalizados:** sin CMP certificada/TCF no se debe asumir elegibilidad para anuncios personalizados en EEE, Reino Unido o Suiza. La política final depende de implementación, territorio y configuración de la cuenta.
- **Servicios administrados remotamente:** GTM puede incluir etiquetas que no aparecen en el código local; la configuración de anuncios y mensajes de AdSense tampoco puede verificarse desde este repositorio.
- **Privacidad/legalidad:** Google, el hosting y otros proveedores pueden tratar datos de solicitudes. La evaluación legal de California y demás jurisdicciones requiere información del operador y revisión profesional.
- **Despliegue pendiente:** las comprobaciones de producción describen el sitio inspeccionado anteriormente, no estos cambios locales. No afirmar cumplimiento total ni solicitar una nueva revisión hasta resolver y verificar los pendientes.

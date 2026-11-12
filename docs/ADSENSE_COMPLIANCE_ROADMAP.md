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
| `node scripts/test-consent.mjs` | Correcto: opciones legacy en región confirmada, Consent Mode, Basic Mode europeo simulado, región no disponible fail-closed, GPC, opt-out US simulado, revocación encolada y rutas desde páginas sin AdSense. No es prueba Google real. |
| `node scripts/test-kokoro-assets.mjs` | Correcto: 10 assets locales verificados. |
| `node scripts/test-activities-browser.mjs` | Correcto: flujos EN/ES, voces, audio simple/diálogo, MP3, actividades, teclado/ratón y responsive. |
| `node scripts/test-privacy-messaging-browser.mjs` | Correcto: Playwright local en escenarios simulados EEE/UK/Suiza, Chile, estado US, GPC, aceptar/rechazar/parcial, persistencia/revocación y ruta ES. Red de Google fue stub; no valida CMP, TCF, GPP ni AdSense real. |
| `node --check consent.js` y `node --check` sobre cada test script modificado | Correcto: sintaxis de scripts modificados. |
| `node scripts/browser-qa.mjs` | Correcto tras iniciar un servidor local en `127.0.0.1:8765`: 15 ejercicios, desktop y mobile. |
| `node scripts/browser-qa.mjs` | Correcto en la auditoría previa: 15 ejercicios, desktop y mobile, contra servidor local. |
| `node scripts/audio-benchmark.mjs` | Correcto en la auditoría previa contra servidor local; WebGPU disponible, previews generadas y cero errores. |
| Pruebas de contenido, calidad editorial y word search | Correctas en la auditoría previa. |
| Inventario de Phase 2 | Una inspección local de HTML y comparación con esta tabla verificó 96 páginas, 82 tags directos y 14 sin tag, sin rutas faltantes ni duplicadas. |
| Revisión estática de IDs y señales | Un GTM ID y un GA4 ID directos. El cambio local añade conexión a TCF API, detección de `navigator.globalPrivacyControl` y lectura de señales GPP de cambios vía `__gpp`; no genera TC string ni escribe GPP. No se encontró un segundo snippet/config GA4 directo; etiquetas remotas del contenedor siguen fuera del alcance local. |
| Revisión de fuentes externas | Documentación oficial de Google sobre CMP/TCF, AdSense NPA, Consent Mode, mensajes US-state/GPP y regulaciones CPPA consultada el 12 de noviembre de 2026; la documentación TCF contiene referencias de versiones distintas, registradas en F y K. |
| `git diff --check` | Reporta CRLF como whitespace en archivos previamente modificados; no se normalizaron finales de línea para no alterar cambios existentes. |
| Verificación HTTP de producción previa | `/ads.txt` accesible con el publisher actual; HTTP y `www` redirigían al host canónico. No es una validación de la versión aún no desplegada. |

La prueba automática de accesibilidad es limitada a idioma declarado, landmark principal, encabezado y nombres no vacíos de enlaces en Privacy/Terms. No se ejecutó axe, una auditoría WCAG integral ni pruebas con lector de pantalla.

## E. Riesgos residuales

- **El motivo “Dishonest declarations” no queda explicado:** los hallazgos son discrepancias verificables, pero no hay evidencia que conecte causalmente ninguno con la decisión de AdSense.
- **Solicitudes antes de elegir:** AdSense se carga en páginas de recursos aun con consentimiento por defecto denegado. El consentimiento limita señales, pero no impide la descarga del tag ni demuestra ausencia de solicitudes.
- **CMP y anuncios personalizados:** sin CMP certificada/TCF no se debe asumir elegibilidad para anuncios personalizados en EEE, Reino Unido o Suiza. La política final depende de implementación, territorio y configuración de la cuenta.
- **Servicios administrados remotamente:** GTM puede incluir etiquetas que no aparecen en el código local; la configuración de anuncios y mensajes de AdSense tampoco puede verificarse desde este repositorio.
- **Privacidad/legalidad:** Google, el hosting y otros proveedores pueden tratar datos de solicitudes. La evaluación legal de California y demás jurisdicciones requiere información del operador y revisión profesional.
- **Despliegue pendiente:** las comprobaciones de producción describen el sitio inspeccionado anteriormente, no estos cambios locales. No afirmar cumplimiento total ni solicitar una nueva revisión hasta resolver y verificar los pendientes.

## F. Fase 2 — CMP y consentimiento para EEE, Reino Unido y Suiza

### Comportamiento local verificado

No hay detección de país, región, GPC ni TCF en `consent.js`. Las mismas opciones y transiciones se aplican a todos los visitantes, independientemente de su ubicación; la opción “Allow analytics only” se muestra globalmente, no solo en California. La respuesta efectiva de AdSense puede variar por ubicación y por ajustes remotos no visibles aquí.

En las 82 páginas de recursos con AdSense, `scripts/build.mjs` inserta en el `<head>`, antes del tag asíncrono de AdSense, un estado predeterminado denegado para `ad_storage`, `ad_user_data`, `ad_personalization` y `analytics_storage`, con `wait_for_update: 500`. Esto transmite el default antes de descargar el tag, pero **no bloquea su descarga ni demuestra que no haya solicitudes**. Después, `consent.js` aplica la elección guardada o la del visitante. En las otras 14 páginas no hay tag directo de AdSense.

| Elección | `ad_storage` | `ad_user_data` | `ad_personalization` | `analytics_storage` | Efecto local |
|---|---|---|---|---|---|
| Aceptar (`accepted`) | granted | granted | **granted** | granted | Actualiza Consent Mode y carga GTM y el tag directo de GA4. En páginas con AdSense, puede habilitar señales de personalización después del default inicial. |
| Rechazar (`rejected`) | denied | denied | denied | denied | No carga GTM ni el tag directo de GA4. En páginas con AdSense el tag ya puede haberse descargado; las señales denegadas no lo bloquean. |
| Solo analítica (`limited`) | denied | denied | denied | granted | Actualiza señales y carga GTM y GA4; el tag de AdSense puede seguir cargado y Google puede determinar si corresponde una solicitud limitada u otra respuesta. |

La preferencia se guarda en `localStorage` hasta 365 días. `consent.js` no cambia `ad_personalization` por ubicación: aceptar lo concede también a visitantes del EEE, Reino Unido y Suiza. No existe `__tcfapi`, TC string, `IABTCF_*`, ni una CMP identificada en el código. Por tanto, el repositorio no puede demostrar que una elección aceptada en esos territorios sea una elección recogida mediante una CMP certificada/TCF. Tampoco se verificó qué tipo de anuncio sirve realmente la cuenta en cada país.

Google distingue dos hechos relevantes:

- Para anuncios personalizados a usuarios del EEE, Reino Unido y Suiza se exige CMP certificada por Google e integrada con IAB TCF. La lista oficial consultada el **12 de noviembre de 2026** identifica a **Google LLC CMP, ID 300, Web and app**; Google Privacy & messaging documenta mensajes europeos certificados. La lista indica que se actualiza semanalmente.
- Google dice que tráfico de una CMP no certificada *puede* ser elegible para anuncios no personalizados o limitados, donde esté soportado; no garantiza que cada solicitud sea elegible. En la documentación disponible al cierre de esta auditoría hay una discrepancia de versiones: el artículo de integración TCF aún afirma v2.3/1 de marzo de 2026, mientras que el artículo vigente de mensajes europeos indica que Privacy & messaging fue actualizado para TCF v2.4. La Fase 3 fija v2.4 como objetivo; v2.3 no es un objetivo de implementación.

### Alternativas evaluadas

| Criterio | A. CMP certificada con TCF | B. No personalizar en las regiones afectadas |
|---|---|---|
| Coste | Google Privacy & messaging se administra dentro de AdSense. La documentación consultada no publica una tarifa separada; no se debe asumir coste cero sin comprobar las condiciones de la cuenta. Las CMP de terceros pueden tener planes/precios propios, no comparados aquí. | No requiere necesariamente contratar una CMP si se mantiene un diálogo propio; hay coste de desarrollo, pruebas y mantenimiento. La detección regional robusta puede exigir un servicio/proveedor adicional. Desactivar personalización globalmente evita esa detección, pero afecta también al resto del mundo. |
| Complejidad | Media con Google CMP; mayor con un proveedor externo y su integración. Requiere configurar el mensaje, proveedor(es), propósitos, idiomas, región y revocación; sustituir o coordinar el diálogo actual para evitar dos interfaces o estados incompatibles. AdSense consume automáticamente el TC string de una CMP TCF. | Media-alta si solo se aplica a ciertas regiones: actualmente no existe geolocalización y la página estática no la proporciona. Debe decidirse cómo separar regiones, asegurar que **todas** las solicitudes de anuncios de esas regiones queden sin personalización y probar los resultados. Aplicar NPA globalmente es más sencillo, pero amplía el efecto. |
| Requisitos técnicos | CMP certificada para **Web**, integrada con el TCF v2.4 objetivo; TC string válido y consentimiento/propósitos adecuados; sincronización de revocación; pruebas en las 82 páginas con anuncios. En las 14 sin tag, confirmar si se necesita exponer el mensaje o revocación. Ver la discrepancia documental de versiones en K. | `ad_personalization=denied` por sí solo no prueba que cada solicitud sea NPA. Google documenta para el tag asíncrono AdSense `adsbygoogle.requestNonPersonalizedAds=1` antes de las solicitudes; la configuración debe preceder a cada solicitud pertinente. NPA aún usa cookies para frecuencia y reportes agregados: donde se requiera, hace falta consentimiento para ese almacenamiento. Sin consentimiento de Purpose 1, Google indica que pueden servir anuncios limitados. |
| Monetización | Permite optar por anuncios personalizados cuando CMP, TC string, propósitos y elección del usuario son válidos; si no, podrían ser NPA o limitados según los consentimientos y compatibilidad. No garantiza ingresos ni aprobación. | Evita la personalización en las regiones elegidas; conserva potencial para anuncios contextuales/NPA o limitados cuando Google y la base legal lo permitan. El rendimiento puede bajar; no hay una estimación local. Si se aplica globalmente, reduce esa posibilidad también fuera de dichas regiones. |
| GitHub Pages | Compatible con alojamiento estático: es una integración web del lado del cliente y no requiere backend. Sí requiere configuración del sitio/mensajes en AdSense y probar scripts remotos y página por página. | También es técnicamente posible en un sitio estático, pero la segmentación regional no está resuelta por el hosting. La configuración de AdSense puede ofrecer controles adicionales; su disponibilidad para esta cuenta no se puede verificar localmente. |
| Mantenimiento | Seguir el estado de TCF v2.4 en Google CMP, la lista de certificación, idiomas, textos, cuenta y cobertura de página; no fijar v2.3 como fallback. Para CMP externa, verificar certificación Web y compatibilidad v2.4 de forma continua. | Mantener detección/reglas de países, cambios de territorios, flags del tag y el estado NPA en todas las solicitudes; repetir pruebas de red y de cuenta cada vez que cambien las páginas o el tag. |

### Recomendación

**Recomiendo la alternativa A, inicialmente evaluar Google Privacy & messaging (Google LLC CMP ID 300, Web and app), antes de considerar un proveedor externo.** Es la opción con menor incertidumbre para personalización en EEE/Reino Unido/Suiza: figura como CMP certificada Web, el TCF se integra con AdSense y Google gestiona el formato v2.3. Además, es compatible con GitHub Pages. La elección no debe implementarse hasta que el propietario confirme acceso/ajustes de cuenta, coste contractual aplicable, idiomas, proveedores publicitarios y cómo cubrir páginas sin tag.

La alternativa B sigue siendo válida como decisión de producto si se acepta no ofrecer anuncios personalizados en esos territorios. No basta con el estado `ad_personalization=denied`: habría que decidir NPA frente a anuncios limitados, asegurar el parámetro/configuración NPA por solicitud y probarlo con herramientas de red y AdSense. Dado que no hay geodetección local, el modo más simple sería NPA global (con impacto global); una política solo regional requiere una fuente regional fiable o una CMP que resuelva la región. No se recomienda inventar geolocalización a partir del idioma del navegador.

Esta recomendación es técnica y documental, no una conclusión legal ni una garantía de que Google sirva un tipo concreto de anuncio.

## G. Fase 2 — Inventario exacto de HTML

Inventario local al 12 de noviembre de 2026. Origen canónico: `https://listeningclassroom.com`. Las rutas de cada celda son URLs completas al concatenarlas con ese origen. Son 96 HTML versionados/publicables: 82 con una etiqueta directa de AdSense y 14 sin ella. Cada fila en la tabla de anuncios contiene dos URLs separadas (EN y ES), por lo que hay 82 URLs distintas.

### 82 páginas con tag directo de AdSense

| Familia | URL EN | URL ES |
|---|---|---|
| Guías | `/guides/` | `/es/guides/` |
| Guías | `/guides/how-to-build-listening-activities-for-a1-and-a2-students/` | `/es/guides/how-to-build-listening-activities-for-a1-and-a2-students/` |
| Guías | `/guides/how-to-create-dictation-activities/` | `/es/guides/how-to-create-dictation-activities/` |
| Guías | `/guides/how-to-create-listening-exercises-for-esl-students/` | `/es/guides/how-to-create-listening-exercises-for-esl-students/` |
| Guías | `/guides/how-to-practice-english-pronunciation-with-audio/` | `/es/guides/how-to-practice-english-pronunciation-with-audio/` |
| Guías | `/guides/how-to-scaffold-listening-for-mixed-ability-esl-classes/` | `/es/guides/how-to-scaffold-listening-for-mixed-ability-esl-classes/` |
| Guías | `/guides/how-to-teach-listening-vocabulary-in-context/` | `/es/guides/how-to-teach-listening-vocabulary-in-context/` |
| Guías | `/guides/how-to-use-text-to-speech-in-english-classes/` | `/es/guides/how-to-use-text-to-speech-in-english-classes/` |
| Niveles | `/levels/a1/` | `/es/levels/a1/` |
| Niveles | `/levels/a2/` | `/es/levels/a2/` |
| Niveles | `/levels/b1/` | `/es/levels/b1/` |
| Niveles | `/levels/b2/` | `/es/levels/b2/` |
| Índice/ejercicio | `/resources/listening-exercises/` | `/es/resources/listening-exercises/` |
| Ejercicio | `/resources/listening-exercises/asking-for-directions/` | `/es/resources/listening-exercises/asking-for-directions/` |
| Ejercicio | `/resources/listening-exercises/at-school/` | `/es/resources/listening-exercises/at-school/` |
| Ejercicio | `/resources/listening-exercises/at-the-airport/` | `/es/resources/listening-exercises/at-the-airport/` |
| Ejercicio | `/resources/listening-exercises/at-the-restaurant/` | `/es/resources/listening-exercises/at-the-restaurant/` |
| Ejercicio | `/resources/listening-exercises/at-the-supermarket/` | `/es/resources/listening-exercises/at-the-supermarket/` |
| Ejercicio | `/resources/listening-exercises/daily-routine/` | `/es/resources/listening-exercises/daily-routine/` |
| Ejercicio | `/resources/listening-exercises/giving-advice/` | `/es/resources/listening-exercises/giving-advice/` |
| Ejercicio | `/resources/listening-exercises/introducing-yourself/` | `/es/resources/listening-exercises/introducing-yourself/` |
| Ejercicio | `/resources/listening-exercises/job-interview/` | `/es/resources/listening-exercises/job-interview/` |
| Ejercicio | `/resources/listening-exercises/making-a-complaint/` | `/es/resources/listening-exercises/making-a-complaint/` |
| Ejercicio | `/resources/listening-exercises/making-an-appointment/` | `/es/resources/listening-exercises/making-an-appointment/` |
| Ejercicio | `/resources/listening-exercises/my-family/` | `/es/resources/listening-exercises/my-family/` |
| Ejercicio | `/resources/listening-exercises/planning-a-trip/` | `/es/resources/listening-exercises/planning-a-trip/` |
| Ejercicio | `/resources/listening-exercises/travel-problems/` | `/es/resources/listening-exercises/travel-problems/` |
| Ejercicio | `/resources/listening-exercises/weekend-plans/` | `/es/resources/listening-exercises/weekend-plans/` |
| Tema | `/topics/advice/` | `/es/topics/advice/` |
| Tema | `/topics/airport/` | `/es/topics/airport/` |
| Tema | `/topics/appointments/` | `/es/topics/appointments/` |
| Tema | `/topics/complaints/` | `/es/topics/complaints/` |
| Tema | `/topics/daily-routine/` | `/es/topics/daily-routine/` |
| Tema | `/topics/family/` | `/es/topics/family/` |
| Tema | `/topics/introductions/` | `/es/topics/introductions/` |
| Tema | `/topics/restaurant/` | `/es/topics/restaurant/` |
| Tema | `/topics/school/` | `/es/topics/school/` |
| Tema | `/topics/shopping/` | `/es/topics/shopping/` |
| Tema | `/topics/travel/` | `/es/topics/travel/` |
| Tema | `/topics/weekend/` | `/es/topics/weekend/` |
| Tema | `/topics/work/` | `/es/topics/work/` |

Las rutas de esta tabla corresponden a `index.html` en cada directorio, salvo los documentos raíz institucionales de la siguiente tabla.

### 14 páginas sin tag directo de AdSense

| URL | Archivo HTML | Motivo de exclusión | ¿Intencional? | ¿Debería incluir anuncios? | Riesgo de inconsistencia |
|---|---|---|---|---|---|
| `https://listeningclassroom.com/` | `index.html` | Landing page manual; no usa la plantilla de recursos con AdSense. | Sí, según el código actual. | No por defecto; sería una decisión de producto aparte. | GTM remoto podría cargar publicidad pese a la ausencia del tag directo; confirmar el contenedor. |
| `https://listeningclassroom.com/es/` | `es/index.html` | Versión española de la landing, también sin tag directo. | Sí. | No por defecto; mantener paridad EN/ES. | Igual que EN; revisar GTM remoto y que ambas versiones mantengan paridad. |
| `https://listeningclassroom.com/about.html` | `about.html` | Página institucional manual. | Sí. | No recomendado; conservar sin anuncios. | Riesgo bajo localmente; el tag remoto de GTM no se puede verificar. |
| `https://listeningclassroom.com/es/about.html` | `es/about.html` | Página institucional española generada. | Sí. | No recomendado; conservar sin anuncios. | Mantener paridad EN/ES y revisar GTM remoto. |
| `https://listeningclassroom.com/contact.html` | `contact.html` | Página de contacto; no es una página de contenido monetizable. | Sí. | No recomendado. | GTM remoto podría cambiar el comportamiento; no hay tag directo. |
| `https://listeningclassroom.com/es/contact.html` | `es/contact.html` | Versión española de contacto. | Sí. | No recomendado. | Mantener paridad EN/ES; comprobar GTM remoto. |
| `https://listeningclassroom.com/generator/` | `generator/index.html` | Aplicación interactiva de generación Kokoro, fuera de la plantilla de recursos. | Sí. | No recomendado sin una decisión explícita y revisión de UX/privacidad. | GTM remoto podría cargar etiquetas; el código local no incluye AdSense. |
| `https://listeningclassroom.com/es/generator/` | `es/generator/index.html` | Versión española de la aplicación. | Sí. | No recomendado; mantener paridad con EN. | Mismo riesgo de GTM remoto y paridad. |
| `https://listeningclassroom.com/privacy.html` | `privacy.html` | Política de privacidad. | Sí. | No; mantenerla libre de anuncios. | Un tag insertado remotamente contradiría la lista/documentación de páginas excluidas. |
| `https://listeningclassroom.com/es/privacy.html` | `es/privacy.html` | Política de privacidad en español. | Sí. | No; mantenerla libre de anuncios. | Igual que EN; verificar GTM remoto. |
| `https://listeningclassroom.com/terms.html` | `terms.html` | Términos de uso. | Sí. | No; mantenerla libre de anuncios. | Un tag remoto contradiría la exclusión declarada. |
| `https://listeningclassroom.com/es/terms.html` | `es/terms.html` | Términos de uso en español. | Sí. | No; mantenerla libre de anuncios. | Igual que EN; verificar GTM remoto. |
| `https://listeningclassroom.com/support/` | `support/index.html` | Página de apoyo/donaciones con enlaces a PayPal. | Sí. | No recomendado; separar donaciones de anuncios es coherente con la función. | GTM remoto podría cargar anuncios; además, confirmar que la medición de apoyo respete consentimiento. |
| `https://listeningclassroom.com/es/support/` | `es/support/index.html` | Versión española de apoyo/donaciones. | Sí. | No recomendado; mantener paridad. | Igual que EN; revisar GTM remoto y medición. |

“Sin AdSense” significa que no se encontró el tag asíncrono directo en ese HTML. Como `consent.js` puede cargar GTM después de una elección permitida, **la ausencia local no demuestra que la configuración remota no inserte otra etiqueta**. No se recomienda agregar ads a estas 14 páginas en esta fase.

## H. Fase 2 — CCPA, señales estadounidenses y derecho de exclusión

### Estado estático de `consent.js`

- `buildCcpaBar()` se ejecuta durante `init()` y crea `#lc-consent-ccpa`; el CSS base lo mantiene `display:none`. `showCcpa()` solo añade `.is-visible`, pero no se encontró ninguna llamada a `showCcpa()` en el archivo. La barra, por tanto, no tiene ruta local de visibilidad.
- El HTML normal del banner incluye un párrafo CCPA con `hidden`; `updateBannerLanguage()` vuelve a establecer `hidden = true`. El texto `I18N.ccpa` (“Do Not Sell or Share…”) no se aplica a un control visible.
- Si la barra se mostrara manualmente, su botón `data-ccpa-action` llama a `acceptLimited()`, que guarda `limited`, deniega las tres señales publicitarias pero concede `analytics_storage` y carga GTM/GA4. El texto de ese botón se fija como “Allow analytics only”, no como confirmación de exclusión de venta/compartición.
- El banner normal sí tiene “Reject non-essential”; rechazar actualiza las cuatro señales a denied y no carga GTM/GA4. Esa acción no es una ruta identificada como “Do Not Sell or Share” y tampoco detiene la descarga previa del tag de AdSense en páginas de recursos.
- No se encontró lectura de `navigator.globalPrivacyControl`, señal `Sec-GPC`, `__gpp`, `usprivacy`, ni publicación de un string GPP/USP. El estado comunicado es Google Consent Mode v2 (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`), no un mensaje GPP de privacidad estadounidense.

### Evaluación y riesgo

La ley aplicable depende, entre otros aspectos, de si el operador está sujeto a CCPA/CPRA, de los roles y contratos respecto de los datos y de si existe “sale” o “sharing” conforme a esas normas. Esos hechos no se pueden resolver con el repositorio y no se ofrece una conclusión legal. Si el operador está sujeto y procede el derecho de opt-out, el código actual **no demuestra una ruta funcional y visible** que lo ejerza ni que trate una señal GPC.

Google documenta mensajes de Privacy & messaging para estados de EE. UU.: incluyen enlace “Do Not Sell or Share”, página de confirmación y decisión de opt-out; almacenan/transmiten elecciones mediante GPP. Hay que distinguir dos alcances: la guía de mensajes describe secciones estatales usadas por el mensaje, pero la guía de integración de AdSense (revisada en 2025) dice que AdSense acepta actualmente GPP US National y las secciones estatales California, Colorado, Connecticut, Florida y Virginia; GPP no es obligatorio para Google y Google también admite RDP por solicitud del tag. Por tanto, la mera existencia de un mensaje o string no prueba qué señal consume un tag de AdSense: hay que confirmar la sección emitida y la reconocida por el producto. Google advierte que corresponde al publisher determinar la configuración y sus obligaciones.

Para California, la documentación técnica de Google dice que RDP se activa al recibir un opt-out de “sale” o “sharing” en la sección US National o California. El código local no emite esos campos GPP ni activa expresamente RDP por solicitud. No se encontró integración GPC; la aplicabilidad y obligación de responder a una señal de opt-out requiere revisión legal.

**Conclusión:** no conservar la barra como si ya cumpliera. Tampoco eliminarla en esta fase: es código inactivo y su intención se debe decidir después de revisión legal y de producto. Si se confirma aplicabilidad, evaluar un mensaje US-state de Google/P&M o una implementación de opt-out que cubra GPP/GPC, persistencia, confirmación, sincronización con Google y demás terceros; luego probarlo. Un `ad_personalization=denied` por sí solo no equivale a demostrar que se emitió un opt-out estatal completo.

## I. Fase 2 — GTM y GA4: revisión estática

| Elemento | Evidencia local | Conclusión / límite |
|---|---|---|
| GTM ID | `GTM-KTXQJMMH` en `consent.js`. | Un único ID local encontrado. El contenido del contenedor no está en el repositorio. |
| GA4 Measurement ID | `G-E1D8VDYM6D` en `consent.js`, también declarado en Privacy Policy. | Un único ID local encontrado. No se verificó que pertenezca a la propiedad prevista ni su configuración remota. |
| Tag manager directo | `consent.js` inserta `https://www.googletagmanager.com/gtm.js?id=...` tras `accepted` o `limited`. | No se encontró otro snippet directo de GTM en las fuentes inspeccionadas. `loadScriptOnce()` evita la reinserción por clave dentro del mismo documento. |
| Google tag/GA4 directo | Después de esperar GTM, inserta `https://www.googletagmanager.com/gtag/js?id=...`, ejecuta `gtag('js', …)` y `gtag('config', GA4_ID)`. | Es una segunda integración directa, además de cargar el contenedor GTM. No se encontró otro `gtag('config')` local fuera de `consent.js`. El `config` puede emitir `page_view` por defecto salvo que se configure lo contrario; el contenedor remoto podría configurar la misma propiedad y duplicarlo. |
| Defaults en páginas con AdSense | Inline en `<head>` por `scripts/build.mjs`, antes del tag: las cuatro señales denied y `wait_for_update:500`. | El tag de AdSense se descarga con default denied; no se bloquea por esa llamada. |
| Defaults en páginas sin AdSense | `consent.js` crea el stub y aplica default rejected al inicializar cuando no hay estado ya comunicado. | GTM/GA4 no se descargan hasta `accepted` o `limited`. |
| Updates y carga | `setConsent()` envía `consent update`; `loadMarketingScripts()` carga GTM y luego GA4 solo para `accepted`/`limited`. | Orden local consistente con la elección. La lógica remota de consentimiento/activadores de GTM no es visible. |
| Eventos | `support_page_view`, `support_click` (parámetro `support_option`), `gtm.js`; eventos DOM `lc-consent:accepted`, `:limited`, `:rejected`, `:error`. | Los eventos de apoyo se envían solo con `accepted`/`limited`. No se encontró consumidor local de los eventos DOM `lc-consent:*`; GTM remoto podría escuchar o transformar eventos mediante otras señales. |
| Duplicados y conflictos | Código local deduplica cada loader por clave, pero carga ambos GTM y GA4 directo. | No hay duplicado directo demostrado; sí existe riesgo no resoluble de doble configuración/page_view si el contenedor GTM también contiene una etiqueta GA4 para `G-E1D8VDYM6D`. No afirmar duplicación sin exportar/revisar GTM. |

No se encontró un `gtag('config')` o snippet de GTM estático en las demás fuentes; las cadenas de Consent Mode presentes en los 82 HTML de AdSense son defaults generados por plantilla, no inicializaciones GTM separadas.

## J. Decisiones y autorizaciones necesarias

No se cambió código en esta fase. Antes de cualquier implementación hace falta autorización explícita para:

1. Elegir A o B y definir si la personalización se deshabilita solo en EEE/Reino Unido/Suiza o globalmente.
2. Publicar/configurar mensajes en AdSense Privacy & messaging, seleccionar proveedores publicitarios, consentimientos y territorios; esto modifica configuración remota y experiencia pública.
3. Sustituir o coordinar el banner `consent.js` con una CMP para evitar dos gestores de consentimiento y decidir cómo conservar analítica en las páginas sin AdSense.
4. Aprobar un proveedor CMP de terceros y sus condiciones/coste si no se usa Google CMP.
5. Obtener determinación legal y autorizar un control CCPA/US-state/GPP/GPC y el tratamiento de RDP.
6. Revisar o cambiar el contenedor GTM y la configuración de GA4; la edición local no puede resolver etiquetas remotas.
7. Autorizar un despliegue y pruebas posteriores en producción. Ninguno se realizó.

### Fuentes oficiales consultadas (12 de noviembre de 2026)

- [Requisitos Google CMP/TCF para EEE, Reino Unido y Suiza; lista de CMP certificadas](https://support.google.com/adsense/answer/13554116?hl=en) — incluye Google LLC CMP ID 300 (Web and app), Cookiebot ID 134 (Web), CookieYes ID 401 (Web and app) y Usercentrics ID 5 (Web, app and CTV); la lista se actualiza semanalmente.
- [Publisher integration con IAB TCF](https://support.google.com/adsense/answer/9804260?hl=en) — señales de consentimiento y requisitos de anuncios personalizados/NPA. Al consultarlo el 12 de noviembre de 2026, el texto aún describía TCF v2.3; no se usa como objetivo de implementación y se contrasta con el artículo de mensajes europeos enlazado en K.
- [Set up and manage your CMP](https://support.google.com/adsense/answer/7670013?hl=en) y [cómo funciona Google CMP](https://support.google.com/adsense/answer/16918505?hl=en) — diálogo propio o CMP, funciones de Google y mensajes europeos/estadounidenses.
- [Crear mensaje europeo en Privacy & messaging](https://support.google.com/adsense/answer/10960768?hl=en) y [About Privacy & messaging](https://support.google.com/adsense/answer/10924669?hl=en) — configuración en cuenta, idioma/elecciones, mensaje publicado y requisitos de etiqueta.
- [Ajustes de personalización en tags AdSense](https://support.google.com/adsense/answer/7670312?hl=en) y [anuncios personalizados/no personalizados](https://support.google.com/adsense/answer/9007336?hl=en) — `requestNonPersonalizedAds=1`, requisitos de cookies, NPA y pausado de solicitudes.
- [Mensajes para regulaciones de estados de EE. UU.](https://support.google.com/adsense/answer/10961479?hl=en), [crear mensaje US-state](https://support.google.com/adsense/answer/10960771?hl=en), [ayuda a publishers ante leyes estatales](https://support.google.com/adsense/answer/9560818?hl=en) y [soporte de AdSense para IAB GPP](https://support.google.com/adsense/answer/14126816?hl=en) — GPP, secciones admitidas por AdSense, opt-out, RDP y responsabilidad del publisher.
- [Regulaciones CCPA/CPRA de CPPA](https://cppa.ca.gov/regulations/consumer_privacy_act.html) — referencia oficial para la revisión legal; este informe no determina aplicabilidad.

## K. Fase 3 — Propuesta de migración a Google Privacy & messaging

**Estado:** propuesta solamente. En esta fase no se modificó código, no se cambió ninguna opción de AdSense/GTM, no se publicó un mensaje y no se desplegó. Se requiere autorización explícita antes de ejecutar cualquiera de los pasos de la sección K.5.

### K.1 Objetivo TCF y evidencia de versión

- El objetivo solicitado para la integración es **IAB TCF v2.4 con Google LLC CMP ID 300**. No usar v2.3 como objetivo ni como fallback. La página oficial de Google “About European regulations messages”, consultada el 12 de noviembre de 2026, declara que los mensajes europeos de Privacy & messaging se actualizaron para soportar TCF v2.4.
- El usuario establece el **23 de octubre de 2026** como fecha límite obligatoria. No encontré esa fecha en las páginas oficiales consultadas. En particular, el artículo oficial “Publisher integration with the IAB TCF” aún afirma que v2.3 es obligatorio desde el 1 de marzo de 2026, y ejemplos de la API de Funding Choices incluyen versiones anteriores. Esto parece documentación no sincronizada; **no demuestra que Google CMP carezca de soporte v2.4**, pero requiere confirmar la versión que realmente emite el mensaje en la cuenta y verificar TC strings en la prueba autorizada antes de publicar.
- La lista de CMP certificadas de Google identifica a Google LLC CMP con ID 300 y plataforma Web and app. La lista se actualiza semanalmente. La certificación del CMP no garantiza por sí sola el cumplimiento legal integral ni que un mensaje concreto esté correctamente configurado.

### K.2 Arquitectura propuesta y convivencia con `consent.js`

La fuente de verdad debe ser única por decisión/región. `consent.js` no debe conceder, revocar ni reescribir decisiones que corresponden a Google CMP/GPP. Mantener el sistema existente intacto como rollback hasta validar el reemplazo en un entorno autorizado; no ejecutar ambos gestores en paralelo en producción para una misma decisión.

| Grupo de visitante | Fuente de decisión propuesta | Consent Mode y etiquetas | Rol futuro de `consent.js` |
|---|---|---|---|
| EEE, Reino Unido, Suiza | Mensaje europeo de Google Privacy & messaging; TC string TCF v2.4 generado por CMP ID 300. AdSense consume el TC string automáticamente. | Conservar el default temprano denegado en `<head>`. Habilitar la integración Consent Mode de mensajes europeos en Privacy & messaging; Google documenta la actualización de los cuatro propósitos para sus productos. No ejecutar el `setConsent()` actual ni inferir el TC string a partir de `accepted`. | No mostrar su banner ni leer/importar `lc_cookie_consent` para permisos europeos; no actualizar las señales ni cargar tags independientemente de la CMP. Enlazar revocación a `googlefc.showRevocationMessage()` mediante `googlefc.callbackQueue`/`CONSENT_API_READY`. |
| Estados de EE. UU. cubiertos por el mensaje | Mensaje US-state de Google Privacy & messaging; decisión “Do Not Sell or Share” comunicada por GPP. Para AdSense, el GPP/RDP debe prevalecer en las solicitudes cubiertas. | Consent Mode no sustituye el estado GPP y la documentación consultada no demuestra que el mensaje US-state configure los cuatro consent types de Consent Mode como un mensaje europeo. No traducir automáticamente GPP a `granted/denied`; mantener por defecto señales publicitarias denegadas hasta que la integración y precedencia se verifiquen. | El control CCPA oculto actual no debe mostrarse ni invocarse como opt-out. No permitir que “Accept” del diálogo actual revierta un opt-out GPP. Si se conserva elección analítica, separarla del estado publicitario y aprobar su UX/legalidad. |
| Resto del mundo (incluido Chile, salvo obligación local aplicable) | No se espera que los mensajes europeos o US-state aparezcan si esas reglas no aplican. Mantener temporalmente el diálogo propio como fallback **solo** para territorios confirmados fuera de las regiones que gestiona P&M; su política actual concede las señales existentes al aceptar. | El default inicial sigue denegado. En el fallback, únicamente la elección del diálogo propio puede actualizar señales. Si la ubicación/estado P&M es desconocida, error o `UNKNOWN`, fallar de forma conservadora: no conceder señales ni cargar GTM/GA4. | Mantener la UX actual únicamente en el fallback regional. No migrar su `localStorage` a TCF/GPP: los tres estados existentes no contienen las elecciones detalladas de propósitos/proveedores de TCF. |

**Detección y orden:** usar las interfaces de Google documentadas (`googlefc.callbackQueue`, API TCF y `googlefc.usstatesoptout.getInitialUsStatesOptOutStatus()`), no el idioma del navegador ni un país inferido de la IP desde código propio. La disponibilidad exacta de esos estados en las 14 páginas sin tag de AdSense está por confirmar. Definir defaults denegados síncronamente antes de cualquier tag; esperar a la señal de región/consentimiento para decidir qué orquestador y etiquetas habilitar. No permitir que la elección local antigua `accepted` se aplique en EEE/UK/Suiza o sobrescriba un opt-out estatal. Los estados de persistencia propios y de P&M no se deben sincronizar a mano.

En un estado gestionado por mensaje US-state, el banner legacy actual tampoco debe permanecer como un “accept all” que conceda señales publicitarias independientemente del GPP. El mensaje US-state es un mecanismo de opt-out, no se debe presentar como sustituto de consentimiento analítico o de un diálogo general. Si se desea mantener una elección analítica separada, requiere un diseño/etiquetado propio, default denegado y reglas que nunca contradigan el estado GPP.

**Páginas sin AdSense:** el inventario de G contiene 14 páginas sin tag directo. Google documenta que el tag existente de AdSense suele desplegar mensajes publicados; no se ha verificado API/bootstrapping de P&M sin ese tag. En este cambio no se cargan GTM/GA4 en esas 14 páginas porque un `localStorage` de una visita anterior no identifica de forma segura la región actual. El botón de privacidad navega a `/guides/` o `/es/guides/` (sin cambiar su monetización); ahí la integración espera el callback de Google y, para una decisión europea recurrente, encola `showRevocationMessage()`. Para una exclusión US-state se mantiene el enlace estándar de Google y se enruta a una página con AdSense. La persistencia/visibilidad real de ese enlace y ambos flujos aún requieren mensaje publicado y QA con Google. Efecto funcional: los eventos GA4 definidos en la página de apoyo no se transmiten desde esa página en esta implementación.

### K.3 Consent Mode v2 y carga de AdSense

**Implementación local de Fase 3:** el template establece los cuatro defaults en `denied`, crea el callback queue de `googlefc` y pone `adsbygoogle.pauseAdRequests=1` antes de incluir el tag AdSense. `consent.js` no importa el consentimiento guardado antiguo para una región europea; registra TCF API v2 en `CONSENT_API_READY`, no sobrescribe las decisiones europeas y usa `CONSENT_MODE_DATA_READY` para desbloquear tags solo si cada uno de los cuatro propósitos es `GRANTED` o `NOT_APPLICABLE` (valores API documentados 1 y 3). `DENIED`, `UNKNOWN` o `NOT_CONFIGURED` no desbloquean. En otras regiones solo inicia el flujo local después de que TCF diga que GDPR no aplica y la consulta US-state devuelva un estado conocido; si la región queda sin resolver, deja pausadas las solicitudes y no presenta una segunda interfaz.

Mantener en `scripts/build.mjs` el default síncrono antes del primer tag:

| Señal | Default recomendado | Quién puede actualizarla en región gestionada por P&M |
|---|---|---|
| `ad_storage` | `denied` | Google CMP/Consent Mode europeo tras la decisión aplicable; no `consent.js` |
| `ad_user_data` | `denied` | Google CMP/Consent Mode europeo tras la decisión aplicable; no `consent.js` |
| `ad_personalization` | `denied` | Google CMP/Consent Mode europeo tras la decisión aplicable; no `consent.js` |
| `analytics_storage` | `denied` | Google CMP/Consent Mode europeo tras la decisión aplicable; o un flujo analítico separado, explícitamente autorizado |

No usar valores previos de `localStorage` para emitir un `granted` en regiones administradas por P&M. En el EEE/UK/Suiza, activar la opción Consent Mode de la configuración del mensaje europeo y validar que cada elección —incluidos rechazar y preferencias parciales— produce las cuatro actualizaciones correctas. Google dice que su integración admite Basic y Advanced: Advanced funciona por defecto una vez habilitado Consent Mode; Basic requiere usar `CONSENT_MODE_DATA_READY` y cargar los tags solo cuando los valores/criterios acordados lo permitan. La elección entre ambos requiere revisión de privacidad/legal y pruebas; no asumir que “los datos de consentimiento están listos” significa que el usuario otorgó consentimiento.

| Enfoque | Solicitudes posibles antes de elegir | Comportamiento publicitario y medición |
|---|---|---|
| Implementación anterior (antes de Fase 3) | Las cuatro señales empiezan `denied`, pero el tag asíncrono de AdSense se descarga en `<head>` en 82 páginas. `consent.js` carga GTM/GA4 después de `accepted` o `limited`. | El banner custom no crea TC string; rechazar no bloquea la descarga previa de AdSense. |
| Implementación local actual | La descarga del tag AdSense sigue ocurriendo antes de una decisión y las solicitudes quedan pausadas desde el inline head. GTM/GA4 se difieren hasta el resultado de P&M en Europa o una elección local tras confirmar otra región. | El modo Basic impide cargar tags controlados por el sitio cuando alguna señal está denegada/no disponible. No se verificaron solicitudes reales ni el servicio del mensaje; `requestNonPersonalizedAds=1` por sí solo no se usa como sustituto de GPP ni de una decisión legal. |
| Consent Mode **Basic** | Bloquear los tags de Analytics/Ads controlados por el sitio hasta que P&M entregue el estado; no cargar el tag de medición si la decisión no lo permite. El tag AdSense que Google necesita para mostrar P&M debe analizarse por separado. | Reduce tags/pings previos para los tags sujetos a Basic. No significa automáticamente “sin solicitudes publicitarias”: P&M/AdSense y el mensaje siguen necesitando su mecanismo de carga y se debe comprobar el tráfico real. |
| Consent Mode **Advanced** | Los tags pueden cargarse con defaults denegados y enviar pings sin cookies/señales concedidas antes de la elección. También puede descargarse el script del tag; las solicitudes reales dependen del producto/configuración. | Permite modelado de conversiones/analítica según producto, pero no equivale a bloquear toda transmisión preconsentimiento. Consent Mode no es una CMP ni reemplaza TC string/GPP. |
| P&M + TCF v2.4 | La etiqueta AdSense existente suele ser suficiente para servir mensajes publicados, según la documentación de Google. El TC string se comunica automáticamente a AdSense. Distinguir descarga de `adsbygoogle.js`, solicitudes de anuncios, pings y cookies; verificar cada una en la red. | Google puede servir personalizados solo con TC string/consentimientos y propósitos válidos. Sin consentimiento de Purpose 1, Google indica que pueden ser elegibles anuncios limitados; NPA también requiere Purpose 1 porque usa almacenamiento para frecuencia/fraude/reportes. Un TC string inválido puede impedir servir anuncios. Rechazar personalización **no** significa que no haya solicitudes publicitarias. |

**Recomendación/decisión aplicada localmente:** usar P&M/TCF como única autoridad europea y mantener Basic Consent Mode; preservar el default denied y el tag AdSense requerido por P&M, pero pausar solicitudes de anuncios hasta una decisión válida. La descarga del script no se bloquea, por lo que la red real debe comprobarse con el mensaje publicado. Fuera de Europa, esperar una clasificación de región conocida antes de mostrar la interfaz legacy. No se añadió otra CMP externa. Esta implementación local no supone que el mensaje esté configurado o publicado.

GTM contiene un contenedor remoto no disponible en el repo y hoy se carga junto con GA4 directo. Antes de la migración se necesita exportar/revisar el contenedor y escoger **una sola** vía de inicialización de `G-E1D8VDYM6D` (GTM o `gtag` directo), para evitar pageviews duplicados y confirmar cómo respeta Consent Mode. No cargar GA4 “directo y via GTM” como parte de la nueva integración sin evidencia de que uno no envía datos.

### K.4 Configuración requerida de Privacy & messaging y privacidad de EE. UU.

**Requiere acceso y autorización de cuenta; no se realizó aquí:**

1. Verificar que `listeningclassroom.com` esté registrado en AdSense y elegirlo en cada mensaje; conservar la política de privacidad correcta.
2. Crear/revisar el mensaje europeo, habilitar TCF/Consent Mode y comprobar en el producto que la CMP sea ID 300 y que emita TCF v2.4. Incluir **Do not consent**, **Consent** y **Manage options**; revisar que las opciones no estén preseleccionadas indebidamente y configurar los propósitos/proveedores usados realmente. Publicar solo después de comprobar texto, tratamiento y preferencias.
3. Configurar idiomas de mensaje: inglés y español. La selección de idioma de Google se basa en el idioma del dispositivo y no necesariamente en `document.documentElement.lang`. Google trata `English (en)` y `English (en-GB)` como distintos; incluir/revisar `en-GB` si se quiere cobertura inglesa coherente en Reino Unido. Para mensaje US-state, Google permite English, Spanish y Spanish (Latin America/es-419); revisar el texto en cada variante.
4. Crear/revisar mensaje de regulaciones US-state, seleccionar “all current and future supported US states” solo tras aprobación legal, o delimitar estados deliberadamente. La documentación consultada lista California, Colorado, Connecticut, Delaware, Florida, Indiana, Iowa, Kentucky, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode Island, Tennessee, Texas, Utah y Virginia. Google determina si el mensaje aplica según ubicación; la cobertura cambia con el producto y la ley.
5. Revisar “Review your ad partners” y la configuración RDP/contratos con el responsable legal. Google documenta GPP para opciones US-state, pero AdSense solo acepta en GPP los strings US National, CA, CO, CT, FL y VA; no confundirlo con las secciones que el mensaje puede almacenar ni con TCF europeo.
6. **GPC:** el código local detecta `navigator.globalPrivacyControl === true`, deniega las tres señales publicitarias y mantiene pausadas las solicitudes AdSense. No se halló evidencia de que esto escriba un opt-out GPP ni de que el browser signal sea leído por P&M; no declarar compatibilidad legal/Google hasta probarlo. Confirmar con Google el estado GPC, persistencia GPP/RDP y comportamiento de red.
7. El API de Funding Choices documenta `googlefc.showRevocationMessage()` para revocar consentimiento europeo y `googlefc` para datos del estado estadounidense. Su API indica que reemplazar el enlace estándar “Do Not Sell or Share” con uno propio solo está soportado para Ad Manager; para AdSense, mantener y probar el enlace estándar de Google. Mantener el control CCPA propio desactivado durante la transición y eliminarlo solo después de validar la ruta Google y contar con autorización.

Los mensajes US-state recogen opt-out de privacidad; no se debe asumir que configuran también Consent Mode para analítica ni que cubren señales de menores. La documentación de Google dice que su solución no recoge `KnownChildSensitiveDataConsents` en GPP. Por el carácter educativo del sitio, el tratamiento de menores y cualquier obligación adicional requieren revisión legal; no se infiere la edad de los visitantes por el contenido.

### K.5 Plan de migración y estado

| Paso | Trabajo propuesto | Criterio de salida |
|---|---|---|
| 0. Diseño | Basic Consent Mode, P&M ID 300 como CMP prevista, TCF v2.4 objetivo y defaults denied. | Implementado localmente; no implica configuración de cuenta. |
| 1. Configuración de cuenta | Crear y publicar mensajes europeos y US-state, configurar idiomas/opciones/proveedores/targeting y confirmar CMP/TCF desde AdSense. | **Pendiente del propietario**; no se accedió ni modificó la cuenta. |
| 2. Adaptación local | Ajustar `renderHead()`/`scripts/build.mjs`, `consent.js`, textos legales, QA estático y enlace de preferencias desde páginas sin AdSense. Conservar custom solo para regiones confirmadas fuera de Europa; no importar decisiones locales a la autoridad europea. | Implementado y probado localmente con mocks; no está desplegado. |
| 3. QA simulado | Ejecutar pruebas Node y Playwright con API/estados simulados, además de build y regresiones existentes. | Correcto para lógica local simulada; no valida Google, TCF real, GPP, geografía, red publicitaria o mensajes de cuenta. |
| 4. QA real de Google | En dominio elegible con mensaje publicado, verificar TCF v2.4, Consent Mode, solicitudes de red, persistencia, revocación y GPP/RDP con geografía aprobada. | **Bloqueado** hasta configuración y publicación por el propietario; los mocks no cuentan como aprobación de integración. |
| 5. Decisión antes de producción | Revisar riesgos, legalidad, contenedor GTM remoto, salida de QA y autorización específica de despliegue. | No desplegar ni solicitar revisión de AdSense desde esta tarea. Una auditoría final requiere autorización posterior. |

### K.6 Plan de pruebas

**Ejecutado localmente:** `scripts/test-consent.mjs` valida estados propios y simulaciones API; `scripts/test-privacy-messaging-browser.mjs` ejecuta Playwright sobre el sitio local y un Google CMP/API deliberadamente simulado. Los scripts externos de AdSense/GTM se reemplazan por respuestas vacías. Ambas pruebas **no son una integración real** y no validan CMP ID, UI remota, TC string, GPP, geolocalización, cookies de Google ni solicitudes publicitarias. `scripts/test-activities-browser.mjs` verifica las regresiones Kokoro/actividades con los servicios externos bloqueados excepto el CDN requerido.

| Escenario | Comprobaciones propuestas |
|---|---|
| Primera visita europea, EN | Solo un mensaje; idioma correcto; defaults de cuatro señales denegados antes de scripts; ninguna concesión derivada del `localStorage` antiguo. |
| Primera visita europea, ES | Texto español; comparar con `lang=es`; comprobar selección basada en idioma de dispositivo y comportamiento en URL `/es/`. |
| Aceptar | TC string válido TCF v2.4; propósitos/proveedores reflectan la selección; Consent Mode actualiza solo señales permitidas; una sola GA4/page_view; medir momento de solicitudes AdSense. |
| Rechazar / Do not consent | Opción explícita disponible; no concesiones ni tags de analítica no permitidos; confirmar comportamiento de anuncios limitados y de solicitud sin afirmar que no hay solicitud. |
| Manage options | Cada propósito/proveedor deseleccionado por defecto según TCF; aceptar parcial, guardar, recargar y verificar señales por cada propósito. |
| Visitante recurrente | Decisión persiste entre recarga y navegación EN/ES; no reaparece sin razón de renovación; estados de Google, no `localStorage` legacy, gobiernan Europa. |
| Revocación | Enlace visible/accesible; `googlefc.showRevocationMessage()` reabre el mensaje, borra/actualiza el estado esperado y propaga revocación a señales/solicitudes siguientes. Probar también en cada una de las 14 páginas sin AdSense. |
| Chile | No mensaje europeo ni US-state cuando no corresponden; fallback acordado y Consent Mode/GA4 según política ROW; no usar `es` como sustituto de geolocalización. |
| Estado de EE. UU. cubierto | VPN/geografía de prueba o mecanismo aprobado; enlace estándar “Do Not Sell or Share”; confirmar GPP sección/campos y RDP según estado; impedir que aceptación legacy revierta opt-out. |
| GPC | Navegador con `navigator.globalPrivacyControl=true` y, si el entorno permite, señal HTTP GPC; verificar si Google CMP detecta, persiste en GPP y causa RDP. Si no se puede demostrar, marcar no verificado y no declarar soporte. |
| Persistencia/limpieza | Repetir con almacenamiento limpio, existente, expirado y bloqueado; borrar consentimiento y verificar primera visita; error/API ausente falla cerrado sin conceder signals. |
| Regresión de sitio | Ejecutar build, test estático sobre 96 HTML, páginas legales EN/ES, generator, navegación, actividades y QA desktop/mobile; ningún tag AdSense añadido a las 14 páginas excluidas. |

Las pruebas con geolocalización real, CMP certificada, cuentas/ajustes de AdSense, GPP y servicios remotos no son demostrables únicamente con HTML local. Los parámetros de debug de P&M no sustituyen una prueba de país/regulación real ni un consentimiento TC/GPP válido.

**Fuentes oficiales de Fase 3 (consultadas el 12 de noviembre de 2026):**

- [About European regulations messages](https://support.google.com/adsense/answer/10961068?hl=en) — estructura Do not consent/Consent/Manage options, renovación de consentimiento, TCF v2.4 y Consent Mode.
- [Create a European regulations message](https://support.google.com/adsense/answer/10960768?hl=en) — sitios, idiomas, opción Do not consent, política de privacidad y publicación.
- [Create a US state regulations message](https://support.google.com/adsense/answer/10960771?hl=en) y [About US state regulations messages](https://support.google.com/adsense/answer/10961479?hl=en) — targeting, idiomas y mensaje de opt-out.
- [Funding Choices API](https://developers.google.com/funding-choices/fc-api-docs) — `googlefc.showRevocationMessage`, `CONSENT_MODE_DATA_READY`, valores Consent Mode, TCF/GPP y estados US-state. Los ejemplos de versión de TCF de esta página parecen anteriores a v2.4.
- [Google Consent Mode: basic vs advanced](https://developers.google.com/tag-platform/security/concepts/consent-mode#basic-vs-advanced) — diferencias de carga/solicitudes y modelado.
- [Publisher integration with the IAB TCF](https://support.google.com/adsense/answer/9804260?hl=en) — requisitos de Purpose 1, personalizados/NPA/limitados y consumo automático del TC string por AdSense; su texto de versión no concuerda con la página europea actualizada a v2.4.
- [Google CMP certification requirements](https://support.google.com/adsense/answer/13554116?hl=en) — requisitos regionales y lista dinámica; verificar CMP ID 300 al configurar.
- [IAB GPP support in AdSense](https://support.google.com/adsense/answer/14126816?hl=en) y [US privacy laws guidance](https://support.google.com/adsense/answer/9560818?hl=en) — secciones aceptadas, RDP y responsabilidad del publisher.

### K.7 Incertidumbres y decisiones pendientes

- Confirmar en AdSense que el mensaje realmente produce un TC string TCF v2.4. La documentación oficial consultada da respuestas mezcladas: la página europea indica v2.4, mientras la API de Funding Choices muestra ejemplos TCF API 2.2 y el artículo de GPP todavía menciona TCF v2.3. El parámetro `2.2` usado por `__tcfapi` es la versión de la API de callback, no una afirmación de que el TC string sea v2.2; el string no se genera en este código.
- Confirmar que el tag puede seguir en `<head>` para mostrar P&M con `pauseAdRequests=1` sin impedir el mensaje; capturar separadamente descarga del tag, solicitudes de anuncios, pings/medición, cookies y Auto ads/unidades remotas.
- Verificar en las 14 páginas sin AdSense que el enlace de preferencias hacia `/guides/` o `/es/guides/` permite efectivamente reabrir la revocación europea y alcanzar el enlace US-state estándar de Google. No se añade publicidad a esas páginas.
- Determinar el comportamiento aprobado en estados de EE. UU. para Consent Mode/Analytics al coexistir con GPP; los mensajes US-state no son una CMP general de analítica.
- Confirmar con la CMP real que GPC se refleja en los datos GPP; el sitio detecta el API del navegador y ahora observa opt-outs GPP listos, pero no genera ni escribe el string y no demuestra cómo tratan el caso los servicios remotos.
- Obtener revisión legal de EEE/UK/CH, leyes estatales, menores, selección de proveedores, cookies NPA y datos de Analytics.
- Revisar contenedor GTM remoto para eliminar duplicación GA4 y definir Basic/Advanced por tag.
- Verificar coste/condiciones de cuenta, elegibilidad del dominio, CMP ID 300, mensaje publicado, idioma/región, opciones, referencia/referrer y cualquier requisito operativo. No se cambiaron settings ni se publicó ningún mensaje.

### K.8 Registro de implementación y entrega

| Cambio | Archivos | Estado/evidencia |
|---|---|---|
| Default Consent Mode v2 denegado, stub `googlefc`, pausa síncrona AdSense y señal NPA auxiliar si el navegador expone GPC | `scripts/build.mjs`; 82 páginas HTML generadas | Build generado localmente. El tag AdSense se descarga; esto no se reporta como “sin comunicación con Google”. |
| Una autoridad por región, cola TCF/P&M, Basic gating de los cuatro propósitos, retención de ads bloqueados para estado no resuelto, GPC, estado US/GPP dinámico y botón persistente de preferencias/revocación | `consent.js` | La lógica local observa `__gpp('addEventListener')` y procesa solo datos `signalStatus=ready`; un opt-out revoca las tres señales publicitarias y cambia las solicitudes aceptadas a NPA, y una señal explícita posterior sin opt-out restaura únicamente la elección local vigente. No crea ni escribe GPP. Las 14 páginas sin tag no cargan GTM/GA4 para evitar confiar en una clasificación regional antigua. El flujo real P&M/GPP requiere cuenta y no está validado; el timeout sin decisión falla cerrado sin segunda interfaz. |
| Pruebas Consent Mode, estado no resuelto, GPC, región fuera de Europa, estado US/GPP inicial y cambios posteriores, persistencia de tags/revocación | `scripts/test-consent.mjs`, `scripts/test-privacy-messaging-browser.mjs`, `scripts/test-adsense-compliance.mjs` | Node y Playwright pasan con callbacks/estados explícitamente simulados, incluidos cambios GPP opt-out/opt-in y propagación a Consent Mode/NPA. No son pruebas de integración Google. |
| Declaraciones EN/ES alineadas a carga/pausa, Basic Mode, rutas y límites de verificación | `privacy.html`, `terms.html`, `index.html`, `README.md`; versiones españolas generadas | Texto local actualizado y generado; se conserva lenguaje condicional respecto a configuración no comprobada en AdSense. |

**Configuración exacta que el propietario debe completar antes de cualquier despliegue autorizado:**

1. En AdSense → Privacy & messaging, confirmar `listeningclassroom.com` como sitio y crear el mensaje europeo para EEE/UK/Suiza usando Google Privacy & messaging (CMP ID 300). Configurar la integración TCF y Consent Mode **Basic**, verificar que las cuatro señales están configuradas y comprobar en el producto que el TC string sea **TCF v2.4**. No basta con que el editor diga “Google CMP”; guardar evidencia/versiones desde una herramienta de Google.
2. Configurar el mensaje en inglés y español; revisar `en-GB` para Reino Unido si el editor lo trata por separado. Incluir una opción explícita **Do not consent**, **Manage options** y el consentimiento afirmativo requerido por el mensaje. Revisar proveedores/propósitos reales, texto, política de privacidad y que no haya opciones preseleccionadas que concedan consentimiento.
3. Configurar el mensaje US-state tras revisión legal: targeting de estados, texto, idioma English/Spanish/es-419, proveedores y enlace estándar **Do Not Sell or Share** de Google. No activar una sustitución custom del enlace. Confirmar qué sección GPP y qué campos RDP produce cada estado.
4. Confirmar compatibilidad/interpretación de GPC y la disponibilidad/visibilidad del enlace US-state persistente. El código local no inventa ni escribe TC string/GPP ni IDs de cuenta.
5. Revisar la política `Referrer-Policy` efectiva en GitHub Pages: Google advierte que mensajes pueden no ser elegibles si el `Referer` no se comparte en solicitudes cross-origin. Confirmar también el contenedor GTM remoto y que no inicialice GA4 por segunda vez.
6. Mantener mensajes en borrador/prueba y sin publicar hasta confirmar idiomas, options y señales; la configuración debe existir y estar validada antes de desplegar el código. Este trabajo no modificó cuenta ni publicó mensajes.

**Comandos ejecutados en esta fase:** `node scripts/build.mjs`; `node scripts/test-consent.mjs`; `node scripts/test-adsense-compliance.mjs`; `node scripts/test-kokoro-assets.mjs`; `node scripts/test-privacy-messaging-browser.mjs`; `node scripts/test-activities-browser.mjs`; `node scripts/browser-qa.mjs` con servidor local; y `node --check` sobre los scripts JS modificados. No se hizo prueba real de anuncios, cuenta, CMP, TCF/GPP ni geolocalización.

**Validación final después de autorización/configuración:** con mensajes publicados en dominio elegible, usar perfiles/navegadores limpios y herramientas oficiales Google. Confirmar primero visita y choice Do not consent/accept/manage; TC string real `cmpId=300`/TCF v2.4, estado de los cuatro Consent Mode y persistencia/revocación en EN/ES; comprobar luego EEA, UK, Suiza, Chile, estado(s) US incluidos, GPC, GPP/RDP, solicitud publicitaria antes/después, GTM/GA4 y enlace desde las 14 páginas sin AdSense. Capturar consola/red/cookies distinguiendo descargas, requests, pings y anuncios. Repetir Kokoro/generación/MP3/diálogo/actividades y revisar el HTML servido, `/ads.txt` y sitemap. Si cualquier señal/API real no coincide, no desplegar ni solicitar nueva revisión.

### K.9 Cambio de seguimiento de GPP y riesgo residual

> **Histórico, reemplazado por K.10:** la descripción de esta sección precede a la auditoría rigurosa de alcance, precedencia y errores GPP; no debe tomarse como estado validado.

Se añadió un listener local al API oficial GPP (`__gpp('addEventListener', ...)`), inicializado en `CONSENT_DATA_READY`. Solo procesa el objeto `pingData` cuando `signalStatus` es `ready`, para no tomar decisiones con secciones que la CMP todavía está modificando. Revisa las secciones `usnat`, `usca`, `usco`, `usct`, `usfl` y `usva` y los campos de opt-out publicados (`MspaOptOut`, `SaleOptOut`, `SharingOptOut`, `TargetedAdvertisingOptOut`); `1` se trata como exclusión, `2` como señal explícita de no exclusión y los valores ausentes/solo “not applicable” no sustituyen la clasificación inicial de Google. `Gpc: true` también es exclusión. No se emiten ni modifican strings GPP.

Cuando una señal válida cambia durante la visita, el código vuelve a emitir las señales Consent Mode para preservar una aceptación previa solo si sigue siendo vigente y local; ante opt-out deniega `ad_storage`, `ad_user_data` y `ad_personalization`, pone AdSense en NPA para una elección local aceptada y mantiene en pausa los anuncios si no existe tal aceptación. Si llega una señal explícita posterior sin opt-out, se restaura la elección local vigente y se quita el flag NPA auxiliar. Una respuesta ausente/no interpretable no otorga consentimiento ni borra un opt-out previo.

| Evidencia | Resultado | Límite |
|---|---|---|
| IAB GPP CMP API Specification: `addEventListener`, eventos y orden `signalStatus` not-ready/ready; `PingReturn.parsedSections` | Justifica esperar un estado `ready` y recibir actualizaciones en vez de consultar solo una vez. | La CMP y sus objetos reales no se probaron. |
| IAB GPP US National specification: `usnat`, `MspaOptOut` (`1` opt-out, `2` did not opt out), subsección GPC. IAB California specification: `usca`, `SaleOptOut`/`SharingOptOut` y GPC. | Implementación usa lectura conservadora de campos conocidos y solo del conjunto de secciones que Google documenta para AdSense/GPP. | No se infiere que el publisher sea MSPA signatory; el uso/alcance del string `usnat` y las secciones realmente suministradas deben confirmarse en la cuenta y con asesoría legal. |
| `node scripts/test-consent.mjs`; `node scripts/test-privacy-messaging-browser.mjs` | Simulaciones verifican cambio dinámico de opt-out, denegación de señales, NPA y restauración condicionada. | No validan el TC/GPP string, valores de CMP ID 300, geolocalización, GPC real ni que Google aplique RDP a la solicitud. |

**Riesgo restante:** si el Google CMP real no expone esas secciones/campos, usa una representación distinta, no emite `signalStatus=ready` o no permite observar cambios de enlace/revocación, el listener no puede confirmar el estado. No interpretar ausencia de datos como opt-in. Validar en un perfil US-state real mediante API, valores GPP generados, consola y solicitudes de red antes de autorizar producción. La señal inicial de Google continúa siendo la fuente de clasificación inicial; no se ha sustituido por inferencia geográfica local.

Fuentes técnicas: [IAB GPP CMP API Specification](https://github.com/InteractiveAdvertisingBureau/Global-Privacy-Platform/blob/main/Core/CMP%20API%20Specification.md), [IAB GPP US National section](https://github.com/InteractiveAdvertisingBureau/Global-Privacy-Platform/tree/main/Sections/US-National) y [IAB GPP California section](https://github.com/InteractiveAdvertisingBureau/Global-Privacy-Platform/tree/main/Sections/US-States/CA). Estas referencias describen el formato, no prueban la configuración de ListeningClassroom ni determinan obligaciones legales.

### K.10 Auditoría de transiciones GPP/GPC/TCF/Consent Mode/NPA/RDP

**Consulta de fuentes oficiales: 2026-11-12.** Esta fase modifica solo código/documentación local. No se accedió ni se modificó AdSense, Privacy & messaging, GTM o GA4; no se desplegó. K.10 reemplaza las afirmaciones más amplias de K.9 cuando describen el estado vigente.

#### Arquitectura y modelo de estados

- En las páginas que contienen AdSense, `scripts/build.mjs` inicia los cuatro estados Consent Mode (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`) en `denied` y `adsbygoogle.pauseAdRequests=1` antes de cargar `adsbygoogle.js`. El script de AdSense **se descarga antes de una elección**. Google documenta que la pausa bloquea solicitudes publicitarias, no la descarga de scripts; las cookies Google preexistentes pueden leerse, aunque los datos ligados a ellas no se usan para publicar/medir mientras la pausa está activa. El efecto de red no se ha probado aquí.
- `consent.js` valida decisiones locales (`accepted`, `limited`, `rejected`) y su expiración de 365 días. Las APIs de Google clasifican el flujo europeo, estados US, otros lugares o región no resuelta; no se infiere ubicación desde IP localmente. GTM (`GTM-KTXQJMMH`) y GA4 directo (`G-E1D8VDYM6D`) se insertan tras decisión, pero su configuración interna y las etiquetas GTM son remotas y desconocidas.
- En Europa, `__tcfapi` y `googlefc.getGoogleConsentModeValues()` alimentan la coordinación. No se crea un TCF paralelo. En Basic Mode, los cuatro estados de Google deben ser `1` para cargar GTM/GA4; `3` (“not applicable”), valores faltantes y otros estados no son consentimiento afirmativo. Solo `1` se mapea a `granted`; el resto a `denied`. La CMP real puede emitir sus propias actualizaciones Consent Mode; la ausencia de contradicción y el orden real requieren verificación con P&M publicado.
- El listener `__gpp('addEventListener', ...)` se registra independientemente de la clasificación inicial US mediante callbacks de disponibilidad Google. Solo acepta `signalStatus=ready` y secciones que aparecen en `PingReturn.applicableSections`. Para AdSense, interpreta solo las seis secciones que la documentación Google consultada acepta: `usnat`/7, `usca`/8, `usva`/9, `usco`/10, `usct`/12 y `usfl`/13. No acepta una sección US no aplicable ni crea, modifica o escribe strings GPP.
- El estado de privacidad se mantiene en dimensiones separadas:

| Dimensión | Estados | Precedencia |
|---|---|---|
| Elección local | No decidida, aceptada, limitada, rechazada, inválida/expirada | Solo gobierna “otro”, fuera de jurisdicciones con autoridad Google. Datos desconocidos nunca conceden consentimiento. |
| Clasificación | EEE/UK/CH, estado US aplicable, otro, no resuelta | APIs Google; no storage previo. No resuelta = fail closed. |
| TCF | Callback/decisión P&M y valores por propósito | En Europa decide la CMP; no se genera TCF manual. La elección local no puede conceder permisos. |
| GPP | No disponible/no listo/listo opt-out/listo no opt-out/incompleto/error/inconsistente/no aplicable | En estado US solo una sección aplicable, completa y `ready` puede resolver. La ausencia o conflicto conserva la restricción anterior. |
| GPC | Ausente/activo para esta navegación | Independiente de TCF y de la elección local. Activo deniega las cuatro señales, bloquea la inserción GTM/GA4 y mantiene pausado AdSense. |
| Consent Mode | Cuatro señales independientes | Comunica restricciones a tags; `denied` por sí solo no prueba bloqueo ni ausencia de solicitudes. |
| Solicitudes | Pausadas, potencialmente NPA, personalización autorizada; RDP no verificado | Pausa bloquea solicitud, NPA no. RDP solo se verifica observando GPP/RDP en solicitudes reales o la configuración Google correspondiente. |

**Precedencia efectiva:** GPC activo → P&M/TCF en Europa → GPP aplicable y listo en estados US → elección local en otras regiones. Una aceptación previa no levanta opt-out. Un conflicto inicial entre Google y GPP permanece cerrado; solo una transición posterior observada `not ready`→`ready` con señal válida puede resolver el conflicto, nunca GPC. `navigator.globalPrivacyControl` refleja el estado cacheado al cargar la navegación superior según W3C; un cambio de ajuste dentro de una pestaña abierta puede no verse hasta recargar.

#### Matriz de transición local (simulada)

| Escenario | Resultado esperado |
|---|---|
| Primera visita/sin señales | Defaults denegados, AdSense pausado, no cargar GTM/GA4 hasta clasificación/decisión. |
| Aceptar/rechazar/limitar fuera de Europa | Persistir solo una opción válida y actualizar las cuatro señales de acuerdo con esa elección. |
| US aplicable con GPP ausente, incompleto, no aplicable, error o `not ready` | Falla cerrado: no conceder ads, no cargar GTM/GA4, pausar AdSense, incluso con `accepted` local. |
| GPP listo con opt-out inicial o posterior | Denegar las tres señales ads; para una solicitud elegible marcar NPA; no inferir por ello RDP. |
| Google indica opt-out y GPP inicial indica “no opt-out” | Conservar el opt-out de Google. Solo transición posterior not-ready/ready válida puede resolver. |
| GPP pierde readiness o devuelve estado inesperado | Invalidar snapshot previo y pausar hasta otro `ready` válido. |
| Sección US GPP no aplicable a la clasificación | Ignorarla; conservar GPC si `Gpc: true` aparece en GPP. |
| GPC con elección local aceptada, incluso desde primera visita | No cargar GTM/GA4, denegar los cuatro estados y mantener AdSense pausado. |
| Rechazo/revocación TCF o estado europeo distinto de `1` | Señales denegadas y futuras solicitudes AdSense pausadas; Basic Mode no carga GTM/GA4. |
| Opt-out GPP → no opt-out tras transición válida | Quitar el NPA auxiliar; restaurar solo permisos de una elección local aceptada vigente y sin GPC. |

#### Defectos encontrados y correcciones

1. Se aceptaba cualquier valor de localStorage como decisión; un dato corrupto/desconocido podía dar un estado incoherente. Ahora solo se aceptan los tres valores definidos.
2. El listener GPP dependía de una callback de estado US y analizaba secciones sin confirmar `applicableSections`. Ahora se registra en callbacks de disponibilidad, interpreta IDs admitidos por Google y comprueba jurisdicción.
3. Una respuesta GPP inválida podía dejar activo el último snapshot listo; además el opt-out inicial de Google podía ser debilitado por un “no opt-out” inicial GPP contradictorio. Ahora eventos no-ready/error/inesperados invalidan el snapshot; los conflictos fallan cerrado; solo una transición posterior válida puede levantar el conflicto.
4. Status `3` se aceptaba como suficiente para cargar tags en Basic Mode. Ahora se requieren los cuatro status `1`.
5. GPC antes denegaba personalización y pausaba AdSense, pero una aceptación previa todavía podía insertar GTM/GA4. Ahora GPC impide esas cargas en la navegación actual y deniega también `analytics_storage`.
6. El código local setea `requestNonPersonalizedAds=1` para el opt-out, no un control local RDP. No se añadió un parámetro ficticio ni se atribuye RDP a NPA.

#### GPP, NPA, RDP y comportamiento de solicitudes

- Google documenta que AdSense acepta `usnat`, `usca`, `usco`, `usct`, `usva`, `usfl` como secciones GPP. Sus opt-outs pertinentes activan RDP: US National para venta/compartición/publicidad dirigida; California para venta/compartición; Colorado, Connecticut, Virginia y Florida para venta/publicidad dirigida. Esto solo aplica si la CMP realmente transmite la señal GPP compatible al tag Google.
- NPA (`requestNonPersonalizedAds=1`, request `npa=1`) significa no personalizar anuncios; **no** significa “no hacer solicitudes” ni activa por sí mismo RDP. Un anuncio NPA todavía puede hacer solicitudes y usar cookies para frecuencia/reporting donde sea admisible. RDP es distinto (`data-restrict-data-processing="1"` por solicitud AdSense compatible, ajuste de cuenta u otra ruta Google admitida).
- No se ha comprobado que los tags reales transmitan `gpp`, `gpp_sid` o `rdp=1`. La configuración de Auto ads es remota; no hay `<ins>` locales configurados para aplicar el atributo RDP por unidad. La integración Google real puede gestionar el GPP directamente, pero esto no se demuestra con mocks. El propietario debe confirmar si su configuración requiere un ajuste account-side para Auto ads.
- En un GPP opt-out US, esta implementación deniega las tres señales publicitarias y conserva `analytics_storage` según la elección local previa; GTM/GA4 pueden seguir cargados. Esto mantiene separadas una exclusión publicitaria y una decisión analítica, pero **no se declara legalmente suficiente**: debe revisarse si el opt-out aplicable también cubre la transferencia/uso analítico del sitio y qué controles aplica el GTM remoto.
- Cuando ya se cargaron GTM/GA4, revocar actualiza Consent Mode, pero no descarga de forma fiable código ejecutado ni garantiza que cada tag remoto respete las señales. La configuración de GTM no está disponible en el repo.
- La prueba simulada del navegador ve la descarga del script AdSense con pausa activa y el defer de GTM/GA4; el script de AdSense se intercepta y no emite una solicitud publicitaria, por lo que no demuestra el efecto de red real.

#### TCF: versión pendiente de resolver

La página de integración TCF de Google AdSense consultada el **2026-11-12** aún exige **TCF v2.3** para nuevos strings desde el 1 de marzo de 2026; la página de Google sobre GPP también pide que los TC strings europeos se generen con TCF v2.3 y aclara que no acepta TCF europeo dentro de GPP. Esto contradice el requisito previo del proyecto que citaba v2.4 y 23 de octubre de 2026. No existe evidencia local/de cuenta de que el CMP ID 300 genere un TC string v2.4 aceptado por Google. No se genera ni cambia ningún string. CMP ID, versión efectiva, TC string y respuesta de Google quedan **PENDIENTES DE VALIDACIÓN REAL**; no afirmar v2.4 soportado por este código.

#### Pruebas y estado

| Tipo | Ejecutado | Resultado y límite |
|---|---|---|
| Unitarias Node | `node scripts/test-consent.mjs` | Pasa: storage inválido, GPP ausente/no-ready/incompleto/no aplicable/error, conflicto inicial, opt-out dinámico, GPC con aceptación previa, secciones US/CA, precedencia jurisdiccional, y las cuatro señales Consent Mode. Mocks deterministas. |
| Navegador Playwright | `node scripts/test-privacy-messaging-browser.mjs` | Pasa: primera visita, aceptar/rechazar/revocar, persistencia/navegación, idiomas, EEA/UK/CH/Chile, GPC, scripts deferred y pausa. P&M, TCF/GPP y endpoints Google son simulados o interceptados. |
| Google real | No ejecutado | **PENDIENTE DE VALIDACIÓN REAL:** mensaje P&M real/publicado, CMP ID/versiones, TC/GPP string, geo-targeting, navegador GPC, solicitudes/cookies, RDP/NPA, y tags remotos. |

Las simulaciones no prueban TC string, `cmpId=300`, TCF v2.4, RDP de AdSense, IDs/secciones reales de GPP ni solicitudes `gampad`. No son evidencia de aprobación legal ni de revisión de AdSense.

#### Acciones del propietario antes de producción

1. En AdSense → Privacy & messaging, confirmar el mensaje europeo, dominios, EN/ES, Do not consent, Manage options, revocación, vendors/propósitos y la lista certificada vigente. Verificar con Google qué versión TCF emite/acepta realmente; no publicar/desplegar como parte de esta fase.
2. Configurar/revisar mensajes US-state; comprobar secciones GPP/campos en cada jurisdicción aplicable y transmisión `gpp`/`gpp_sid`. Verificar `rdp=1` en solicitudes reales y confirmar si Auto ads necesita una configuración RDP de cuenta; NPA no sustituye esta comprobación.
3. Obtener acceso de solo lectura al contenedor GTM y GA4 para identificar duplicados, Consent Settings, activadores y tratamiento al revocar/opt-out.
4. Con CMP real y perfiles limpios, capturar consola/HAR para primera visita, aceptación, rechazo, gestión, revocación, GPC y estados pertinentes. Distinguir descarga de script, solicitud de anuncio, ping/medición, cookies y parámetros `gpp`, `gpp_sid`, `npa`, `rdp`; repetir páginas con/sin AdSense.
5. Solicitar revisión jurídica de jurisdicciones, venta/compartición, analítica, cookies NPA, retención, menores y relación de proveedores. Los resultados técnicos no declaran cumplimiento legal.

#### Fuentes oficiales consultadas (2026-11-12)

- [Google Consent Mode (defaults, updates, Basic/Advanced)](https://developers.google.com/tag-platform/security/guides/consent)
- [AdSense: pause ad requests and NPA](https://support.google.com/adsense/answer/7670312?hl=en)
- [AdSense: Restricted Data Processing](https://support.google.com/adsense/answer/9598414?hl=en)
- [AdSense: GPP support, sections and RDP opt-outs](https://support.google.com/adsense/answer/14126816?hl=en)
- [AdSense: US-state privacy laws](https://support.google.com/adsense/answer/9560818?hl=en)
- [AdSense: IAB TCF integration and current version/deadline](https://support.google.com/adsense/answer/9804260?hl=en)
- [Google-certified CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en)
- [IAB GPP CMP API](https://github.com/InteractiveAdvertisingBureau/Global-Privacy-Platform/blob/main/Core/CMP%20API%20Specification.md), [section IDs](https://github.com/InteractiveAdvertisingBureau/Global-Privacy-Platform/blob/main/Sections/Section%20Information.md), [US National](https://github.com/InteractiveAdvertisingBureau/Global-Privacy-Platform/tree/main/Sections/US-National), [California](https://github.com/InteractiveAdvertisingBureau/Global-Privacy-Platform/tree/main/Sections/US-States/CA), [Colorado](https://github.com/InteractiveAdvertisingBureau/Global-Privacy-Platform/tree/main/Sections/US-States/CO)
- [IAB Europe TCF resources](https://iabeurope.eu/transparency-consent-framework/)
- [W3C Global Privacy Control specification](https://w3c.github.io/gpc/)

**Evaluación:** la ruta local simulada ahora falla cerrada ante ausencia, incompletitud y conflictos demostrados, y separa NPA de RDP. La auditoría **no está aprobada para producción ni lista para declarar integración correcta**: faltan la CMP real, decisión sobre discrepancia TCF, señales/solicitudes Google reales, verificación RDP y revisión GTM/GA4 remoto. No se desplegó, no se modificó la cuenta ni se solicitó revisión de AdSense.

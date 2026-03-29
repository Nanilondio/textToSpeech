# 🎙 English Audio Generator

Free text-to-speech tool for ESL teachers. Deployed on GitHub Pages.

---

## 🚀 Cómo desplegarlo en GitHub Pages (paso a paso)

### Paso 1 — Crear el repositorio

1. Ve a [github.com](https://github.com) e inicia sesión
2. Haz clic en **"New repository"** (botón verde)
3. En **Repository name** escribe exactamente: `english-audio-generator`  
   *(o cualquier nombre que quieras — afecta la URL)*
4. Déjalo en **Public**
5. Haz clic en **"Create repository"**

---

### Paso 2 — Subir el archivo

1. En la página del repositorio recién creado, haz clic en **"uploading an existing file"**
2. Arrastra el archivo `index.html` a la zona de subida
3. Abajo en "Commit changes", escribe algo como `Initial commit`
4. Haz clic en **"Commit changes"**

---

### Paso 3 — Activar GitHub Pages

1. Ve a **Settings** (pestaña de tu repositorio)
2. En el menú izquierdo, haz clic en **"Pages"**
3. En **"Source"** selecciona: `Deploy from a branch`
4. En **"Branch"** selecciona: `main` y carpeta `/ (root)`
5. Haz clic en **Save**

⏳ Espera 1-2 minutos. Tu sitio estará en:
```
https://TU-USUARIO.github.io/english-audio-generator/
```

---

### Paso 4 — Actualizar la URL en el HTML

Abre `index.html` y reemplaza las 3 ocurrencias de:
```
https://YOUR-USERNAME.github.io/
```
con tu URL real, por ejemplo:
```
https://hernanbarra.github.io/english-audio-generator/
```

Esto mejora el SEO (canonical URL y Open Graph).

---

## 📢 Configurar Google AdSense

### Paso 1 — Crear cuenta AdSense
1. Ve a [adsense.google.com](https://adsense.google.com)
2. Inicia sesión con tu Gmail
3. Ingresa la URL de tu sitio GitHub Pages
4. Sigue el proceso de verificación (pueden pasar 1-14 días para aprobación)

### Paso 2 — Agregar el código de verificación
Mientras esperas aprobación, AdSense te dará un código así:
```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
```
Pégalo en el `<head>` del `index.html` (ya hay un comentario marcando el lugar).

### Paso 3 — Cuando te aprueben
Busca los 3 bloques de comentarios en `index.html` marcados con:
```
<!-- AdSense: reemplaza cuando tengas tu código aprobado
```
Descomenta cada bloque y reemplaza:
- `ca-pub-XXXXXXXXXXXXXXXX` → tu Publisher ID
- `XXXXXXXXXX` → el Ad Slot ID de cada unidad

Los 3 espacios de publicidad están listos:
| Posición | Tamaño | Tipo |
|----------|--------|------|
| Top banner | 728×90 | Leaderboard |
| Sidebar | 250×250 | Square |
| Bottom | 970×90 | Leaderboard |

---

## 🔍 SEO incluido

- ✅ Title y meta description optimizados
- ✅ Open Graph (WhatsApp/Facebook preview)
- ✅ Twitter Card
- ✅ Schema.org WebApplication structured data
- ✅ Canonical URL
- ✅ Contenido FAQ indexable por Google
- ✅ Headings semánticos H1/H2/H3

---

## 📁 Estructura del proyecto

```
english-audio-generator/
└── index.html   ← todo en un solo archivo, listo para GitHub Pages
```

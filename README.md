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

### Paso 2 — Revisar la monetización
El sitio ahora carga Google Tag Manager y AdSense solo después de que el usuario acepta las cookies no esenciales mediante el banner de consentimiento.

Eso significa que:
- no hay bloques manuales de anuncio en el HTML;
- puedes usar Auto Ads desde tu cuenta de AdSense;
- si más adelante quieres insertar unidades manuales, tendrás que agregar los `ins` de AdSense correspondientes.

### Paso 3 — Confirmar el dominio
Asegúrate de que la URL canónica en el HTML y el dominio del `CNAME` coincidan con tu sitio publicado:
```txt
https://listeningclassroom.com/
```

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

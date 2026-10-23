# Nido CMS

Gestor de contenidos multi-sitio para agencias. Desde un solo panel gestionas las webs de todos tus clientes, y cada cliente entra con su usuario para editar solo la suya.

- **Editor visual por bloques** con vista previa real (escritorio, tablet y móvil), deshacer/rehacer e historial de versiones.
- **21 bloques**: portada, texto, imagen + texto, galería, vídeo, características, cifras, testimonios, equipo, precios, preguntas frecuentes, llamada a la acción, formulario, últimas entradas, mapa, HTML…
- **Plantillas de página**: inicio, sobre nosotros, servicios, contacto, landing y textos legales.
- **Blog**: entradas con editor de texto enriquecido, categorías, etiquetas, imagen destacada y publicación programada.
- **Formularios**: constructor de campos, avisos por email, bandeja de mensajes y exportación a CSV. Protección antispam (campo trampa y límite de envíos).
- **Medios**: biblioteca con arrastrar y soltar, búsqueda y texto alternativo.
- **Diseño**: 3 temas (Aurora, Clásico, Minimal) personalizables: colores, tipografías de Google Fonts, bordes, botones y cabecera.
- **Menús** con arrastrar y soltar y submenús.
- **SEO**: título y descripción por página, imagen para redes, `noindex`, URL canónica, `sitemap.xml` y `robots.txt` por sitio.
- **Dominios propios** con HTTPS automático (Caddy), o subdominios automáticos `cliente.tudominio.com`.
- **Roles**: superadministrador (agencia) y, por sitio, Administrador, Editor y Cliente.
- **API headless** de solo lectura con claves por sitio, para webs hechas a medida (Next.js, Astro…).
- Modo mantenimiento, aviso de cookies, código personalizado (analítica), recuperación de contraseña por email.

## Tecnología

Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL + Prisma · Tailwind CSS · TipTap · dnd-kit.

## Puesta en producción (recomendado: Docker)

Necesitas un VPS (Hetzner, DigitalOcean, OVH…) con Docker instalado.

1. Apunta el DNS del dominio del panel (por ejemplo `cms.tuagencia.com`) a la IP del servidor.
2. Copia el proyecto al servidor y prepara la configuración:
   ```bash
   cp .env.production.example .env
   nano .env        # ADMIN_DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, SMTP…
   docker compose up -d --build
   ```
3. Abre `https://cms.tuagencia.com`: verás el asistente de instalación para crear tu cuenta de superadministrador.

Las migraciones de base de datos se aplican solas cada vez que arranca el contenedor.

### Conectar el dominio de un cliente

1. En el proveedor del dominio del cliente, crea un registro **A** hacia la IP de tu servidor (o un **CNAME** hacia el dominio del panel).
2. En el panel: *Ajustes → General → Dominio propio*, escribe `www.cliente.com` y guarda.
3. En la primera visita, Caddy obtiene el certificado HTTPS automáticamente. Solo se emiten certificados para dominios dados de alta en el CMS.

Para subdominios automáticos (`cliente.webs.tuagencia.com`), define `ROOT_DOMAIN=webs.tuagencia.com` y crea un DNS comodín `*.webs.tuagencia.com`.

### Copias de seguridad

Hay que guardar dos cosas: la base de datos y los archivos subidos.

```bash
docker compose exec db pg_dump -U cms cms > backup-$(date +%F).sql
docker run --rm -v nido-cms_uploads:/u -v "$PWD":/b alpine tar czf /b/uploads-$(date +%F).tgz -C /u .
```

(El nombre del volumen depende de la carpeta del proyecto; compruébalo con `docker volume ls`.)

## Puesta en producción en Netlify

El proyecto incluye `netlify.toml`. En Netlify:

- La **base de datos** la crea Netlify Database automáticamente, y en cada despliegue aplica las migraciones de `netlify/database/migrations/`. Si cambias `prisma/schema.prisma`, copia también la nueva migración SQL de `prisma/migrations/` a esa carpeta.
- Los **archivos subidos** se guardan en Netlify Blobs.
- Variables necesarias: `APP_URL` (URL del panel), `STORAGE_DRIVER=netlify` y `MAX_UPLOAD_MB=5` (Netlify no acepta subidas de más de ~6 MB).
- **Dominios de clientes**: añade cada dominio en *Domain management* del proyecto de Netlify (como alias) y luego en *Ajustes → General* de la web en el CMS. Netlify genera el HTTPS.

## Desarrollo local

```bash
cp .env.example .env              # ajusta DATABASE_URL
npm install
npx prisma migrate deploy
npm run dev                        # http://localhost:3000
```

Sin dominio propio, cada web se ve en `http://localhost:3000/s/<identificador>`.

Para crear o recuperar un superadministrador desde la terminal:

```bash
npm run create-admin -- tu@email.com "Tu nombre" contraseñaSegura
```

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Conexión a PostgreSQL |
| `APP_URL` | URL pública del panel, p. ej. `https://cms.tuagencia.com` |
| `ROOT_DOMAIN` | Opcional. Dominio base para subdominios automáticos |
| `UPLOAD_DIR` | Carpeta de archivos subidos (por defecto `./uploads`) |
| `MAX_UPLOAD_MB` | Tamaño máximo por archivo (20 por defecto) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Envío de emails. Sin SMTP los mensajes se guardan igualmente en el panel |

## Roles y permisos

| | Cliente | Editor | Administrador | Superadmin |
| --- | :-: | :-: | :-: | :-: |
| Editar textos e imágenes de las páginas | ✓ | ✓ | ✓ | ✓ |
| Blog, medios y mensajes | ✓ | ✓ | ✓ | ✓ |
| Crear, duplicar y borrar páginas | | ✓ | ✓ | ✓ |
| Menús y formularios | | ✓ | ✓ | ✓ |
| Apariencia, ajustes, equipo, claves API, bloque HTML | | | ✓ | ✓ |
| Crear y borrar sitios, gestionar todos los usuarios | | | | ✓ |

## API headless

Crea una clave en *Ajustes → API headless* y úsala así:

```js
const res = await fetch("https://cms.tuagencia.com/api/v1/posts?limit=6", {
  headers: { Authorization: "Bearer nido_..." },
});
const { data, meta } = await res.json();
```

| Método | Ruta | Devuelve |
| --- | --- | --- |
| GET | `/api/v1/site` | Nombre, logo, tema, contacto, redes |
| GET | `/api/v1/pages` · `/api/v1/pages/{slug}` | Páginas publicadas (con sus bloques en JSON) |
| GET | `/api/v1/posts?page=&limit=&category=&tag=` · `/api/v1/posts/{slug}` | Entradas del blog |
| GET | `/api/v1/categories` · `/api/v1/tags` · `/api/v1/menus` · `/api/v1/media` | Taxonomías, menús, medios |
| GET / POST | `/api/v1/forms/{slug}` | Definición del formulario / enviar un mensaje (JSON) |

## Estructura del proyecto

```
prisma/                 Esquema y migraciones de la base de datos
src/middleware.ts       Enruta cada dominio de cliente a su web
src/app/(auth)/         Instalación, inicio de sesión y recuperación de contraseña
src/app/admin/          Panel de administración
src/app/s/[site]/       Web pública de cada sitio (+ sitemap.xml y robots.txt)
src/app/api/v1/         API headless
src/app/actions/        Acciones del servidor (guardar, borrar…)
src/components/site/    Bloques y componentes de las webs públicas
src/components/admin/   Componentes del panel (editor, medios, menús…)
src/lib/                Bloques, temas, permisos, autenticación, utilidades
```

Para añadir un bloque nuevo: defínelo en `src/lib/blocks.ts` (sus campos generan el formulario del editor automáticamente) y pinta su HTML en `src/components/site/Blocks.tsx`.

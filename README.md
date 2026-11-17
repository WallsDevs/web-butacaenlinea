# Butaca En Línea — web

Frontend React + TypeScript + Vite. El backend de producción está en
`https://api.butacaenlinea.com` (AWS Lightsail).

## Publicación en Vercel

En el proyecto `web-butacaenlinea`, configurar estas variables para Production:

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://api.butacaenlinea.com` |
| `VITE_WEB_URL` | `https://butacaenlinea.com` |
| `SEO_API_URL` | `https://api.butacaenlinea.com` |

Ejecutar un nuevo despliegue después de cambiarlas: Vite incorpora la URL al
JavaScript durante la compilación. Las variables del panel prevalecen sobre
`.env.production`. Build: `npm run build`; directorio de salida: `dist`.
`vercel.json` conserva las rutas de la SPA y permite conexiones e imágenes del API.
No colocar secretos del servidor, llaves QR ni contraseñas en variables `VITE_*`.

En desarrollo, `.env` apunta al backend local en `http://localhost:1340`.

## Plantilla React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

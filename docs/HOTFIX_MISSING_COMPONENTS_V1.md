# Hotfix Missing Components v1

Este parche corrige el fallo de build producido porque `app/marketplace/listing/[id]/page.tsx`
importaba componentes que no existían en el workspace actual de Vercel/v0:

- `components/analytics/listing-view-tracker`
- `components/marketplace/post-publish-share-card`
- `components/marketplace/related-listings-section`
- `components/seo/json-ld`

También añade un script seguro para crear `test:contracts` si el `package.json` del workspace no lo tiene.

## Aplicación

1. Copiar el contenido del ZIP en la raíz del proyecto.
2. Ejecutar:

```bash
node scripts/apply-wetudy-scripts.mjs
npm run test:contracts
npm run build
```

## Nota

No hay que ejecutar ninguna SQL de Supabase con este hotfix.

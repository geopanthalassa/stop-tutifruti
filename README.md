# Stop / Tutifruti

Next.js + Supabase Realtime + Capacitor. Modo local (pasa y juega), online (salas con
timer sincronizado) y práctica contra bots.

**Plan actual:** versión web con link primero (gratis, ya) → Google Play ($25) →
iOS más adelante, cuando tenga sentido.

## 1. Supabase

Usá tu proyecto actual o creá uno nuevo (recomendado: separado de RoamCost, para no
mezclar tablas ni políticas RLS de dos productos distintos).

1. Entrá al SQL Editor de tu proyecto en supabase.com
2. Pegá y ejecutá todo `supabase/schema.sql`
3. En Project Settings → API, copiá la **Project URL** y la **anon public key**

## 2. Correr local para probar

```
cp .env.local.example .env.local   # completá con tu URL y anon key de Supabase
npm install
npm run dev
```

Abrí http://localhost:3000 — probá el modo online con dos pestañas para ver el sync
en vivo, y el modo práctica contra bots.

## 3. Versión web con link (gratis, hoy mismo)

Esta es la parte rápida: la misma build estática que usa Capacitor sirve para una web
normal, sin necesitar Google Play ni Apple.

1. Subí este proyecto a un repo de GitHub
2. Andá a vercel.com, "Import Project", elegí el repo (detecta Next.js solo)
3. En "Environment Variables" cargá `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy — te da un link tipo `stop-tutifruti.vercel.app` en un par de minutos
5. (Opcional) Conectá un subdominio propio, tipo `stop.nukumarketing.com`, desde
   Vercel → Settings → Domains

Cada push a `main` vuelve a desplegar solo. Esto ya es jugable por link, sin pasar
por ninguna tienda.

## 4. Google Play (cuando quieras dar el salto a app instalable)

```
npm run build            # genera out/
npx cap init              # solo la primera vez, ya pre-configurado en capacitor.config.ts
npm run cap:add:android
npm run cap:sync
```

Para automatizar build + firma + subida en cada push, usá `codemagic.yaml` (ya tiene
el workflow de Android activo, el de iOS está comentado para más adelante):

1. Cuenta en Google Play Console ($25 USD, pago único, con verificación de identidad)
2. Creá un Service Account en Google Cloud con permisos de "Release Manager" en tu
   app de Play Console, generá su credencial JSON
3. En Codemagic: conectá el repo de GitHub, creá el grupo de variables `google_play`
   con esa credencial, y el grupo `supabase` con tus dos variables de entorno
4. Cada push a `main` compila el `.aab` y lo sube al track "internal" de Play Console
5. Cuentas nuevas: Google exige 14 días de testing cerrado con 12-20 testers antes
   de pasar a producción — sumá esos testers desde el Play Console apenas tengas
   la primera build subida, para no perder tiempo después

Guía oficial para cargar las credenciales:
https://docs.codemagic.io/yaml-publishing/google-play/

## 5. iOS — para más adelante

El workflow ya está escrito en `codemagic.yaml` (comentado). Cuando quieras activarlo:
descomentalo, sumá cuenta de Apple Developer ($99/año) y las credenciales de App
Store Connect. Tu build corre en una Mac en la nube — no hace falta Mac física.
Ver conversación anterior para el detalle completo.

## 6. Assets pendientes antes de publicar (cualquiera de las dos vías)

- Ícono de la app (1024x1024)
- Capturas de pantalla
- Política de privacidad publicada en una URL (obligatoria incluso para un juego sin
  cuentas de usuario)
- Descripción corta y larga en los idiomas que sumes

## Notas de arquitectura

- `game_rooms` es una sola tabla en Supabase: una fila por sala, con el estado
  completo en columnas + jsonb. Realtime empuja cualquier cambio a todos los
  clientes conectados — no hay polling.
- Las escrituras que pueden chocar entre sí (unirse a una sala, enviar respuestas,
  invalidar una respuesta) pasan por funciones de Postgres (`join_room`,
  `submit_answer`, `toggle_override`) para que sean atómicas aunque dos jugadores
  escriban al mismo tiempo.
- Las políticas RLS actuales son abiertas (cualquiera con la anon key puede leer/
  escribir cualquier sala) — aceptable para un juego casual sin cuentas, pero
  revisalo si en algún momento agregás login o historial persistente de partidas.
- El modo práctica juega contra bots locales (`lib/botWordbank.js`), sin backend.
  Local y online funcionan en cualquier idioma sin banco de palabras: el puntaje
  solo valida que la respuesta empiece con la letra correcta.

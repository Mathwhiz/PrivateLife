# Android

La app puede empaquetarse como APK usando Capacitor sobre el export estatico de Next.

## Flujo base

1. Instalar Android Studio
2. Desde [`web`](E:\Privatelife\web) correr:

```powershell
npm run android:add
npm run android:sync
npm run android:open
```

3. En Android Studio:
   - esperar que termine Gradle
   - conectar telefono o abrir emulador
   - usar `Run`
   - para APK: `Build > Build Bundle(s) / APK(s) > Build APK(s)`

## Que hace cada comando

- `npm run android:add`: crea la carpeta `android/` nativa
- `npm run android:sync`: genera `out/` con Next y copia la web al proyecto Android
- `npm run android:open`: abre el proyecto Android en Android Studio

## Datos

La app Android usa la misma logica web y la misma persistencia de Supabase. Si la app web ya esta sincronizada con Supabase, el APK vera el mismo archivo.

## Nota

Para builds Android locales, la app usa `basePath ""`, no `/PrivateLife`, asi que no depende de GitHub Pages.

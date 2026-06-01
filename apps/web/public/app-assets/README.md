# App icon and splash placeholders

Drop the real assets here before any signed APK or App Store
submission. Filenames must match exactly so the manifest and
Capacitor pipeline pick them up.

Required PNG sources (commit the real files here, NOT lorem
placeholders):

- `icon-192.png` (192x192) . PWA install icon, any purpose
- `icon-512.png` (512x512) . PWA install icon, any purpose
- `icon-512-maskable.png` (512x512) . Android adaptive icon, full bleed
- `icon-1024.png` (1024x1024) . Source for Capacitor `cap assets generate`
- `splash-2732.png` (2732x2732) . Source for Capacitor splash generation
- `notification-icon.png` (96x96) . White-on-transparent for Android status bar

Until the operator drops the real files here, the PWA install
prompt will fall back to the SVG favicon. That works but is not
the brand-quality output we want at release.

Do not commit real high-resolution art into this README, only the
PNG files alongside it.

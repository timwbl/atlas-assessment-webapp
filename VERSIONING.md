# ATLAS WebApp Versionierung

Aktuelle sichtbare WebApp-Version: `2.8`

- Kleine Updates und Patches erhöhen die zweite Zahl: `2.6` → `2.7`.
- Grosse Funktions- oder Architekturupdates erhöhen die erste Zahl: `2.6` → `3.0`.
- Die technische Paketversion in `package.json` verwendet SemVer mit Patchstelle, beispielsweise `2.6.0`.
- Bei jedem veröffentlichten Update müssen `package.json`, `package-lock.json` und die sichtbare WebApp-Version gemeinsam aktualisiert werden.

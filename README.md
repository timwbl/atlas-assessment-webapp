# ATLAS Assessment WebApp

Separate read-only Assessment-WebApp für Mitstudierende.

## Eigenschaften

- Keine KI-Generierung
- Kein PDF-Upload
- Keine Accounts
- Keine Cloud- oder Server-Speicherung personenbezogener Daten
- Assessments werden aus `public/assessments/*.json` geladen
- Fortschritt bleibt lokal im Browser
- Versteckter Admin-Modus mit lokalem Passwort und JSON-Export

## Start

```bash
npm install
npm run dev
```

Dann `http://localhost:3000` öffnen.

## Assessments hinzufügen

Lege kompatible Assessment-JSONs in:

```text
public/assessments/
```

Die App listet JSON-Dateien automatisch über die lokale Next.js Route `/api/assessments`.

## Admin-Modus

1. `.env.local.example` zu `.env.local` kopieren.
2. `NEXT_PUBLIC_ADMIN_PASSWORD` setzen.
3. App neu starten.
4. Admin öffnen mit `Ctrl + Alt + A` oder Doppelklick auf den kaum sichtbaren Punkt unten rechts.

Admin-Änderungen werden nicht serverseitig gespeichert. Nutze `Export Assessment JSON` und ersetze danach die JSON-Datei in `public/assessments/`.

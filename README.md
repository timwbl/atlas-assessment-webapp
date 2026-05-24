# ATLAS Assessment WebApp

Separate read-only Assessment-WebApp für Mitstudierende.

## Eigenschaften

- Keine KI-Generierung
- Kein PDF-Upload
- Accounts sind optional
- Ohne Login bleibt Fortschritt lokal im Browser
- Mit Supabase-Konfiguration kann Fortschritt freiwillig synchronisiert werden
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

## Optionaler Account-Sync

Die App funktioniert weiterhin komplett ohne Account. Wenn du Fortschritte zentral speichern willst:

1. Supabase-Projekt erstellen.
2. SQL aus `supabase/schema.sql` im Supabase SQL Editor ausführen.
3. In `.env.local` und Netlify setzen:

```text
NEXT_PUBLIC_SUPABASE_URL=https://dein-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

`NEXT_PUBLIC_SUPABASE_URL` muss die Project URL sein, nicht die API-Unterseite. Richtig ist also
`https://...supabase.co`, ohne `/auth/v1`, ohne `/rest/v1` und ohne Dashboard-Pfad.

4. App neu starten oder neu deployen.
5. In der Library mit E-Mail und Passwort einen Account erstellen.
6. Deinen Account in Supabase einmalig zum Admin machen:

```sql
update public.profiles
set role = 'admin'
where email = 'deine-email@example.com';
```

Normale User können ohne Login weiter lernen. Mit Login wird ihr lokaler Fortschritt mit Supabase synchronisiert. Im Admin-Modus erscheint zusätzlich ein Cloud-Progress-Dashboard für synchronisierte Accounts.

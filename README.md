# ATLAS Assessment WebApp

Separate read-only Assessment-WebApp für Mitstudierende.

## Eigenschaften

- Keine KI-Generierung
- Kein PDF-Upload
- Accounts sind optional
- Ohne Login bleibt Fortschritt lokal im Browser
- Mit Supabase-Konfiguration kann Fortschritt freiwillig synchronisiert werden
- Assessments werden aus `public/assessments/*.json` geladen
- Zusammenfassungen können im eigenen Downloadbereich nach Semester und Block bereitgestellt werden
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

## Zusammenfassungen / Downloads

Der Tab `Zusammenfassungen` zeigt Block-Zusammenfassungen nach `HS2025` und `FS2026`. Im Admin-Modus kannst du Dateien hochladen, bearbeiten, löschen und einem Semester plus Block zuordnen.

Ohne Supabase werden Uploads lokal im Browser gespeichert. Für eine öffentlich geteilte Netlify-Seite solltest du Supabase konfigurieren und das aktuelle `supabase/schema.sql` ausführen. Dann speichert die App Dateien bis 300 MB in einem öffentlichen Supabase-Storage-Bucket `summary-downloads` und nur die Metadaten in der Tabelle `summary_downloads`. Grosse Dateien werden automatisch in kleine Storage-Teile zerlegt und beim Download wieder zusammengesetzt, damit das Bucket-Limit nicht mehr blockiert.

Beim Speichern wird `Copyright: Tim Weibel` verpflichtend in den App-Metadaten hinterlegt und im Downloadbereich angezeigt.

## Block-Empfehlungen

Im Admin-Modus kannst du für jeden Semester-Block eine interne MC-Fragen-Bewertung von 1 bis 10 und einen kurzen Kommentar speichern. Mit Supabase werden diese Empfehlungen zentral in `assessment_block_recommendations` gespeichert und nur im Admin-Bereich angezeigt.

## Altfragen

Im 2. Semester gibt es einen geschützten Assessment-Block `Altfragen` mit grauer Blockfarbe. Assessments erscheinen dort, wenn ihr JSON-Feld so gesetzt ist:

```json
{
  "block": "Altfragen"
}
```

Im Admin-Editor gibt es dafür den Button `Als Altfragen markieren`. Der Zugriff ist für Admins automatisch offen. Eingeloggte User können eine Freigabe mit Name und Studienjahr 1 bis 6 anfragen; du siehst diese Anfragen im Admin-Modus unter `Altfragen Zugriff` und kannst sie freigeben oder ablehnen.

Optional kannst du zusätzlich ein direktes Altfragen-Passwort setzen:

```text
NEXT_PUBLIC_ALTFRAGEN_PASSWORD=dein-altfragen-passwort
```

Führe das aktuelle `supabase/schema.sql` erneut im Supabase SQL Editor aus, damit `altfragen_access_requests` und die Zugriffspolicies vorhanden sind.

## User-Bewertungen

Angemeldete User können nach Abschluss eines Assessments 1 bis 5 Sterne und optional einen Kommentar abgeben. Bewertungen werden in `assessment_reviews` gespeichert. Kommentare sind standardmässig nicht freigegeben und erscheinen erst öffentlich, wenn du sie im Admin-Modus moderierst.

## Online-Zähler

Oben rechts zeigt die WebApp aktive Verbindungen an. Dafür schreibt die App anonyme Heartbeats in `online_presence` und zählt Sessions, die gerade aktiv sind. Führe das aktuelle `supabase/schema.sql` erneut aus, damit die Tabelle und Policies vorhanden sind.

## Optionaler Account-Sync

Die App funktioniert weiterhin komplett ohne Account. Wenn du Fortschritte zentral speichern willst:

1. Supabase-Projekt erstellen.
2. SQL aus `supabase/schema.sql` im Supabase SQL Editor ausführen.
3. In Supabase unter `Authentication` -> `Providers` -> `Email` die Option `Confirm email` ausschalten. Sonst blockiert Supabase neue Sessions weiterhin mit `Email not confirmed`.
4. Falls bereits Accounts erstellt wurden, einmalig `ATLAS_confirm_existing_supabase_users.sql` im Supabase SQL Editor ausführen oder folgendes SQL verwenden:

```sql
update auth.users
set
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where email_confirmed_at is null;
```
5. In `.env.local` und Netlify setzen:

```text
NEXT_PUBLIC_SUPABASE_URL=https://dein-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=https://deine-netlify-seite.netlify.app
```

`NEXT_PUBLIC_SUPABASE_URL` muss die Project URL sein, nicht die API-Unterseite. Richtig ist also
`https://...supabase.co`, ohne `/auth/v1`, ohne `/rest/v1` und ohne Dashboard-Pfad.

In Supabase unter `Authentication` → `URL Configuration`:

- `Site URL`: deine Netlify-URL, z. B. `https://deine-netlify-seite.netlify.app`
- `Redirect URLs`: zusätzlich dieselbe URL und optional `https://deine-netlify-seite.netlify.app/**`

6. App neu starten oder neu deployen.
7. In der Library mit E-Mail und Passwort einen Account erstellen.
8. Deinen Account in Supabase einmalig zum Admin machen:

```sql
update public.profiles
set role = 'admin'
where email = 'deine-email@example.com';
```

Normale User können ohne Login weiter lernen. Mit Login wird ihr lokaler Fortschritt mit Supabase synchronisiert. Im Admin-Modus erscheint zusätzlich ein Cloud-Progress-Dashboard für synchronisierte Accounts.

# ATLAS E-Mail-Bestätigung

Die WebApp erwartet bestätigungspflichtige Supabase-Accounts und leitet danach auf:

`https://atlas-mc-fragen.netlify.app/auth/confirm`

## Automatische Konfiguration

1. Erstelle unter Supabase Account Settings einen Personal Access Token.
2. Kopiere die Project Reference aus `Project Settings > General`.
3. Führe im Projektordner aus:

```bash
export SUPABASE_ACCESS_TOKEN="dein-personal-access-token"
export SUPABASE_PROJECT_REF="deine-project-reference"
bash supabase/configure-email-confirmation.sh
```

Für eine andere Produktionsdomain:

```bash
export ATLAS_SITE_URL="https://deine-domain.example"
bash supabase/configure-email-confirmation.sh
```

Das Script setzt:

- `mailer_autoconfirm: false`
- Site URL
- erlaubte Redirect-URLs für Produktion und `localhost:3000`
- ATLAS-Betreff und ATLAS-HTML-Mailtemplate

## Manuell im Dashboard

1. `Authentication > Providers > Email`
2. `Confirm email` aktivieren.
3. `Authentication > URL Configuration`
4. Site URL auf `https://atlas-mc-fragen.netlify.app` setzen.
5. Redirect URLs ergänzen:
   - `https://atlas-mc-fragen.netlify.app/auth/confirm`
   - `http://localhost:3000/auth/confirm`
6. Unter `Authentication > Email Templates > Confirm signup` den Inhalt aus `email-confirmation-template.html` einsetzen.

## Wichtig

- `auth.users.confirmed_at` niemals per SQL aktualisieren. Die Spalte wird von Supabase verwaltet.
- Die Netlify-Variable `NEXT_PUBLIC_SITE_URL` muss ebenfalls `https://atlas-mc-fragen.netlify.app` enthalten.
- Für Produktion empfiehlt Supabase einen eigenen SMTP-Anbieter, da der eingebaute Maildienst limitiert ist.

## Kontrolle

Nur zum Prüfen im Supabase SQL Editor:

```sql
select
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
from auth.users
order by created_at desc;
```

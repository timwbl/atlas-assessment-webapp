# ATLAS WebApp Versionierung

Aktuelle sichtbare WebApp-Version: `3.10.2`

- Patch und Mini-Bugfix: dritte Zahl erhöhen, z. B. `3.1.1` → `3.1.2`.
- Kleines bis mittleres Feature-Update: zweite Zahl erhöhen und Patch zurücksetzen, z. B. `3.1.2` → `3.2.0`.
- Grosses Funktions- oder Architekturupdate: erste Zahl erhöhen und die übrigen Zahlen zurücksetzen, z. B. `3.2.0` → `4.0.0`.
- Die sichtbare und technische Version verwenden immer vollständig das Schema `Major.Minor.Patch`.
- Bei jedem veröffentlichten Update müssen `package.json`, `package-lock.json` und die sichtbare WebApp-Version gemeinsam aktualisiert werden.

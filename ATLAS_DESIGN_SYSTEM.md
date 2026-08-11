# ATLAS Design System v1

ATLAS ist ein ruhiges Produktivsystem im Stil von Apple Calendar und Notes: klare Navigation, viel Luft, helle Systemflächen, feine Linien und ein kontrollierter Einsatz von ATLAS Blue.

## Produktgefühl

- Ruhig, fokussiert, funktional.
- Informationsdicht, aber nicht technisch.
- Akzentfarben markieren Status und Aktion, sie dominieren nie die Fläche.
- Navigation verwendet lineare, Apple-artige Piktogramme mit kurzen Labels.
- Karten dienen einzelnen Objekten oder Werkzeugen, nicht als dekorative Seitencontainer.

## Tokens

- Hintergrund: `#f7f7f9`
- Fläche: `rgba(255,255,255,.92)`
- Sidebar: `rgba(255,255,255,.82)`
- Text: `#1d1d1f`
- Sekundärtext: `#6e6e73`
- Linie: `rgba(60,60,67,.14)`
- ATLAS Blue: `#0a84ff`
- Violet/Pink nur für seltene Highlights: `#9b72ff`, `#ff4fb8`
- Success/Warning/Danger: Apple-nahe Systemfarben

## Formen

- Controls: 14px Radius
- Cards: 14-18px Radius
- Panels: maximal 24px Radius
- Keine pillenförmigen Buttons für komplexe Navigation, ausser kleine Badges.

## Typografie

- Systemfont: `-apple-system`, `SF Pro Text`, `SF Pro Display`, Fallback `Segoe UI`.
- Keine negative Letter-Spacing.
- Grosse Headlines nur auf Start-/Dashboardflächen.
- Werkzeuge, Tabellen und Planer verwenden kompaktere Hierarchien.

## Navigation

Desktop:
- Ruhige Topbar oder Sidebar.
- Aktiver Tab: leichte blaue Tönung, nicht voller Farbblock.
- Icon + Label für Hauptbereiche.

Mobile:
- Bottom Tab Bar.
- Kurze Labels.
- Piktogramme bleiben führend.

## Komponenten

- Buttons: mindestens 40-44px Touch-Ziel.
- Inputs: helle Systemflächen mit feinem Border.
- Cards: feine Linie, minimale Schatten.
- Tabellen: klare Zeilen, wenig Dekoration.
- Modals/Sheets: abgerundete Panels, reduzierte Hintergrundunschärfe.

## Icon-Regel

Die WebApp nutzt eigene ATLAS-Systemicons, die sich an SF Symbols orientieren, aber als eigene SVG-Schicht gepflegt werden. Die lokale macOS-App kann visuell näher an SF Symbols geführt werden.

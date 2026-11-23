# ATLAS Design System

ATLAS ist auf kurze Lerneinstiege und konzentrierte Übungssitzungen ausgelegt. Auf der Übersicht hat die nächste oder laufende Übung Vorrang. Übungen, Altfragen und Zusammenfassungen behalten ihre fachlichen Filter und Blockfarben. Rückmeldungen im Quiz verwenden Text und Zustände zusätzlich zur Farbe.

## Navigation und Lesbarkeit

- Am Desktop steht die Hauptnavigation am linken Rand. Aktuelle Seiten und zugehörige Detailansichten sind sichtbar markiert. Die eingeklappte Navigation behält ihre Beschriftung für Screenreader und zeigt sie bei Mauszeigerkontakt.
- Auf kompakten Ansichten sind Übersicht, Übungen, Training, Fortschritt und Unterlagen am unteren Rand erreichbar. Der Reiter Übungen führt auch zu den Altfragen. Ein Zugriff auf den Hauptinhalt per Tastatur steht am Anfang der Navigation.
- Die Schrift folgt dem System des Geräts. Überschriften haben eine kompaktere Laufweite, Fragen und Antworten ausreichend Zeilenabstand. Die wiederkehrenden Schriftgrössen sind in rem definiert.
- Inhaltsflächen sind deckend. Die Navigationsleisten dürfen durchscheinend sein und werden mit den Systemeinstellungen für weniger Transparenz oder mehr Kontrast deckend. ATLAS verwendet weiterhin das eigene Logo und die eigenen Icons.

## Bedienung

- Bedienelemente zeigen den Druckzustand sofort und lösen die Aktion beim Loslassen aus. Tastaturfokus bleibt sichtbar. Hauptaktionen und häufig genutzte Touch-Ziele sind mindestens 44 CSS-Pixel hoch, soweit der Platz und der jeweilige Kontext es zulassen.
- Auswahlmenüs bleiben am Auslöser verankert, öffnen bei Platzmangel darüber und beschränken ihre Höhe auf den sichtbaren Bereich. Pfeiltasten bewegen die Hervorhebung. Enter oder Leertaste bestätigen, Escape schliesst.
- Dialoge verwenden das native Dialogelement. Auf dem Handy können schliessbare Dialoge zusätzlich über den Griff nach unten gezogen werden. Die Position folgt dem Finger. Beim Loslassen berücksichtigt die Bewegung dessen Geschwindigkeit und lässt sich durch erneutes Greifen unterbrechen. Jede Geste hat eine sichtbare Alternative.
- Bei weniger Bewegung erscheinen Layoutwechsel direkt. Für Rückmeldungen genügen kurze Überblendungen ohne räumliche Bewegung. Ladestände zeigen den tatsächlichen Vorgang an.

## Bewegung

Navigation, Suchresultate, Lernfortschritt und Fragenwechsel erscheinen direkt. Die Position von Lesetext und Bedienelementen bleibt beim Umschalten stabil.

| Situation | Zweck und Ausführung |
| --- | --- |
| Schaltflächen und Lernaktionen | Druckfeedback mit einer Skalierung auf 97.8 Prozent über 120 ms. Die Lernaktionen auf der Übersicht reagieren mit einer neutralen Tönung und einer kleineren Skalierung. |
| Auswahlfelder und Account-Menü | Der Auslöser gibt den Ursprung vor. Bei Zeigereingabe werden Deckkraft und Skalierung in 155 ms angepasst. Tastatureingaben erscheinen sofort. |
| Dialoge | Fläche und Hintergrund öffnen gemeinsam in 240 ms. Mobile Dialoge übernehmen Weg und Geschwindigkeit der Geste. Eine unterbrechbare Feder bewegt die Fläche nach dem Loslassen weiter. |
| Bildbetrachter | Beim Antippen wächst das Bild in 240 ms von der Vorschau in die Vollbildansicht. Derselbe Weg führt beim Schliessen zurück, solange das Bild eingepasst und seine Vorschau sichtbar ist. Zoomen und Verschieben folgen der Geste direkt. |
| Quizabschluss | Bei einer Abgabe per Maus oder Touch setzt sich die Punktübersicht in 240 ms mit leichter Perspektive ins Bild. Die Detailauswertung ist sofort lesbar. |
| Profil und E-Mail | Beim Antippen von «Bearbeiten» blendet die Profilansicht in 160 ms um. Bei der Bestätigung einer neuen E-Mail-Adresse bewegt sich das Häkchen einmalig in 240 ms in seine Endposition. |
| Import von Fortschrittsdaten | Kurzes Einblenden der Rückmeldung in 160 ms. Der Status ist auch über einen Screenreader verfügbar. |

Geprüfte Hauptbereiche sind Übersicht, Übungen, Altfragen, Unterlagen, Training, Quiz, Resultate, Lernfortschritt, Einstellungen, Anmeldung, Admin und Wartung. Fragenwechsel, Listenfilter und die Navigation zwischen Hauptbereichen erfolgen direkt. Gespeicherte Resultate öffnen ohne erneute Animation. Tastaturbedienung und die Systemeinstellung für weniger Bewegung bleiben bei allen neuen Übergängen berücksichtigt.

[Apple, Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/) · [W3C, WCAG 2.2](https://www.w3.org/TR/WCAG22/)
[W3C, CSS Transitions Level 2](https://www.w3.org/TR/css-transitions-2/)

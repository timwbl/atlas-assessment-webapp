import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Nutzungsbedingungen · ATLAS",
  description: "Nutzungsbedingungen für ATLAS Study OS."
};

const sections = [
  {
    title: "1. Geltungsbereich",
    body: [
      "Diese Nutzungsbedingungen gelten für ATLAS Study OS und alle damit verbundenen Funktionen wie Übungen, Altfragen, Zusammenfassungen, Lernfortschritt, Account-Synchronisierung und Downloads."
    ]
  },
  {
    title: "2. Zweck von ATLAS",
    body: [
      "ATLAS ist eine Lern- und Übungssoftware. Die App unterstützt Studierende beim Wiederholen, Trainieren und Strukturieren von Studieninhalten.",
      "ATLAS ersetzt keine Vorlesungen, offiziellen Prüfungsinformationen, medizinische Beratung, rechtliche Beratung oder verbindliche Leistungsbeurteilungen."
    ]
  },
  {
    title: "3. Account und Zugang",
    items: [
      "Du kannst ATLAS lokal oder mit Account-Funktionen nutzen, sofern diese verfügbar sind.",
      "Bei Registrierung oder Google-Anmeldung bist du dafür verantwortlich, dass deine Angaben korrekt sind und dein Zugang geschützt bleibt.",
      "Bestimmte Bereiche, insbesondere Altfragen oder administrative Funktionen, können nur mit Freigabe oder Passwort zugänglich sein."
    ]
  },
  {
    title: "4. Lerninhalte und Genauigkeit",
    body: [
      "ATLAS bemüht sich um korrekte und nützliche Lerninhalte. Trotzdem können Fragen, Erklärungen, Zusammenfassungen oder importierte Unterlagen Fehler enthalten oder veraltet sein.",
      "Prüfungsrelevante Entscheidungen solltest du immer mit offiziellen Unterlagen deiner Universität, deiner Dozent:innen oder den zuständigen Stellen abgleichen."
    ]
  },
  {
    title: "5. Erlaubte Nutzung",
    items: [
      "Du nutzt ATLAS nur für persönliche Lern- und Ausbildungszwecke.",
      "Du versuchst nicht, Schutzmechanismen, Freigaben, Passwörter oder technische Beschränkungen zu umgehen.",
      "Du lädst keine rechtswidrigen, verletzenden, vertraulichen oder urheberrechtlich unzulässigen Inhalte hoch.",
      "Du verwendest ATLAS nicht, um Systeme zu stören, zu überlasten oder unbefugt auf Daten anderer Nutzer:innen zuzugreifen."
    ]
  },
  {
    title: "6. Urheberrecht und Unterlagen",
    body: [
      "Die App, das Design, die Struktur und eigens erstellte Inhalte von ATLAS sind geschützt. Lernunterlagen, Altfragen oder Zusammenfassungen können zusätzlichen Rechten Dritter unterliegen.",
      "Downloads und bereitgestellte Dokumente sind, sofern nicht anders angegeben, nur für den persönlichen Gebrauch bestimmt und dürfen nicht ohne Berechtigung weiterverbreitet werden."
    ]
  },
  {
    title: "7. Fortschritt, Synchronisierung und Datenverlust",
    body: [
      "ATLAS kann Fortschritt lokal im Browser und, bei aktiviertem Account, in der Cloud speichern. Lokale Browserdaten können durch Browser-Einstellungen, Gerätewechsel oder manuelles Löschen verloren gehen.",
      "ATLAS bemüht sich um zuverlässige Synchronisierung, garantiert aber keine jederzeit fehlerfreie oder unterbrechungsfreie Speicherung."
    ]
  },
  {
    title: "8. Verfügbarkeit",
    body: [
      "ATLAS kann zeitweise nicht verfügbar sein, zum Beispiel wegen Wartung, technischer Probleme, Hosting-Ausfällen oder Änderungen an externen Diensten."
    ]
  },
  {
    title: "9. Haftung",
    body: [
      "ATLAS wird mit angemessener Sorgfalt bereitgestellt. Soweit gesetzlich zulässig, ist die Haftung für indirekte Schäden, Datenverlust, Prüfungsergebnisse, Lernentscheidungen oder Folgeschäden ausgeschlossen.",
      "Zwingende gesetzliche Haftung bleibt unberührt."
    ]
  },
  {
    title: "10. Änderungen und Beendigung",
    body: [
      "Funktionen, Inhalte und diese Bedingungen können weiterentwickelt oder angepasst werden. Wenn du ATLAS nach einer Änderung weiter nutzt, gilt die jeweils aktuelle Fassung.",
      "Du kannst die Nutzung jederzeit beenden. Account- oder Löschanfragen kannst du an die Kontaktadresse richten."
    ]
  },
  {
    title: "11. Kontakt und anwendbares Recht",
    body: [
      "Kontakt: tim.nick.weibel@icloud.com. Soweit zulässig, gilt Schweizer Recht."
    ]
  }
];

export default function NutzungsbedingungenPage() {
  return (
    <LegalPage
      eyebrow="ATLAS Bedingungen"
      intro="Diese Regeln halten fest, wofür ATLAS gedacht ist, wie du die App fair nutzt und wo die Grenzen der Lernsoftware liegen."
      sections={sections}
      title="Nutzungsbedingungen"
      updatedAt="14. August 2026"
    />
  );
}

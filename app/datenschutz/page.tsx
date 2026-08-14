import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Datenschutzerklärung · ATLAS",
  description: "Datenschutzerklärung für ATLAS Study OS."
};

const sections = [
  {
    title: "1. Verantwortliche Stelle",
    body: [
      "Verantwortlich für ATLAS Study OS ist Tim Weibel. Kontakt für Datenschutzanfragen: tim.nick.weibel@icloud.com.",
      "ATLAS ist eine Lern- und Übungsapp für medizinische Studieninhalte. Die App unterstützt beim Trainieren, Wiederholen und Verwalten des persönlichen Lernfortschritts."
    ]
  },
  {
    title: "2. Welche Daten ATLAS verarbeitet",
    items: [
      "Accountdaten wie Anzeigename, E-Mail-Adresse und Login-Informationen, falls du einen Account erstellst oder dich über Google anmeldest.",
      "Lern- und Übungsdaten wie gesehene Fragen, Antworten, Scores, markierte Fragen, Sessions, Fortschritt, Lernphase, Fachsemester und lokale Einstellungen.",
      "Technische Daten wie Browsertyp, Gerätedaten, Spracheinstellungen, Fehlermeldungen und Sicherheitsereignisse, soweit sie für Betrieb, Schutz und Fehleranalyse erforderlich sind.",
      "Inhalte, die du selbst in ATLAS eingibst, zum Beispiel Profilname, Feedback, Freigabeanfragen oder lokal gespeicherte Einstellungen."
    ]
  },
  {
    title: "3. Zwecke der Verarbeitung",
    items: [
      "Bereitstellung der App, Übungen, Altfragen, Zusammenfassungen und Lernfortschrittsfunktionen.",
      "Synchronisierung deines Fortschritts zwischen Geräten, wenn du einen Account nutzt.",
      "Anmeldung, Authentifizierung, Missbrauchsschutz und Verwaltung von Freigaben.",
      "Verbesserung von Stabilität, Bedienbarkeit, Fehlerbehebung und Sicherheit der App.",
      "Kommunikation bei Support-, Feedback- oder Freigabeanfragen."
    ]
  },
  {
    title: "4. Rechtsgrundlagen",
    body: [
      "Die Bearbeitung erfolgt, soweit anwendbar, zur Vertragserfüllung beziehungsweise zur Bereitstellung der von dir angefragten Funktionen, auf Grundlage deiner Einwilligung, aufgrund berechtigter Interessen am sicheren Betrieb der App oder zur Erfüllung gesetzlicher Pflichten."
    ]
  },
  {
    title: "5. Lokale Speicherung und Cookies",
    body: [
      "ATLAS nutzt lokale Browser-Speicherung, um Einstellungen, Lernfortschritt und Sessions auf deinem Gerät verfügbar zu halten. Wenn du keinen Account verwendest, bleiben wesentliche Lernfortschritte lokal auf deinem Gerät gespeichert.",
      "Für Login, Sicherheit und Synchronisierung können technisch notwendige Cookies oder vergleichbare Speichertechnologien eingesetzt werden."
    ]
  },
  {
    title: "6. Dienste und Empfänger",
    items: [
      "Supabase kann für Authentifizierung, Datenbank, Accountverwaltung und Synchronisierung eingesetzt werden.",
      "Google wird nur verwendet, wenn du dich aktiv mit Google anmeldest oder dein Konto damit verknüpfst.",
      "Hosting- und Infrastruktur-Anbieter können technische Verbindungs- und Betriebsdaten verarbeiten, um ATLAS auszuliefern und abzusichern.",
      "Eine Weitergabe zu Werbezwecken findet nicht statt."
    ]
  },
  {
    title: "7. Übermittlung ins Ausland",
    body: [
      "Je nach eingesetzten Diensten können Daten in Länder ausserhalb der Schweiz oder des Europäischen Wirtschaftsraums übermittelt werden. In diesem Fall achtet ATLAS darauf, geeignete Garantien oder anerkannte Schutzmechanismen der jeweiligen Anbieter zu verwenden, soweit dies erforderlich ist."
    ]
  },
  {
    title: "8. Speicherdauer",
    body: [
      "Personendaten werden nur so lange gespeichert, wie dies für die genannten Zwecke erforderlich ist. Lokale Daten bleiben auf deinem Gerät, bis du sie im Browser, in ATLAS oder durch Zurücksetzen deines Fortschritts löschst. Accountdaten und synchronisierte Fortschritte können nach einer Löschanfrage entfernt werden, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen."
    ]
  },
  {
    title: "9. Deine Rechte",
    body: [
      "Du kannst im Rahmen des anwendbaren Datenschutzrechts Auskunft, Berichtigung, Löschung, Einschränkung, Datenherausgabe oder Widerspruch verlangen. Falls eine Verarbeitung auf Einwilligung beruht, kannst du diese Einwilligung für die Zukunft widerrufen."
    ]
  },
  {
    title: "10. Sicherheit",
    body: [
      "ATLAS setzt angemessene technische und organisatorische Massnahmen ein, um Daten vor Verlust, Missbrauch und unbefugtem Zugriff zu schützen. Kein System ist absolut sicher; melde verdächtige Vorgänge bitte an die oben genannte Kontaktadresse."
    ]
  },
  {
    title: "11. Änderungen",
    body: [
      "Diese Datenschutzerklärung kann angepasst werden, wenn sich Funktionen, Dienste oder rechtliche Anforderungen ändern. Die jeweils aktuelle Fassung ist in ATLAS abrufbar."
    ]
  }
];

export default function DatenschutzPage() {
  return (
    <LegalPage
      eyebrow="ATLAS Datenschutz"
      intro="Hier findest du kompakt, welche Daten ATLAS verarbeitet, wofür sie genutzt werden und welche Rechte du hast."
      sections={sections}
      title="Datenschutzerklärung"
      updatedAt="14. August 2026"
    />
  );
}

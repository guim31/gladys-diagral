# Diagral e-ONE

## Überblick

Diese Integration verbindet deine **Diagral-e-ONE**-Alarmanlage über die Diagral-Cloud mit Gladys,
dieselbe Cloud, die die App Diagral e-ONE auf deinem Handy nutzt. Gladys sieht:

- den **Alarmstatus**: Ausgeschaltet, Ausgangsverzögerung, Komplett eingeschaltet, Teilweise
  eingeschaltet, Anwesenheitsmodus;
- die **eingeschalteten Gruppen**, mit den Namen aus der Installation;
- die **Störungen** der Melder, Bedienteile, Fernbedienungen, Sirenen und der Zentrale: schwache
  Batterien, Sabotageschutz (ein geöffnetes oder abgerissenes Gehäuse), Funk- oder
  Übertragungsstörung;
- mit **Gladys Plus** die **Alarme** in Echtzeit (Einbruch, Panik, Feuer, technischer Alarm).

Gladys kann die Alarmanlage auch über ein Widget oder eine Szene **ein- oder ausschalten**, aber nur,
wenn du es erlaubst: Standardmäßig zeigt Gladys nur den Status an.

Ohne die Hardware entwickelt: Rückmeldungen willkommen auf
[github.com/guim31/gladys-diagral/issues](https://github.com/guim31/gladys-diagral/issues). Diese
Integration ist nicht mit Diagral oder Hager verbunden.

## Voraussetzungen

- Eine Diagral-e-ONE-Alarmanlage, die über ihre **Box** mit dem Internet verbunden ist: eine Box
  DIAG56AAX (nicht mehr im Handel) oder die in eine Zentrale DIAG99AGX eingebaute Box. Wenn die App
  Diagral e-ONE deine Alarmanlage aus der Ferne steuert, passt alles.
- Das **Konto der App Diagral e-ONE**: E-Mail-Adresse und Passwort.
- Die **Seriennummer der Box**: 14 Zeichen, auf dem Etikett mit QR-Code **im Inneren** der Box. Du
  musst ihren Deckel öffnen (siehe Anleitung der Box).
- Der **Zugangscode**, den du in der App eingibst, um die Alarmanlage zu sehen und zu steuern: der
  Mastercode oder ein Benutzercode.
- Gladys 5.1 oder neuer. Für Alarme in Echtzeit: ein **Gladys-Plus**-Abonnement.

## Konfiguration

Öffne in Gladys **Integrationen**, installiere **Diagral e-ONE** („Von GitHub installieren“, falls sie
noch nicht im Katalog ist) und öffne dann ihren Bildschirm **Konfiguration**.

### Diagral-Konto

- **E-Mail-Adresse** und **Passwort**: die der App Diagral e-ONE.
- **Seriennummer der Box**: die 14 Zeichen des Etiketts. Groß- und Kleinschreibung, Leerzeichen und
  Bindestriche spielen keine Rolle.
- **Zugangscode der Alarmanlage**: Diagral verlangt ihn bei jeder Abfrage des Status, nicht nur für
  die Befehle.

Bei der ersten Verbindung erstellt die Integration einen **API-Schlüssel** in der Diagral-Cloud, wie
es die Home-Assistant-Integration tut. Danach nutzt jede Abfrage diesen Schlüssel: Das Passwort geht
nur noch an Diagral, um einen neuen Schlüssel zu erstellen.

### Einschalten über Gladys

- **Aus (nur Status)**, die Voreinstellung: Gladys zeigt den Alarmstatus an und ändert ihn nie.
- **Nur einschalten**: Widget und Szenen können die Alarmanlage einschalten, nie ausschalten.
- **Ein- und ausschalten**: Wer deine Dashboards und Szenen nutzt, kann die Alarmanlage auch
  ausschalten.

In jedem Fall wird die Alarmanlage **nie wie ein Schalter und nie per Sprache** gesteuert: Der Status
ist eine schreibgeschützte Funktion. Das Ausschalten über das Widget verlangt eine Bestätigung.

### Abfrage der Alarmanlage

**Abfrage der Alarmanlage** legt fest, wie oft Status und Störungen gelesen werden: jede Minute, alle
2 Minuten, alle **5 Minuten** (Voreinstellung, wie Home Assistant) oder alle 10 Minuten. Jede
Abfrage stellt zwei Anfragen an die Diagral-Cloud (Status und Störungen); die Konfiguration der
Alarmanlage (Namen, Gruppen) wird nur alle 6 Stunden neu gelesen. Diagral veröffentlicht kein
Kontingent: Bleib vernünftig. Bittet Diagral um weniger Anfragen, pausieren die Abfragen eine Minute,
dann zwei und so weiter bis zu zwei Stunden.

Während einer Ausgangsverzögerung wird die Alarmanlage alle 30 Sekunden gelesen, bis sie
eingeschaltet ist.

### Sprache

**Sprache der Namen und Texte**: die Sprache der Funktionsnamen und der Störungstexte (standardmäßig
Französisch). Gladys behält die Namen, die beim Hinzufügen des Geräts gewählt wurden.

### Gladys-Plus-Webhook (Echtzeit)

Die Diagral-Cloud kann ein Ereignis über einen **Webhook** melden: Alarm, Ein- oder Ausschalten, neue
Störung. Da Gladys bei dir zu Hause läuft, geht dieser Webhook über **Gladys Plus**.

> **Achtung: Diagral behält nur einen Webhook pro Box.** Empfängt Home Assistant, Jeedom oder eine
> andere Software schon die Ereignisse deiner Alarmanlage, ersetzt die Option unten diesen Webhook:
> Die andere Software bekommt dann nichts mehr von Diagral.

Deshalb ist die Option **Alarme in Echtzeit (ersetzt anderen Webhook)** **standardmäßig aus**.
Solange sie aus ist, liest, ändert oder löscht Gladys den Webhook deiner Box nie. Zum Einschalten:

1. Erstelle in Gladys Plus einen Open-API-Schlüssel (Einstellungen → Open API).
2. Füge ihn im Block „Gladys-Plus-Webhooks“ des Bildschirms Konfiguration der Integration ein: Er
   nennt „Diagral-Ereignisse (Alarme, Einschaltungen, Störungen)“.
3. Aktiviere **Alarme in Echtzeit (ersetzt anderen Webhook)**: Die Integration trägt die Adresse bei
   Diagral ein.

Schaltest du die Option aus oder entfernst du den Schlüssel, löscht die Integration ihren Webhook bei
Diagral, aber nur, wenn es noch ihrer ist. Der Webhook einer anderen Software wird nie gelöscht.

**Ohne die Option**, was bleibt und was fehlt: Die Diagral-API hat keinen Ereignisverlauf. Status,
eingeschaltete Gruppen und Störungen werden weiter im gewählten Takt gelesen (standardmäßig alle 5
Minuten), und die Auslöser für Einschalten und Störungen funktionieren, mit dieser Verzögerung. Ein
**Alarm** ist aber nie sichtbar: „Alarm läuft“ bleibt ohne Wert und der Auslöser „Diagral-Alarm
ausgelöst“ kommt nie. „Geändert von“ bleibt leer.

### Aktionen

- **Verbindung testen**: liest Status und Störungen der Alarmanlage und fasst sie zusammen. Nichts
  wird ein- oder ausgeschaltet.
- **API-Schlüssel erneuern**: erstellt einen neuen API-Schlüssel in der Diagral-Cloud und löscht den
  alten. Nützlich, wenn du glaubst, dass er bekannt wurde, oder wenn Diagral ihn ablehnt.

## Das Gerät

Nach der Verbindung bietet der Tab **Entdecken** ein Gerät **Diagral-Alarmanlage** an (gefolgt vom
Namen deiner Alarmanlage). Seine Funktionen, alle schreibgeschützt:

- **Alarmstatus**: Ausgeschaltet, Ausgangsverzögerung, Komplett eingeschaltet, Teilweise
  eingeschaltet, Anwesenheitsmodus. Komplett eingeschaltet schaltet alle Gruppen ein; mit einem Teil
  der Gruppen ist es teilweise eingeschaltet.
- **Alarm läuft**: 1, sobald Diagral einen Alarm meldet, bis die Alarmanlage ausgeschaltet ist. Nur
  mit dem Gladys-Plus-Webhook: Ohne ihn bleibt diese Funktion ohne Wert, da nichts es mitteilen kann.
- **Eingeschaltete Gruppen**: die Namen der eingeschalteten Gruppen oder „Keine“.
- **Störungen**: die aktuellen Störungen, zum Beispiel „(2) Porte garage: schwache Batterien,
  Zentrale: Sabotage“.
- **Anzahl der Störungen**: dieselbe Zahl, für die Szenen.
- **Schwache Batterien**: 1, wenn ein Gerät der Alarmanlage schwache Batterien oder eine Störung der
  Stromversorgung meldet.
- **Sabotageschutz**: 1, wenn ein Gerät eine Sabotage meldet (Gehäuse geöffnet oder abgerissen).
- **Verbindungsstörung**: 1, wenn ein Gerät eine Funk- oder Übertragungsstörung meldet (GSM,
  Telefonleitung, Internet).
- **Diagral-Cloud**: 0, wenn die Diagral-Cloud nicht mehr antwortet.

## Das Widget

Das Widget **Diagral-Alarmanlage** zeigt den Alarmstatus (bei einem Alarm rot „ALARM LÄUFT“), die
eingeschalteten Gruppen und die Störungen. Je nach **Einschalten über Gladys** bietet es bis zu vier
Knöpfe: **Komplett ein**, **Teilweise 1** (oder **Teilweise 2**, wenn deine Alarmanlage keinen
Teilmodus 1 hat), **Anwesenheit** und **Ausschalten**, das eine Bestätigung verlangt. Der aktuelle
Modus ist mit einem Haken markiert.

## Szenenauslöser

- **Diagral-Alarm ausgelöst**: Die Alarmanlage hat ausgelöst. Filter: die Art des Alarms (Einbruch,
  Panik, Feuer, Technisch (Wasser, Temperatur …), Andere). Variablen: die Art des Alarms, der Melder,
  die Gruppe und der Diagral-Code. Braucht den Gladys-Plus-Webhook. Ein Alarm, der mehr als 15 Minuten
  zu spät ankommt, löst nichts aus.
- **Diagral ein- oder ausgeschaltet**: Die Alarmanlage hat den Modus gewechselt, per Bedienteil,
  Fernbedienung, App oder Gladys. Filter: der neue Modus (Ausgeschaltet, Komplett eingeschaltet,
  Teilweise eingeschaltet, Anwesenheitsmodus). Variablen: der neue Modus und „Geändert von“ (der Name
  des Benutzers, wenn Diagral ihn über den Webhook nennt, „Gladys“ bei einem Befehl von Gladys). Das
  Ende einer Ausgangsverzögerung ist das Einschalten.
- **Diagral-Störung gemeldet**: Eine neue Störung ist aufgetreten. Filter: die Art der Störung
  (Batterien oder Strom, Sabotageschutz, Funk- oder Übertragungsverbindung, Andere). Variablen: die
  Art der Störung, das Gerät und die Störung im Klartext.

Störungen, die beim Start der Integration schon da sind, lösen nichts aus.

## Szenenaktion

**Diagral ein- oder ausschalten**, soweit „Einschalten über Gladys“ es erlaubt:

- **Befehl**: Ausschalten, Komplett ein, Anwesenheit, Teilweise 1, Teilweise 2 oder Gewählte Gruppen;
- **Gruppen**: nur für „Gewählte Gruppen“, die Nummern der Gruppen durch Kommas getrennt, zum Beispiel
  `1,3`.

Ergebnis: „Status nach dem Befehl“, direkt nach dem Einschalten meist eine Ausgangsverzögerung.

## Szenenbeispiele

- **Einbruch**: Auslöser „Diagral-Alarm ausgelöst“, Art Einbruch → alle Lichter einschalten, eine
  Nachricht „Einbruch erkannt von {{triggerEvent.data.device}}“ und das Bild der Eingangskamera
  senden.
- **Haus verlassen**: Wenn das letzte Familienmitglied das Haus verlässt → Aktion „Diagral ein- oder
  ausschalten“, Befehl Komplett ein (mindestens „Nur einschalten“ nötig).
- **Batterien wechseln**: Auslöser „Diagral-Störung gemeldet“, Art Batterien oder Strom → Nachricht
  „Batterien wechseln: {{triggerEvent.data.fault}}“.
- **Nacht**: Auslöser „Diagral ein- oder ausgeschaltet“, Modus Anwesenheitsmodus → Heizung absenken
  und Fernseher ausschalten.

## Fehlerbehebung

- **„Diagral lehnt die E-Mail-Adresse oder das Passwort ab“**: Prüfe sie in der App Diagral e-ONE. Die
  Integration versucht es erst nach der nächsten Änderung der Konfiguration wieder, damit dein Konto
  nicht gesperrt wird.
- **„Diagral lehnt die Seriennummer der Box oder den Zugangscode ab“**: Prüfe die 14 Zeichen des
  Etiketts und den Code. Ein Scan im Tab Entdecken versucht es erneut.
- **„Die Diagral-Cloud antwortet nicht“**: Die Integration versucht es weiter und schreibt es einmal
  in die Protokolle. Funktioniert die App Diagral e-ONE?
- **Nichts in Echtzeit**: Ist die Option „Alarme in Echtzeit“ aktiviert? Prüfe auch den Open-API-Schlüssel im Block „Gladys-Plus-Webhooks“. Ein anderes
  Werkzeug könnte den Webhook deiner Box übernommen haben: Diagral behält nur einen.
- **Mehr Details**: Setze die Variable `LOG_LEVEL=debug`. Die Protokolle enthalten nie das Passwort,
  den Code, den API-Schlüssel oder die Adresse des Webhooks.

## Grenzen

- **Ohne die Hardware und ohne Diagral-Konto** entwickelt: Die Verbindung zur echten Cloud konnte
  nicht ausprobiert werden. Die Antworten der API stammen aus der Bibliothek pydiagral und der
  Home-Assistant-Integration von Marc Guyard. Deine Rückmeldungen sind wertvoll.
- Die Diagral-Cloud hat keinen Ereignisverlauf: Alarme kommen nur über den Webhook (Gladys Plus),
  Einschaltungen und Störungen auch über die Abfragen.
- Wer ein- oder ausgeschaltet hat („Geändert von“), ist nur mit dem Webhook bekannt.
- Ein Webhook pro Box bei Diagral: Gladys und ein anderes Werkzeug können ihn nicht gleichzeitig
  nutzen.
- Die Melder sind keine eigenen Geräte: Die API liefert nicht ihren Zustand (Tür offen, Bewegung), nur
  ihre Störungen.
- Eine Alarmanlage bleibt deine Verantwortung: Verlass dich nicht allein auf Gladys, um von einem
  Einbruch zu erfahren.

## Daten und Sicherheit

- Passwort und Zugangscode bleiben in der Konfiguration von Gladys. Der API-Schlüssel und sein
  Geheimnis liegen in `/data/diagral-state.json`, nur für den Container lesbar. Die Adresse des
  Webhooks wird nicht gespeichert (nur ihr Fingerabdruck), da sie deinen Open-API-Schlüssel enthält.
- Die Integration spricht nur mit der Diagral-Cloud (`appv3.tt-monitor.com`) und mit Gladys.
- Ein Ereignis des Webhooks wird nur vom Übertragungsgerät deiner Box angenommen; Einschaltungen und
  Störungen werden vor der Anzeige immer über die API neu gelesen.

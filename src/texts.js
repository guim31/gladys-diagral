// -----------------------------------------------------------------------------
// Every text the integration shows, in the four languages of the Gladys
// interface: English, French, German (with "du") and Spanish (with "usted").
// test/i18n.test.js checks that none is missing, empty or too long. French
// follows the words of the Diagral keypads and app (marche totale, marche
// partielle, marche présence, arrêt, autoprotection); German and Spanish
// follow the alarm box of Gladys (eingeschaltet, armada). Brand names are not
// translated.
// -----------------------------------------------------------------------------

/** The text of a multi-language object in a language, English otherwise. */
export const pick = (texts, language) => texts?.[language] ?? texts?.en ?? '';

/** A multi-language object from a function of the language. */
export const localized = (fn) => ({ en: fn('en'), fr: fn('fr'), de: fn('de'), es: fn('es') });

// Name of the device, before the name of the alarm when Diagral gives one.
export const DEVICE_NAME = {
  en: 'Diagral alarm',
  fr: 'Alarme Diagral',
  de: 'Diagral-Alarmanlage',
  es: 'Alarma Diagral',
};

// Names of the features, fixed by Gladys when the device is added.
export const FEATURE_NAMES = {
  en: {
    state: 'Alarm state',
    triggered: 'Alarm in progress',
    groups: 'Armed groups',
    faults: 'Faults',
    fault_count: 'Number of faults',
    battery_low: 'Low batteries',
    tamper: 'Tamper protection',
    link_fault: 'Link fault',
    online: 'Diagral cloud',
  },
  fr: {
    state: "État de l'alarme",
    triggered: 'Alarme en cours',
    groups: 'Groupes en marche',
    faults: 'Anomalies',
    fault_count: "Nombre d'anomalies",
    battery_low: 'Piles faibles',
    tamper: 'Autoprotection',
    link_fault: 'Défaut de liaison',
    online: 'Cloud Diagral',
  },
  de: {
    state: 'Alarmstatus',
    triggered: 'Alarm läuft',
    groups: 'Eingeschaltete Gruppen',
    faults: 'Störungen',
    fault_count: 'Anzahl der Störungen',
    battery_low: 'Schwache Batterien',
    tamper: 'Sabotageschutz',
    link_fault: 'Verbindungsstörung',
    online: 'Diagral-Cloud',
  },
  es: {
    state: 'Estado de la alarma',
    triggered: 'Alarma en curso',
    groups: 'Grupos armados',
    faults: 'Anomalías',
    fault_count: 'Número de anomalías',
    battery_low: 'Pilas bajas',
    tamper: 'Autoprotección',
    link_fault: 'Fallo de enlace',
    online: 'Nube Diagral',
  },
};

// States of the alarm (feature `state`, widget, scene trigger).
export const STATE_NAMES = {
  en: {
    disarmed: 'Disarmed',
    arming: 'Exit delay',
    armed: 'Fully armed',
    partial: 'Partially armed',
    presence: 'Presence mode',
  },
  fr: {
    disarmed: 'Arrêt',
    arming: 'Temporisation de sortie',
    armed: 'Marche totale',
    partial: 'Marche partielle',
    presence: 'Marche présence',
  },
  de: {
    disarmed: 'Ausgeschaltet',
    arming: 'Ausgangsverzögerung',
    armed: 'Komplett eingeschaltet',
    partial: 'Teilweise eingeschaltet',
    presence: 'Anwesenheitsmodus',
  },
  es: {
    disarmed: 'Desarmada',
    arming: 'Retardo de salida',
    armed: 'Armada (total)',
    partial: 'Armada (parcial)',
    presence: 'Modo presencia',
  },
};

// Commands of the widget buttons and of the scene action (24 characters at most).
export const COMMAND_NAMES = {
  en: {
    disarm: 'Disarm',
    arm: 'Arm fully',
    presence: 'Presence',
    partial_1: 'Partial 1',
    partial_2: 'Partial 2',
    groups: 'Chosen groups',
  },
  fr: {
    disarm: 'Arrêt',
    arm: 'Marche totale',
    presence: 'Marche présence',
    partial_1: 'Partielle 1',
    partial_2: 'Partielle 2',
    groups: 'Groupes choisis',
  },
  de: {
    disarm: 'Ausschalten',
    arm: 'Komplett ein',
    presence: 'Anwesenheit',
    partial_1: 'Teilweise 1',
    partial_2: 'Teilweise 2',
    groups: 'Gewählte Gruppen',
  },
  es: {
    disarm: 'Desarmar',
    arm: 'Armar total',
    presence: 'Presencia',
    partial_1: 'Parcial 1',
    partial_2: 'Parcial 2',
    groups: 'Grupos elegidos',
  },
};

// Anomalies of the Diagral cloud (their names are the flags of the
// configuration), in the words of the Diagral app. An unknown name is shown
// as Diagral sends it.
export const ANOMALY_NAMES = {
  en: {
    powerSupplyAlert: 'low batteries',
    mainPowerSupplyAlert: 'main power fault',
    secondaryPowerSupplyAlert: 'backup power fault',
    autoprotectionMechanicalAlert: 'tamper',
    autoprotectionWiredAlert: 'wired tamper',
    radioAlert: 'radio link fault',
    outOfOrderAlert: 'out of order',
    mediaGSMAlert: 'GSM fault',
    mediaRTCAlert: 'phone line fault',
    mediaADSLAlert: 'Internet fault',
    defaultMediaAlert: 'transmission fault',
    loopAlert: 'loop fault',
    maskAlert: 'masking',
    sensorAlert: 'detector fault',
  },
  fr: {
    powerSupplyAlert: 'piles faibles',
    mainPowerSupplyAlert: 'défaut alimentation',
    secondaryPowerSupplyAlert: 'défaut alimentation secours',
    autoprotectionMechanicalAlert: 'autoprotection',
    autoprotectionWiredAlert: 'autoprotection filaire',
    radioAlert: 'défaut liaison radio',
    outOfOrderAlert: 'hors service',
    mediaGSMAlert: 'défaut GSM',
    mediaRTCAlert: 'défaut ligne téléphonique',
    mediaADSLAlert: 'défaut Internet',
    defaultMediaAlert: 'défaut de transmission',
    loopAlert: 'défaut de boucle',
    maskAlert: 'masquage',
    sensorAlert: 'défaut détecteur',
  },
  de: {
    powerSupplyAlert: 'schwache Batterien',
    mainPowerSupplyAlert: 'Störung Stromversorgung',
    secondaryPowerSupplyAlert: 'Störung Notstrom',
    autoprotectionMechanicalAlert: 'Sabotage',
    autoprotectionWiredAlert: 'Sabotage (verdrahtet)',
    radioAlert: 'Funkstörung',
    outOfOrderAlert: 'außer Betrieb',
    mediaGSMAlert: 'GSM-Störung',
    mediaRTCAlert: 'Störung Telefonleitung',
    mediaADSLAlert: 'Internetstörung',
    defaultMediaAlert: 'Übertragungsstörung',
    loopAlert: 'Schleifenstörung',
    maskAlert: 'Abdeckung',
    sensorAlert: 'Melderstörung',
  },
  es: {
    powerSupplyAlert: 'pilas bajas',
    mainPowerSupplyAlert: 'fallo de alimentación',
    secondaryPowerSupplyAlert: 'fallo de alimentación de reserva',
    autoprotectionMechanicalAlert: 'autoprotección',
    autoprotectionWiredAlert: 'autoprotección cableada',
    radioAlert: 'fallo de enlace radio',
    outOfOrderAlert: 'fuera de servicio',
    mediaGSMAlert: 'fallo GSM',
    mediaRTCAlert: 'fallo de línea telefónica',
    mediaADSLAlert: 'fallo de Internet',
    defaultMediaAlert: 'fallo de transmisión',
    loopAlert: 'fallo de bucle',
    maskAlert: 'enmascaramiento',
    sensorAlert: 'fallo de detector',
  },
};

// Short words of the feature texts and of the widget.
export const WORDS = {
  en: { none: 'None', central: 'Control panel', group: 'Group' },
  fr: { none: 'Aucun', central: 'Centrale', group: 'Groupe' },
  de: { none: 'Keine', central: 'Zentrale', group: 'Gruppe' },
  es: { none: 'Ninguno', central: 'Central', group: 'Grupo' },
};

// Connection status shown on the Configuration screen.
export const CONNECTION_TEXT = {
  notConfigured: {
    en: 'Fill in the e-mail address, the password, the serial number of the box and the access code.',
    fr: "Renseignez l'adresse e-mail, le mot de passe, le numéro de série de la box et le code d'accès.",
    de: 'Gib die E-Mail-Adresse, das Passwort, die Seriennummer der Box und den Zugangscode ein.',
    es: 'Indique el correo electrónico, la contraseña, el número de serie de la caja y el código de acceso.',
  },
  authRefused: {
    en: 'Diagral refused the e-mail address or the password (those of the Diagral e-ONE app).',
    fr: "Diagral refuse l'adresse e-mail ou le mot de passe (ceux de l'application Diagral e-ONE).",
    de: 'Diagral lehnt die E-Mail-Adresse oder das Passwort ab (die der App Diagral e-ONE).',
    es: 'Diagral rechaza el correo electrónico o la contraseña (los de la aplicación Diagral e-ONE).',
  },
  accessRefused: {
    en: 'Diagral refused the serial number of the box or the access code: check them in the configuration.',
    fr: "Diagral refuse le numéro de série de la box ou le code d'accès : vérifiez-les dans la configuration.",
    de: 'Diagral lehnt die Seriennummer der Box oder den Zugangscode ab: Prüfe sie in der Konfiguration.',
    es: 'Diagral rechaza el número de serie de la caja o el código de acceso: revíselos en la configuración.',
  },
  unreachable: {
    en: 'The Diagral cloud does not answer: the integration keeps trying.',
    fr: "Le cloud Diagral ne répond pas : l'intégration réessaie.",
    de: 'Die Diagral-Cloud antwortet nicht: Die Integration versucht es weiter.',
    es: 'La nube Diagral no responde: la integración sigue intentándolo.',
  },
  rateLimited: {
    en: 'Diagral asks to slow down: reads are paused for a while.',
    fr: 'Diagral demande de ralentir : les lectures sont suspendues un moment.',
    de: 'Diagral bittet um weniger Anfragen: Die Abfragen pausieren eine Weile.',
    es: 'Diagral pide ir más despacio: las lecturas se pausan un tiempo.',
  },
};

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les journaux de l'intégration.",
  de: 'Die Initialisierung ist fehlgeschlagen, sieh in den Protokollen der Integration nach.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

// Messages of actions, widget buttons and scene actions.
export const MESSAGES = {
  controlOff: {
    en: 'Arming from Gladys is off in the configuration of the integration.',
    fr: "L'armement depuis Gladys est désactivé dans la configuration de l'intégration.",
    de: 'Das Einschalten über Gladys ist in der Konfiguration der Integration aus.',
    es: 'El armado desde Gladys está desactivado en la configuración de la integración.',
  },
  disarmOff: {
    en: 'Disarming from Gladys is not allowed in the configuration of the integration.',
    fr: "Le désarmement depuis Gladys n'est pas autorisé dans la configuration de l'intégration.",
    de: 'Das Ausschalten über Gladys ist in der Konfiguration der Integration nicht erlaubt.',
    es: 'El desarmado desde Gladys no está permitido en la configuración de la integración.',
  },
  noPartial: {
    en: 'This partial mode has no group in the configuration of your alarm.',
    fr: "Cette marche partielle n'a aucun groupe dans la configuration de votre alarme.",
    de: 'Dieser Teilmodus hat keine Gruppe in der Konfiguration deiner Alarmanlage.',
    es: 'Este modo parcial no tiene ningún grupo en la configuración de su alarma.',
  },
  badGroups: {
    en: 'Give the numbers of existing groups, separated by commas (e.g. 1,3).',
    fr: 'Indiquez des numéros de groupes existants, séparés par des virgules (ex. 1,3).',
    de: 'Gib Nummern vorhandener Gruppen an, durch Kommas getrennt (z. B. 1,3).',
    es: 'Indique números de grupos existentes, separados por comas (p. ej. 1,3).',
  },
  failed: {
    en: 'Diagral refused the command.',
    fr: 'Diagral a refusé la commande.',
    de: 'Diagral hat den Befehl abgelehnt.',
    es: 'Diagral ha rechazado la orden.',
  },
  unknownDevice: {
    en: 'Unknown device: choose the Diagral alarm again.',
    fr: "Appareil inconnu : choisissez de nouveau l'alarme Diagral.",
    de: 'Unbekanntes Gerät: Wähle die Diagral-Alarmanlage erneut.',
    es: 'Dispositivo desconocido: elija de nuevo la alarma Diagral.',
  },
  starting: {
    en: 'The integration is starting, try again in a moment.',
    fr: "L'intégration démarre, réessayez dans un instant.",
    de: 'Die Integration startet, versuche es gleich noch einmal.',
    es: 'La integración se está iniciando, inténtelo de nuevo en un momento.',
  },
  keyRenewed: {
    en: 'New API key created on the Diagral cloud; the previous one is deleted.',
    fr: "Nouvelle clé d'API créée sur le cloud Diagral ; l'ancienne est supprimée.",
    de: 'Neuer API-Schlüssel in der Diagral-Cloud erstellt; der alte ist gelöscht.',
    es: 'Nueva clave de API creada en la nube Diagral; la anterior se ha eliminado.',
  },
  ...CONNECTION_TEXT,
};

/** The message of a command that went through. */
export function commandDone(command) {
  return localized((lang) => `${pick(COMMAND_NAMES, lang)[command]} ✓`);
}

/** Report of a successful connection test. */
export function connectedReport({ name, state, groups, faults }) {
  const prefix = name ? `${name}, ` : '';
  const stateOf = (lang) => pick(STATE_NAMES, lang)[state] ?? '?';
  return {
    en: `Connected: ${prefix}${stateOf('en')}, ${groups} group(s), ${faults} fault(s). Add the alarm in the Discover tab.`,
    fr: `Connecté : ${prefix}${stateOf('fr')}, ${groups} groupe(s), ${faults} anomalie(s). Ajoutez l'alarme depuis l'onglet Découverte.`,
    de: `Verbunden: ${prefix}${stateOf('de')}, ${groups} Gruppe(n), ${faults} Störung(en). Füge die Alarmanlage im Tab Entdecken hinzu.`,
    es: `Conectado: ${prefix}${stateOf('es')}, ${groups} grupo(s), ${faults} anomalía(s). Añada la alarma en la pestaña Descubrir.`,
  };
}

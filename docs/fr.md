# Diagral e-ONE

## Présentation

Cette intégration relie votre alarme **Diagral e-ONE** à Gladys par le cloud Diagral, celui qu'utilise
l'application Diagral e-ONE de votre téléphone. Gladys voit :

- l'**état de l'alarme** : Arrêt, Temporisation de sortie, Marche totale, Marche partielle, Marche
  présence ;
- les **groupes en marche**, avec les noms donnés à l'installation ;
- les **anomalies** des détecteurs, claviers, télécommandes, sirènes et de la centrale : piles faibles,
  autoprotection (un boîtier ouvert ou arraché), défaut de liaison radio ou de transmission ;
- avec **Gladys Plus**, les **déclenchements d'alarme** en temps réel (intrusion, panique, incendie,
  alarme technique).

Gladys peut aussi **mettre l'alarme en marche ou l'arrêter** depuis un widget ou une scène, mais
seulement si vous l'autorisez : par défaut, Gladys se contente d'afficher l'état.

Développée sans le matériel : retours bienvenus sur
[github.com/guim31/gladys-diagral/issues](https://github.com/guim31/gladys-diagral/issues).
Cette intégration n'est pas affiliée à Diagral ni à Hager.

## Prérequis

- Une alarme Diagral e-ONE reliée à Internet par sa **box** : une box DIAG56AAX (plus vendue), ou la
  box intégrée à une centrale DIAG99AGX. Si l'application Diagral e-ONE pilote votre alarme à
  distance, c'est bon.
- Le **compte de l'application Diagral e-ONE** : adresse e-mail et mot de passe.
- Le **numéro de série de la box** : 14 caractères, sur l'étiquette à QR code **à l'intérieur** de la
  box. Il faut ouvrir son capot (voir la notice de la box).
- Le **code d'accès** que vous tapez dans l'application pour voir et commander l'alarme : le code
  maître ou le code d'un utilisateur.
- Gladys 5.1 ou plus récent. Pour les alarmes en temps réel : un abonnement **Gladys Plus**.

## Configuration

Dans Gladys, ouvrez **Intégrations**, installez **Diagral e-ONE** (« Installer depuis GitHub » si elle
n'est pas encore dans le catalogue), puis ouvrez son écran **Configuration**.

### Compte Diagral

- **Adresse e-mail** et **Mot de passe** : ceux de l'application Diagral e-ONE.
- **Numéro de série de la box** : les 14 caractères de l'étiquette. Majuscules, espaces et tirets
  n'ont pas d'importance.
- **Code d'accès de l'alarme** : Diagral le demande à chaque lecture de l'état, pas seulement pour
  les commandes.

À la première connexion, l'intégration crée une **clé d'API** sur le cloud Diagral, comme le fait
l'intégration Home Assistant. Ensuite, toutes les lectures se font avec cette clé : le mot de passe
ne repart chez Diagral que pour créer une nouvelle clé.

### Armement depuis Gladys

- **Désactivé (état seul)**, le réglage par défaut : Gladys affiche l'état de l'alarme sans jamais le
  changer.
- **Armer seulement** : le widget et les scènes peuvent mettre l'alarme en marche, jamais l'arrêter.
- **Armer et désarmer** : quiconque utilise vos tableaux de bord et vos scènes peut aussi arrêter
  l'alarme.

Dans tous les cas, l'alarme ne se pilote **jamais comme un interrupteur ni à la voix** : son état est
une fonctionnalité en lecture seule. Arrêter l'alarme depuis le widget demande une confirmation.

### Lecture de l'alarme

**Lecture de l'alarme** règle la fréquence de lecture de l'état et des anomalies : toutes les
minutes, 2 minutes, **5 minutes** (par défaut, comme Home Assistant) ou 10 minutes. Chaque lecture
fait deux requêtes au cloud Diagral (état et anomalies) ; la configuration de l'alarme (noms, groupes)
n'est relue que toutes les 6 heures. Diagral ne publie pas de quota : restez raisonnable. Si Diagral
demande de ralentir, les lectures s'arrêtent une minute, puis deux, et ainsi de suite jusqu'à deux
heures.

Pendant une temporisation de sortie, l'alarme est relue toutes les 30 secondes jusqu'à la mise en
marche.

### Langue

**Langue des noms et des textes** : la langue des noms de fonctionnalités et des textes d'anomalies
(français par défaut). Gladys garde les noms choisis à l'ajout de l'appareil.

### Webhook Gladys Plus (temps réel)

Le cloud Diagral sait prévenir d'un événement par un **webhook** : déclenchement d'alarme, mise en
marche ou arrêt, nouvelle anomalie. Gladys étant chez vous, ce webhook passe par **Gladys Plus**.

1. Dans Gladys Plus, créez une clé Open API (Réglages → Open API).
2. Collez-la dans le bloc « Webhooks Gladys Plus » de l'écran Configuration de l'intégration : il
   annonce « Événements Diagral (alarmes, mises en marche, anomalies) ».
3. L'intégration inscrit d'elle-même l'adresse chez Diagral.

Diagral ne garde **qu'un webhook par box** : si un autre outil (Home Assistant…) en avait inscrit un,
il est remplacé. Retirez la clé et l'intégration supprime le sien chez Diagral.

Sans Gladys Plus, tout fonctionne par lectures, sauf les **déclenchements d'alarme**, que le cloud
Diagral ne signale que par le webhook.

### Actions

- **Tester la connexion** : lit l'état et les anomalies de l'alarme et les résume. Rien n'est mis en
  marche ni arrêté.
- **Renouveler la clé d'API** : crée une nouvelle clé d'API sur le cloud Diagral et supprime
  l'ancienne. Utile si vous pensez qu'elle a fui, ou si Diagral la refuse.

## L'appareil

Après la connexion, l'onglet **Découverte** propose un appareil **Alarme Diagral** (suivi du nom de
votre alarme). Ses fonctionnalités, toutes en lecture seule :

- **État de l'alarme** : Arrêt, Temporisation de sortie, Marche totale, Marche partielle, Marche
  présence. La marche totale met en marche tous les groupes ; une marche avec une partie des groupes
  est une marche partielle.
- **Alarme en cours** : 1 dès que Diagral signale un déclenchement, jusqu'à l'arrêt de l'alarme.
  Seulement avec le webhook Gladys Plus : sans lui, cette fonctionnalité reste sans valeur, car rien
  ne permet de le savoir.
- **Groupes en marche** : les noms des groupes en marche, ou « Aucun ».
- **Anomalies** : les anomalies en cours, par exemple « (2) Porte garage : piles faibles, Centrale :
  autoprotection ».
- **Nombre d'anomalies** : le même compte, pour les scènes.
- **Piles faibles** : 1 si un appareil de l'alarme signale des piles faibles ou un défaut
  d'alimentation.
- **Autoprotection** : 1 si un appareil signale une autoprotection (boîtier ouvert ou arraché).
- **Défaut de liaison** : 1 si un appareil signale un défaut de liaison radio ou de transmission
  (GSM, ligne téléphonique, Internet).
- **Cloud Diagral** : 0 quand le cloud Diagral ne répond plus.

## Le widget

Le widget **Alarme Diagral** montre l'état de l'alarme (en rouge « ALARME EN COURS » lors d'un
déclenchement), les groupes en marche et les anomalies. Selon **Armement depuis Gladys**, il propose
jusqu'à quatre boutons : **Marche totale**, **Partielle 1** (ou **Partielle 2** si votre alarme n'a
pas de marche partielle 1), **Marche présence** et **Arrêt**, qui demande une confirmation. Le mode en
cours est marqué d'une coche.

## Déclencheurs de scène

- **Alarme Diagral déclenchée** : l'alarme s'est déclenchée. Filtre : le type d'alarme (Intrusion,
  Panique, Incendie, Technique (eau, température…), Autre). Variables : le type d'alarme, le
  détecteur, le groupe et le code Diagral. Nécessite le webhook Gladys Plus. Une alarme reçue avec
  plus de 15 minutes de retard ne déclenche rien.
- **Diagral mise en marche ou arrêtée** : l'alarme a changé de mode, depuis un clavier, une
  télécommande, l'application ou Gladys. Filtre : le nouveau mode (Arrêt, Marche totale, Marche
  partielle, Marche présence). Variables : le nouveau mode et « Changé par » (le nom de l'utilisateur
  quand Diagral le donne par le webhook, « Gladys » pour une commande de Gladys). La fin d'une
  temporisation de sortie est la mise en marche.
- **Anomalie Diagral signalée** : une nouvelle anomalie est apparue. Filtre : le type d'anomalie
  (Piles ou alimentation, Autoprotection, Liaison radio ou transmission, Autre). Variables : le type
  d'anomalie, l'appareil et l'anomalie en clair.

Les anomalies déjà présentes au démarrage de l'intégration ne déclenchent rien.

## Action de scène

**Mettre en marche ou arrêter Diagral**, dans la limite de « Armement depuis Gladys » :

- **Commande** : Arrêt, Marche totale, Marche présence, Partielle 1, Partielle 2 ou Groupes choisis ;
- **Groupes** : pour « Groupes choisis » seulement, les numéros des groupes séparés par des virgules,
  par exemple `1,3`.

Résultat : « État après la commande », le plus souvent une temporisation de sortie juste après une
mise en marche.

## Exemples de scènes

- **Intrusion** : déclencheur « Alarme Diagral déclenchée », type Intrusion → allumer toutes les
  lumières, envoyer un message « Intrusion détectée par {{triggerEvent.data.device}} » et la photo de
  la caméra de l'entrée.
- **Départ de la maison** : quand le dernier membre de la famille quitte la maison → action « Mettre
  en marche ou arrêter Diagral », commande Marche totale (il faut « Armer seulement » au moins).
- **Piles à changer** : déclencheur « Anomalie Diagral signalée », type Piles ou alimentation →
  message « Piles à changer : {{triggerEvent.data.fault}} ».
- **Nuit** : déclencheur « Diagral mise en marche ou arrêtée », mode Marche présence → baisser le
  chauffage et éteindre la télévision.

## Dépannage

- **« Diagral refuse l'adresse e-mail ou le mot de passe »** : vérifiez-les dans l'application Diagral
  e-ONE. L'intégration ne réessaie plus jusqu'à la prochaine modification de la configuration, pour ne
  pas bloquer votre compte.
- **« Diagral refuse le numéro de série de la box ou le code d'accès »** : vérifiez les 14 caractères
  de l'étiquette et le code. Un scan dans l'onglet Découverte réessaie.
- **« Le cloud Diagral ne répond pas »** : l'intégration réessaie toute seule et l'écrit une seule fois
  dans les journaux. L'application Diagral e-ONE fonctionne-t-elle ?
- **Rien en temps réel** : vérifiez la clé Open API dans le bloc « Webhooks Gladys Plus ». Un autre
  outil a pu reprendre le webhook de votre box : Diagral n'en garde qu'un.
- **Plus de détails** : passez la variable `LOG_LEVEL=debug`. Les journaux ne contiennent jamais le mot
  de passe, le code, la clé d'API ni l'adresse du webhook.

## Limites

- Développée **sans le matériel ni un compte Diagral** : la connexion au vrai cloud n'a pas pu être
  essayée. Les réponses de l'API viennent de la bibliothèque pydiagral et de l'intégration Home
  Assistant de Marc Guyard. Vos retours sont précieux.
- Le cloud Diagral n'expose pas d'historique des événements : les déclenchements d'alarme n'arrivent
  que par le webhook (Gladys Plus), les mises en marche et les anomalies aussi par les lectures.
- L'auteur d'une mise en marche ou d'un arrêt (« Changé par ») n'est connu qu'avec le webhook.
- Un seul webhook par box chez Diagral : Gladys et un autre outil ne peuvent pas l'utiliser en même
  temps.
- Les détecteurs ne sont pas des appareils séparés : l'API ne donne pas leur état (porte ouverte,
  mouvement), seulement leurs anomalies.
- Une alarme de sécurité reste votre responsabilité : ne comptez pas sur Gladys seul pour être
  prévenu d'une intrusion.

## Données et sécurité

- Le mot de passe et le code d'accès restent dans la configuration de Gladys. La clé d'API et son
  secret sont dans `/data/diagral-state.json`, lisible par le seul conteneur. L'adresse du webhook
  n'est pas gardée (seulement son empreinte), car elle contient votre clé Open API.
- L'intégration ne parle qu'au cloud Diagral (`appv3.tt-monitor.com`) et à Gladys.
- Un événement du webhook n'est accepté que s'il vient du transmetteur de votre box ; mises en marche
  et anomalies sont toujours relues sur l'API avant d'être montrées.

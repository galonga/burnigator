(function () {
  const words = {
    pinboardTab: 'Pinnwand|Pinboard',
    pinboardTitle: 'Pinnwand|Pinboard',
    pinboardIntro:
      'Teile Hinweise mit anderen Festivalgästen. Zum Schreiben brauchst du eine bezahlte Bestellung für dieses Event.|Share helpful notes with other festival visitors. A paid order for this event is required to post.',
    pinboardUnlockInfo:
      'Zum Schreiben auf der Pinnwand brauchst du deine Pretix-Bestellnummer. Du findest sie in der Bestätigungs-E-Mail deiner Bestellung. Lesen kannst du die Beiträge auch ohne Anmeldung.|You need your Pretix order number to post on the pinboard. You can find it in the confirmation email of your order. You can read the posts without signing in.',
    orderCodeLabel: 'Pretix-Bestellnummer|Pretix order number',
    eventSignIn: 'Freischalten|Unlock posting',
    eventSignOut: 'Abmelden|Sign out',
    eventSignedIn: 'Angemeldet als|Signed in as',
    eventAuthFailed: 'Bestellnummer konnte nicht bestätigt werden.|Could not verify that order number.',
    eventFeatureUnavailable:
      'Die Pinnwand ist derzeit nicht verfügbar.|The pinboard is currently unavailable.',
    pinboardEmpty: 'Noch keine Beiträge.|No posts yet.',
    pinboardMessage: 'Dein Hinweis',
    pinboardPost: 'Veröffentlichen|Post',
    pinboardEdit: 'Bearbeiten|Edit',
    pinboardDelete: 'Löschen|Delete',
    pinboardSave: 'Speichern|Save',
    pinboardCancel: 'Abbrechen|Cancel',
    pinboardPosted: 'Beitrag veröffentlicht.|Post published.',
    pinboardModeration: 'Pinnwand moderieren|Moderate pinboard',
    pinboardHidden: 'Ausgeblendet|Hidden',
    pinboardHide: 'Ausblenden|Hide',
    pinboardShow: 'Einblenden|Show',
    pinboardModerationUnavailable: 'Beiträge konnten nicht geladen werden.|Could not load posts.',
    eventAuthTitle: 'Event-Authentifizierung|Event authentication',
    eventAuthIntro:
      'Mit der Event-Authentifizierung melden sich Gäste mit ihrer Pretix-Bestellnummer an. Nur wer eine bezahlte Bestellung für dieses Event hat, kann auf der Pinnwand schreiben, und Event-Owner können damit ihr Event bearbeiten.|Event authentication lets guests sign in with their Pretix order number. Only guests with a paid order for this event can post on the pinboard, and event owners use it to edit their event.',
    pretixHeading: 'Pretix-Anbindung|Pretix connection',
    pretixExplain:
      'Pretix ist ein Ticketsystem. Burnigator fragt über die Pretix-API die Bestellnummern und deren Status ab (nur lesend) und erlaubt nur bezahlten Bestellungen den Zugang. Namen, E-Mail-Adressen und Zahlungsdaten werden nicht abgerufen oder gespeichert. Den Abgleich startest du mit „Jetzt synchronisieren“.|Pretix is a ticketing system. Burnigator reads order numbers and their status through the Pretix API (read-only) and only lets paid orders in. Names, email addresses and payment details are not retrieved or stored. Start the comparison with “Sync now”.',
    csvHeading: 'CSV-Import statt Pretix|CSV import instead of Pretix',
    csvExplain:
      'Ohne Pretix-Anbindung kannst du die Bestellungen als CSV-Datei hochladen, zum Beispiel aus einem anderen Ticketsystem.|Without a Pretix connection you can upload the orders as a CSV file, for example from another ticketing system.',
    databaseRequiredNotice:
      'Dafür ist eine Datenbankverbindung erforderlich.|This requires a database connection.',
    databaseSetupLink: 'Datenbankverbindung einrichten|Set up database connection',
    pinboardDatabaseRequired:
      'Für die Pinnwand ist eine Datenbankverbindung erforderlich. Beiträge und Anmeldungen werden dort gespeichert.|The pinboard needs a database connection. Posts and sign-ins are stored there.',
    databaseTitle: 'Datenbankverbindung|Database connection',
    databaseIntro:
      'Die Pinnwand und die Event-Authentifizierung speichern Bestellungen, Anmeldungen und Beiträge in einer MariaDB-/MySQL-Datenbank. Ohne Datenbankverbindung sind beide Funktionen nicht nutzbar. Die Karte und das Programm funktionieren auch ohne Datenbank.|The pinboard and event authentication store orders, sign-ins and posts in a MariaDB/MySQL database. Without a database connection neither works. The map and the programme work without a database.',
    databaseStateNone: 'Keine Datenbank verbunden.|No database connected.',
    databaseStateReady: 'Verbunden mit {name} auf {host}.|Connected to {name} on {host}.',
    databaseStateConnected: 'Datenbank verbunden.|Database connected.',
    databaseStateFailed:
      'Die gespeicherte Datenbank ist nicht erreichbar. Prüfe die Zugangsdaten.|The saved database cannot be reached. Check the credentials.',
    databaseManagedByEnvironment:
      'Die Zugangsdaten werden über Servervariablen (BURNIGATOR_DB_*) gesetzt und können hier nicht geändert werden.|The credentials are set through server variables (BURNIGATOR_DB_*) and cannot be changed here.',
    databasePasswordHint:
      'Ein leeres Passwortfeld behält das gespeicherte Passwort bei. Die Verbindung wird vor dem Speichern getestet und die benötigten Tabellen werden angelegt.|Leave the password empty to keep the saved password. The connection is tested before saving and the required tables are created.',
    databaseChangeHint:
      'Wenn du eine andere Datenbank einträgst, bleiben bisherige Bestellungen und Beiträge in der alten Datenbank. Gäste müssen sich danach neu anmelden und die Bestellungen müssen neu synchronisiert werden.|If you enter a different database, existing orders and posts stay in the old one. Guests have to sign in again and orders need to be synchronised again.',
    databaseSave: 'Verbindung testen und speichern|Test and save connection',
    databaseRemove: 'Verbindung entfernen|Remove connection',
    databaseRemoveConfirm:
      'Datenbankverbindung entfernen? Pinnwand und Event-Authentifizierung sind dann nicht mehr nutzbar. Die Daten in der Datenbank werden nicht gelöscht.|Remove the database connection? The pinboard and event authentication will stop working. Data in the database is not deleted.',
    databaseSaved: 'Datenbankverbindung gespeichert.|Database connection saved.',
    databaseRemoved: 'Datenbankverbindung entfernt.|Database connection removed.',
    databaseConfigNotWritable:
      'config.php ist nicht beschreibbar. Prüfe die Dateirechte auf dem Server.|config.php is not writable. Check the file permissions on the server.',
    eventAuthPrivacy:
      'Bestellnummern werden nur beim Abgleich verwendet und als HMAC-Hash gespeichert.|Order numbers are only used for verification and stored as HMAC hashes.',
    pretixBaseUrl: 'Pretix-Basisadresse|Pretix base URL',
    pretixOrganizer: 'Organizer-Kennung|Organizer slug',
    pretixEvent: 'Event-Kennung|Event slug',
    pretixToken: 'Pretix API-Token|Pretix API token',
    pretixTokenHint:
      'Der Token bleibt auf dem Server. Ein leeres Feld behält den gespeicherten Token bei.|The token stays on the server. Leave this field empty to keep the saved token.',
    pretixTokenHelp:
      'Du findest den Token in Pretix bei deinem Organizer-Team: Team öffnen und unterhalb der Teammitglieder einen API-Token mit Leserechten für Bestellungen anlegen. Den Token zeigt Pretix nur einmal an.|In pretix, open your organizer team and create an API token below the team members with permission to view orders. pretix shows the token only once.',
    pretixTokenDocs: 'Pretix-Anleitung öffnen|Open pretix instructions',
    csvFormatHelp:
      'UTF-8-CSV mit Kopfzeile und exakt zwei Spalten: Order code und Status. Eine Zeile je Bestellung.|UTF-8 CSV with a header row and exactly two columns: Order code and Status. One row per order.',
    csvFormatValues:
      'paid erlaubt das Schreiben, canceled und expired sperren. Erstattete Bestellungen dürfen nicht als paid importiert werden.|paid allows posting; canceled and expired block access. Refunded orders must not be imported as paid.',
    setupPinboardEnable: 'Pinnwand aktivieren|Enable the pinboard',
    pinboardEnabledToggle: 'Pinnwand für Besucher aktivieren|Enable the pinboard for visitors',
    pinboardEnabledHint:
      'Die Aktivierung blendet den Pinnwand-Tab ein. Zum Speichern von Beiträgen wird eine eingerichtete Datenbank benötigt.|Enabling shows the pinboard tab. A configured database is required to save posts.',
    setupDatabaseOptional: 'MariaDB-Datenbank verbinden (optional)|Connect a MariaDB database (optional)',
    setupDatabaseHint:
      'Für Pinnwand und Event-Authentifizierung. Ohne Angaben kannst du die Zugangsdaten später serverseitig einrichten.|Used for the pinboard and event authentication. You can configure database access on the server later if you skip this.',
    setupDatabaseHost: 'Datenbank-Host|Database host',
    setupDatabaseName: 'Datenbankname|Database name',
    setupDatabaseUser: 'Datenbank-Benutzer|Database user',
    setupDatabasePassword: 'Datenbank-Passwort|Database password',
    setupDatabaseIncomplete:
      'Bitte alle Datenbankfelder vollständig und mit gültigem Host- und Datenbanknamen ausfüllen.|Complete all database fields and use a valid host and database name.',
    setupDatabaseUnavailable:
      'Die PHP-Erweiterung pdo_mysql ist nicht verfügbar.|The PHP pdo_mysql extension is unavailable.',
    setupDatabaseConnection:
      'Die Datenbankverbindung konnte nicht hergestellt werden. Bitte Zugangsdaten und Datenbank prüfen.|Could not connect to the database. Check the credentials and database.',
    configTabsLabel: 'Konfigurationsbereiche|Configuration sections',
    configTabGeneral: 'Allgemein|General',
    configTabEvent: 'Event|Event',
    configTabUsers: 'Nutzerverwaltung|User management',
    configTabSecurity: 'Sicherheit & Verlauf|Security & history',
    resetAppTitle: 'Anwendung zurücksetzen|Reset application',
    resetAppDescription:
      'Setzt Burnigator vollständig auf den Einrichtungszustand zurück. Eventdaten, Bilder, Konten, Pinnwand und Anmeldedaten werden gelöscht.|Returns Burnigator to its initial setup state. Event data, images, accounts, pinboard posts, and login credentials will be deleted.',
    resetAppWarning:
      'Diese Aktion kann nicht rückgängig gemacht werden. Erstelle vorher eine Sicherung.|This cannot be undone. Create a backup first.',
    resetAppPhraseLabel:
      'Zur Bestätigung genau eingeben: RESET BURNIGATOR|Type exactly to confirm: RESET BURNIGATOR',
    resetAppButton: 'Anwendung endgültig zurücksetzen|Permanently reset application',
    resetAppDialog:
      'Die Anwendung und alle Eventdaten werden endgültig gelöscht und zur Ersteinrichtung zurückgesetzt. Fortfahren?|This permanently deletes the application data and returns it to setup. Continue?',
    resetAppPhraseMismatch: 'Bitte gib exakt RESET BURNIGATOR ein.|Type exactly RESET BURNIGATOR.',
    resetAppDone: 'Zurückgesetzt. Die Einrichtung wird geöffnet.|Reset complete. Opening setup.',
    resetAppFailed:
      'Zurücksetzen fehlgeschlagen. Prüfe Passwort und Schreibrechte.|Reset failed. Check your password and file permissions.',
    eventAuthSyncGuard:
      'Achtung: Dieser Abgleich würde die Berechtigung von {before} auf {after} Bestellungen senken. Prüfe Datei bzw. Pretix-Einstellungen. Trotzdem übernehmen?|Warning: this import would reduce eligible orders from {before} to {after}. Check the file or Pretix settings. Apply anyway?',
    resetAppPartial:
      'Zurücksetzen nur teilweise abgeschlossen: Die Datenbank wurde geleert, Dateien aber nicht. Prüfe die Schreibrechte und wiederhole das Zurücksetzen.|Reset only partly completed: the database was cleared but files were not. Check file permissions and run the reset again.',
    eventAuthHttpWarning:
      'Diese Seite wird ohne HTTPS ausgeliefert. Teilnehmer-Logins, Sitzungs-Cookies und der Pretix-Token werden dann unverschlüsselt übertragen. Bitte HTTPS aktivieren, sobald die Pinnwand live genutzt wird.|This site is served without HTTPS. Attendee logins, session cookies and the Pretix token are sent unencrypted. Enable HTTPS before using the pinboard live.',
    syncPretix: 'Jetzt synchronisieren|Sync now',
    csvFallback: 'CSV-Import (Fallback)|CSV import (fallback)',
    importCsv: 'CSV importieren|Import CSV',
    eventAuthSetupHelp:
      'Die Datenbank oder das Event-Auth-Secret ist nicht eingerichtet. Trage unter „Datenbankverbindung“ die Zugangsdaten ein.|The database or the event-auth secret is not set up. Enter the credentials under “Database connection”.',
    eventAuthSaved: 'Authentifizierungseinstellungen gespeichert.|Authentication settings saved.',
    eventAuthSyncDone: 'Synchronisierung abgeschlossen.|Synchronization complete.',
    eventAuthImportDone: 'CSV-Import abgeschlossen.|CSV import complete.',
    eventAuthCounts:
      '{total} Bestellungen · {eligible} schreibberechtigt · {ineligible} gesperrt|{total} orders · {eligible} allowed to post · {ineligible} blocked',
    lastSync: 'Letzter Abgleich|Last sync',
    eventAuthActionFailed:
      'Aktion fehlgeschlagen. Bitte Einstellungen und Serververbindung prüfen.|Action failed. Check the settings and server connection.',
    eventAuthOrderOverviewTitle: 'Gespeicherte Buchungsdaten|Stored order data',
    eventAuthOrderOverviewHint:
      'Gruppiert nach Status, Quelle und Postingberechtigung. Bestellnummern werden nicht angezeigt.|Grouped by status, source, and posting access. Order numbers are not shown.',
    eventAuthOrderOverviewEmpty:
      'Noch keine Buchungsdaten importiert oder synchronisiert.|No order data has been imported or synchronized yet.',
    eventAuthOrderStatus: 'Pretix-Status|Pretix status',
    eventAuthOrderSource: 'Quelle|Source',
    eventAuthOrderAccess: 'Postingzugriff|Posting access',
    eventAuthOrderCount: 'Anzahl|Count',
    eventAuthOrderAllowed: 'Erlaubt|Allowed',
    eventAuthOrderBlocked: 'Gesperrt|Blocked',
    eventAuthSourcePretix: 'Pretix API|Pretix API',
    eventAuthSourceCsv: 'CSV-Import|CSV import',
    pinboardDeleteConfirm: 'Diesen Beitrag löschen?|Delete this post?',
    adminViews: 'Admin-Ansichten|Admin views',
    adminEditView: 'Programm & Orte|Programme & places',
    adminConfigView: 'Konfiguration|Configuration',
    adminPinboardView: 'Pinnwand moderieren|Moderate pinboard',
    AdminEditView: 'Orte und Programm|Places and program',
    AdminConfigView: 'Konfiguration|Configuration',
    generalSettings: 'Allgemeine Einstellungen|General settings',
    publicationSettings: 'Veröffentlichung|Publication',
    publicationHint:
      'Unveröffentlichte Festivals sind nur für angemeldete Teammitglieder sichtbar. Nur der Owner kann die Sichtbarkeit ändern.|Unpublished festivals are visible only to signed-in team members. Only the owner can change visibility.',
    sitePublished: 'Die Festivalansicht ist öffentlich.|The festival view is public.',
    siteUnpublished:
      'Die Festivalansicht ist nur für angemeldete Teammitglieder sichtbar.|The festival view is visible only to signed-in team members.',
    publishSite: 'Festival veröffentlichen|Publish festival',
    unpublishSite: 'Veröffentlichung aufheben|Unpublish festival',
    confirmUnpublish:
      'Festivalansicht für Besucher wirklich ausblenden?|Hide the festival view from visitors?',
    publicationSaved: 'Sichtbarkeit wurde aktualisiert.|Visibility updated.',
    publicationFailed: 'Sichtbarkeit konnte nicht geändert werden.|Could not change visibility.',
    previewOnly:
      'Vorschau: Diese Festivalansicht ist noch nicht veröffentlicht.|Preview: this festival view has not been published yet.',
    festivalUnpublished:
      'Dieses Festival ist noch nicht veröffentlicht.|This festival has not been published yet.',
    history_publication_change: 'Veröffentlichungsstatus geändert|Publication status changed',
    soundcloudSettings: 'SoundCloud-Player|SoundCloud player',
    showSoundcloudPlayer:
      'SoundCloud-Player in der Besucheransicht anzeigen|Show the SoundCloud player in the visitor view',
    soundcloudPlaylistUrl: 'SoundCloud-Playlist-URL|SoundCloud playlist URL',
    soundcloudPlaylistHint:
      'Es kann eine öffentliche SoundCloud-Playlist mit /sets/ im Link verwendet werden.|Use a public SoundCloud playlist whose URL contains /sets/.',
    saveSoundcloud: 'SoundCloud-Einstellungen speichern|Save SoundCloud settings',
    soundcloudPlaylistInvalid:
      'Bitte eine gültige öffentliche SoundCloud-Playlist mit /sets/ im Link eingeben.|Enter a valid public SoundCloud playlist URL containing /sets/.',
    saveAppearance: 'Erscheinungsbild speichern|Save appearance',
    saveCategories: 'Kategorien speichern|Save categories',
    saveTracking: 'Tracking-Einstellungen speichern|Save tracking settings',
    accountUsername: 'Benutzername|Username',
    repeatNewPassword: 'Neues Passwort wiederholen|Repeat new password',
    changeOwnerPassword: 'Owner-Passwort ändern|Change owner password',
    currentPassword: 'Aktuelles Passwort|Current password',
    newOwnerPassword: 'Neues Passwort (mindestens 12 Zeichen)|New password (at least 12 characters)',
    saveOwnerPassword: 'Passwort ändern|Change password',
    currentPasswordInvalid: 'Das aktuelle Passwort ist nicht korrekt.|The current password is incorrect.',
    ownerPasswordSaved: 'Owner-Passwort wurde geändert.|Owner password changed.',
    ownerPasswordFailed: 'Owner-Passwort konnte nicht gespeichert werden.|Could not save the owner password.',
    history_owner_password_save: 'Owner-Passwort geändert|Owner password changed',
    appearanceSettings: 'Erscheinungsbild|Appearance',
    appearanceSettingsHint:
      'Passe Farben, Logo und Kartendarstellung an.|Adjust colors, logo, and map appearance.',
    themeColors: 'Hauptfarben der App|App main colors',
    themeColorsHint:
      'Diese Farben werden in der Besucheransicht und im Adminbereich verwendet.|These colors are used across the visitor view and admin panel.',
    themePrimary: 'Hauptfarbe|Primary color',
    themeAccent: 'Akzentfarbe|Accent color',
    themeAlert: 'Warnfarbe|Alert color',
    themeBackground: 'Hintergrundfarbe|Background color',
    themeReset: 'Standardfarben wiederherstellen|Restore default colors',
    matomoSettings: 'Matomo-Tracking|Matomo tracking',
    matomoSettingsHint:
      'Gib die Basisadresse deiner Matomo-Installation und die Website-ID ein. Eine leere Adresse deaktiviert das Tracking.|Enter your Matomo installation base URL and site ID. Leave the URL empty to disable tracking.',
    matomoUrl: 'Matomo-URL|Matomo URL',
    matomoSiteId: 'Seiten-ID|Site ID',
    matomoInvalidUrl:
      'Bitte eine gültige Matomo-Basisadresse mit HTTP oder HTTPS eingeben.|Enter a valid Matomo base URL using HTTP or HTTPS.',
    matomoInvalidSiteId:
      'Die Matomo-Seiten-ID muss eine positive ganze Zahl sein.|The Matomo site ID must be a positive whole number.',
    enableBrowserTranslation:
      'Browserübersetzung für WWW-Beschreibungen anbieten|Offer browser translation for WWW descriptions',
    browserTranslationHint:
      'Nutzt die experimentelle Übersetzungsfunktion des Browsers. Sie erscheint nur in Browsern, die sie unterstützen.|Uses the browser’s experimental translation feature. It appears only in browsers that support it.',
    enableLiveTimetable:
      '„Jetzt und gleich“-Leiste und Überschneidungs-Hinweise anzeigen|Show the “now and next” strip and clash warnings',
    liveTimetableHint:
      'Zeigt Besuchern im Programm, was gerade läuft und was als Nächstes beginnt, und markiert überlappende Favoriten.|Shows visitors what is on now and what starts next, and marks overlapping favourites.',
    translateDescription: 'Übersetzen|Translate',
    translationLoading: 'Übersetzung wird geladen…|Translating…',
    translationShowOriginal: 'Original anzeigen|Show original',
    translationUnavailable:
      'Übersetzung wird von diesem Browser nicht unterstützt.|Translation is not supported by this browser.',
    translationSameLanguage:
      'Der Text ist bereits in der aktuellen Sprache.|This text is already in the current language.',
    mapLoadFailed:
      'Die Karte konnte nicht geladen werden. Bitte Verbindung prüfen und erneut versuchen.|The map could not be loaded. Check your connection and try again.',
    adminDataLoadFailed:
      'Karten- und POI-Daten konnten nicht geladen werden. Bitte Seite neu laden und erneut anmelden.|Map and POI data could not be loaded. Reload the page and sign in again.',
    adminPreviewDenied:
      'Die Vorschau ist nicht verfügbar. Bitte Seite neu laden und erneut anmelden.|The preview is unavailable. Reload the page and sign in again.',
    adminInitializationFailed:
      'Der Admin-Editor konnte nicht vollständig geladen werden. Bitte Seite neu laden.|The admin editor could not be fully loaded. Reload the page.',
    retry: 'Erneut versuchen|Try again',
    filterEventCategories: 'Event-Kategorien filtern|Filter event categories',
    timetableFilters: 'Filter|Filters',
    timetableDayHeading: 'Tag auswählen|Select a day',
    eventCategoryFilterHint: 'Keine Auswahl zeigt alle Kategorien.|No selection shows all categories.',
    noEventsForFilters: 'Keine Veranstaltungen passen zu diesen Filtern.|No events match these filters.',
    map: 'Event|Event',
    mapTab: 'Karte|Map',
    timetable: 'WWW (Verpassungsschutz)|WWW (Verpassungsschutz)',
    timetableTab: 'WWW|WWW',
    exportMapJpg: 'JPG: Karte + POI-Index|JPG: map + POI index',
    exportDayJpg: 'Diesen Tag als JPG exportieren|Export this day as JPG',
    jpgExportFailed: 'Das JPG konnte nicht erstellt werden.|Could not create the JPG image.',
    poiIndex: 'POI-Index|POI index',
    mapPdfNoImage:
      'Für den Kartenexport zuerst eine Veranstaltungskarte hochladen.|Upload an event map before exporting the map.',
    mapPdfImageFailed:
      'Die Veranstaltungskarte konnte nicht geladen werden.|The event map could not be loaded.',
    eventCategories: 'Event-Kategorien auswählen|Select event categories',
    independentTimelines: 'Zusätzliche Timelines|Additional timelines',
    timetableRowHeading: 'Orte / Zeit|Places / Time',
    independentTimelinesHint:
      'Bis zu drei Timelines ohne Ortsbindung verwalten.|Manage up to three timelines that are not tied to a location.',
    addIndependentTimeline: 'Timeline hinzufügen|Add timeline',
    independentTimeline: 'Timeline|Timeline',
    timelineName: 'Name der Timeline|Timeline name',
    deleteTimeline: 'Timeline löschen|Delete timeline',
    confirmDeleteTimeline:
      'Diese Timeline und alle ihre Einträge löschen?|Delete this timeline and all of its events?',
    saveIndependentTimelines: 'Timelines speichern|Save timelines',
    timelinesSaved: 'Timelines gespeichert.|Timelines saved.',
    timelineLimit:
      'Es sind höchstens drei zusätzliche Timelines möglich.|You can have up to three additional timelines.',
    timelineNameRequired: 'Bitte jeder Timeline einen Namen geben.|Please give every timeline a name.',
    timelineEventTitleRequired:
      'Bitte jedem Programmpunkt einen Titel geben.|Please give every event a title.',
    history_timelines_save: 'Zusätzliche Timelines gespeichert|Additional timelines saved',
    eventCategoryPerformance: 'Performance|Performance',
    eventCategoryMusic: 'DJ/Live/Musik|DJ/Live/Music',
    eventCategoryKink: 'Sex-positiv / Kink (18+)|Sex-Positive / Kink (18+)',
    eventCategoryAdultMind:
      'Consent / Selbstentwicklung / Psychologie (18+)|Consent / Self-development / Psychology (18+)',
    eventCategoryKidsMind:
      'Consent / Selbstentwicklung / Psychologie (kindergeeignet)|Consent / Self-development / Psychology (kids appropriate)',
    eventCategoryMovement: 'Körper / Bewegung|Physical / Movement',
    eventCategoryQuiet: 'Ruhig|Quiet',
    eventCategoryLoud: 'Laut|Loud',
    eventCategoryCrafting: 'Basteln|Crafting',
    programHeading: 'Veranstaltungsprogramm|Event program',
    hasProgram: 'Hat Programm|Has program',
    addEvent: 'Eintrag hinzufügen|Add event',
    programLink: 'Zum WWW/Programm|View WWW/program',
    eventLinkUrl: 'Link-URL (https://…)|Link URL (https://…)',
    eventLinkText: 'Link-Beschreibung|Link description',
    programEmpty:
      'Für dieses Festival sind noch keine Programmpunkte eingetragen.|No program entries have been added yet.',
    favoriteFilter: 'Nur Favoriten|Favorites only',
    addFavorite: 'Zu Favoriten hinzufügen|Add to favorites',
    removeFavorite: 'Aus Favoriten entfernen|Remove from favorites',
    noFavoriteEvents: 'Für diesen Tag sind keine Favoriten vorhanden.|No favorite events for this day.',
    noProgramPois: 'Noch keine Orte im WWW.|No places are on WWW yet.',
    eventOwnerCode: 'Event-Owner (Bestellcode, optional)|Event owner (order code, optional)',
    eventOwnerCodePlaceholder: 'Bestellcode eintragen|Enter order code',
    eventOwnerCodeSet: '•••••• Owner zugewiesen|•••••• Owner assigned',
    eventOwnerRemove: 'Owner entfernen|Remove owner',
    eventOwnerHint:
      'Wer mit diesem Bestellcode angemeldet ist (Pinnwand-Tab), kann Zeit, Beschreibung und Kategorien dieses Events selbst ändern. Der Code wird nur als Hash gespeichert und nicht angezeigt.|Whoever is signed in with this order code (pinboard tab) can change the time, description and categories of this event. The code is stored only as a hash and is never shown.',
    eventOwnerCodeInvalid:
      'Der Bestellcode ist ungültig. Erlaubt sind Buchstaben, Ziffern und Bindestriche.|The order code is invalid. Letters, digits and hyphens are allowed.',
    eventOwnerUnavailable:
      'Event-Owner können erst gesetzt werden, wenn die Event-Authentifizierung eingerichtet ist.|Event owners can only be set once event authentication is set up.',
    editEvent: 'Event bearbeiten|Edit event',
    eventEditSaved: 'Event gespeichert.|Event saved.',
    eventEditFailed: 'Das Event konnte nicht gespeichert werden.|The event could not be saved.',
    eventEditForbidden:
      'Du bist nicht berechtigt, dieses Event zu bearbeiten.|You are not allowed to edit this event.',
    eventEditTimeInvalid:
      'Die Endzeit darf nicht gleich der Startzeit sein.|The end time must differ from the start time.',
    history_event_owner_save: 'Event vom Event-Owner geändert|Event changed by its event owner',
    eventStart: 'Startzeit|Start time',
    eventOvernight: 'Endet am nächsten Tag|Ends the next day',
    eventEnd: 'Endzeit|End time',
    eventTitle: 'Veranstaltung|Event',
    eventDescription: 'Beschreibung (optional)|Description (optional)',
    eventHost: 'Durchführende Person(en) (optional)|Host / presenter(s) (optional)',
    eventHostLabel: 'Durchgeführt von|Hosted by',
    musicPlayer: 'SoundCloud-Player|SoundCloud player',
    titleLogo: 'Titel-Logo (PNG, optional)|Title logo (PNG, optional)',
    favicon: 'Favicon (PNG, optional)|Favicon (PNG, optional)',
    uploadLogo: 'Logo hochladen|Upload logo',
    uploadFavicon: 'Favicon hochladen|Upload favicon',
    brandingUploadSuccess: 'Branding-Bild hochgeladen.|Branding image uploaded.',
    brandingUploadError: 'Bitte eine gültige PNG-Datei bis 5 MB wählen.|Choose a valid PNG file up to 5 MB.',
    musicPlay: 'Musik abspielen|Play music',
    musicPause: 'Musik pausieren|Pause music',
    musicNext: 'Nächster Titel|Next track',
    musicVolume: 'Lautstärke|Volume',
    musicPrompt: 'Lust auf Groove?|Need some groove?',
    musicReady: 'Lust auf Groove?|Need some groove?',
    musicLoading: 'SoundCloud wird geladen…|Loading SoundCloud…',
    musicPaused: 'Pausiert|Paused',
    musicUnavailable: 'SoundCloud-Player nicht verfügbar|SoundCloud player unavailable',
    admin: 'Administration|Admin',
    adminTitle: 'Eventverwaltung|Event management',
    poiEditorTitle: 'POIs bearbeiten|Edit POIs',
    wwwEditorTitle: 'WWW-Programm bearbeiten|Edit WWW timetable',
    username: 'Benutzername|Username',
    accountsHeading: 'Zusatzkonten|Additional accounts',
    accountsHint:
      'Erstelle ein eingeschränktes Konto für POIs und eines für das WWW-Programm. Ein leeres Passwort lässt das bestehende Passwort unverändert.|Create one limited account for POIs and one for the WWW timetable. Leave a password blank to keep the current password.',
    poiAccount: 'POI-Konto|POI account',
    wwwAccount: 'WWW-Konto|WWW account',
    newPassword: 'Neues Passwort (mindestens 12 Zeichen)|New password (at least 12 characters)',
    saveAccounts: 'Konten speichern|Save accounts',
    accountsSaved: 'Konten gespeichert.|Accounts saved.',
    accountsFailed: 'Konten konnten nicht gespeichert werden.|Could not save accounts.',
    places: 'Orte|Places',
    searchPlaces: 'Orte suchen…|Search places…',
    searchPlacesLabel: 'Orte suchen|Search places',
    mapLabel: 'Interaktive Bildkarte|Interactive image map',
    mapPending: 'Die Karte wird gerade eingerichtet.|The map is being set up.',
    noPlaces: 'Noch keine Orte eingetragen.|No places have been added yet.',
    noMatches: 'Keine passenden Orte gefunden.|No matching places found.',
    showPoiNames: 'POI-Namen anzeigen|Show POI names',
    showCategory: 'Kategorie anzeigen|Show category',
    dataTools: 'Datensicherung|Data backup',
    exportData: 'Komplettsicherung herunterladen|Download full backup',
    importData: 'Vollständige Sicherung wiederherstellen|Restore full backup',
    importHint:
      'Die Sicherung enthält Kartendaten und alle hochgeladenen Veranstaltungskarten. Login-Konten bleiben unverändert.|The backup includes map data and all uploaded event maps. Login accounts stay unchanged.',
    importConfirm:
      'Import überschreibt die aktuellen Kartendaten. Fortfahren?|Import will replace the current map data. Continue?',
    importSuccess: 'Daten importiert und gespeichert.|Data imported and saved.',
    importInvalid: 'Ungültige oder nicht unterstützte JSON-Datei.|Invalid or unsupported JSON file.',
    importFailed: 'Import fehlgeschlagen.|Import failed.',
    backupFilename: 'burnigator-komplettsicherung.json|burnigator-full-backup.json',
    exportSuccess: 'Vollständige Sicherung heruntergeladen.|Full backup downloaded.',
    backupFailed:
      'Sicherung konnte nicht erstellt oder wiederhergestellt werden.|Could not create or restore the backup.',
    backupInvalid: 'Ungültige Sicherungsdatei oder fehlendes Bild.|Invalid backup file or missing image.',
    backupTooLarge: 'Die Sicherungsdatei ist größer als 80 MB.|The backup file is larger than 80 MB.',
    fullBackupConfirm:
      'Die Sicherung ersetzt die aktuellen Kartendaten und Bilder. Vorher wird automatisch ein Snapshot erstellt. Fortfahren?|This backup replaces the current map data and images. An automatic snapshot will be made first. Continue?',
    backupRestored: 'Vollständige Sicherung wiederhergestellt.|Full backup restored.',
    snapshotsHeading: 'Automatische Snapshots|Automatic snapshots',
    snapshotsHint:
      'Die fünf letzten Kartenstände werden automatisch behalten.|The five most recent map states are kept automatically.',
    snapshotsEmpty: 'Noch keine Snapshots vorhanden|No snapshots yet',
    restoreSnapshot: 'Ausgewählten Stand wiederherstellen|Restore selected snapshot',
    snapshotsLoadFailed: 'Snapshots konnten nicht geladen werden.|Could not load snapshots.',
    snapshotConfirm:
      'Dieser Kartenstand ersetzt die aktuellen Kartendaten. Fortfahren?|This snapshot replaces the current map data. Continue?',
    snapshotRestored: 'Kartenstand wiederhergestellt.|Map snapshot restored.',
    snapshotRestoreFailed:
      'Kartenstand konnte nicht wiederhergestellt werden.|Could not restore the snapshot.',
    history_snapshot_restore: 'Snapshot wiederhergestellt|Snapshot restored',
    history_backup_restore: 'Vollsicherung wiederhergestellt|Full backup restored',
    lastUpdated: 'Zuletzt aktualisiert|Last updated',
    dataOnline: 'Aktuell vom Server geladen|Loaded from server just now',
    dataOffline: 'Offline – gespeicherte Daten|Offline – saved data',
    refreshingData: 'Aktualisiere…|Refreshing…',
    timeUnknown: 'unbekannt|unknown',
    enabledDays: 'Verfügbare Event-Tage|Available event days',
    enabledDaysHint:
      'Deaktivierte Tage erscheinen nicht im Programm-Editor für Orte. Bereits eingetragene Events bleiben gespeichert.|Disabled days do not appear in the programme editor for places. Events already entered are kept.',
    enabledDaysRequired:
      'Mindestens ein Event-Tag muss aktiviert bleiben.|At least one event day must stay enabled.',
    weekStart: 'Erster Tag des Events|First day of the event',
    weekStartHint:
      'Das Event dauert sieben Tage ab diesem Tag, zum Beispiel Donnerstag bis Mittwoch. Gilt für den Programm-Editor und die Besucheransicht.|The event runs for seven days from this day, for example Thursday to Wednesday. Applies to the programme editor and the visitor view.',
    dayMon: 'Montag|Monday',
    dayTue: 'Dienstag|Tuesday',
    dayWed: 'Mittwoch|Wednesday',
    dayThu: 'Donnerstag|Thursday',
    dayFri: 'Freitag|Friday',
    daySat: 'Samstag|Saturday',
    daySun: 'Sonntag|Sunday',
    setupTitle: 'Eventverwaltung einrichten|Set up event management',
    setupText:
      'Lege ein starkes Administratorpasswort fest (mindestens 12 Zeichen).|Set a strong administrator password (at least 12 characters).',
    setupWizardIntro:
      'In wenigen Schritten bereitest du die Grundkonfiguration vor.|Set up the basic configuration in a few guided steps.',
    setupStepAccount: '1. Zugang|1. Account',
    setupStepAppearance: '2. Aussehen|2. Appearance',
    setupStepOptions: '3. Optionen|3. Options',
    setupAccountHeading: 'Administratorzugang|Administrator account',
    setupAccountHint:
      'Lege ein sicheres Passwort mit mindestens 12 Zeichen fest.|Choose a secure password with at least 12 characters.',
    setupAppearanceHeading: 'Grundaussehen|Basic appearance',
    setupAppearanceHint:
      'Diese Werte kannst du später jederzeit in der Konfiguration ändern.|You can change these values later in Configuration.',
    setupOptionsHeading: 'Optionale Funktionen|Optional features',
    setupOptionsHint:
      'Alles lässt sich später im Adminbereich ergänzen oder ändern.|You can add or change these settings later in the admin panel.',
    setupError:
      'Einrichtung fehlgeschlagen. Bitte Eingaben und Dateirechte prüfen.|Setup failed. Check the form values and file permissions.',
    setupCustomUrlError:
      'Der Zusatzbutton benötigt eine gültige HTTP- oder HTTPS-Adresse.|The custom button needs a valid HTTP or HTTPS address.',
    setupQrUrlError:
      'Die QR-Code-Adresse benötigt eine gültige HTTP- oder HTTPS-Adresse.|The QR code needs a valid HTTP or HTTPS address.',
    setupImpressUrlError:
      'Der Impress-Link benötigt eine gültige HTTP- oder HTTPS-Adresse.|The legal notice URL needs a valid HTTP or HTTPS address.',
    setupDataWriteError:
      'Datenverzeichnis oder uploads ist nicht beschreibbar. Bitte Dateirechte prüfen und erneut versuchen.|The data or uploads folder is not writable. Check permissions and try again.',
    password: 'Passwort|Password',
    passwordAgain: 'Passwort wiederholen|Repeat password',
    setupButton: 'Einrichtung abschließen|Finish setup',
    next: 'Weiter|Next',
    back: 'Zurück|Back',
    passwordShort:
      'Bitte ein Passwort mit mindestens 12 Zeichen wählen.|Choose a password with at least 12 characters.',
    passwordMismatch: 'Die Passwörter stimmen nicht überein.|The passwords do not match.',
    configWrite: 'config.php ist nicht beschreibbar. Bitte Dateirechte prüfen.|config.php is not writable.',
    login: 'Anmelden|Sign in',
    badPassword: 'Passwort nicht korrekt.|Incorrect password.',
    loginRateLimited:
      'Zu viele Versuche. Bitte 15 Minuten warten.|Too many attempts. Please wait 15 minutes.',
    mapConflict:
      'Die Karte wurde von jemand anderem geändert. Bitte lade die Seite neu und übertrage deine Änderungen erneut.|The map was changed by someone else. Reload the page and reapply your changes.',
    saveEvent: 'Event speichern|Save event',
    eventHintTitle: 'Bitte einen Event-Titel eingeben.|Please enter an event title.',
    eventHintStart: 'Bitte eine Startzeit festlegen.|Please set a start time.',
    eventIncomplete:
      'Mindestens ein Event ist unvollständig. Titel und Startzeit sind Pflichtfelder.|At least one event is incomplete. Title and start time are required.',
    invalidEventTime:
      'Die Endzeit darf nicht gleich der Startzeit sein.|The end time must differ from the start time.',
    backToMap: 'Zur Besucherkarte|Visitor map',
    title: 'Event-Titel|Event title',
    iconMode: 'Symbolfarben|Icon color mode',
    mono: 'Monochrom (schwarz)|Monochrome (black)',
    color: 'Farbig|Colored',
    image: 'Veranstaltungskarte (PNG/JPG)|Event map (PNG/JPG)',
    upload: 'Bild hochladen|Upload image',
    categories: 'Kategorien|Categories',
    newCategory: 'Neue Kategorie|New category',
    add: 'Hinzufügen|Add',
    poiLimit: 'Es können höchstens 2.000 Orte gespeichert werden.|A maximum of 2,000 places can be saved.',
    poiHeading: 'Orte|Places',
    addPoiHint:
      'Klicke auf die Karte, um einen Ort anzulegen. Ziehe Marker zum Verschieben.|Click the map to add a place. Drag markers to move them.',
    collapsePlaces: 'Alle einklappen|Collapse all',
    expandPlaces: 'Alle ausklappen|Expand all',
    uncategorized: 'Ohne Kategorie|Uncategorized',
    save: 'Änderungen speichern|Save changes',
    visitorMap: 'Besucherkarte|Visitor map',
    logout: 'Abmelden|Sign out',
    name: 'Name|Name',
    description: 'Beschreibung|Description',
    categoryNone: 'Ohne Kategorie|No category',
    deletePlace: 'Ort löschen|Delete place',
    confirmDeletePlace:
      'Diesen Ort wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.|Delete this place? This action cannot be undone.',
    eventSectionDetails: 'Details|Details',
    eventSectionLink: 'Link (optional)|Link (optional)',
    eventSectionCategories: 'Kategorien|Categories',
    deleteEvent: 'Veranstaltung löschen|Delete event',
    confirmDeleteEvent:
      'Diese Veranstaltung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.|Delete this event? This action cannot be undone.',
    position: 'Position|Position',
    iconSearchSummary: 'Symbol suchen oder auswählen|Search or choose an icon',
    iconSearchPlaceholder: 'Suchen: Essen, Hotel, Park …|Search: food, hotel, park…',
    customIcon: 'Font Awesome Symbolname|Font Awesome icon name',
    iconSearchEmpty: 'Keine passenden Symbole.|No matching icons.',
    saveSuccess: 'Änderungen gespeichert.|Changes saved.',
    uploadSuccess: 'Bild hochgeladen.|Image uploaded.',
    selectImage: 'Bitte zuerst ein Bild auswählen.|Select an image first.',
    uploadFailed: 'Upload fehlgeschlagen.|Upload failed.',
    needImage: 'Lade zuerst eine Veranstaltungskarte hoch.|Upload an event map first.',
    failedSave: 'Speichern fehlgeschlagen.|Could not save changes.',
    customButtonLabel: 'Zusatzbutton-Text (optional)|Custom button label (optional)',
    customButtonUrl: 'Zusatzbutton-Link (https://…)|Custom button URL (https://…)',
    wwwQrUrl: 'QR-Code-URL für WWW-JPG (optional)|WWW JPG export QR URL (optional)',
    titleLinkUrl: 'Titel-Link (optional)|Title link URL (optional)',
    titleLinkUrlInvalid:
      'Der Titel-Link muss eine gültige HTTP- oder HTTPS-Adresse sein.|The title link URL must be a valid HTTP or HTTPS address.',
    impressUrl: 'Impress-Link (optional)|Legal notice URL (optional)',
    impressUrlInvalid:
      'Der Impress-Link muss eine gültige HTTP- oder HTTPS-Adresse sein.|The legal notice URL must be a valid HTTP or HTTPS address.',
    qrUrlInvalid:
      'Die QR-Code-URL muss mit http:// oder https:// beginnen.|The QR URL must start with http:// or https://.',
    historyHeading: 'Änderungsverlauf|Change history',
    historyEmpty: 'Noch keine Änderungen protokolliert.|No changes recorded yet.',
    history_map_save: 'Karteneinstellungen gespeichert|Map settings saved',
    history_poi_save: 'POI gespeichert|POI saved',
    history_poi_save_all: 'POIs gespeichert|POIs saved',
    history_poi_delete: 'POI gelöscht|POI deleted',
    history_program_save: 'WWW-Programm gespeichert|WWW timetable saved',
    history_accounts_save: 'Zusatzkonten geändert|Additional accounts updated',
    history_map_image_upload: 'Veranstaltungskarte hochgeladen|Event map uploaded',
    history_branding_logo: 'Titel-Logo geändert|Title logo updated',
    history_branding_favicon: 'Favicon geändert|Favicon updated',
    poiDeleteHasEvents:
      'Dieser Ort hat Veranstaltungen im WWW-Programm und kann von diesem Konto nicht gelöscht werden. Bitte frage den Admin.|This place has events in the WWW timetable and cannot be deleted by this account. Please ask the admin.',
    requestFailed: 'Anfrage fehlgeschlagen. Bitte versuche es erneut.|Request failed. Please try again.',
    errorImageSize: 'Das Bild darf höchstens 20 MB groß sein.|The image must be 20 MB or smaller.',
    errorImageFormat: 'Bitte eine gültige PNG- oder JPG-Datei wählen.|Choose a valid PNG or JPG file.',
    errorPermissions:
      'Prüfe die Schreibrechte für data/ und uploads/.|Check file permissions for data/ and uploads/.',
    errorSession:
      'Sitzung abgelaufen. Bitte melde dich erneut an.|Your session expired. Please sign in again.',
    locationName: 'Neuer Ort|New place',
    categoryDelete: 'Löschen|Delete',
    musicForward30: '30 Sekunden vorspulen|Skip forward 30 seconds',
    shareLink: 'Link teilen|Share link',
    shareCopied: 'Link kopiert|Link copied',
    deepLinkNotFound:
      'Dieser Link verweist auf einen Eintrag, den es nicht mehr gibt.|This link points to something that no longer exists.',
    announcementDismiss: 'Hinweis schließen|Dismiss announcement',
    eventChanged: 'Kürzlich geändert (Zeit, Ort oder Titel)|Recently changed (time, place or title)',
    announcementTitle: 'Hinweis für Besucher|Visitor announcement',
    announcementIntro:
      'Ein kurzer Hinweis, der oben auf der Besucherseite erscheint, zum Beispiel eine Verspätung oder eine Wetterwarnung. Besucher können ihn schließen; ändert sich der Text, erscheint er erneut. Leer lassen und speichern entfernt den Hinweis. Geänderte Events (Zeit, Ort oder Titel) werden 24 Stunden lang automatisch markiert.|A short notice shown at the top of the visitor page, for example a delay or a weather warning. Visitors can dismiss it; when you change the text it shows again. Save it empty to remove it. Events whose time, place or title change are marked automatically for 24 hours.',
    announcementText: 'Text (max. 300 Zeichen)|Text (max. 300 characters)',
    announcementLevel: 'Art|Type',
    announcementLevelInfo: 'Information|Information',
    announcementLevelWarning: 'Warnung|Warning',
    announcementSave: 'Hinweis veröffentlichen|Publish announcement',
    announcementClear: 'Hinweis entfernen|Remove announcement',
    announcementSaved: 'Hinweis gespeichert.|Announcement saved.',
    announcementRemoved: 'Hinweis entfernt.|Announcement removed.',
    announcementFailed: 'Hinweis konnte nicht gespeichert werden.|Announcement could not be saved.',
    history_announcement_save: 'Besucherhinweis geändert|Visitor announcement changed',
    statsTitle: 'Statistik|Statistics',
    statsIntro:
      'Zählt anonym, was Besucher öffnen: Besuche, Events, Orte und Favoriten. Es werden keine Cookies, IP-Adressen, Kennungen oder Zeitpunkte unterhalb eines Tages gespeichert. Daten von angemeldeten Teammitgliedern und aus der Vorschau werden nicht gezählt. Die Werte der letzten 90 Tage bleiben erhalten.|Anonymously counts what visitors open: visits, events, places and favourites. No cookies, IP addresses, identifiers or timestamps finer than a day are stored. Signed-in team members and the preview are not counted. The last 90 days are kept.',
    statsEnable: 'Statistik aktivieren|Enable statistics',
    statsEnabledNote: 'Statistik ist aktiv.|Statistics are on.',
    statsDisabledNote: 'Statistik ist aus. Es wird nichts gezählt.|Statistics are off. Nothing is counted.',
    statsRange: 'Zeitraum|Period',
    statsRange7: 'Letzte 7 Tage|Last 7 days',
    statsRange30: 'Letzte 30 Tage|Last 30 days',
    statsRange90: 'Letzte 90 Tage|Last 90 days',
    statsVisits: 'Besuche|Visits',
    statsEventOpens: 'Event-Details geöffnet|Event details opened',
    statsPoiOpens: 'Orte geöffnet|Places opened',
    statsFavorites: 'Favoriten|Favourites',
    statsVisitsPerDay: 'Besuche pro Tag|Visits per day',
    statsTopEvents: 'Beliebteste Events|Most popular events',
    statsTopPois: 'Meistgeöffnete Orte|Most opened places',
    statsColEvent: 'Event|Event',
    statsColPlace: 'Ort|Place',
    statsColOpens: 'Geöffnet|Opened',
    statsColFavorites: 'Favoriten|Favourites',
    statsNoData: 'Noch keine Daten.|No data yet.',
    statsReset: 'Statistik zurücksetzen|Reset statistics',
    statsResetConfirm: 'Alle gezählten Werte unwiderruflich löschen?|Permanently delete all counted values?',
    statsLoadFailed: 'Statistik konnte nicht geladen werden.|Statistics could not be loaded.',
    history_stats_setting: 'Statistik-Einstellung geändert|Statistics setting changed',
    history_stats_reset: 'Statistik zurückgesetzt|Statistics reset',
    nowNextLabel: 'Gerade und als Nächstes heute|Happening now and up next today',
    nowNextNow: 'Läuft gerade|Happening now',
    nowNextNext: 'Als Nächstes|Up next',
    nowNextNothingNow: 'Gerade läuft nichts.|Nothing on right now.',
    nowNextNothingNext: 'Heute kommt nichts mehr.|Nothing more today.',
    clashHint: 'Überschneidet sich mit deinen Favoriten: {names}|Overlaps with your favourites: {names}',
    clashSummary:
      '{n} deiner Favoriten überschneiden sich an diesem Tag.|{n} of your favourites overlap on this day.',
    lang: 'Sprache|Language',
    ownerHint: 'Powered by|Powered by',
    impressLink: 'Impressum|Legal notice',
    sourceLink: 'Quellcode|Source code',
    refreshData: 'Aktualisieren|Refresh',
    closeDetails: 'Details schließen|Close details',
    installApp: 'Als App installieren|Install app',
    installFallback:
      'Öffne das Browsermenü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.|Open your browser menu and choose “Install app” or “Add to Home screen”.',
  };
  function lang() {
    try {
      return localStorage.getItem('imageMapLanguage') === 'en' ? 'en' : 'de';
    } catch (_) {
      return 'de';
    }
  }
  function t(key) {
    const pair = words[key] || key;
    const parts = pair.split('|');
    return parts[lang() === 'en' ? 1 : 0] || parts[0];
  }
  function apply() {
    document.documentElement.lang = lang();
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      if (words[el.dataset.i18n]) el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      if (words[el.dataset.i18nPlaceholder]) el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      if (words[el.dataset.i18nAria]) el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    const sel = document.getElementById('language-switch');
    if (sel) {
      sel.value = lang();
      sel.onchange = () => {
        try {
          localStorage.setItem('imageMapLanguage', sel.value);
        } catch (_) {}
        apply();
        window.dispatchEvent(new Event('image-map-language-change'));
      };
    }
  }
  window.AppI18n = { t, lang, apply };
  apply();
  document.addEventListener('DOMContentLoaded', apply);
})();

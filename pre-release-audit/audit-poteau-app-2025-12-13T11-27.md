# 🎯 ACTION REQUIRED - Poteau App (B2C)

Generated: 12/13/2025, 12:27:49 PM

---

## Release Status: 🟡 MINOR ISSUES

A few translations missing. Can release with known gaps.

**Coverage:** 100% (936/938 keys complete)

---

## Priority Fixes

### 🚨 Critical Screens (Fix First)

These are high-traffic screens that users see frequently:

- **GameSheet** (/game/:gameId): 2 missing translations [ES, IT, EN, FR]

### ⚠️ Other Screens with Issues

- **Features**: 1 missing [ES, IT, EN, FR]

---

## By Language

🇪🇸 **Spanish**: 100% complete (1 missing) ✅
🇮🇹 **Italian**: 100% complete (1 missing) ✅
🇬🇧 **English**: 100% complete (1 missing) ✅
🇫🇷 **French**: 100% complete (0 missing) ✅

---

## ⚠️ Possible Copy-Paste Errors

These have French text in Spanish/Italian slots (likely forgot to translate):

- "Pablo da Fonseca..." (ES same as FR)
- "Pablo da Fonseca..." (IT same as FR)
- "poteau-app.com..." (ES same as FR)
- "poteau-app.com..." (IT same as FR)
- "Valider..." (ES same as FR)

*...and 6 more*

---

## Quick Action Checklist

- [ ] Add 1 Spanish/Italian translations in FlutterFlow
- [ ] Review 11 potential copy-paste errors
- [ ] Prioritize: GameSheet
- [ ] Re-run audit after fixes: `audit-poteau` or `audit-poteau-max`


---

# 📋 Detailed Analysis

# Pre-Release Audit Report

**App:** Poteau App (B2C)
**Generated:** 2025-12-13T11-27
**Tool Version:** 1.0.0

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Translation Keys | 938 |
| Complete (all 4 languages) | 936 (100%) |
| Partial (missing some) | 2 |
| Empty (all languages) | 0 |

### Coverage by Language

| Language | Filled | Empty | Coverage |
|----------|--------|-------|----------|
| French (fr) | 937 | 0 | 100% |
| English (en) | 936 | 1 | 100% |
| Spanish (es) | 936 | 1 | 100% |
| Italian (it) | 936 | 1 | 100% |

---

## 🚨 Critical Issues (Empty Translations)

---

## ⚠️ Suspicious Duplicates (Possible Copy-Paste Errors)

These translations have the same text in French and another language:

| Key ID | Issue | Text |
|--------|-------|------|
| `hh6k4gp3` | ES same as FR | Pablo da Fonseca... |
| `hh6k4gp3` | IT same as FR | Pablo da Fonseca... |
| `8xd713uj` | ES same as FR | poteau-app.com... |
| `8xd713uj` | IT same as FR | poteau-app.com... |
| `o1v3iu4a` | ES same as FR | Valider... |
| `ukxl0w0k` | ES same as FR | Poteau... |
| `ukxl0w0k` | IT same as FR | Poteau... |
| `jrak23tq` | ES same as FR | poteau.app/quiz... |
| `jrak23tq` | IT same as FR | poteau.app/quiz... |
| `0mldst42` | ES same as FR | poteau.app/quiz... |
| `0mldst42` | IT same as FR | poteau.app/quiz... |

---

## ⚠️ Leading/Trailing Space Mismatch (UI Issue)

These translations have leading or trailing spaces in French but not in other languages.
This can cause UI alignment issues when text is concatenated.

| Key ID | FR Text | Issue |
|--------|---------|-------|
| `doyhb224` | "L’accès s’ouvrira à tout le mo" | Missing trailing space in: EN, IT |
| `frn8zjp6` | "Payer tes matchs moins chers " | Missing trailing space in: EN, ES, IT |
| `y3p5audp` | "Tu as déjà un terrain " | Missing trailing space in: EN, ES |
| `opjw5nlt` | "On a envoyé un code à 4 chiffr" | Missing trailing space in: EN |
| `08sxviwc` | "Ça y est ! " | Missing trailing space in: EN |
| `i27x9mek` | "Bonne nouvelle ! Une mise à jo" | Missing trailing space in: EN, ES, IT |
| `s25m3yq4` | "Chaque " | Missing trailing space in: EN |
| `tx28oy5l` | "Bienvenue sur la meilleure app" | Missing trailing space in: EN, ES, IT |

---

## 📱 Screen-by-Screen Analysis

**Screens with issues:** 2  
**Clean screens:** 50

### GameSheet

- **Path:** `/game/:gameId`
- **Translations:** 110 complete, 2 incomplete
- **Navigates to:** Ban, ValidateEmail, BecomeGold, MyProfile, Profile, InviteFriends, EditMyGame, Home

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `1ddd2aqn` |   | fr, en, es, it |
| `mbzjn5pj` | , tu peux jouer pour  | en, es, it |

### Features

- **Path:** `/features`
- **Translations:** 3 complete, 1 incomplete
- **Navigates to:** None

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `1dfx6u08` |   | fr, en, es, it |

---

## 🗺️ Navigation Map

This shows how screens connect to each other.

### Landing
- **From:** (entry point)
- **To:** CreateAccount

### CreateAccount
- **From:** Landing
- **To:** LogIn

### LogIn
- **From:** CreateAccount
- **To:** (terminal)

### ValidateEmail
- **From:** Games, Home, GameSheet, EditMyProfile
- **To:** Ban

### a_Nickname
- **From:** (entry point)
- **To:** BPhoto

### b_Photo
- **From:** (entry point)
- **To:** CPhone

### c_Phone
- **From:** (entry point)
- **To:** DCity

### d_City
- **From:** (entry point)
- **To:** CitySelector

### e_Sports
- **From:** (entry point)
- **To:** FAlert

### f_Alert
- **From:** (entry point)
- **To:** FTeam, Home

### f_Team
- **From:** (entry point)
- **To:** Home

### Games
- **From:** CitySelector, a_Create, Profile
- **To:** Ban, CitySelector, ValidateEmail, BPhoto, CPhone, DCity, ANickname, EditMyProfile, ConfigureAlert

### Home
- **From:** f_Alert, f_Team, CitySelector, ConfigureAlert, a_Create, GameSheet, FeedbackSaved, Credits, EditMyProfile, Notifications, Contacts
- **To:** Ban, ValidateEmail, BPhoto, CPhone, DCity, ANickname, ESports, EditMyProfile, ACreate, FTeam

### MyProfile
- **From:** BecomeGold, GameSheet, EditMyProfile, FavoriteClub, Profile
- **To:** Ban, Settings, LevelReveal, LevelPickRole, FavoriteClub, FavoriteSelection

### BecomeGold
- **From:** GameSheet, Settings
- **To:** MyProfile, GameSheet

### CitySelector
- **From:** d_City, Games, b_Location
- **To:** FAlert, Home, Games

### ConfigureAlert
- **From:** Games, ManageAlerts
- **To:** ManageAlerts, Home

### a_Create
- **From:** (entry point)
- **To:** Ban, Home, Games

### b_Location
- **From:** (entry point)
- **To:** ACreate, CitySelector

### c_DateAndTime
- **From:** (entry point)
- **To:** DTypeVisibility

### d_TypeVisibility
- **From:** (entry point)
- **To:** ELevelMood

### e_LevelMood
- **From:** (entry point)
- **To:** FPrice

### f_Price
- **From:** (entry point)
- **To:** GSummaryRepeat

### g_SummaryRepeat
- **From:** (entry point)
- **To:** InviteFriends

### EditMyGame
- **From:** GameSheet
- **To:** GameSheet

### Filter
- **From:** Filter
- **To:** Filter

### GameSheet
- **From:** BecomeGold, EditMyGame, InviteFriends
- **To:** Ban, ValidateEmail, BecomeGold, MyProfile, Profile, InviteFriends, EditMyGame, Home

### InviteFriends
- **From:** g_SummaryRepeat, GameSheet
- **To:** GameSheet

### ManageAlerts
- **From:** ConfigureAlert, Settings
- **To:** ConfigureAlert

### FeedbackSaved
- **From:** GiveFeedback
- **To:** Home

### GiveFeedback
- **From:** (entry point)
- **To:** FeedbackSaved

### LevelPickRole
- **From:** MyProfile
- **To:** (terminal)

### LevelQuestion
- **From:** LevelStart
- **To:** (terminal)

### LevelReveal
- **From:** MyProfile
- **To:** (terminal)

### LevelStart
- **From:** (entry point)
- **To:** LevelQuestion

### Ban
- **From:** ValidateEmail, Games, Home, MyProfile, a_Create, GameSheet
- **To:** (terminal)

### Credits
- **From:** Settings
- **To:** Home

### EditMyPhone
- **From:** (entry point)
- **To:** EditMyProfile

### EditMyProfile
- **From:** Games, Home, EditMyPhone, Settings
- **To:** ValidateEmail, BPhoto, CPhone, DCity, ANickname, MyProfile, Home

### FavoriteClub
- **From:** MyProfile
- **To:** MyProfile

### FavoriteSelection
- **From:** MyProfile
- **To:** (terminal)

### Features
- **From:** Settings
- **To:** (terminal)

### Invoices
- **From:** Settings
- **To:** (terminal)

### Notifications
- **From:** (entry point)
- **To:** Home

### Settings
- **From:** MyProfile
- **To:** BecomeGold, EditMyProfile, ManageAlerts, Invoices, Credits, Features

### Contacts
- **From:** (entry point)
- **To:** Home, FTeam

### Profile
- **From:** GameSheet
- **To:** MyProfile, Games



---

# 📚 Screen Catalog - Complete Text Reference

This document shows ALL text displayed on each screen in all 4 languages.
Use this as a reference to verify what users see.

---

## a_Create

**Route:** `/new/sport`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: Ban, Home, Games

**Displayed Text (21 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Publier mon match | Publish my game | Crear una partida | Creare una partita | ✅ |
| 2 | Tu organises un match de  | What kind of game are you | ¿Organizas un partido de  | Che tipo di partita organ | ✅ |
| 3 | Foot | Soccer | Fútbol | Calcio | ✅ |
| 4 | Padel | Padel | Pádel | Padel | ✅ |
| 5 | Foot | Soccer | Fútbol | Calcio | ✅ |
| 6 | Padel | Padel | Pádel | Padel | ✅ |
| 7 | Foot | Soccer | Fútbol | Calcio | ✅ |
| 8 | Padel | Padel | Pádel | Padel | ✅ |
| 9 | Tu as déjà un terrain  | You already have a field | Primero, ¿tienes terreno? | Innanzitutto, hai un terr | ✅ |
| 10 | réservé | reserved |  reservado |  prenotato | ✅ |
| 11 |  pour ton match ? |  for your game? |  para tu partido? |  per la tua partita? | ✅ |
| 12 | Oui, je l\ | Yes, I reserved it | Sí, ya lo he reservado | Sì, l\ | ✅ |
| 13 | Non, pas encore | No, not yet | No, aún no | No, non ancora | ✅ |
| 14 | Oui, je l\ | Yes, I reserved it | Sí, ya lo he reservado | Sì, l\ | ✅ |
| 15 | Non, pas encore | No, not yet | No, aún no | No, non ancora | ✅ |
| 16 | Oui, je l\ | Yes, I reserved it | Sí, ya lo he reservado | Sì, l\ | ✅ |
| 17 | Non, pas encore | No, not yet | No, aún no | No, non ancora | ✅ |
| 18 | Super ! C\ | Great! Is this a place wh | ¡Excelente! ¿Donde está l | Eccellente! Dove si trova | ✅ |
| 19 | Sélectionner un autre lie | Select another location | Seleccionar ubicación | Seleziona la posizione | ✅ |
| 20 | Super ! Dans quel lieu se | Great! Where is it locate | ¡Excelente! ¿Donde está l | Eccellente! Dove si trova | ✅ |
| 21 | Sélectionner le lieu | Select the location | Seleccionar ubicación | Seleziona la posizione | ✅ |

---

## a_Nickname

**Route:** `/onboarding/firstname`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: BPhoto

**Displayed Text (4 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Bienvenue sur Poteau ⚽️ | Welcome to Poteau ⚽️ | Bienvenido a Posteau ⚽️ | Benvenuti a Posteau ⚽️ | ✅ |
| 2 | On a besoin de quelques i | We need some basic info s | Necesitamos información b | Abbiamo bisogno di alcune | ✅ |
| 3 | Quel est ton surnom ? | What\ | ¿Cuál es tu verdadero nom | Qual è il tuo vero nome? | ✅ |
| 4 | Valider | Validate | Validar | Convalidare | ✅ |

---

## b_Location

**Route:** `/new/center`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: ACreate, CitySelector

**Displayed Text (1 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Nom du lieu, ville, adres | Place name, city, address | Nombre del lugar, ciudad, | Nome del luogo, città, in | ✅ |

---

## b_Photo

**Route:** `/onboarding/picture`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: CPhone

**Displayed Text (8 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Ta photo de profil 📸 | Your profile picture 📸 | Tu foto de perfil 📸 | La tua immagine del profi | ✅ |
| 2 | Mets une photo avec ton v | Add a photo with your fac | Publica una foto con tu c | Pubblica una foto con il  | ✅ |
| 3 | Si tu as refusé l\ | If you denied access to y | Si ha rechazado el acceso | Se hai rifiutato l\ | ✅ |
| 4 | Ouvrir mes réglages | Open my settings | abrir mi configuración | Apri le mie impostazioni | ✅ |
| 5 | On enregistre la photo… | Saving the photo... | Guardamos la foto… | Salviamo la foto... | ✅ |
| 6 | C\ | All good! | ¡Es bueno! | Va bene! | ✅ |
| 7 | On n\ | We couldn\ | No pudimos guardar la fot | Impossibile salvare la fo | ✅ |
| 8 | Choisir ma photo | Choose my photo | Elegir mi foto | Scegli la mia foto | ✅ |

---

## Ban

**Route:** `/out`

**Navigation:**
- ← Comes from: ValidateEmail, Games, Home, MyProfile, a_Create, GameSheet
- → Goes to: (no outbound navigation)

**Displayed Text (6 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Cette décision a été pris | This decision was made af | Esta decisión se tomó lue | Questa decisione è stata  | ✅ |
| 2 | Le fair-play et le respec | Fair play and respect are | El juego limpio y el resp | Fair play e rispetto sono | ✅ |
| 3 | Nous sommes désolés d\ | We are sorry to have made | Lamentamos haber tomado e | Siamo spiacenti di aver p | ✅ |
| 4 | Cette décision n\ | This decision is not yet  | Esta decisión aún no es d | Questa decisione non è an | ✅ |
| 5 | Lorsque nous penserons qu | When we think you\ | Cuando creamos que ha ten | Quando riteniamo che tu a | ✅ |
| 6 | L\ | The Poteau team | El equipo Poteau | La squadra di Poteau | ✅ |

---

## BecomeGold

**Route:** `/gold`

**Navigation:**
- ← Comes from: GameSheet, Settings
- → Goes to: MyProfile, GameSheet

**Displayed Text (39 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | C\ | It\ | Es tu partido. Elige quié | È la tua partita. Scegli  | ✅ |
| 2 | En devenant membre Gold,  | By becoming a Gold member | Al convertirte en miembro | Diventando membro Gold, a | ✅ |
| 3 | 📸 | 📸 | 🤔 | 🤔 | ✅ |
| 4 | Ajouter des photos dans l | Add photos to the discuss | Agregar fotos en la conve | Aggiungi foto nella discu | ✅ |
| 5 | 🤔 | 🤔 | 🤔 | 🤔 | ✅ |
| 6 | Choisir si ton match est  | Choose if your game is fo | Elige si tu partido es re | Scegli se la tua partita  | ✅ |
| 7 | 👋 | 👋 | 👋 | 👋 | ✅ |
| 8 | Retirer des joueurs de te | Remove players from your  | Retirar jugadores de tus  | Rimuovi giocatori dalle t | ✅ |
| 9 | 🔥 | 🔥 | 🔥 | 🔥 | ✅ |
| 10 | Rejoindre les meilleurs m | Join the best games exclu | Accede a todos los partid | Accedi a tutte le partite | ✅ |
| 11 | 💰 | 💰 | 💰 | 💰 | ✅ |
| 12 | Payer tes matchs moins ch | Pay less for your games | Paga menos por tus partid | Paga meno per le tue part | ✅ |
| 13 | sur les matchs avec paiem | on games with in-app paym | Paga menos por tus partid | Paga meno per le tue part | ✅ |
| 14 | 🎁 | 🎁 | 🎁 | 🎁 | ✅ |
| 15 | Recevoir des cadeaux excl | Receive exclusive gifts | Recibe regalos exclusivos | Ricevi regali esclusivi ( | ✅ |
| 16 | Invitations VIP, maillots | VIP invitations, soccer j | Paga menos por tus partid | Paga meno per le tue part | ✅ |
| 17 | Avoir le statut Gold part | Get Gold status everywher | Tener la insignia Dorada  | Avere il badge Gold sul t | ✅ |
| 18 | Choisis ton abonnement : | Choose your subscription: | Elige tu suscripción: | Scegli il tuo abbonamento | ✅ |
| 19 | Hebdo | Weekly | Semanal | Settimanale | ✅ |
| 20 | /semaine | /week | /semana | /settimana | ✅ |
| 21 | Mensuel | Monthly | Mensual | Mensile | ✅ |
| 22 | /semaine | /week | /semana | /settimana | ✅ |
| 23 | Annuel | Annual | Anual | Annuale | ✅ |
| 24 | /semaine | /week | /semana | /settimana | ✅ |
| 25 | Hebdo | Weekly | Semanal | Settimanale | ✅ |
| 26 | /semaine | /week | /semana | /settimana | ✅ |
| 27 | Mensuel | Monthly | Mensual | Mensile | ✅ |
| 28 | /semaine | /week | /semana | /settimana | ✅ |
| 29 | Annuel | Annual | Anual | Annuale | ✅ |
| 30 | /semaine | /week | /semana | /settimana | ✅ |
| 31 | Hebdo | Weekly | Semanal | Settimanale | ✅ |
| 32 | /semaine | /week | /semana | /settimana | ✅ |
| 33 | Mensuel | Monthly | Mensual | Mensile | ✅ |
| 34 | /semaine | /week | /semana | /settimana | ✅ |
| 35 | Annuel | Annual | Anual | Annuale | ✅ |
| 36 | /semaine | /week | /semana | /settimana | ✅ |
| 37 | Pour plus d\ | For more info, you can ch | Para más información pued | Per ulteriori informazion | ✅ |
| 38 | Notre politique de confid | Our privacy policy | Nuestra política de priva | La nostra politica sulla  | ✅ |
| 39 | Nos conditions d\ | Our terms of use | Nuestros términos de uso | Le nostre condizioni d\ | ✅ |

---

## BuildMyTeam

**Route:** `/buildmyteam`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: (no outbound navigation)

**Displayed Text (11 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Construire mon équipe | Build my team | Construir mi equipo | Costruisci la mia squadra | ✅ |
| 2 | Envoyer mon lien d\ | Send my invitation link | Enviar mi enlace de invit | Invia il mio link d\ | ✅ |
| 3 | Invite tes potes à rejoin | Invite your friends to jo | Invita a tus amigos a uni | Invita i tuoi amici a uni | ✅ |
| 4 | Comme ça, ils pourront s\ | This way, they can sign u | De esta manera podrán reg | In questo modo potranno r | ✅ |
| 5 | L\ | Preview of your invitatio | La vista previa de tu inv | L\ | ✅ |
| 6 |  t\ |  invites you to join thei |  te invita a unirte a su  |  ti invita a unirti al su | ✅ |
| 7 | Partager à mes potes | Share with my friends | Comparte con mis amigos | Condividi con i miei amic | ✅ |
| 8 | Inviter depuis WhatsApp | Invite via WhatsApp | Invitar desde WhatsApp | Invita tramite WhatsApp | ✅ |
| 9 | Ajouter des joueurs Potea | Add Poteau players | Agregar jugadores Poteau | Aggiungi giocatori Poteau | ✅ |
| 10 | Recherche tes amis parmi  | Find your friends among t | Busca a tus amigos entre  | Cerca i tuoi amici tra i  | ✅ |
| 11 | Rechercher sur Poteau | Search on Poteau | Buscar en Poteau | Cerca su Poteau | ✅ |

---

## c_DateAndTime

**Route:** `/new/date`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: DTypeVisibility

**Displayed Text (6 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | 50% | 50% | 50% | 50% | ✅ |
| 2 | Ton match a lieu quel jou | What day is your game? | ¿Tu partido es qué día? | Il tuo match si svolge in | ✅ |
| 3 | À quelle heure ? | What time? | ¿A qué hora? | A che ora? | ✅ |
| 4 | et jusqu\ | and up to...? | ¿y hasta…? | e fino a…? | ✅ |
| 5 | Double check le jour de t | Double-check your game da | Verifica el día de tu par | Ricontrolla il giorno del | ✅ |
| 6 | Valider | Validate | Validar | Convalidare | ✅ |

---

## c_Phone

**Route:** `/onboarding/phone`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: DCity

**Displayed Text (7 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Ton numéro 📱 | Your number 📱 | Tu número 📱 | Il tuo numero 📱 | ✅ |
| 2 | Utilise ton  | Use your  | Utilice tu  | Usa il tuo  | ✅ |
| 3 | vrai numéro | real number | número real | numero reale | ✅ |
| 4 |  pour sécuriser ton compt |  to secure your account a |  para proteger tu cuenta  |  per proteggere il tuo ac | ✅ |
| 5 | Pays | Country | País | Paese | ✅ |
| 6 | Pays | Country | País | Paese | ✅ |
| 7 | Valider | Validate | Validar | Convalidare | ✅ |

---

## CitySelector

**Route:** `/city`

**Navigation:**
- ← Comes from: d_City, Games, b_Location
- → Goes to: FAlert, Home, Games

**Displayed Text (3 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Tape ta ville | Enter your city | Escribe tu ciudad | Scrivi la tua città | ✅ |
| 2 | Historique | History | Historial | Storico | ✅ |
| 3 | Aucun résultat pour ta re | No results for your searc | No hay resultados para tu | Nessun risultato per la t | ✅ |

---

## ConfigureAlert

**Route:** `/configurealert`

**Navigation:**
- ← Comes from: Games, ManageAlerts
- → Goes to: ManageAlerts, Home

*No translation keys found in this screen (may use dynamic content or components)*

---

## Contacts

**Route:** `/contacts`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: Home, FTeam

**Displayed Text (6 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Mes contacts | My contacts | Mis contactos | I miei contatti | ✅ |
| 2 | Vérifie que tu as bien pa | Make sure you\ | Asegúrate de haber dado a | Assicurati di aver condiv | ✅ |
| 3 | Ouvrir mes réglages | Open my settings | Abrir mis ajustes | Apri le mie impostazioni | ✅ |
| 4 | Sélectionne tes potes dan | Select your buddies from  | Selecciona a tus amigos d | Seleziona i tuoi amici da | ✅ |
| 5 | Ouvrir mes réglages | Open my settings | Abrir mis ajustes | Apri le mie impostazioni | ✅ |
| 6 | Définir leur niveau | Define their level | Definir su nivel | Definire il loro livello | ✅ |

---

## CreateAccount

**Route:** `/signup`

**Navigation:**
- ← Comes from: Landing
- → Goes to: LogIn

**Displayed Text (9 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Créer un compte | Create an account | Crea una cuenta | Creare un account | ✅ |
| 2 | J\ | I already have a Poteau a | Ya tengo una cuenta Potea | Ho già un account Poteau | ✅ |
| 3 | Entre ton adresse mail | Enter your email address | Introduce tu dirección de | Inserisci il tuo indirizz | ✅ |
| 4 | Cette adresse n\ | This address is not accep | Esta dirección no es acep | Questo indirizzo non è ac | ✅ |
| 5 | Recevoir des infos par ma | Receive info by email (ze | Recibir información de mi | Ricevi informazioni sulle | ✅ |
| 6 | Choisis un mot de passe | Choose a password | Elije una contraseña | Scegli una password | ✅ |
| 7 | Lettres, chiffres, caract | Letters, numbers, special | Letras, números, caracter | Lettere, numeri, caratter | ✅ |
| 8 | Les mots de passe ne corr | Passwords do not match. T | Las contraseñas no coinci | Le passwords non corrispo | ✅ |
| 9 | Valider | Validate | Validar | Convalidare | ✅ |

---

## Credits

**Route:** `/credits`

**Navigation:**
- ← Comes from: Settings
- → Goes to: Home

**Displayed Text (3 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Remerciements | Thanks | Gracias | Grazie | ✅ |
| 2 | Merci à tous ceux qui ont | Thanks to everyone who he | Gracias a todos los que a | Grazie a tutti coloro che | ✅ |
| 3 | Ce n\ | This is just the beginnin | Este es solo el comienzo. | Questo è solo l\ | ✅ |

---

## d_City

**Route:** `/onboarding/city`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: CitySelector

**Displayed Text (4 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Ta ville 📍 | Your city 📍 | Tu ciudad 📍 | La tua città 📍 | ✅ |
| 2 | On va afficher les matchs | We will display the games | Mostraremos los partidos  | Mostreremo le partite org | ✅ |
| 3 | Autour de moi | Around me | A mi alrededor | Intorno a me | ✅ |
| 4 | Rechercher ma ville | Search my city | Encontrar mi ciudad | Trova la mia città | ✅ |

---

## d_TypeVisibility

**Route:** `/new/type`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: ELevelMood

**Displayed Text (13 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | 70% | 70% | 70% | 70% | ✅ |
| 2 | C\ | What kind of game is it? | ¿Qué tipo de partido es? | Che tipo di partita è? | ✅ |
| 3 | Pour l\ | For now, you want your so | Por ahora, quieres que tu | Per ora, vuoi che il tuo  | ✅ |
| 4 | Pour l\ | For now, you want your pa | Por ahora, quieres que tu | Per ora, vuoi che il tuo  | ✅ |
| 5 | Pour l\ | For now, you want your ga | Por ahora, quieres que tu | Per ora, vuoi che la tua  | ✅ |
| 6 | 🔗 | 🔗 | 🔗 | 🔗 | ✅ |
| 7 | Par tes amis seulement | By your friends only | Solo por tus amigos | Solo dai tuoi amici | ✅ |
| 8 | Ceux à qui tu enverras le | Those you send the link t | Aquellos a quienes envíes | Coloro a cui invierai il  | ✅ |
| 9 | 🌍 | 🌍 | 🌍 | 🌍 | ✅ |
| 10 | Par tout le monde | By everyone | Por todo el mundo | Da tutti | ✅ |
| 11 | Tout le monde sur Poteau  | Everyone on Poteau will s | Todo el mundo en Poteau v | Tutti su Poteau vedranno  | ✅ |
| 12 | Il te manque combien de j | How many players are you  | ¿Cuántos jugadores te fal | Quanti giocatori ti manca | ✅ |
| 13 | Valider | Validate | Validar | Convalidare | ✅ |

---

## e_LevelMood

**Route:** `/new/level`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: FPrice

**Displayed Text (10 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | 80% | 80% | 80% | 80% | ✅ |
| 2 | Quel est le niveau du mat | What is the level of the  | ¿Cuál es el nivel del par | Qual è il livello della p | ✅ |
| 3 | Et c\ | And what\ | ¿Y qué es lo más importan | E qual è la cosa più impo | ✅ |
| 4 | S\ | Have fun | Disfrutar | Divertirsi | ✅ |
| 5 | Tout gagner | Win everything | Ganarlo todo | Vincere tutto | ✅ |
| 6 | S\ | Have fun | Disfrutar | Divertirsi | ✅ |
| 7 | Tout gagner | Win everything | Ganarlo todo | Vincere tutto | ✅ |
| 8 | S\ | Have fun | Disfrutar | Divertirsi | ✅ |
| 9 | Tout gagner | Win everything | Ganarlo todo | Vincere tutto | ✅ |
| 10 | Valider | Validate | Validar | Convalidare | ✅ |

---

## e_Sports

**Route:** `/onboarding/sport`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: FAlert

**Displayed Text (6 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Foot, padel, les deux ? | Soccer, padel, or both? | ¿Fútbol, pádel o ambos? | Calcio, padel o entrambi? | ✅ |
| 2 | Pour le moment, Poteau t\ | For now, Poteau helps you | Por ahora, Poteau te ayud | Per ora, Poteau ti aiuta  | ✅ |
| 3 | Sélectionne au moins un s | Select at least one sport | Selecciona al menos un de | Seleziona almeno uno spor | ✅ |
| 4 | Foot | Soccer | Fútbol | Calcio | ✅ |
| 5 | Padel | Padel | Pádel | Padel | ✅ |
| 6 | Valider | Validate | Validar | Convalidare | ✅ |

---

## EditMyGame

**Route:** `/game/:gameId/edit`

**Navigation:**
- ← Comes from: GameSheet
- → Goes to: GameSheet

**Displayed Text (88 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Modifier mon match | Edit my game | Editar mi partido | Modifica la mia partita | ✅ |
| 2 | L\ | Time | Tiempo | Tempo | ✅ |
| 3 | 1 | 1 | 1 | 1 | ✅ |
| 4 | 2 | 2 | 2 | 2 | ✅ |
| 5 | 3 | 3 | 3 | 3 | ✅ |
| 6 | 4 | 4 | 4 | 4 | ✅ |
| 7 | 5 | 5 | 5 | 5 | ✅ |
| 8 | 6 | 6 | 6 | 6 | ✅ |
| 9 | 7 | 7 | 7 | 7 | ✅ |
| 10 | 8 | 8 | 8 | 8 | ✅ |
| 11 | 9 | 9 | 9 | 9 | ✅ |
| 12 | 10 | 10 | 10 | 10 | ✅ |
| 13 | 11 | 11 | 11 | 11 | ✅ |
| 14 | 12 | 12 | 12 | 12 | ✅ |
| 15 | : | : | : | : | ✅ |
| 16 | 00 | 00 | 00 | 00 | ✅ |
| 17 | 05 | 05 | 05 | 05 | ✅ |
| 18 | 10 | 10 | 10 | 10 | ✅ |
| 19 | 15 | 15 | 15 | 15 | ✅ |
| 20 | 20 | 20 | 20 | 20 | ✅ |
| 21 | 25 | 25 | 25 | 25 | ✅ |
| 22 | 30 | 30 | 30 | 30 | ✅ |
| 23 | 35 | 35 | 35 | 35 | ✅ |
| 24 | 40 | 40 | 40 | 40 | ✅ |
| 25 | 45 | 45 | 45 | 45 | ✅ |
| 26 | 50 | 50 | 50 | 50 | ✅ |
| 27 | 55 | 55 | 55 | 55 | ✅ |
| 28 | 00 | 00 | 00 | 00 | ✅ |
| 29 | AM | AM | AM | AM | ✅ |
| 30 | PM | PM | PM | PM | ✅ |
| 31 | 00 | 00 | 00 | 00 | ✅ |
| 32 | 01 | 01 | 01 | 01 | ✅ |
| 33 | 02 | 02 | 02 | 02 | ✅ |
| 34 | 03 | 03 | 03 | 03 | ✅ |
| 35 | 04 | 04 | 04 | 04 | ✅ |
| 36 | 05 | 05 | 05 | 05 | ✅ |
| 37 | 06 | 06 | 06 | 06 | ✅ |
| 38 | 07 | 07 | 07 | 07 | ✅ |
| 39 | 08 | 08 | 08 | 08 | ✅ |
| 40 | 09 | 09 | 09 | 09 | ✅ |
| 41 | 10 | 10 | 10 | 10 | ✅ |
| 42 | 11 | 11 | 11 | 11 | ✅ |
| 43 | 12 | 12 | 12 | 12 | ✅ |
| 44 | 13 | 13 | 13 | 13 | ✅ |
| 45 | 14 | 14 | 14 | 14 | ✅ |
| 46 | 15 | 15 | 15 | 15 | ✅ |
| 47 | 16 | 16 | 16 | 16 | ✅ |
| 48 | 17 | 17 | 17 | 17 | ✅ |
| 49 | 18 | 18 | 18 | 18 | ✅ |
| 50 | 19 | 19 | 19 | 19 | ✅ |
| 51 | 20 | 20 | 20 | 20 | ✅ |
| 52 | 21 | 21 | 21 | 21 | ✅ |
| 53 | 22 | 22 | 22 | 22 | ✅ |
| 54 | 23 | 23 | 23 | 23 | ✅ |
| 55 | : | : | : | : | ✅ |
| 56 | 00 | 00 | 00 | 00 | ✅ |
| 57 | 05 | 05 | 05 | 05 | ✅ |
| 58 | 10 | 10 | 10 | 10 | ✅ |
| 59 | 15 | 15 | 15 | 15 | ✅ |
| 60 | 20 | 20 | 20 | 20 | ✅ |
| 61 | 25 | 25 | 25 | 25 | ✅ |
| 62 | 30 | 30 | 30 | 30 | ✅ |
| 63 | 35 | 35 | 35 | 35 | ✅ |
| 64 | 40 | 40 | 40 | 40 | ✅ |
| 65 | 45 | 45 | 45 | 45 | ✅ |
| 66 | 50 | 50 | 50 | 50 | ✅ |
| 67 | 55 | 55 | 55 | 55 | ✅ |
| 68 | 00 | 00 | 00 | 00 | ✅ |
| 69 | La durée | Duration | La duración | La durata | ✅ |
| 70 | 30 minutes | 30 minutes | 30 minutos | 30 minuti | ✅ |
| 71 | 45 minutes | 45 minutes | 45 minutos | 45 minuti | ✅ |
| 72 | 1 heure | 1 hour | 1 hora | 1 ora | ✅ |
| 73 | 1 heure 30 | 1 hour 30 minutes | 1 hora 30 | 1 ora e 30 | ✅ |
| 74 | 2 heures | 2 hours | 2 horas | 2 ore | ✅ |
| 75 | 2 heures 30 | 2 hours 30 minutes | 2 horas 30 | 2 ore e 30 | ✅ |
| 76 | 3 heures | 3 hours | 3 horas | 3 ore | ✅ |
| 77 | Le prix à payer par perso | The price per person | El precio a pagar por per | Il prezzo da pagare a per | ✅ |
| 78 | Le prix avant réduction p | The price before discount | El precio antes de la red | Il prezzo prima della rid | ✅ |
| 79 | Le lien de paiement | The payment link | El enlace de pago | Il collegamento di pagame | ✅ |
| 80 | Le nom de la résa | Reservation name | El nombre de la reserva | Il nome della prenotazion | ✅ |
| 81 | La description | The description | La descripcion | La descrizione | ✅ |
| 82 | Par exemple :\nPetit matc | For example:\nCasual kick | Por ejemplo :\nPequeño pa | Per esempio :\nPiccola pa | ✅ |
| 83 | Le style | Style | El estilo | Lo stile | ✅ |
| 84 | 😁 Détente | 😁 Relaxation | 😁 Relajación | 😁 Relax | ✅ |
| 85 | 🏆 Compétition | 🏆 Competition | 🏆 Competencia | 🏆 Competizione | ✅ |
| 86 | Sélectionner | Select | Seleccionar | Selezionare | ✅ |
| 87 | Le niveau | The level | El nivel | Il livello | ✅ |
| 88 | Valider | Validate | Valider | Convalidare | ✅ |

---

## EditMyPhone

**Route:** `/edit/phone`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: EditMyProfile

**Displayed Text (5 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Modifier mon numéro | Edit my number | Cambiar mi numero | Cambia il mio numero | ✅ |
| 2 | Pays | Country | País | Paese | ✅ |
| 3 | Pays | Country | País | Paese | ✅ |
| 4 | Ce numéro n\ | This number is not valid. | Este número no es válido. | Questo numero non è valid | ✅ |
| 5 | Valider | Validate | Validar | Convalidare | ✅ |

---

## EditMyProfile

**Route:** `/edit`

**Navigation:**
- ← Comes from: Games, Home, EditMyPhone, Settings
- → Goes to: ValidateEmail, BPhoto, CPhone, DCity, ANickname, MyProfile, Home

**Displayed Text (35 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Modifier mon profil | Edit my profile | Modificar mi perfil | Modifica il mio profilo | ✅ |
| 2 | Complète ton profil avant | Complete your profile bef | Complete su perfil antes  | Completa il tuo profilo p | ✅ |
| 3 | Ta photo de profil | Your profile picture | Tu foto de perfil * | La tua immagine del profi | ✅ |
| 4 | On enregistre la photo… | Saving the photo... | Guardamos la foto… | Salviamo la foto... | ✅ |
| 5 | C\ | All good! | ¡Es bueno! | Va bene! | ✅ |
| 6 | On n\ | We couldn\ | No pudimos guardar la fot | Impossibile salvare la fo | ✅ |
| 7 | Le nom que tu souhaites a | The name you want to disp | El nombre que desea mostr | Il nome che desideri visu | ✅ |
| 8 | Ton vrai nom | Your real name | Tu verdadero nombre | Il tuo vero nome | ✅ |
| 9 | Ton surnom | Your nickname | Tu apodo | Il tuo soprannome | ✅ |
| 10 | Ton surnom | Your nickname | Tu apodo | Il tuo soprannome | ✅ |
| 11 | Mets la façon dont tes po | Enter the way your friend | Di cómo te llaman tus ami | Dì come ti chiamano i tuo | ✅ |
| 12 | Ton prénom | Your first name | Tu nombre * | Il tuo nome * | ✅ |
| 13 | Il y a des chiffres dans  | Are there numbers in your | ¿Hay números en tu nombre | Ci sono numeri nel tuo no | ✅ |
| 14 | Ton nom de famille | Your last name | Tu apellido * | Il tuo cognome * | ✅ |
| 15 | Il y a des chiffres dans  | Are there numbers in your | ¿Hay números en tu apelli | Ci sono numeri nel tuo co | ✅ |
| 16 | Ton numéro de téléphone | Your phone number | Tu número de teléfono * | Il tuo numero di telefono | ✅ |
| 17 | Ton adresse mail | Your email address | Su dirección de correo el | Il tuo indirizzo di posta | ✅ |
| 18 | Ta date de naissance | Your date of birth | Tu fecha de nacimiento | La tua data di nascita | ✅ |
| 19 | Ton genre | Your gender | Tu sexo | La tua gentilezza | ✅ |
| 20 | Homme | Male | Hombre | Uomo | ✅ |
| 21 | Femme | Female | Mujer | Donna | ✅ |
| 22 | Ton style de jeu préféré | Your favorite playing sty | Tu estilo de juego favori | Il tuo stile di gioco pre | ✅ |
| 23 | S\ | Have fun | Disfrutar | Divertirsi | ✅ |
| 24 | Tout gagner | Win everything | Ganarlo todo | Vincere tutto | ✅ |
| 25 | S\ | Have fun | Disfrutar | Divertirsi | ✅ |
| 26 | Tout gagner | Win everything | Ganarlo todo | Vincere tutto | ✅ |
| 27 | S\ | Have fun | Disfrutar | Divertirsi | ✅ |
| 28 | Tout gagner | Win everything | Ganarlo todo | Vincere tutto | ✅ |
| 29 | Ta ville | Your city | Tu ciudad | La tua città | ✅ |
| 30 | Tu peux modifier ta ville | You can change your city  | Puedes cambiar tu ciudad  | Puoi cambiare la tua citt | ✅ |
| 31 | Tes sports | Your sports | Tu ciudad | La tua città | ✅ |
| 32 | Foot | Soccer | Fútbol | Calcio | ✅ |
| 33 | Padel | Padel | Pádel | Padel | ✅ |
| 34 | Tu ne peux pas valider ta | You cannot validate as lo | No se puede validar mient | Non è possibile convalida | ✅ |
| 35 | Valider | Validate | Validar | Convalidare | ✅ |

---

## f_Alert

**Route:** `/onboarding/alert`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: FTeam, Home

**Displayed Text (3 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Ta 1ère alerte 🔔 | Your 1st alert 🔔 | Tu 1ª alerta 🔔 | Il tuo primo avviso 🔔 | ✅ |
| 2 | Tu recevras une invitatio | You will receive an invit | Recibirás una invitación  | Riceverai un invito non a | ✅ |
| 3 | Plus tard | Later | Más tarde | Dopo | ✅ |

---

## f_Price

**Route:** `/new/price`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: GSummaryRepeat

**Displayed Text (5 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | 90% | 90% | 90% | 90% | ✅ |
| 2 | Quel est le prix par joue | What is the price per pla | ¿Cuál es el precio por pe | Qual è il prezzo a person | ✅ |
| 3 | Il y a une réduction par  | Is there a discount compa | ¿Cuál es el precio por pe | Qual è il prezzo a person | ✅ |
| 4 | OK, c\ | OK, what\ | ¿Cuál es el precio por pe | Qual è il prezzo a person | ✅ |
| 5 | Valider | Validate | Validar | Convalidare | ✅ |

---

## f_Team

**Route:** `/team`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: Home

**Displayed Text (7 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Ton équipe Poteau 🏆 | Your Poteau team 🏆 | Tu equipo Poteau 🏆 | Il tuo team Poteau 🏆 | ✅ |
| 2 | Invite tes potes à rejoin | Invite your friends to jo | Invita a tus amigos a uni | Invita i tuoi amici a uni | ✅ |
| 3 | Comme ça, ils pourront s\ | This way, they can sign u | De esta manera podrán reg | In questo modo potranno r | ✅ |
| 4 | L\ | Preview of your invitatio | La vista previa de tu inv | L\ | ✅ |
| 5 |  t\ |  invites you to join thei |  te invita a unirte a su  |  ti invita a unirti al su | ✅ |
| 6 | Partager à mes potes | Share with my friends | Comparte con mis amigos | Condividi con i miei amic | ✅ |
| 7 | Partager plus tard | Share later | Compartir más tarde | Condividi più tardi | ✅ |

---

## FavoriteClub

**Route:** `/favoriteclub`

**Navigation:**
- ← Comes from: MyProfile
- → Goes to: MyProfile

**Displayed Text (5 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Mon club de cœur | My favorite club | Mi club del corazón | Il mio club del cuore | ✅ |
| 2 | Pas de club préféré | No favorite club | Ningún club favorito | Nessun club preferito | ✅ |
| 3 | Ton club (pro) n\ | Your club (pro) isn\ | ¿Tu club (profesional) no | Il tuo club (pro) non è n | ✅ |
| 4 | Clique ici pour le demand | Click here to request it | Haga clic aquí para solic | Clicca qui per richiederl | ✅ |
| 5 | Envoyer | Send | Enviar a | Mandare | ✅ |

---

## FavoriteSelection

**Route:** `/favoriteselection`

**Navigation:**
- ← Comes from: MyProfile
- → Goes to: (no outbound navigation)

**Displayed Text (3 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Ma sélection | My selection | Mi seleccion favorita | La mia selezione preferit | ✅ |
| 2 | Pas de sélection national | No national team selectio | Sin selección nacional | Nessuna selezione naziona | ✅ |
| 3 | Rechercher un pays… | Search for a country... | Buscar un país… | Cerca un paese… | ✅ |

---

## Features

**Route:** `/features`

**Navigation:**
- ← Comes from: Settings
- → Goes to: (no outbound navigation)

**Displayed Text (4 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Voter pour les nouveautés | Vote for new features | Vota por las nuevas funci | Vota per le nuove funzion | ✅ |
| 2 | Chaque mois, on sélection | Each month, we select one | Cada mes seleccionamos un | Ogni mese selezioniamo un | ✅ |
| 3 | Voici les dernières fonct | Here are the latest featu | Aquí están las últimas fu | Ecco le ultime funzionali | ✅ |
| 4 |   |   |   |   | ❌ |

---

## FeedbackSaved

**Route:** `/feedback/done`

**Navigation:**
- ← Comes from: GiveFeedback
- → Goes to: Home

**Displayed Text (9 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Ton match a l\ | Your game seems to have g | ¡Parece que tu partido sa | Sembra che la tua partita | ✅ |
| 2 | Ton feedback est visible  | Your feedback is visible  | Tus comentarios son visib | Il tuo feedback è visibil | ✅ |
| 3 | Merci de nous aider à con | Thank you for helping us  | Gracias por ayudarnos a c | Grazie per averci aiutato | ✅ |
| 4 | Ajoute les membres avec l | Add the members you enjoy | Agrega los miembros con l | Aggiungi i membri con cui | ✅ |
| 5 | Les problèmes sur ton mat | The issues with your game | Los problemas con tu part | I problemi con la tua par | ✅ |
| 6 | Ils apparaissent sur le p | They appear on the profil | Aparecen en el perfil de  | Appaiono sul profilo dei  | ✅ |
| 7 | Merci de nous aider à ren | Thank you for helping mak | Gracias por ayudarnos a h | Grazie per averci aiutato | ✅ |
| 8 | Tu peux ajouter les joueu | You can add players you h | Puedes agregar los jugado | Puoi aggiungere i giocato | ✅ |
| 9 | Accéder aux matchs | Access games | Acceder a partidos | Accedi alle partite | ✅ |

---

## Filter

**Route:** `/centres`

**Navigation:**
- ← Comes from: Filter
- → Goes to: Filter

**Displayed Text (2 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Filtrer les matchs | Filter games | Filtrar coincidencias | Filtrare le corrispondenz | ✅ |
| 2 | Ajouter un centre | Add a center | Agregar un centro | Aggiungi un centro | ✅ |

---

## FilterCentres

**Route:** `/addcentre`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: (no outbound navigation)

**Displayed Text (6 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Ajouter un centre préféré | Add a favorite center | Añadir un centro preferid | Aggiungi un centro prefer | ✅ |
| 2 | Les centres les plus popu | The most popular centers | Los centros más populares | I centri più frequentati | ✅ |
| 3 | Ajouter | Add | Agregar | Aggiungere | ✅ |
| 4 | Ajouté | Added | Añadido | Aggiunto | ✅ |
| 5 | Rechercher un centre | Search for a center | encontrar un centro | Trova un centro | ✅ |
| 6 | Nom du lieu, ville, adres | Place name, city, address | Nombre del lugar, ciudad, | Nome del luogo, città, in | ✅ |

---

## g_SummaryRepeat

**Route:** `/new/recap`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: InviteFriends

**Displayed Text (12 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | 99% | 99% | 99% | 99% | ✅ |
| 2 | Récap\ | Summary | Crear una partida | Creare una partita | ✅ |
| 3 | Terrain réservé | Field reserved | Campo reservado | Campo riservato | ✅ |
| 4 |  pour  |  for  |  para  |  per  | ✅ |
| 5 |  (au lieu de  |  (instead of  |  (en lugar de  |  (invece di  | ✅ |
| 6 | ) | ) | ) | ) | ✅ |
| 7 | C\ | Is it a weekly game? | ¿Es un partido semanal? | È una partita settimanale | ✅ |
| 8 | Oui, répéter ce match cha | Yes, repeat this game eve | Sí, repetir este partido  | Sì, ripeti questa partita | ✅ |
| 9 | Non, juste pour cette foi | No, just this time | No, solo por esta vez | No, solo per questa volta | ✅ |
| 10 | Modifie le nom de la résa | Edit the reservation name | Modifica el nombre de la  | Modifica il nome della pr | ✅ |
| 11 | Par exemple :\nPetit matc | For example:\nSmall resta | Por ejemplo :\nPequeño pa | Per esempio :\nPiccola pa | ✅ |
| 12 | Publier mon match | Publish my game | Crear una partida | Creare una partita | ✅ |

---

## Games

**Route:** `/games`

**Navigation:**
- ← Comes from: CitySelector, a_Create, Profile
- → Goes to: Ban, CitySelector, ValidateEmail, BPhoto, CPhone, DCity, ANickname, EditMyProfile, ConfigureAlert

**Displayed Text (1 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Ajouter une alerte | Add an alert | Agregar una alerta | Aggiungi un avviso | ✅ |

---

## GameSheet

**Route:** `/game/:gameId`

**Navigation:**
- ← Comes from: BecomeGold, EditMyGame, InviteFriends
- → Goes to: Ban, ValidateEmail, BecomeGold, MyProfile, Profile, InviteFriends, EditMyGame, Home

**Displayed Text (112 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | MATCH COMPLET | GAME FULL | PARTIDO COMPLETO | PARTITA INTERA | ✅ |
| 2 | MATCH ANNULÉ | GAME CANCELED | PARTIDO CANCELADO | PARTITA ANNULLATA | ✅ |
| 3 |  pour  |  for  |  para  |  per  | ✅ |
| 4 |  (au lieu de  |  (instead of  |  (en lugar de  |  (invece di  | ✅ |
| 5 | ) | ) | ) | ) | ✅ |
| 6 | Lien copié | Link copied | Enlace copiado | Link copiato | ✅ |
| 7 | Copier le lien | Copy the link | Copiar el enlace | Copia il link | ✅ |
| 8 | Partager | Share | Compartir | Suddividere | ✅ |
| 9 | Match privé | Private game | Partido privado | Partita privata | ✅ |
| 10 | Confirmer | Confirm | Confirmar | Conferma | ✅ |
| 11 | La feuille de match | The match sheet | Hoja del partido | Resoconto della partita | ✅ |
| 12 | Tu as envie de jouer ? | Do you want to play? | ¿Tienes ganas de jugar? | Hai voglia di giocare? | ✅ |
| 13 | Une personne veut jouer | Someone wants to play | Una persona quiere jugar | Una persona vuole giocare | ✅ |
| 14 |  personnes veulent jouer |  people want to play |  personas quieren jugar |  persone vogliono giocare | ✅ |
| 15 | Ouvrir l\ | Open access | Abrir el acceso | Apri l\ | ✅ |
| 16 | Suivre ce match | Follow this game | Seguir este partido | Segui questa partita | ✅ |
| 17 | Arrêter de suivre | Unfollow | Únete | Partecipa | ✅ |
| 18 | Inviter | Invite | Invitar | Invitare | ✅ |
| 19 | +  | +  | +  | +  | ✅ |
| 20 |  autres joueurs |  other players |  otros jugadores |  altri giocatori | ✅ |
| 21 | Le fil de discussion | The discussion thread | Hilo de discusión | Filo della discussione | ✅ |
| 22 | Karim Boudebouz | Karim Boudebouz | Karim Boudebouz | Karim Boudébouz | ✅ |
| 23 |   |   |   |   | ❌ |
| 24 | s\ | has registered. | registrado. | registrato. | ✅ |
| 25 | Pablo da Fonseca | Pablo da Fonseca | Pablo da Fonseca | Pablo da Fonseca | ✅ |
| 26 | Salut les gars, vous êtes | Hey guys, are you all rea | Hola chicos, ¿están todos | Ehi ragazzi, siete tutti  | ✅ |
| 27 | Sadio Mané | Sadio Mané | Sadio Mané | Sadio Manè | ✅ |
| 28 | Ouais c\ | Yeah, it\ | si, es bueno para mi | Sì, mi fa bene | ✅ |
| 29 | Sadio Mané | Sadio Mané | Sadio Mané | Sadio Manè | ✅ |
| 30 | Ouais c\ | Yeah, it\ | si, es bueno para mi | Sì, mi fa bene | ✅ |
| 31 | Réservé aux membres Gold | Reserved for Gold members | Reservado para miembros G | Riservato ai membri Gold | ✅ |
| 32 | Ce match est réservé aux  | This game is reserved for | Este partido está reserva | Questa partita è riservat | ✅ |
| 33 | En savoir plus | Learn more | Unete a la communidad | Unisciti alla comunità | ✅ |
| 34 | Le fil de discussion | The discussion thread | Hilo de discusión | Filo della discussione | ✅ |
| 35 | NOUVEAU SUR POTEAU\n | NEW ON POTEAU\n | NUEVO EN POTEAU\n | NUOVO SU POTEAU\n | ✅ |
| 36 | Réagis aux messages : res | React to messages: hold d | Reacciona a los mensajes: | Reagisci ai messaggi: tie | ✅ |
| 37 | Il n\ | There are no bad question | No hay preguntas malas: i | Non ci sono domande sbagl | ✅ |
| 38 | Plus d\ | More info on the game | Más info sobre el partido | Più info sulla partita | ✅ |
| 39 | 🌍 | 🌍 | 🌍 | 🌍 | ✅ |
| 40 | Visible par tout le monde | Visible to everyone | Visible para todos | Visibile a tutti | ✅ |
| 41 | Tous les membres de la co | All community members can | Todos los miembros de la  | Tutti i membri della comu | ✅ |
| 42 | Restreindre la visibilité | Restrict visibility | Restringir la visibilidad | Restringi la visibilità | ✅ |
| 43 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |
| 44 | Visible par tes amis | Visible to your friends | Visible por tus amigos | Visibile dai tuoi amici | ✅ |
| 45 | Seuls tes amis Poteau et  | Only your Poteau friends  | Solo tus amigos de Poteau | Solo i tuoi amici Poteau  | ✅ |
| 46 | Rendre visible par tous | Make visible to everyone | Hacer visible para todos | Rendi visibile a tutti | ✅ |
| 47 | Réservé aux membres Gold | Reserved for Gold members | Reservado para miembros G | Riservato ai membri Gold | ✅ |
| 48 | Ton match est très demand | Your game is in high dema | Tu partido es muy demanda | La tua partita è molto ri | ✅ |
| 49 | Pour que ce soit des joue | To ensure reliable player | Para que sean jugadores f | Per garantire che siano g | ✅ |
| 50 | L’accès s’ouvrira à tout  | Access will open to every | El acceso se abrirá para  | L\ | ✅ |
| 51 | h avant le coup d’envoi s | hr before kickoff if more | h antes del inicio si tod | h prima del calcio d’iniz | ✅ |
| 52 | Tu es membre Gold ✅ | You are a Gold member ✅ | Eres miembro Gold ✅ | Sei membro Gold ✅ | ✅ |
| 53 | Tu peux donc choisir de l | You can choose to open it | Puedes elegir abrirlo a t | Puoi quindi scegliere di  | ✅ |
| 54 | Ouvrir l\ | Open access to my game | Abrir el acceso a mi part | Aprire l\ | ✅ |
| 55 | Tu peux choisir de l\ | You can choose to open it | Puedes elegir abrirlo a t | Puoi scegliere di aprirlo | ✅ |
| 56 | En savoir plus | Learn more | Únete a la comunidad | Unisciti alla comunità | ✅ |
| 57 | N\ | Anyone can join | Cualquiera puede unirse | Chiunque può unirsi | ✅ |
| 58 | Actuellement, ton match n | Currently, your game is n | Actualmente, tu partido n | Attualmente, la tua parti | ✅ |
| 59 | On a mis en place un abon | We have set up a Gold sub | Hemos implementado una su | Abbiamo creato un abbonam | ✅ |
| 60 | On te recommande de conta | We recommend contacting t | Te recomendamos contactar | Ti consigliamo di contatt | ✅ |
| 61 | Sinon, tu peux choisir de | Otherwise, you can choose | Si no, puedes elegir rese | Altrimenti, puoi sceglier | ✅ |
| 62 | Donner la priorité aux me | Prioritize Gold members | Dar prioridad a los miemb | Dare la priorità ai membr | ✅ |
| 63 | Ton match a lieu dans moi | Your game is in less than | Tu partido es en menos de | La tua partita avrà luogo | ✅ |
| 64 | Niveau | Level | Nivel | Livello | ✅ |
| 65 | Ambiance | Atmosphere | Atmósfera | Atmosfera | ✅ |
| 66 | Détente | Relaxation | Relajación | Rilassamento | ✅ |
| 67 | Compétition | Competition | Competencia | Concorrenza | ✅ |
| 68 | Paiement | Payment | Pago | Pagamento | ✅ |
| 69 | Sur l\ | On the app | En la aplicación | Sull\ | ✅ |
| 70 | En ligne | Online | En línea | In linea | ✅ |
| 71 | Sur place | On-site | En el sitio | Sul posto | ✅ |
| 72 | Lien de paiement | Payment link | Enlace de pago: | Link per il pagamento: | ✅ |
| 73 | Ajouter le lien de paieme | Add payment link | Agregar el enlace de pago | Aggiungi il link di pagam | ✅ |
| 74 | Clique ici pour payer ta  | Click here to pay your sh | Haga clic aquí para pagar | Clicca qui per pagare la  | ✅ |
| 75 | Ce match est géré par le  | This game is managed by t | Partido organizado por el | Partita organizzata dal c | ✅ |
| 76 | Description | Description | Descripción: | Descrizione: | ✅ |
| 77 | Nom de la réservation | Reservation name | Nombre de la reserva: | Nome della prenotazione: | ✅ |
| 78 | Quitter le match | Leave the game | Salir del partido | Lasciare la partita | ✅ |
| 79 | Annuler mon match | Cancel my game | Cancelar mi partido | Annulla la mia partita | ✅ |
| 80 | Tu viens juste de publier | You just posted your game | Acabas de publicar tu par | Hai appena pubblicato la  | ✅ |
| 81 | Modifier le match | Edit the game | Cancelar el partido | Annulla la partita | ✅ |
| 82 | Annuler le match | Cancel the game | Cancelar el partido | Annulla la partita | ✅ |
| 83 | Plus d\ | More info on  | Más información sobre  | Più info su  | ✅ |
| 84 | Adresse | Address | Dirección: | Indirizzo: | ✅ |
| 85 | La feuille de match | The match sheet | Hoja del partido | Resoconto della partita | ✅ |
| 86 | Match privé | Private game | Partido privado | Partita privata | ✅ |
| 87 | La feuille de match | The match sheet | Hoja del partido | Resoconto della partita | ✅ |
| 88 | Dernière place dispo | Last spot available | Último lugar disponible � | Ultimo posto disponibile  | ✅ |
| 89 | Plus que  | More than  | ¡Solo quedan  | Solo  | ✅ |
| 90 |  places dispo |  spots available |  lugares! |  posti disponibili | ✅ |
| 91 | Plus d\ | More info on  | Más información sobre  | Più info su  | ✅ |
| 92 | Adresse | Address | Dirección: | Indirizzo: | ✅ |
| 93 | Fais un match à  | Play a game at  | Juega al fútbol en  | Gioca a calcio al  | ✅ |
| 94 |  avec Poteau 👟 |  with Poteau 👟 |  con Poteau 👟 |  con Poteau 👟 | ✅ |
| 95 | Envie d’un match sans te  | Want a game without break | ¿Quieres jugar un partido | Cerchi una partita senza  | ✅ |
| 96 | Par exemple, à  | For example, at  | Por ejemplo, en  | Ad esempio, al  | ✅ |
| 97 | , tu peux jouer pour  | ❌ | ❌ | ❌ | ⚠️ |
| 98 | . | . | . | . | ✅ |
| 99 | L\ | The Poteau app lets you s | La app de Poteau te muest | L’app Poteau ti mostra tu | ✅ |
| 100 | 👉 Plus d\ | 👉 More info on  | 👉 Más información sobre  | 👉 Maggiori informazioni  | ✅ |
| 101 | poteau-app.com | poteau-app.com | poteau-app.com | poteau-app.com | ✅ |
| 102 | Rendez-vous sur l\ | Go to the Poteau app to j | Mira la app de Poteau par | Guarda l’app Poteau per t | ✅ |
| 103 | Ouvrir dans l\ | Open in the app | Abrir en la app | Apri nell’app | ✅ |
| 104 | Télécharger | Download | Descarga la aplicación | Scarica l\ | ✅ |
| 105 | Tu ne peux pas rejoindre  | You cannot join this game | Último lugar disponible � | Ultimo posto disponibile  | ✅ |
| 106 | Dernière place dispo | Last spot available | Último lugar disponible � | Ultimo posto disponibile  | ✅ |
| 107 | Plus qu\ | Only one player to find | Último lugar disponible � | Ultimo posto disponibile  | ✅ |
| 108 | Dernière place dispo | Last spot available | Último lugar disponible � | Ultimo posto disponibile  | ✅ |
| 109 | Plus que  | More than  | ¡Solo quedan  | Solo  | ✅ |
| 110 |  joueurs à trouver |  players to find |  lugares! |  posti disponibili | ✅ |
| 111 | Plus que  | More than  | ¡Solo quedan  | Solo  | ✅ |
| 112 |  places dispo |  spots available |  lugares! |  posti disponibili | ✅ |

---

## GiveFeedback

**Route:** `/feedback`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: FeedbackSaved

**Displayed Text (3 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Noter mon match | Rate my game | Califica mi partido | Valuta la mia partita | ✅ |
| 2 | Les participants | Participants | Los participantes | I partecipanti | ✅ |
| 3 | Valider | Validate | Validar | Convalidare | ✅ |

---

## Home

**Route:** `/home`

**Navigation:**
- ← Comes from: f_Alert, f_Team, CitySelector, ConfigureAlert, a_Create, GameSheet, FeedbackSaved, Credits, EditMyProfile, Notifications, Contacts
- → Goes to: Ban, ValidateEmail, BPhoto, CPhone, DCity, ANickname, ESports, EditMyProfile, ACreate, FTeam

**Displayed Text (7 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Matchs | Games | Partidos | Partite | ✅ |
| 2 | Invitations | Invitations | Alertas e invitaciones | Avvisi e inviti | ✅ |
| 3 | Ton équipe | Your team | Clasificación Poteau | Classifica Poteau | ✅ |
| 4 | Construire mon équipe Pot | Build my Poteau team | Clasificar a mis amigos | Classificare i miei amici | ✅ |
| 5 | Deviens membre Poteau Gol | Become a Poteau Gold memb | Conviértete en miembro de | Diventa un membro Poteau  | ✅ |
| 6 | Fais partie des meilleurs | Join the best Poteau user | Conviértete en uno de los | Diventa uno dei migliori  | ✅ |
| 7 | En savoir plus | Learn more | Más información | Saperne di più | ✅ |

---

## InviteFriends

**Route:** `/game/:gameId/invite`

**Navigation:**
- ← Comes from: g_SummaryRepeat, GameSheet
- → Goes to: GameSheet

**Displayed Text (6 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Compléter le match | Complete the game | Invitar jugadores | Invita giocatori | ✅ |
| 2 | Partager à mes amis | Share with my friends | Compartir con mis amigos | Condividi con i miei amic | ✅ |
| 3 | Envoie une invitation à t | Send an invitation to you | Envía una invitación a tu | Invia un invito ai tuoi a | ✅ |
| 4 | Envoyer le match | Send the game | Comparte el partido | Condividi la partita | ✅ |
| 5 | Mon équipe sur Poteau | My team on Poteau | Mi equipo en Poteau | La mia squadra su Poteau | ✅ |
| 6 | Invite les membres de ton | Invite your Poteau team m | Invita a los miembros de  | Invita i membri della tua | ✅ |

---

## Invoices

**Route:** `/invoices`

**Navigation:**
- ← Comes from: Settings
- → Goes to: (no outbound navigation)

**Displayed Text (4 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Tes factures pour les mat | Your invoices for Poteau  | Tus facturas de partidos  | Le tue fatture per i fiam | ✅ |
| 2 | Paiement confirmé | Payment confirmed | Pago confirmado | Pagamento confermato | ✅ |
| 3 | Paiement annulé | Payment canceled | Pago cancelado | Pagamento annullato | ✅ |
| 4 | Autorisation validée | Authorization validated | Autorización validada | Autorizzazione convalidat | ✅ |

---

## Landing

**Route:** `/welcome`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: CreateAccount

**Displayed Text (8 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | 🇫🇷 | 🇫🇷 | 🇫🇷 | 🇫🇷 | ✅ |
| 2 | 🇺🇸 | 🇺🇸 | 🇺🇸 | 🇺🇸 | ✅ |
| 3 | 🇪🇸 | 🇪🇸 | 🇪🇸 | 🇪🇸 | ✅ |
| 4 | 🇮🇹 | 🇮🇹 | 🇮🇹 | 🇮🇹 | ✅ |
| 5 | Continuer par email (5min | Continue by email (5min) | Continuar por correo elec | Continua via e-mail (4 mi | ✅ |
| 6 | En quelques secondes | In a few seconds | En unos segundos | Tra pochi secondi | ✅ |
| 7 | Continuer avec Apple | Continue with Apple | Continuar con Apple | Continua con Apple | ✅ |
| 8 | Continuer avec Google | Continue with Google | Continuar con Google | Continua con Google | ✅ |

---

## LandingInvite

**Route:** `/invite`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: (no outbound navigation)

**Displayed Text (8 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Poteau | Poteau | Poteau | Poteau | ✅ |
| 2 | 4.7 | 4.7 | 4.7 | 4.7 | ✅ |
| 3 | Voir l\ | View the app | Ver la aplicación | Visualizza l\ | ✅ |
| 4 | veut que tu rejoignes | wants you to join | quiere que te unas | vuole che tu ti unisca | ✅ |
| 5 | sur Poteau | on Poteau | en Poteau | su Poteau | ✅ |
| 6 | Continuer avec Apple | Continue with Apple | Continuar con Apple | Continua con Apple | ✅ |
| 7 | Continuer avec Google | Continue with Google | Continuar con Google | Continua con Google | ✅ |
| 8 | Continuer par email (3min | Continue by email (3min) | Continuar por correo elec | Continua via e-mail (3 mi | ✅ |

---

## LevelPickRole

**Route:** `/level/role`

**Navigation:**
- ← Comes from: MyProfile
- → Goes to: (no outbound navigation)

**Displayed Text (5 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | On est sur le terrain.\nT | We\ | Estamos en el campo.\n¿Dó | Siamo sul campo.\nDove gi | ✅ |
| 2 | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE | ✅ |
| 3 | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE | ✅ |
| 4 | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA | ✅ |
| 5 | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE | ✅ |

---

## LevelQuestion

**Route:** `/level/question`

**Navigation:**
- ← Comes from: LevelStart
- → Goes to: (no outbound navigation)

**Displayed Text (5 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | PADEL | PADEL | PADEL | PADEL | ✅ |
| 2 | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE | ✅ |
| 3 | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE | ✅ |
| 4 | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA | ✅ |
| 5 | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE | ✅ |

---

## LevelReveal

**Route:** `/level/reveal`

**Navigation:**
- ← Comes from: MyProfile
- → Goes to: (no outbound navigation)

**Displayed Text (16 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | PADEL | PADEL | PADEL | PADEL | ✅ |
| 2 | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE | ✅ |
| 3 | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE | ✅ |
| 4 | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA | ✅ |
| 5 | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE | ✅ |
| 6 | PADEL | PADEL | PADEL | PADEL | ✅ |
| 7 | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE | ✅ |
| 8 | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE | ✅ |
| 9 | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA | ✅ |
| 10 | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE | ✅ |
| 11 | Partage ton score | Share your score | Muestra tu puntuación | Mostra il tuo punteggio | ✅ |
| 12 | poteau.app/quiz | poteau.app/quiz | poteau.app/quiz | poteau.app/quiz | ✅ |
| 13 | Voir mon profil | View my profile | Ver mi perfil | Visualizza il mio profilo | ✅ |
| 14 | Supprimer mon score | Delete my score | Eliminar mi puntuación | Elimina il mio punteggio | ✅ |
| 15 | Télécharger Poteau | Download Poteau | Muestra tu puntuación | Mostra il tuo punteggio | ✅ |
| 16 | poteau.app/quiz | poteau.app/quiz | poteau.app/quiz | poteau.app/quiz | ✅ |

---

## LevelSelfScore

**Route:** `/level/selfscore`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: (no outbound navigation)

**Displayed Text (8 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | PADEL | PADEL | PADEL | PADEL | ✅ |
| 2 | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE | ✅ |
| 3 | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE | ✅ |
| 4 | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA | ✅ |
| 5 | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE | ✅ |
| 6 | Ça y est !  | That\ | ¡Eso es!  | Ecco fatto!   | ✅ |
| 7 | On a estimé ton niveau av | We estimated your soccer  | Hemos estimado tu nivel c | Abbiamo stimato il tuo li | ✅ |
| 8 | Avant qu’on te le dise,\n | Before anyone tells you,\ | Antes de que te lo digamo | Prima che te lo diciamo,\ | ✅ |

---

## LevelStart

**Route:** `/level/start`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: LevelQuestion

*No translation keys found in this screen (may use dynamic content or components)*

---

## LevelTempoUsers

**Route:** `/level/phone`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: (no outbound navigation)

**Displayed Text (5 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Tape ton numéro de téléph | Enter your phone number t | Introduce tu número de te | Inserisci il tuo numero d | ✅ |
| 2 | Tu pourras relier ton sco | You can link your score w | Podrás vincular tu puntua | Potrai collegare il tuo p | ✅ |
| 3 | Pays | Country | País | Paese | ✅ |
| 4 | Pays | Country | País | Paese | ✅ |
| 5 | Découvrir mon score | Discover my score | Descubre mi puntuación | Scopri il mio punteggio | ✅ |

---

## LogIn

**Route:** `/connect`

**Navigation:**
- ← Comes from: CreateAccount
- → Goes to: (no outbound navigation)

**Displayed Text (6 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Connexion | Login | Acceso | Login | ✅ |
| 2 | Entre ton adresse mail | Enter your email address | Introduce tu dirección de | Inserisci il tuo indirizz | ✅ |
| 3 | Et ton mot de passe | And your password | Y tu contraseña | E la tua password | ✅ |
| 4 | Entre ton adresse mail av | Enter your email address  | Ingrese su dirección de c | Inserisci il tuo indirizz | ✅ |
| 5 | Mot de passe oublié | Forgot password | ¿Olvidaste tu contraseña? | Hai dimenticato la passwo | ✅ |
| 6 | Valider | Validate | Validar | Convalidare | ✅ |

---

## ManageAlerts

**Route:** `/managealerts`

**Navigation:**
- ← Comes from: ConfigureAlert, Settings
- → Goes to: ConfigureAlert

**Displayed Text (3 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Gérer mes alertes | Manage my alerts | Administrar mis alertas | Gestisci i miei avvisi | ✅ |
| 2 | Aucune alerte pour le mom | No alerts at the moment | No hay alertas por el mom | Nessun avviso al momento | ✅ |
| 3 | Ajouter une alerte | Add an alert | Agregar una alerta | Aggiungi un avviso | ✅ |

---

## MyProfile

**Route:** `/me`

**Navigation:**
- ← Comes from: BecomeGold, GameSheet, EditMyProfile, FavoriteClub, Profile
- → Goes to: Ban, Settings, LevelReveal, LevelPickRole, FavoriteClub, FavoriteSelection

**Displayed Text (16 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE | ✅ |
| 2 | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE | ✅ |
| 3 | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA | ✅ |
| 4 | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE | ✅ |
| 5 | PADEL | PADEL | PADEL | PADEL | ✅ |
| 6 | joue pour | plays for | juega para | gioca per | ✅ |
| 7 | S\ | Have fun | Disfrutar | Divertirsi | ✅ |
| 8 | Tout gagner | Win everything | Ganarlo todo | Vincere tutto | ✅ |
| 9 | Ajouter un objectif | Add a goal | Añadir un objetivo | Aggiungi un obiettivo | ✅ |
| 10 | supporte | support | apoya | supporta | ✅ |
| 11 | Ajouter un club | Add a club | Añadir un club | Aggiungi un club | ✅ |
| 12 | Ajouter une sélection | Add a selection | Agregar una selección | Aggiungi una selezione | ✅ |
| 13 | On enregistre la photo… | Saving the photo... | Guardamos la foto… | Salviamo la foto... | ✅ |
| 14 | C\ | All good! | ¡Es bueno! | Va bene! | ✅ |
| 15 | On n\ | We couldn\ | No pudimos guardar la fot | Impossibile salvare la fo | ✅ |
| 16 | Partager | Share | Compartir | Suddividere | ✅ |

---

## Notifications

**Route:** `/notifications`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: Home

**Displayed Text (2 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Notifications | Notifications | Notificaciones | Notifiche | ✅ |
| 2 | Aucune notification reçue | No notifications received | Ninguna notificación reci | Nessuna notifica ricevuta | ✅ |

---

## Profile

**Route:** `/user/:thisUser`

**Navigation:**
- ← Comes from: GameSheet
- → Goes to: MyProfile, Games

**Displayed Text (12 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE | ✅ |
| 2 | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE | ✅ |
| 3 | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA | ✅ |
| 4 | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE | ✅ |
| 5 | PADEL | PADEL | PÁDEL | PADEL | ✅ |
| 6 | joue pour | plays for | juega para | gioca per | ✅ |
| 7 | S\ | Have fun | Disfrutar | Divertirsi | ✅ |
| 8 | Tout gagner | Win everything | Ganarlo todo | Vincere tutto | ✅ |
| 9 | supporte | support | apoya | supporta | ✅ |
| 10 | On enregistre la photo… | Saving the photo... | Guardamos la foto… | Salviamo la foto... | ✅ |
| 11 | C\ | All good! | ¡Es bueno! | Va bene! | ✅ |
| 12 | On n\ | We couldn\ | No pudimos guardar la fot | Impossibile salvare la fo | ✅ |

---

## Settings

**Route:** `/settings`

**Navigation:**
- ← Comes from: MyProfile
- → Goes to: BecomeGold, EditMyProfile, ManageAlerts, Invoices, Credits, Features

**Displayed Text (48 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Devenir Poteau Gold | Become Poteau Gold | Convertirse en Poteau Gol | Diventa Poteau Gold | ✅ |
| 2 | Fais partie des meilleurs | Join the best Poteau user | Conviértete en uno de los | Diventa uno dei migliori  | ✅ |
| 3 | Mes réglages | My settings | Mis ajustes | Le mie impostazioni | ✅ |
| 4 | Modifier mon profil | Edit my profile | Modificar mi perfil | Modifica il mio profilo | ✅ |
| 5 | ✏️ | ✏️ | ✏️ | ✏️ | ✅ |
| 6 | Personnalise ton profil e | Customize your profile an | Personaliza tu perfil y g | Personalizza il tuo profi | ✅ |
| 7 | Gérer mes alertes | Manage my alerts | Administrar mis alertas | Gestisci i miei avvisi | ✅ |
| 8 | 🔔 | 🔔 | 🔔 | 🔔 | ✅ |
| 9 | Reçois des invitations po | Receive invitations to pl | Recibe invitaciones para  | Ricevi inviti per giocare | ✅ |
| 10 | Gérer mes notifications | Manage my notifications | Gestionar mis notificacio | Gestisci le mie notifiche | ✅ |
| 11 | 📳 | 📳 | 📳 | 📳 | ✅ |
| 12 | Tu préfères recevoir tes  | How would you prefer to r | ¿Prefieres recibir tus no | Preferisci ricevere le tu | ✅ |
| 13 | Push | Push | Push | Push | ✅ |
| 14 | Push | Push | Push | Push | ✅ |
| 15 | Email | Email | Correo electrónico | Email | ✅ |
| 16 | Email | Email | Correo electrónico | Email | ✅ |
| 17 | 🧾 | 🧾 | 🧾 | 🧾 | ✅ |
| 18 | Changer le langage | Change language | Cambiar el idioma | Cambia lingua | ✅ |
| 19 | 🌍 | 🌍 | 🌍 | 🌍 | ✅ |
| 20 | Tu ne veux plus que l\ | Don\ | ¿Ya no quieres que la app | Non vuoi più che l\ | ✅ |
| 21 | 🇫🇷 | 🇫🇷 | 🇫🇷 | 🇫🇷 | ✅ |
| 22 | 🇺🇸 | 🇺🇸 | 🇺🇸 | 🇺🇸 | ✅ |
| 23 | 🇪🇸 | 🇪🇸 | 🇪🇸 | 🇪🇸 | ✅ |
| 24 | 🇮🇹 | 🇮🇹 | 🇮🇹 | 🇮🇹 | ✅ |
| 25 | Comment soutenir Poteau ? | How to support Poteau? | ¿Cómo apoyar a Poteau? | Come sostenere Poteau? | ✅ |
| 26 | Suivre Poteau sur Insta | Follow Poteau on Insta | Sigue a Poteau en Insta | Segui Poteau su Insta | ✅ |
| 27 | Suivre Poteau sur TikTok | Follow Poteau on TikTok | Sigue a Poteau en TikTok | Segui Poteau su TikTok | ✅ |
| 28 | Donner de la force | Give strength | Dar fuerza | Dare forza | ✅ |
| 29 | 💪 | 💪 | 💪 | 💪 | ✅ |
| 30 | Si tu veux soutenir Potea | If you want to support Po | Si quieres apoyar a Potea | Se vuoi supportare Poteau | ✅ |
| 31 | Nos remerciements | Our thanks | Nuestros agradecimientos | I nostri ringraziamenti | ✅ |
| 32 | 🦸‍♂️ | 🦸‍♂️ | 🦸‍♂️ | 🦸‍♂️ | ✅ |
| 33 | Retrouve celles et ceux s | Find those without whom P | Encuentra a aquellos sin  | Ritrova coloro senza i qu | ✅ |
| 34 | Besoin d\ | Need help? | ¿Necesitas ayuda? | Hai bisogno di aiuto? | ✅ |
| 35 | Vos questions sur Poteau | Your questions about Pote | Tus preguntas sobre Potea | Le tue domande su Poteau | ✅ |
| 36 | ❓ | ❓ | ❓ | ❓ | ✅ |
| 37 | Voter pour les nouveautés | Vote for new features | Vota por las nuevas funci | Vota per le nuove funzion | ✅ |
| 38 | 🗳️ | 🗳️ | 🗳️ | 🗳️ | ✅ |
| 39 | Aide-nous à choisir les p | Help us choose the next a | Ayúdanos a elegir las pró | Aiutaci a scegliere le pr | ✅ |
| 40 | Nous envoyer un message | Send us a message | Envíanos un mensaje | Inviaci un messaggio | ✅ |
| 41 | 💬 | 💬 | 💬 | 💬 | ✅ |
| 42 | Il y a un problème que tu | Is there a problem you\ | ¿Hay un problema que está | C\ | ✅ |
| 43 | Tape ton message ici… | Type your message here… | Escribe tu mensaje aquí… | Scrivi il tuo messaggio q | ✅ |
| 44 | Envoyer | Send | Enviar | Inviare | ✅ |
| 45 | Se déconnecter | Log out | Cerrar sesión | Disconnettersi | ✅ |
| 46 | Lire les conditions génér | Read the terms and condit | Leer los términos y condi | Leggi i termini e condizi | ✅ |
| 47 | Lire la politique de conf | Read the privacy policy | Leer la política de priva | Leggi l\ | ✅ |
| 48 | Supprimer mon compte | Delete my account | Eliminar mi cuenta | Elimina il mio account | ✅ |

---

## ValidateEmail

**Route:** `/emailvalidation`

**Navigation:**
- ← Comes from: Games, Home, GameSheet, EditMyProfile
- → Goes to: Ban

**Displayed Text (3 items):**

| # | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian | Status |
|---|-----------|------------|------------|------------|--------|
| 1 | Valide ton email | Verify your email | Valida tu email | Conferma la tua email | ✅ |
| 2 | On a envoyé un code à 4 c | We sent a 4-digit code to | Hemos enviado un código d | Abbiamo inviato un codice | ✅ |
| 3 | . Entre-le ci-dessous pou | . Enter it below to conti | . Introdúcelo abajo para  | . Inseriscilo qui sotto p | ✅ |

---


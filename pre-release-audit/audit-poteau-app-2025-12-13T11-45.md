# 🎯 ACTION REQUIRED - Poteau App (B2C)

Generated: 12/13/2025, 12:45:32 PM

---

## Release Status: 🟢 READY

All translations are complete.

**Coverage:** 100% (938/938 keys complete)

---

## By Language

🇪🇸 **Spanish**: 100% complete (0 missing) ✅
🇮🇹 **Italian**: 100% complete (0 missing) ✅
🇬🇧 **English**: 100% complete (0 missing) ✅
🇫🇷 **French**: 100% complete (0 missing) ✅

---

## ⚠️ Leading/Trailing Space Issues (5 keys)

These have leading or trailing spaces in French but not in other languages (UI issue):

| Key | French Text | Issue |
|-----|-------------|-------|
| `ghw93olh` | "Ton match est très demandé : o" | Missing trailing space in: EN, ES, IT |
| `mcjurwtf` | "Invite tes potes à rejoindre t" | Missing trailing space in: EN, ES, IT |
| `vg8tl1qe` | "Invite tes potes à rejoindre t" | Missing trailing space in: EN, ES, IT |
| `y29wv7fw` | "Sélectionne la raison pour laq" | Missing trailing space in: EN, ES, IT |
| `qvbpnac5` | "J'ai compris " | Missing trailing space in: ES |

---

## Quick Action Checklist

- [ ] Fix 5 space issues (see table above)
- [ ] Re-run audit after fixes: `audit-poteau` or `audit-poteau-max`


---

# 📋 Detailed Analysis

# Pre-Release Audit Report

**App:** Poteau App (B2C)
**Generated:** 2025-12-13T11-45
**Tool Version:** 1.0.0

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Translation Keys | 938 |
| Complete (all 4 languages) | 938 (100%) |
| Partial (missing some) | 0 |
| Empty (all languages) | 0 |

### Coverage by Language

| Language | Filled | Empty | Coverage |
|----------|--------|-------|----------|
| French (fr) | 938 | 0 | 100% |
| English (en) | 938 | 0 | 100% |
| Spanish (es) | 938 | 0 | 100% |
| Italian (it) | 938 | 0 | 100% |

---

## 🚨 Critical Issues (Empty Translations)

---

## ⚠️ Leading/Trailing Space Mismatch (UI Issue)

These translations have leading or trailing spaces in French but not in other languages.
This can cause UI alignment issues when text is concatenated.

| Key ID | FR Text | Issue |
|--------|---------|-------|
| `ghw93olh` | "Ton match est très demandé : o" | Missing trailing space in: EN, ES, IT |
| `mcjurwtf` | "Invite tes potes à rejoindre t" | Missing trailing space in: EN, ES, IT |
| `vg8tl1qe` | "Invite tes potes à rejoindre t" | Missing trailing space in: EN, ES, IT |
| `y29wv7fw` | "Sélectionne la raison pour laq" | Missing trailing space in: EN, ES, IT |
| `qvbpnac5` | "J'ai compris " | Missing trailing space in: ES |

---

## 📱 Screen-by-Screen Analysis

**Screens with issues:** 0  
**Clean screens:** 52

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

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `55m1mks8` | Publier mon match | Publish my game | Crear una partida | Creare una partita |
| ✅ | 2 | `d45o0mw9` | Tu organises un match de  | What kind of game are you | ¿Organizas un partido de  | Che tipo di partita organ |
| ✅ | 3 | `0117ye8q` | Foot | Soccer | Fútbol | Calcio |
| ✅ | 4 | `92s7zrk8` | Padel | Padel | Pádel | Padel |
| ✅ | 5 | `fq063upp` | Foot | Soccer | Fútbol | Calcio |
| ✅ | 6 | `4pvml5y7` | Padel | Padel | Pádel | Padel |
| ✅ | 7 | `sjvebma2` | Foot | Soccer | Fútbol | Calcio |
| ✅ | 8 | `cpkxc9uy` | Padel | Padel | Pádel | Padel |
| ✅ | 9 | `y3p5audp` | Tu as déjà un terrain  | You already have a field  | Primero, ¿tienes terreno  | Innanzitutto, hai un terr |
| ✅ | 10 | `1mkj96wt` | réservé | reserved |  reservado |  prenotato |
| ✅ | 11 | `r93zwnyu` |  pour ton match ? |  for your game? |  para tu partido? |  per la tua partita? |
| ✅ | 12 | `b0wzce2j` | Oui, je l'ai réservé | Yes, I reserved it | Sí, ya lo he reservado | Sì, l'ho già prenotato |
| ✅ | 13 | `hg6geiee` | Non, pas encore | No, not yet | No, aún no | No, non ancora |
| ✅ | 14 | `tdg3w2rs` | Oui, je l'ai réservé | Yes, I reserved it | Sí, ya lo he reservado | Sì, l'ho già prenotato |
| ✅ | 15 | `rj0cxne2` | Non, pas encore | No, not yet | No, aún no | No, non ancora |
| ✅ | 16 | `6l2hxaji` | Oui, je l'ai réservé | Yes, I reserved it | Sí, ya lo he reservado | Sì, l'ho già prenotato |
| ✅ | 17 | `zx6yjsz0` | Non, pas encore | No, not yet | No, aún no | No, non ancora |
| ✅ | 18 | `yh8q9i31` | Super ! C'est un lieu dan | Great! Is this a place wh | ¡Excelente! ¿Donde está l | Eccellente! Dove si trova |
| ✅ | 19 | `zsk448l1` | Sélectionner un autre lie | Select another location | Seleccionar ubicación | Seleziona la posizione |
| ✅ | 20 | `mjy3sbrl` | Super ! Dans quel lieu se | Great! Where is it locate | ¡Excelente! ¿Donde está l | Eccellente! Dove si trova |
| ✅ | 21 | `1y3dpe7f` | Sélectionner le lieu | Select the location | Seleccionar ubicación | Seleziona la posizione |

---

## a_Nickname

**Route:** `/onboarding/firstname`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: BPhoto

**Displayed Text (4 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `9ozm2tvr` | Bienvenue sur Poteau ⚽️ | Welcome to Poteau ⚽️ | Bienvenido a Posteau ⚽️ | Benvenuti a Posteau ⚽️ |
| ✅ | 2 | `b2zaytdh` | On a besoin de quelques i | We need some basic info s | Necesitamos información b | Abbiamo bisogno di alcune |
| ✅ | 3 | `xx41c2t7` | Quel est ton surnom ? | What's your nickname? | ¿Cuál es tu verdadero nom | Qual è il tuo vero nome? |
| ✅ | 4 | `np052a8l` | Valider | Validate | Validar | Convalidare |

---

## b_Location

**Route:** `/new/center`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: ACreate, CitySelector

**Displayed Text (1 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `z5q9kvcs` | Nom du lieu, ville, adres | Place name, city, address | Nombre del lugar, ciudad, | Nome del luogo, città, in |

---

## b_Photo

**Route:** `/onboarding/picture`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: CPhone

**Displayed Text (8 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `pbp2yhbl` | Ta photo de profil 📸 | Your profile picture 📸 | Tu foto de perfil 📸 | La tua immagine del profi |
| ✅ | 2 | `6xa0l1dq` | Mets une photo avec ton v | Add a photo with your fac | Publica una foto con tu c | Pubblica una foto con il  |
| ✅ | 3 | `35zqwqpq` | Si tu as refusé l'accès à | If you denied access to y | Si ha rechazado el acceso | Se hai rifiutato l'access |
| ✅ | 4 | `6chfx6ll` | Ouvrir mes réglages | Open my settings | abrir mi configuración | Apri le mie impostazioni |
| ✅ | 5 | `v7i2q6s5` | On enregistre la photo… | Saving the photo... | Guardamos la foto… | Salviamo la foto... |
| ✅ | 6 | `3fbtz7di` | C'est bon ! | All good! | ¡Es bueno! | Va bene! |
| ✅ | 7 | `6g7dpxss` | On n'a pas réussi à enreg | We couldn't save the phot | No pudimos guardar la fot | Impossibile salvare la fo |
| ✅ | 8 | `c3wpgylv` | Choisir ma photo | Choose my photo | Elegir mi foto | Scegli la mia foto |

---

## Ban

**Route:** `/out`

**Navigation:**
- ← Comes from: ValidateEmail, Games, Home, MyProfile, a_Create, GameSheet
- → Goes to: (no outbound navigation)

**Displayed Text (6 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `hpi9amoq` | Cette décision a été pris | This decision was made af | Esta decisión se tomó lue | Questa decisione è stata  |
| ✅ | 2 | `fmnxi3zj` | Le fair-play et le respec | Fair play and respect are | El juego limpio y el resp | Fair play e rispetto sono |
| ✅ | 3 | `hg3kzfmp` | Nous sommes désolés d'avo | We are sorry to have made | Lamentamos haber tomado e | Siamo spiacenti di aver p |
| ✅ | 4 | `7eztsg0f` | Cette décision n'est pas  | This decision is not yet  | Esta decisión aún no es d | Questa decisione non è an |
| ✅ | 5 | `b0947559` | Lorsque nous penserons qu | When we think you've had  | Cuando creamos que ha ten | Quando riteniamo che tu a |
| ✅ | 6 | `9gx0otix` | L'équipe Poteau | The Poteau team | El equipo Poteau | La squadra di Poteau |

---

## BecomeGold

**Route:** `/gold`

**Navigation:**
- ← Comes from: GameSheet, Settings
- → Goes to: MyProfile, GameSheet

**Displayed Text (39 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `x32dawoy` | C'est ton match. Choisis  | It's your game. Choose wh | Es tu partido. Elige quié | È la tua partita. Scegli  |
| ✅ | 2 | `c33fs487` | En devenant membre Gold,  | By becoming a Gold member | Al convertirte en miembro | Diventando membro Gold, a |
| ✅ | 3 | `moaj7ald` | 📸 | 📸 | 🤔 | 🤔 |
| ✅ | 4 | `xedtnaa7` | Ajouter des photos dans l | Add photos to the discuss | Agregar fotos en la conve | Aggiungi foto nella discu |
| ✅ | 5 | `p427pkqv` | 🤔 | 🤔 | 🤔 | 🤔 |
| ✅ | 6 | `hhjwtogu` | Choisir si ton match est  | Choose if your game is fo | Elige si tu partido es re | Scegli se la tua partita  |
| ✅ | 7 | `lxr4hiy4` | 👋 | 👋 | 👋 | 👋 |
| ✅ | 8 | `iwbhp92a` | Retirer des joueurs de te | Remove players from your  | Retirar jugadores de tus  | Rimuovi giocatori dalle t |
| ✅ | 9 | `47587mr0` | 🔥 | 🔥 | 🔥 | 🔥 |
| ✅ | 10 | `ef1oavrf` | Rejoindre les meilleurs m | Join the best games exclu | Accede a todos los partid | Accedi a tutte le partite |
| ✅ | 11 | `teljel9e` | 💰 | 💰 | 💰 | 💰 |
| ✅ | 12 | `frn8zjp6` | Payer tes matchs moins ch | Pay less for your games  | Paga menos por tus partid | Paga meno per le tue part |
| ✅ | 13 | `7i5y0qhz` | sur les matchs avec paiem | on games with in-app paym | Paga menos por tus partid | Paga meno per le tue part |
| ✅ | 14 | `xlgazvo1` | 🎁 | 🎁 | 🎁 | 🎁 |
| ✅ | 15 | `io8tqxbq` | Recevoir des cadeaux excl | Receive exclusive gifts | Recibe regalos exclusivos | Ricevi regali esclusivi ( |
| ✅ | 16 | `nj3ryi4w` | Invitations VIP, maillots | VIP invitations, soccer j | Paga menos por tus partid | Paga meno per le tue part |
| ✅ | 17 | `vcdltsth` | Avoir le statut Gold part | Get Gold status everywher | Tener la insignia Dorada  | Avere il badge Gold sul t |
| ✅ | 18 | `mahsyof3` | Choisis ton abonnement : | Choose your subscription: | Elige tu suscripción: | Scegli il tuo abbonamento |
| ✅ | 19 | `oypkui55` | Hebdo | Weekly | Semanal | Settimanale |
| ✅ | 20 | `infayyyc` | /semaine | /week | /semana | /settimana |
| ✅ | 21 | `ic7n2cr3` | Mensuel | Monthly | Mensual | Mensile |
| ✅ | 22 | `x99jm7u1` | /semaine | /week | /semana | /settimana |
| ✅ | 23 | `pie8qe5u` | Annuel | Annual | Anual | Annuale |
| ✅ | 24 | `442rzcl2` | /semaine | /week | /semana | /settimana |
| ✅ | 25 | `zm7au25z` | Hebdo | Weekly | Semanal | Settimanale |
| ✅ | 26 | `6ctw6r1s` | /semaine | /week | /semana | /settimana |
| ✅ | 27 | `odd9espt` | Mensuel | Monthly | Mensual | Mensile |
| ✅ | 28 | `xqafjfrm` | /semaine | /week | /semana | /settimana |
| ✅ | 29 | `2q4dl5rq` | Annuel | Annual | Anual | Annuale |
| ✅ | 30 | `kehkj5dm` | /semaine | /week | /semana | /settimana |
| ✅ | 31 | `uoc4o0qr` | Hebdo | Weekly | Semanal | Settimanale |
| ✅ | 32 | `0g2h992h` | /semaine | /week | /semana | /settimana |
| ✅ | 33 | `n33y8w0d` | Mensuel | Monthly | Mensual | Mensile |
| ✅ | 34 | `oovvufpz` | /semaine | /week | /semana | /settimana |
| ✅ | 35 | `kdt3x2zc` | Annuel | Annual | Anual | Annuale |
| ✅ | 36 | `07wpqbal` | /semaine | /week | /semana | /settimana |
| ✅ | 37 | `s6xib0iq` | Pour plus d'infos, tu peu | For more info, you can ch | Para más información pued | Per ulteriori informazion |
| ✅ | 38 | `l2qhn6qu` | Notre politique de confid | Our privacy policy | Nuestra política de priva | La nostra politica sulla  |
| ✅ | 39 | `w46wxtx7` | Nos conditions d'utilisat | Our terms of use | Nuestros términos de uso | Le nostre condizioni d'us |

---

## BuildMyTeam

**Route:** `/buildmyteam`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: (no outbound navigation)

**Displayed Text (11 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `9g36rf23` | Construire mon équipe | Build my team | Construir mi equipo | Costruisci la mia squadra |
| ✅ | 2 | `39p80bof` | Envoyer mon lien d'invita | Send my invitation link | Enviar mi enlace de invit | Invia il mio link d'invit |
| ✅ | 3 | `mcjurwtf` | Invite tes potes à rejoin | Invite your friends to jo | Invita a tus amigos a uni | Invita i tuoi amici a uni |
| ✅ | 4 | `tbew63gd` | Comme ça, ils pourront s' | This way, they can sign u | De esta manera podrán reg | In questo modo potranno r |
| ✅ | 5 | `a71i64f9` | L'aperçu de ton invitatio | Preview of your invitatio | La vista previa de tu inv | L'anteprima del tuo invit |
| ✅ | 6 | `1ssngfzn` |  t'invite à rejoindre son |  invites you to join thei |  te invita a unirte a su  |  ti invita a unirti al su |
| ✅ | 7 | `czbbx7jj` | Partager à mes potes | Share with my friends | Comparte con mis amigos | Condividi con i miei amic |
| ✅ | 8 | `aj0lq7hj` | Inviter depuis WhatsApp | Invite via WhatsApp | Invitar desde WhatsApp | Invita tramite WhatsApp |
| ✅ | 9 | `hzqawrct` | Ajouter des joueurs Potea | Add Poteau players | Agregar jugadores Poteau | Aggiungi giocatori Poteau |
| ✅ | 10 | `ia1f5mir` | Recherche tes amis parmi  | Find your friends among t | Busca a tus amigos entre  | Cerca i tuoi amici tra i  |
| ✅ | 11 | `g2f6hvkb` | Rechercher sur Poteau | Search on Poteau | Buscar en Poteau | Cerca su Poteau |

---

## c_DateAndTime

**Route:** `/new/date`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: DTypeVisibility

**Displayed Text (6 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `q6wrkd6q` | 50% | 50% | 50% | 50% |
| ✅ | 2 | `36e4pztv` | Ton match a lieu quel jou | What day is your game? | ¿Tu partido es qué día? | Il tuo match si svolge in |
| ✅ | 3 | `54kfhhgl` | À quelle heure ? | What time? | ¿A qué hora? | A che ora? |
| ✅ | 4 | `4l532nl9` | et jusqu'à… ? | and up to...? | ¿y hasta…? | e fino a…? |
| ✅ | 5 | `08hx7q5g` | Double check le jour de t | Double-check your game da | Verifica el día de tu par | Ricontrolla il giorno del |
| ✅ | 6 | `z5ou97hs` | Valider | Validate | Validar | Convalidare |

---

## c_Phone

**Route:** `/onboarding/phone`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: DCity

**Displayed Text (7 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `jzq4ihib` | Ton numéro 📱 | Your number 📱 | Tu número 📱 | Il tuo numero 📱 |
| ✅ | 2 | `lo50bu2a` | Utilise ton  | Use your  | Utilice tu  | Usa il tuo  |
| ✅ | 3 | `wfh7n7p2` | vrai numéro | real number | número real | numero reale |
| ✅ | 4 | `wi5emv08` |  pour sécuriser ton compt |  to secure your account a |  para proteger tu cuenta  |  per proteggere il tuo ac |
| ✅ | 5 | `9tvcrve3` | Pays | Country | País | Paese |
| ✅ | 6 | `qepqvoce` | Pays | Country | País | Paese |
| ✅ | 7 | `2srpnqze` | Valider | Validate | Validar | Convalidare |

---

## CitySelector

**Route:** `/city`

**Navigation:**
- ← Comes from: d_City, Games, b_Location
- → Goes to: FAlert, Home, Games

**Displayed Text (3 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `skdiljuj` | Tape ta ville | Enter your city | Escribe tu ciudad | Scrivi la tua città |
| ✅ | 2 | `tp322bwl` | Historique | History | Historial | Storico |
| ✅ | 3 | `iqca39us` | Aucun résultat pour ta re | No results for your searc | No hay resultados para tu | Nessun risultato per la t |

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

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `kbc85dgo` | Mes contacts | My contacts | Mis contactos | I miei contatti |
| ✅ | 2 | `iiq8q3wr` | Vérifie que tu as bien pa | Make sure you've shared c | Asegúrate de haber dado a | Assicurati di aver condiv |
| ✅ | 3 | `nuip65yk` | Ouvrir mes réglages | Open my settings | Abrir mis ajustes | Apri le mie impostazioni |
| ✅ | 4 | `w16oumoe` | Sélectionne tes potes dan | Select your buddies from  | Selecciona a tus amigos d | Seleziona i tuoi amici da |
| ✅ | 5 | `vkdot39f` | Ouvrir mes réglages | Open my settings | Abrir mis ajustes | Apri le mie impostazioni |
| ✅ | 6 | `z4v43vck` | Définir leur niveau | Define their level | Definir su nivel | Definire il loro livello |

---

## CreateAccount

**Route:** `/signup`

**Navigation:**
- ← Comes from: Landing
- → Goes to: LogIn

**Displayed Text (9 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `joy2tkzq` | Créer un compte | Create an account | Crea una cuenta | Creare un account |
| ✅ | 2 | `n1kagigp` | J'ai déjà un compte Potea | I already have a Poteau a | Ya tengo una cuenta Potea | Ho già un account Poteau |
| ✅ | 3 | `39pzrb46` | Entre ton adresse mail | Enter your email address | Introduce tu dirección de | Inserisci il tuo indirizz |
| ✅ | 4 | `738auohw` | Cette adresse n'est pas a | This address is not accep | Esta dirección no es acep | Questo indirizzo non è ac |
| ✅ | 5 | `jqy3v1dx` | Recevoir des infos par ma | Receive info by email (ze | Recibir información de mi | Ricevi informazioni sulle |
| ✅ | 6 | `o5kclkki` | Choisis un mot de passe | Choose a password | Elije una contraseña | Scegli una password |
| ✅ | 7 | `ghg3pp5t` | Lettres, chiffres, caract | Letters, numbers, special | Letras, números, caracter | Lettere, numeri, caratter |
| ✅ | 8 | `dz81z8bp` | Les mots de passe ne corr | Passwords do not match. T | Las contraseñas no coinci | Le passwords non corrispo |
| ✅ | 9 | `r1en1q7b` | Valider | Validate | Validar | Convalidare |

---

## Credits

**Route:** `/credits`

**Navigation:**
- ← Comes from: Settings
- → Goes to: Home

**Displayed Text (3 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `ntwy26mh` | Remerciements | Thanks | Gracias | Grazie |
| ✅ | 2 | `7g0jkvvt` | Merci à tous ceux qui ont | Thanks to everyone who he | Gracias a todos los que a | Grazie a tutti coloro che |
| ✅ | 3 | `xkygbmox` | Ce n'est que le début. | This is just the beginnin | Este es solo el comienzo. | Questo è solo l'inizio. |

---

## d_City

**Route:** `/onboarding/city`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: CitySelector

**Displayed Text (4 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `i2vywg1o` | Ta ville 📍 | Your city 📍 | Tu ciudad 📍 | La tua città 📍 |
| ✅ | 2 | `gbcywr6m` | On va afficher les matchs | We will display the games | Mostraremos los partidos  | Mostreremo le partite org |
| ✅ | 3 | `zgdu0ahf` | Autour de moi | Around me | A mi alrededor | Intorno a me |
| ✅ | 4 | `yo6ug01h` | Rechercher ma ville | Search my city | Encontrar mi ciudad | Trova la mia città |

---

## d_TypeVisibility

**Route:** `/new/type`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: ELevelMood

**Displayed Text (13 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `4iu5wat7` | 70% | 70% | 70% | 70% |
| ✅ | 2 | `lfiodv6n` | C'est quel genre de match | What kind of game is it? | ¿Qué tipo de partido es? | Che tipo di partita è? |
| ✅ | 3 | `0bep8m0r` | Pour l'instant, tu veux q | For now, you want your so | Por ahora, quieres que tu | Per ora, vuoi che il tuo  |
| ✅ | 4 | `avvle7zg` | Pour l'instant, tu veux q | For now, you want your pa | Por ahora, quieres que tu | Per ora, vuoi che il tuo  |
| ✅ | 5 | `dsoqvc3r` | Pour l'instant, tu veux q | For now, you want your ga | Por ahora, quieres que tu | Per ora, vuoi che la tua  |
| ✅ | 6 | `t301d7dg` | 🔗 | 🔗 | 🔗 | 🔗 |
| ✅ | 7 | `vqo90y2l` | Par tes amis seulement | By your friends only | Solo por tus amigos | Solo dai tuoi amici |
| ✅ | 8 | `enteqnnr` | Ceux à qui tu enverras le | Those you send the link t | Aquellos a quienes envíes | Coloro a cui invierai il  |
| ✅ | 9 | `g6hur4kt` | 🌍 | 🌍 | 🌍 | 🌍 |
| ✅ | 10 | `sgxqz6ep` | Par tout le monde | By everyone | Por todo el mundo | Da tutti |
| ✅ | 11 | `i32sekrz` | Tout le monde sur Poteau  | Everyone on Poteau will s | Todo el mundo en Poteau v | Tutti su Poteau vedranno  |
| ✅ | 12 | `mvbh4qa8` | Il te manque combien de j | How many players are you  | ¿Cuántos jugadores te fal | Quanti giocatori ti manca |
| ✅ | 13 | `kfw4r1l5` | Valider | Validate | Validar | Convalidare |

---

## e_LevelMood

**Route:** `/new/level`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: FPrice

**Displayed Text (10 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `atfjyc2q` | 80% | 80% | 80% | 80% |
| ✅ | 2 | `935pphkw` | Quel est le niveau du mat | What is the level of the  | ¿Cuál es el nivel del par | Qual è il livello della p |
| ✅ | 3 | `7gt2pv0d` | Et c'est  quoi le plus im | And what's the most impor | ¿Y qué es lo más importan | E qual è la cosa più impo |
| ✅ | 4 | `qlc6dmzh` | S'amuser | Have fun | Disfrutar | Divertirsi |
| ✅ | 5 | `s30adgwe` | Tout gagner | Win everything | Ganarlo todo | Vincere tutto |
| ✅ | 6 | `wgfcwe0j` | S'amuser | Have fun | Disfrutar | Divertirsi |
| ✅ | 7 | `ivtavqrp` | Tout gagner | Win everything | Ganarlo todo | Vincere tutto |
| ✅ | 8 | `n5p1ry81` | S'amuser | Have fun | Disfrutar | Divertirsi |
| ✅ | 9 | `zg5yj4ax` | Tout gagner | Win everything | Ganarlo todo | Vincere tutto |
| ✅ | 10 | `7tv8izbs` | Valider | Validate | Validar | Convalidare |

---

## e_Sports

**Route:** `/onboarding/sport`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: FAlert

**Displayed Text (6 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `k98ktcy5` | Foot, padel, les deux ? | Soccer, padel, or both? | ¿Fútbol, pádel o ambos? | Calcio, padel o entrambi? |
| ✅ | 2 | `5qh6cg3o` | Pour le moment, Poteau t' | For now, Poteau helps you | Por ahora, Poteau te ayud | Per ora, Poteau ti aiuta  |
| ✅ | 3 | `ubsv3iw1` | Sélectionne au moins un s | Select at least one sport | Selecciona al menos un de | Seleziona almeno uno spor |
| ✅ | 4 | `v6mpyci0` | Foot | Soccer | Fútbol | Calcio |
| ✅ | 5 | `rseo94mf` | Padel | Padel | Pádel | Padel |
| ✅ | 6 | `71dnif2v` | Valider | Validate | Validar | Convalidare |

---

## EditMyGame

**Route:** `/game/:gameId/edit`

**Navigation:**
- ← Comes from: GameSheet
- → Goes to: GameSheet

**Displayed Text (88 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `mxfaruuc` | Modifier mon match | Edit my game | Editar mi partido | Modifica la mia partita |
| ✅ | 2 | `6a60nhl1` | L'heure | Time | Tiempo | Tempo |
| ✅ | 3 | `12sgod2i` | 1 | 1 | 1 | 1 |
| ✅ | 4 | `epbogf0t` | 2 | 2 | 2 | 2 |
| ✅ | 5 | `95bj049t` | 3 | 3 | 3 | 3 |
| ✅ | 6 | `w5hvxyp7` | 4 | 4 | 4 | 4 |
| ✅ | 7 | `l65q6x00` | 5 | 5 | 5 | 5 |
| ✅ | 8 | `e4mjkdcw` | 6 | 6 | 6 | 6 |
| ✅ | 9 | `jdeoxi60` | 7 | 7 | 7 | 7 |
| ✅ | 10 | `sss3t2pp` | 8 | 8 | 8 | 8 |
| ✅ | 11 | `s1kxu2lj` | 9 | 9 | 9 | 9 |
| ✅ | 12 | `gslbrtm5` | 10 | 10 | 10 | 10 |
| ✅ | 13 | `8ryx2v54` | 11 | 11 | 11 | 11 |
| ✅ | 14 | `ho89rmuq` | 12 | 12 | 12 | 12 |
| ✅ | 15 | `fzirwwsy` | : | : | : | : |
| ✅ | 16 | `5duvldjf` | 00 | 00 | 00 | 00 |
| ✅ | 17 | `e5e2ue6l` | 05 | 05 | 05 | 05 |
| ✅ | 18 | `jfxhjlmg` | 10 | 10 | 10 | 10 |
| ✅ | 19 | `qx79ryeh` | 15 | 15 | 15 | 15 |
| ✅ | 20 | `uq3wtril` | 20 | 20 | 20 | 20 |
| ✅ | 21 | `5z3yj7rg` | 25 | 25 | 25 | 25 |
| ✅ | 22 | `vv4j812y` | 30 | 30 | 30 | 30 |
| ✅ | 23 | `yfqkmbqa` | 35 | 35 | 35 | 35 |
| ✅ | 24 | `6e65yiwu` | 40 | 40 | 40 | 40 |
| ✅ | 25 | `i19jpk2b` | 45 | 45 | 45 | 45 |
| ✅ | 26 | `2szh8iue` | 50 | 50 | 50 | 50 |
| ✅ | 27 | `9eqtwcug` | 55 | 55 | 55 | 55 |
| ✅ | 28 | `fqkbotgo` | 00 | 00 | 00 | 00 |
| ✅ | 29 | `pv39ntt3` | AM | AM | AM | AM |
| ✅ | 30 | `apy5upei` | PM | PM | PM | PM |
| ✅ | 31 | `3yx8ice1` | 00 | 00 | 00 | 00 |
| ✅ | 32 | `rcks9xul` | 01 | 01 | 01 | 01 |
| ✅ | 33 | `iy2gwpos` | 02 | 02 | 02 | 02 |
| ✅ | 34 | `rr3cmtqv` | 03 | 03 | 03 | 03 |
| ✅ | 35 | `ayxv13q5` | 04 | 04 | 04 | 04 |
| ✅ | 36 | `3vlt9dod` | 05 | 05 | 05 | 05 |
| ✅ | 37 | `cyw6w722` | 06 | 06 | 06 | 06 |
| ✅ | 38 | `2yd6mca6` | 07 | 07 | 07 | 07 |
| ✅ | 39 | `40wcnrwt` | 08 | 08 | 08 | 08 |
| ✅ | 40 | `jyqozkqt` | 09 | 09 | 09 | 09 |
| ✅ | 41 | `us6z55c9` | 10 | 10 | 10 | 10 |
| ✅ | 42 | `7ul38wza` | 11 | 11 | 11 | 11 |
| ✅ | 43 | `9gdy41a9` | 12 | 12 | 12 | 12 |
| ✅ | 44 | `q0x6gczi` | 13 | 13 | 13 | 13 |
| ✅ | 45 | `pxn7rb5i` | 14 | 14 | 14 | 14 |
| ✅ | 46 | `rus4vnuh` | 15 | 15 | 15 | 15 |
| ✅ | 47 | `t52prghg` | 16 | 16 | 16 | 16 |
| ✅ | 48 | `if0spyg2` | 17 | 17 | 17 | 17 |
| ✅ | 49 | `yiyugq75` | 18 | 18 | 18 | 18 |
| ✅ | 50 | `yx0gfd8f` | 19 | 19 | 19 | 19 |
| ✅ | 51 | `fgljesef` | 20 | 20 | 20 | 20 |
| ✅ | 52 | `8ucik5xa` | 21 | 21 | 21 | 21 |
| ✅ | 53 | `7xfhm2uy` | 22 | 22 | 22 | 22 |
| ✅ | 54 | `egkfrocn` | 23 | 23 | 23 | 23 |
| ✅ | 55 | `wgaca7d4` | : | : | : | : |
| ✅ | 56 | `es6gkih7` | 00 | 00 | 00 | 00 |
| ✅ | 57 | `o6d86x3c` | 05 | 05 | 05 | 05 |
| ✅ | 58 | `5ivpw2q7` | 10 | 10 | 10 | 10 |
| ✅ | 59 | `z33sd6fg` | 15 | 15 | 15 | 15 |
| ✅ | 60 | `k7olgqyl` | 20 | 20 | 20 | 20 |
| ✅ | 61 | `7gcfk66z` | 25 | 25 | 25 | 25 |
| ✅ | 62 | `gj5hdtxl` | 30 | 30 | 30 | 30 |
| ✅ | 63 | `r7sv2zds` | 35 | 35 | 35 | 35 |
| ✅ | 64 | `nxmb4rg6` | 40 | 40 | 40 | 40 |
| ✅ | 65 | `ngdehng0` | 45 | 45 | 45 | 45 |
| ✅ | 66 | `ur4kjkkm` | 50 | 50 | 50 | 50 |
| ✅ | 67 | `5nd7fk06` | 55 | 55 | 55 | 55 |
| ✅ | 68 | `e0izv2nx` | 00 | 00 | 00 | 00 |
| ✅ | 69 | `d9qel7j0` | La durée | Duration | La duración | La durata |
| ✅ | 70 | `ajnmbfow` | 30 minutes | 30 minutes | 30 minutos | 30 minuti |
| ✅ | 71 | `l9roy27s` | 45 minutes | 45 minutes | 45 minutos | 45 minuti |
| ✅ | 72 | `v06ta5pk` | 1 heure | 1 hour | 1 hora | 1 ora |
| ✅ | 73 | `37un26pe` | 1 heure 30 | 1 hour 30 minutes | 1 hora 30 | 1 ora e 30 |
| ✅ | 74 | `onqkyd56` | 2 heures | 2 hours | 2 horas | 2 ore |
| ✅ | 75 | `jkhew9qn` | 2 heures 30 | 2 hours 30 minutes | 2 horas 30 | 2 ore e 30 |
| ✅ | 76 | `p7gfau8l` | 3 heures | 3 hours | 3 horas | 3 ore |
| ✅ | 77 | `d2v8588a` | Le prix à payer par perso | The price per person | El precio a pagar por per | Il prezzo da pagare a per |
| ✅ | 78 | `9z4a4gyj` | Le prix avant réduction p | The price before discount | El precio antes de la red | Il prezzo prima della rid |
| ✅ | 79 | `qz3kyfov` | Le lien de paiement | The payment link | El enlace de pago | Il collegamento di pagame |
| ✅ | 80 | `4fqoin4p` | Le nom de la résa | Reservation name | El nombre de la reserva | Il nome della prenotazion |
| ✅ | 81 | `p7waltw8` | La description | The description | La descripcion | La descrizione |
| ✅ | 82 | `4uej5d2w` | Par exemple :\nPetit matc | For example:\nCasual kick | Por ejemplo :\nPequeño pa | Per esempio :\nPiccola pa |
| ✅ | 83 | `9ty11xd1` | Le style | Style | El estilo | Lo stile |
| ✅ | 84 | `5pcmpiv3` | 😁 Détente | 😁 Relaxation | 😁 Relajación | 😁 Relax |
| ✅ | 85 | `3bg7dcm5` | 🏆 Compétition | 🏆 Competition | 🏆 Competencia | 🏆 Competizione |
| ✅ | 86 | `oa014iw9` | Sélectionner | Select | Seleccionar | Selezionare |
| ✅ | 87 | `1c9su05l` | Le niveau | The level | El nivel | Il livello |
| ✅ | 88 | `o1v3iu4a` | Valider | Validate | Validar | Convalidare |

---

## EditMyPhone

**Route:** `/edit/phone`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: EditMyProfile

**Displayed Text (5 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `bt5w8q7o` | Modifier mon numéro | Edit my number | Cambiar mi numero | Cambia il mio numero |
| ✅ | 2 | `pya2fpp2` | Pays | Country | País | Paese |
| ✅ | 3 | `1qwxc8fs` | Pays | Country | País | Paese |
| ✅ | 4 | `sruxgqa1` | Ce numéro n'est pas valid | This number is not valid. | Este número no es válido. | Questo numero non è valid |
| ✅ | 5 | `4av4vy47` | Valider | Validate | Validar | Convalidare |

---

## EditMyProfile

**Route:** `/edit`

**Navigation:**
- ← Comes from: Games, Home, EditMyPhone, Settings
- → Goes to: ValidateEmail, BPhoto, CPhone, DCity, ANickname, MyProfile, Home

**Displayed Text (35 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `dx50op5m` | Modifier mon profil | Edit my profile | Modificar mi perfil | Modifica il mio profilo |
| ✅ | 2 | `idowl4rh` | Complète ton profil avant | Complete your profile bef | Complete su perfil antes  | Completa il tuo profilo p |
| ✅ | 3 | `5wrsd35c` | Ta photo de profil | Your profile picture | Tu foto de perfil * | La tua immagine del profi |
| ✅ | 4 | `v7i2q6s5` | On enregistre la photo… | Saving the photo... | Guardamos la foto… | Salviamo la foto... |
| ✅ | 5 | `3fbtz7di` | C'est bon ! | All good! | ¡Es bueno! | Va bene! |
| ✅ | 6 | `6g7dpxss` | On n'a pas réussi à enreg | We couldn't save the phot | No pudimos guardar la fot | Impossibile salvare la fo |
| ✅ | 7 | `porxpfzl` | Le nom que tu souhaites a | The name you want to disp | El nombre que desea mostr | Il nome che desideri visu |
| ✅ | 8 | `gh5jk7sl` | Ton vrai nom | Your real name | Tu verdadero nombre | Il tuo vero nome |
| ✅ | 9 | `pjvb51z4` | Ton surnom | Your nickname | Tu apodo | Il tuo soprannome |
| ✅ | 10 | `zxbp87lt` | Ton surnom | Your nickname | Tu apodo | Il tuo soprannome |
| ✅ | 11 | `193slonf` | Mets la façon dont tes po | Enter the way your friend | Di cómo te llaman tus ami | Dì come ti chiamano i tuo |
| ✅ | 12 | `7c5ekydx` | Ton prénom | Your first name | Tu nombre * | Il tuo nome * |
| ✅ | 13 | `l7vi7d8a` | Il y a des chiffres dans  | Are there numbers in your | ¿Hay números en tu nombre | Ci sono numeri nel tuo no |
| ✅ | 14 | `kensf7gj` | Ton nom de famille | Your last name | Tu apellido * | Il tuo cognome * |
| ✅ | 15 | `iaiqese2` | Il y a des chiffres dans  | Are there numbers in your | ¿Hay números en tu apelli | Ci sono numeri nel tuo co |
| ✅ | 16 | `rtbsmvsh` | Ton numéro de téléphone | Your phone number | Tu número de teléfono * | Il tuo numero di telefono |
| ✅ | 17 | `8ugdw9sd` | Ton adresse mail | Your email address | Su dirección de correo el | Il tuo indirizzo di posta |
| ✅ | 18 | `ht7319b0` | Ta date de naissance | Your date of birth | Tu fecha de nacimiento | La tua data di nascita |
| ✅ | 19 | `gyn8alyz` | Ton genre | Your gender | Tu sexo | La tua gentilezza |
| ✅ | 20 | `v7zitlr7` | Homme | Male | Hombre | Uomo |
| ✅ | 21 | `tiv9j0o0` | Femme | Female | Mujer | Donna |
| ✅ | 22 | `13znvmji` | Ton style de jeu préféré | Your favorite playing sty | Tu estilo de juego favori | Il tuo stile di gioco pre |
| ✅ | 23 | `1n2bbm5e` | S'amuser | Have fun | Disfrutar | Divertirsi |
| ✅ | 24 | `5epwtiky` | Tout gagner | Win everything | Ganarlo todo | Vincere tutto |
| ✅ | 25 | `4olfeif4` | S'amuser | Have fun | Disfrutar | Divertirsi |
| ✅ | 26 | `i7bwdebc` | Tout gagner | Win everything | Ganarlo todo | Vincere tutto |
| ✅ | 27 | `z5johfyv` | S'amuser | Have fun | Disfrutar | Divertirsi |
| ✅ | 28 | `my4z7vce` | Tout gagner | Win everything | Ganarlo todo | Vincere tutto |
| ✅ | 29 | `xeguik8z` | Ta ville | Your city | Tu ciudad | La tua città |
| ✅ | 30 | `tz74lg6s` | Tu peux modifier ta ville | You can change your city  | Puedes cambiar tu ciudad  | Puoi cambiare la tua citt |
| ✅ | 31 | `iqjbfpiy` | Tes sports | Your sports | Tu ciudad | La tua città |
| ✅ | 32 | `f7oqf6gk` | Foot | Soccer | Fútbol | Calcio |
| ✅ | 33 | `okxpgwnn` | Padel | Padel | Pádel | Padel |
| ✅ | 34 | `tvf1v2wd` | Tu ne peux pas valider ta | You cannot validate as lo | No se puede validar mient | Non è possibile convalida |
| ✅ | 35 | `ulh6xa5a` | Valider | Validate | Validar | Convalidare |

---

## f_Alert

**Route:** `/onboarding/alert`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: FTeam, Home

**Displayed Text (3 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `82uvjbo7` | Ta 1ère alerte 🔔 | Your 1st alert 🔔 | Tu 1ª alerta 🔔 | Il tuo primo avviso 🔔 |
| ✅ | 2 | `8e65gi00` | Tu recevras une invitatio | You will receive an invit | Recibirás una invitación  | Riceverai un invito non a |
| ✅ | 3 | `ruk9g5ar` | Plus tard | Later | Más tarde | Dopo |

---

## f_Price

**Route:** `/new/price`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: GSummaryRepeat

**Displayed Text (5 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `j84wpvi1` | 90% | 90% | 90% | 90% |
| ✅ | 2 | `kmvw5ota` | Quel est le prix par joue | What is the price per pla | ¿Cuál es el precio por pe | Qual è il prezzo a person |
| ✅ | 3 | `9xk29luz` | Il y a une réduction par  | Is there a discount compa | ¿Cuál es el precio por pe | Qual è il prezzo a person |
| ✅ | 4 | `jiec3rzu` | OK, c'est quoi le prix av | OK, what's the price befo | ¿Cuál es el precio por pe | Qual è il prezzo a person |
| ✅ | 5 | `njfx76i1` | Valider | Validate | Validar | Convalidare |

---

## f_Team

**Route:** `/team`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: Home

**Displayed Text (7 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `9rdwmr8n` | Ton équipe Poteau 🏆 | Your Poteau team 🏆 | Tu equipo Poteau 🏆 | Il tuo team Poteau 🏆 |
| ✅ | 2 | `vg8tl1qe` | Invite tes potes à rejoin | Invite your friends to jo | Invita a tus amigos a uni | Invita i tuoi amici a uni |
| ✅ | 3 | `dw4txkbk` | Comme ça, ils pourront s' | This way, they can sign u | De esta manera podrán reg | In questo modo potranno r |
| ✅ | 4 | `c6fsht1o` | L'aperçu de ton invitatio | Preview of your invitatio | La vista previa de tu inv | L'anteprima del tuo invit |
| ✅ | 5 | `pgl2yr3y` |  t'invite à rejoindre son |  invites you to join thei |  te invita a unirte a su  |  ti invita a unirti al su |
| ✅ | 6 | `u146rc09` | Partager à mes potes | Share with my friends | Comparte con mis amigos | Condividi con i miei amic |
| ✅ | 7 | `c7ij7n3l` | Partager plus tard | Share later | Compartir más tarde | Condividi più tardi |

---

## FavoriteClub

**Route:** `/favoriteclub`

**Navigation:**
- ← Comes from: MyProfile
- → Goes to: MyProfile

**Displayed Text (5 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `cf9gjf3c` | Mon club de cœur | My favorite club | Mi club del corazón | Il mio club del cuore |
| ✅ | 2 | `dc5we5jn` | Pas de club préféré | No favorite club | Ningún club favorito | Nessun club preferito |
| ✅ | 3 | `wi25w0vy` | Ton club (pro) n'est pas  | Your club (pro) isn't on  | ¿Tu club (profesional) no | Il tuo club (pro) non è n |
| ✅ | 4 | `yfidx3ko` | Clique ici pour le demand | Click here to request it | Haga clic aquí para solic | Clicca qui per richiederl |
| ✅ | 5 | `014jtnvt` | Envoyer | Send | Enviar a | Mandare |

---

## FavoriteSelection

**Route:** `/favoriteselection`

**Navigation:**
- ← Comes from: MyProfile
- → Goes to: (no outbound navigation)

**Displayed Text (3 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `zze0jeak` | Ma sélection | My selection | Mi seleccion favorita | La mia selezione preferit |
| ✅ | 2 | `781lo6uc` | Pas de sélection national | No national team selectio | Sin selección nacional | Nessuna selezione naziona |
| ✅ | 3 | `bpgsun0d` | Rechercher un pays… | Search for a country... | Buscar un país… | Cerca un paese… |

---

## Features

**Route:** `/features`

**Navigation:**
- ← Comes from: Settings
- → Goes to: (no outbound navigation)

**Displayed Text (4 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `hmmk6jgw` | Voter pour les nouveautés | Vote for new features | Vota por las nuevas funci | Vota per le nuove funzion |
| ✅ | 2 | `ejigtr5h` | Chaque mois, on sélection | Each month, we select one | Cada mes seleccionamos un | Ogni mese selezioniamo un |
| ✅ | 3 | `l4a1qxwn` | Voici les dernières fonct | Here are the latest featu | Aquí están las últimas fu | Ecco le ultime funzionali |
| ✅ | 4 | `1dfx6u08` |   |   |   |   |

---

## FeedbackSaved

**Route:** `/feedback/done`

**Navigation:**
- ← Comes from: GiveFeedback
- → Goes to: Home

**Displayed Text (9 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `6o7hqosb` | Ton match a l'air de s'êt | Your game seems to have g | ¡Parece que tu partido sa | Sembra che la tua partita |
| ✅ | 2 | `qszy6htp` | Ton feedback est visible  | Your feedback is visible  | Tus comentarios son visib | Il tuo feedback è visibil |
| ✅ | 3 | `1kroxr5n` | Merci de nous aider à con | Thank you for helping us  | Gracias por ayudarnos a c | Grazie per averci aiutato |
| ✅ | 4 | `1oqdt4gn` | Ajoute les membres avec l | Add the members you enjoy | Agrega los miembros con l | Aggiungi i membri con cui |
| ✅ | 5 | `gn5dgya9` | Les problèmes sur ton mat | The issues with your game | Los problemas con tu part | I problemi con la tua par |
| ✅ | 6 | `lmcc0gh6` | Ils apparaissent sur le p | They appear on the profil | Aparecen en el perfil de  | Appaiono sul profilo dei  |
| ✅ | 7 | `3yd72f2o` | Merci de nous aider à ren | Thank you for helping mak | Gracias por ayudarnos a h | Grazie per averci aiutato |
| ✅ | 8 | `ixyhejly` | Tu peux ajouter les joueu | You can add players you h | Puedes agregar los jugado | Puoi aggiungere i giocato |
| ✅ | 9 | `as9xmlqf` | Accéder aux matchs | Access games | Acceder a partidos | Accedi alle partite |

---

## Filter

**Route:** `/centres`

**Navigation:**
- ← Comes from: Filter
- → Goes to: Filter

**Displayed Text (2 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `rc277wpy` | Filtrer les matchs | Filter games | Filtrar coincidencias | Filtrare le corrispondenz |
| ✅ | 2 | `j083rkdy` | Ajouter un centre | Add a center | Agregar un centro | Aggiungi un centro |

---

## FilterCentres

**Route:** `/addcentre`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: (no outbound navigation)

**Displayed Text (6 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `f0zmde8p` | Ajouter un centre préféré | Add a favorite center | Añadir un centro preferid | Aggiungi un centro prefer |
| ✅ | 2 | `mk726zs7` | Les centres les plus popu | The most popular centers | Los centros más populares | I centri più frequentati |
| ✅ | 3 | `ue6k6obd` | Ajouter | Add | Agregar | Aggiungere |
| ✅ | 4 | `zr9n1rfn` | Ajouté | Added | Añadido | Aggiunto |
| ✅ | 5 | `zcwkr2qc` | Rechercher un centre | Search for a center | encontrar un centro | Trova un centro |
| ✅ | 6 | `ugtau3nu` | Nom du lieu, ville, adres | Place name, city, address | Nombre del lugar, ciudad, | Nome del luogo, città, in |

---

## g_SummaryRepeat

**Route:** `/new/recap`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: InviteFriends

**Displayed Text (12 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `7frd9teg` | 99% | 99% | 99% | 99% |
| ✅ | 2 | `setzog0d` | Récap' | Summary | Crear una partida | Creare una partita |
| ✅ | 3 | `dwpmdt8l` | Terrain réservé | Field reserved | Campo reservado | Campo riservato |
| ✅ | 4 | `jqwcqtol` |  pour  |  for  |  para  |  per  |
| ✅ | 5 | `npj1lb0a` |  (au lieu de  |  (instead of  |  (en lugar de  |  (invece di  |
| ✅ | 6 | `iht7wam7` | ) | ) | ) | ) |
| ✅ | 7 | `t2dizl3s` | C'est un match hebdo ? | Is it a weekly game? | ¿Es un partido semanal? | È una partita settimanale |
| ✅ | 8 | `ocny1kta` | Oui, répéter ce match cha | Yes, repeat this game eve | Sí, repetir este partido  | Sì, ripeti questa partita |
| ✅ | 9 | `d7ylhyjd` | Non, juste pour cette foi | No, just this time | No, solo por esta vez | No, solo per questa volta |
| ✅ | 10 | `my1c05hs` | Modifie le nom de la résa | Edit the reservation name | Modifica el nombre de la  | Modifica il nome della pr |
| ✅ | 11 | `p74ekaib` | Par exemple :\nPetit matc | For example:\nSmall resta | Por ejemplo :\nPequeño pa | Per esempio :\nPiccola pa |
| ✅ | 12 | `he8eqzdl` | Publier mon match | Publish my game | Crear una partida | Creare una partita |

---

## Games

**Route:** `/games`

**Navigation:**
- ← Comes from: CitySelector, a_Create, Profile
- → Goes to: Ban, CitySelector, ValidateEmail, BPhoto, CPhone, DCity, ANickname, EditMyProfile, ConfigureAlert

**Displayed Text (1 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `ibvldf6v` | Ajouter une alerte | Add an alert | Agregar una alerta | Aggiungi un avviso |

---

## GameSheet

**Route:** `/game/:gameId`

**Navigation:**
- ← Comes from: BecomeGold, EditMyGame, InviteFriends
- → Goes to: Ban, ValidateEmail, BecomeGold, MyProfile, Profile, InviteFriends, EditMyGame, Home

**Displayed Text (112 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `lcsem52b` | MATCH COMPLET | GAME FULL | PARTIDO COMPLETO | PARTITA INTERA |
| ✅ | 2 | `qfhpyg8x` | MATCH ANNULÉ | GAME CANCELED | PARTIDO CANCELADO | PARTITA ANNULLATA |
| ✅ | 3 | `pqwotoaf` |  pour  |  for  |  para  |  per  |
| ✅ | 4 | `jizkifhq` |  (au lieu de  |  (instead of  |  (en lugar de  |  (invece di  |
| ✅ | 5 | `znmlbzd1` | ) | ) | ) | ) |
| ✅ | 6 | `3n0wr5uk` | Lien copié | Link copied | Enlace copiado | Link copiato |
| ✅ | 7 | `aw6eut0z` | Copier le lien | Copy the link | Copiar el enlace | Copia il link |
| ✅ | 8 | `vwtoqrue` | Partager | Share | Compartir | Suddividere |
| ✅ | 9 | `pjclf89i` | Match privé | Private game | Partido privado | Partita privata |
| ✅ | 10 | `w94jvrfq` | Confirmer | Confirm | Confirmar | Conferma |
| ✅ | 11 | `bjnt5esf` | La feuille de match | The match sheet | Hoja del partido | Resoconto della partita |
| ✅ | 12 | `z7rhy7rs` | Tu as envie de jouer ? | Do you want to play? | ¿Tienes ganas de jugar? | Hai voglia di giocare? |
| ✅ | 13 | `pbysew3f` | Une personne veut jouer | Someone wants to play | Una persona quiere jugar | Una persona vuole giocare |
| ✅ | 14 | `go9yyjv2` |  personnes veulent jouer |  people want to play |  personas quieren jugar |  persone vogliono giocare |
| ✅ | 15 | `dgkyral9` | Ouvrir l'accès | Open access | Abrir el acceso | Apri l'accesso |
| ✅ | 16 | `a7f0rvho` | Suivre ce match | Follow this game | Seguir este partido | Segui questa partita |
| ✅ | 17 | `h58iit6s` | Arrêter de suivre | Unfollow | Únete | Partecipa |
| ✅ | 18 | `4lku4r3v` | Inviter | Invite | Invitar | Invitare |
| ✅ | 19 | `e7ov6f6l` | +  | +  | +  | +  |
| ✅ | 20 | `isvub5cm` |  autres joueurs |  other players |  otros jugadores |  altri giocatori |
| ✅ | 21 | `urugjn23` | Le fil de discussion | The discussion thread | Hilo de discusión | Filo della discussione |
| ✅ | 22 | `gdsxpwkr` | Karim Boudebouz | Karim Boudebouz | Karim Boudebouz | Karim Boudébouz |
| ✅ | 23 | `1ddd2aqn` |   |   |   |   |
| ✅ | 24 | `ufqvb3hj` | s'est inscrit. | has registered. | registrado. | registrato. |
| ✅ | 25 | `hh6k4gp3` | Pablo da Fonseca | Pablo da Fonseca | Pablo da Fonseca | Pablo da Fonseca |
| ✅ | 26 | `8js7fcdz` | Salut les gars, vous êtes | Hey guys, are you all rea | Hola chicos, ¿están todos | Ehi ragazzi, siete tutti  |
| ✅ | 27 | `phjdz1wh` | Sadio Mané | Sadio Mané | Sadio Mané | Sadio Manè |
| ✅ | 28 | `yddetl4p` | Ouais c'est bon pour moi | Yeah, it's fine with me | si, es bueno para mi | Sì, mi fa bene |
| ✅ | 29 | `139ueuu0` | Sadio Mané | Sadio Mané | Sadio Mané | Sadio Manè |
| ✅ | 30 | `hieh66sh` | Ouais c'est bon pour moi | Yeah, it's fine with me | si, es bueno para mi | Sì, mi fa bene |
| ✅ | 31 | `tq2441xm` | Réservé aux membres Gold | Reserved for Gold members | Reservado para miembros G | Riservato ai membri Gold |
| ✅ | 32 | `wmsnjtf3` | Ce match est réservé aux  | This game is reserved for | Este partido está reserva | Questa partita è riservat |
| ✅ | 33 | `y7spzlc8` | En savoir plus | Learn more | Unete a la communidad | Unisciti alla comunità |
| ✅ | 34 | `3f2x223t` | Le fil de discussion | The discussion thread | Hilo de discusión | Filo della discussione |
| ✅ | 35 | `frboo5yt` | NOUVEAU SUR POTEAU\n | NEW ON POTEAU\n | NUEVO EN POTEAU\n | NUOVO SU POTEAU\n |
| ✅ | 36 | `2iu44vh3` | Réagis aux messages : res | React to messages: hold d | Reacciona a los mensajes: | Reagisci ai messaggi: tie |
| ✅ | 37 | `whsppjk0` | Il n'y a pas de mauvaise  | There are no bad question | No hay preguntas malas: i | Non ci sono domande sbagl |
| ✅ | 38 | `cbiuf24k` | Plus d'infos sur le match | More info on the game | Más info sobre el partido | Più info sulla partita |
| ✅ | 39 | `7fs24xzg` | 🌍 | 🌍 | 🌍 | 🌍 |
| ✅ | 40 | `ysy54p8x` | Visible par tout le monde | Visible to everyone | Visible para todos | Visibile a tutti |
| ✅ | 41 | `fwz7b6lr` | Tous les membres de la co | All community members can | Todos los miembros de la  | Tutti i membri della comu |
| ✅ | 42 | `jidec2ik` | Restreindre la visibilité | Restrict visibility | Restringir la visibilidad | Restringi la visibilità |
| ✅ | 43 | `f3vzdxas` | 🔒 | 🔒 | 🔒 | 🔒 |
| ✅ | 44 | `te8rjhj6` | Visible par tes amis | Visible to your friends | Visible por tus amigos | Visibile dai tuoi amici |
| ✅ | 45 | `miu8ki1c` | Seuls tes amis Poteau et  | Only your Poteau friends  | Solo tus amigos de Poteau | Solo i tuoi amici Poteau  |
| ✅ | 46 | `e2xjgxii` | Rendre visible par tous | Make visible to everyone | Hacer visible para todos | Rendi visibile a tutti |
| ✅ | 47 | `hti1fay2` | Réservé aux membres Gold | Reserved for Gold members | Reservado para miembros G | Riservato ai membri Gold |
| ✅ | 48 | `ghw93olh` | Ton match est très demand | Your game is in high dema | Tu partido es muy demanda | La tua partita è molto ri |
| ✅ | 49 | `yrpg8xkf` | Pour que ce soit des joue | To ensure reliable player | Para que sean jugadores f | Per garantire che siano g |
| ✅ | 50 | `doyhb224` | L’accès s’ouvrira à tout  | Access will open to every | El acceso se abrirá para  | L'accesso sarà aperto a t |
| ✅ | 51 | `us6skh7t` | h avant le coup d’envoi s | hr before kickoff if more | h antes del inicio si tod | h prima del calcio d’iniz |
| ✅ | 52 | `8yvdcytq` | Tu es membre Gold ✅ | You are a Gold member ✅ | Eres miembro Gold ✅ | Sei membro Gold ✅ |
| ✅ | 53 | `29uay1ol` | Tu peux donc choisir de l | You can choose to open it | Puedes elegir abrirlo a t | Puoi quindi scegliere di  |
| ✅ | 54 | `32rgxhnk` | Ouvrir l'accès à mon matc | Open access to my game | Abrir el acceso a mi part | Aprire l'accesso alla mia |
| ✅ | 55 | `tckcbt9i` | Tu peux choisir de l'ouvr | You can choose to open it | Puedes elegir abrirlo a t | Puoi scegliere di aprirlo |
| ✅ | 56 | `ti91u5a7` | En savoir plus | Learn more | Únete a la comunidad | Unisciti alla comunità |
| ✅ | 57 | `4lanklkj` | N'importe qui peut le rej | Anyone can join | Cualquiera puede unirse | Chiunque può unirsi |
| ✅ | 58 | `ttxl0k3i` | Actuellement, ton match n | Currently, your game is n | Actualmente, tu partido n | Attualmente, la tua parti |
| ✅ | 59 | `3o27maq7` | On a mis en place un abon | We have set up a Gold sub | Hemos implementado una su | Abbiamo creato un abbonam |
| ✅ | 60 | `csfo0pb9` | On te recommande de conta | We recommend contacting t | Te recomendamos contactar | Ti consigliamo di contatt |
| ✅ | 61 | `b2632rcf` | Sinon, tu peux choisir de | Otherwise, you can choose | Si no, puedes elegir rese | Altrimenti, puoi sceglier |
| ✅ | 62 | `qa9ccfyf` | Donner la priorité aux me | Prioritize Gold members | Dar prioridad a los miemb | Dare la priorità ai membr |
| ✅ | 63 | `edm826sl` | Ton match a lieu dans moi | Your game is in less than | Tu partido es en menos de | La tua partita avrà luogo |
| ✅ | 64 | `2ii1wh2o` | Niveau | Level | Nivel | Livello |
| ✅ | 65 | `bd24e5lp` | Ambiance | Atmosphere | Atmósfera | Atmosfera |
| ✅ | 66 | `g0w9vd7o` | Détente | Relaxation | Relajación | Rilassamento |
| ✅ | 67 | `mnnwptbx` | Compétition | Competition | Competencia | Concorrenza |
| ✅ | 68 | `f9g63tf4` | Paiement | Payment | Pago | Pagamento |
| ✅ | 69 | `z04iuoct` | Sur l'application | On the app | En la aplicación | Sull'app |
| ✅ | 70 | `n40pfygs` | En ligne | Online | En línea | In linea |
| ✅ | 71 | `9d62sdve` | Sur place | On-site | En el sitio | Sul posto |
| ✅ | 72 | `f9w9jvae` | Lien de paiement | Payment link | Enlace de pago: | Link per il pagamento: |
| ✅ | 73 | `8wl8fj0y` | Ajouter le lien de paieme | Add payment link | Agregar el enlace de pago | Aggiungi il link di pagam |
| ✅ | 74 | `lo1uphnf` | Clique ici pour payer ta  | Click here to pay your sh | Haga clic aquí para pagar | Clicca qui per pagare la  |
| ✅ | 75 | `z5ywndxe` | Ce match est géré par le  | This game is managed by t | Partido organizado por el | Partita organizzata dal c |
| ✅ | 76 | `2kmky4ud` | Description | Description | Descripción: | Descrizione: |
| ✅ | 77 | `bjdp915h` | Nom de la réservation | Reservation name | Nombre de la reserva: | Nome della prenotazione: |
| ✅ | 78 | `zjcphxrs` | Quitter le match | Leave the game | Salir del partido | Lasciare la partita |
| ✅ | 79 | `id4spamy` | Annuler mon match | Cancel my game | Cancelar mi partido | Annulla la mia partita |
| ✅ | 80 | `bwfhccm9` | Tu viens juste de publier | You just posted your game | Acabas de publicar tu par | Hai appena pubblicato la  |
| ✅ | 81 | `h2x0oqqk` | Modifier le match | Edit the game | Cancelar el partido | Annulla la partita |
| ✅ | 82 | `91g9akkf` | Annuler le match | Cancel the game | Cancelar el partido | Annulla la partita |
| ✅ | 83 | `5ap5iez0` | Plus d'infos sur  | More info on  | Más información sobre  | Più info su  |
| ✅ | 84 | `1kbm61j1` | Adresse | Address | Dirección: | Indirizzo: |
| ✅ | 85 | `a55tmi5q` | La feuille de match | The match sheet | Hoja del partido | Resoconto della partita |
| ✅ | 86 | `dgxu5lgz` | Match privé | Private game | Partido privado | Partita privata |
| ✅ | 87 | `p3on97km` | La feuille de match | The match sheet | Hoja del partido | Resoconto della partita |
| ✅ | 88 | `r94d8fnb` | Dernière place dispo | Last spot available | Último lugar disponible � | Ultimo posto disponibile  |
| ✅ | 89 | `t7asd5cw` | Plus que  | More than  | ¡Solo quedan  | Solo  |
| ✅ | 90 | `ux8wwj6h` |  places dispo |  spots available |  lugares! |  posti disponibili |
| ✅ | 91 | `2ufm658b` | Plus d'infos sur  | More info on  | Más información sobre  | Più info su  |
| ✅ | 92 | `621wkw9k` | Adresse | Address | Dirección: | Indirizzo: |
| ✅ | 93 | `l0p52ooe` | Fais un match à  | Play a game at  | Juega al fútbol en  | Gioca a calcio al  |
| ✅ | 94 | `vazemx9o` |  avec Poteau 👟 |  with Poteau 👟 |  con Poteau 👟 |  con Poteau 👟 |
| ✅ | 95 | `q9bxtq9u` | Envie d’un match sans te  | Want a game without break | ¿Quieres jugar un partido | Cerchi una partita senza  |
| ✅ | 96 | `pzo9n542` | Par exemple, à  | For example, at  | Por ejemplo, en  | Ad esempio, al  |
| ✅ | 97 | `mbzjn5pj` | , tu peux jouer pour  | , you can play for  | , puedes jugar por  | , puoi giocare per  |
| ✅ | 98 | `qy8acynx` | . | . | . | . |
| ✅ | 99 | `xozhjpu7` | L'application Poteau te p | The Poteau app lets you s | La app de Poteau te muest | L’app Poteau ti mostra tu |
| ✅ | 100 | `chxk5h16` | 👉 Plus d'infos sur  | 👉 More info on  | 👉 Más información sobre  | 👉 Maggiori informazioni  |
| ✅ | 101 | `8xd713uj` | poteau-app.com | poteau-app.com | poteau-app.com | poteau-app.com |
| ✅ | 102 | `u1zkt0oi` | Rendez-vous sur l'app Pot | Go to the Poteau app to j | Mira la app de Poteau par | Guarda l’app Poteau per t |
| ✅ | 103 | `zkd0grdg` | Ouvrir dans l'app | Open in the app | Abrir en la app | Apri nell’app |
| ✅ | 104 | `dx2n6amq` | Télécharger | Download | Descarga la aplicación | Scarica l'applicazione |
| ✅ | 105 | `cuh7sltv` | Tu ne peux pas rejoindre  | You cannot join this game | Último lugar disponible � | Ultimo posto disponibile  |
| ✅ | 106 | `cs10uuii` | Dernière place dispo | Last spot available | Último lugar disponible � | Ultimo posto disponibile  |
| ✅ | 107 | `rhy4kd93` | Plus qu'un joueur à trouv | Only one player to find | Último lugar disponible � | Ultimo posto disponibile  |
| ✅ | 108 | `ocra1341` | Dernière place dispo | Last spot available | Último lugar disponible � | Ultimo posto disponibile  |
| ✅ | 109 | `xlypcrir` | Plus que  | More than  | ¡Solo quedan  | Solo  |
| ✅ | 110 | `mna1m7y9` |  joueurs à trouver |  players to find |  lugares! |  posti disponibili |
| ✅ | 111 | `7qhussqu` | Plus que  | More than  | ¡Solo quedan  | Solo  |
| ✅ | 112 | `fpsldg1i` |  places dispo |  spots available |  lugares! |  posti disponibili |

---

## GiveFeedback

**Route:** `/feedback`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: FeedbackSaved

**Displayed Text (3 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `2pq91q7g` | Noter mon match | Rate my game | Califica mi partido | Valuta la mia partita |
| ✅ | 2 | `w18vr23q` | Les participants | Participants | Los participantes | I partecipanti |
| ✅ | 3 | `7pzf4cwz` | Valider | Validate | Validar | Convalidare |

---

## Home

**Route:** `/home`

**Navigation:**
- ← Comes from: f_Alert, f_Team, CitySelector, ConfigureAlert, a_Create, GameSheet, FeedbackSaved, Credits, EditMyProfile, Notifications, Contacts
- → Goes to: Ban, ValidateEmail, BPhoto, CPhone, DCity, ANickname, ESports, EditMyProfile, ACreate, FTeam

**Displayed Text (7 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `j28pc5s3` | Matchs | Games | Partidos | Partite |
| ✅ | 2 | `llbbn3p5` | Invitations | Invitations | Alertas e invitaciones | Avvisi e inviti |
| ✅ | 3 | `halks9ya` | Ton équipe | Your team | Clasificación Poteau | Classifica Poteau |
| ✅ | 4 | `ubtas69w` | Construire mon équipe Pot | Build my Poteau team | Clasificar a mis amigos | Classificare i miei amici |
| ✅ | 5 | `tfza49a9` | Deviens membre Poteau Gol | Become a Poteau Gold memb | Conviértete en miembro de | Diventa un membro Poteau  |
| ✅ | 6 | `c0f45q2m` | Fais partie des meilleurs | Join the best Poteau user | Conviértete en uno de los | Diventa uno dei migliori  |
| ✅ | 7 | `qryexdiy` | En savoir plus | Learn more | Más información | Saperne di più |

---

## InviteFriends

**Route:** `/game/:gameId/invite`

**Navigation:**
- ← Comes from: g_SummaryRepeat, GameSheet
- → Goes to: GameSheet

**Displayed Text (6 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `13ov32en` | Compléter le match | Complete the game | Invitar jugadores | Invita giocatori |
| ✅ | 2 | `ele31gqu` | Partager à mes amis | Share with my friends | Compartir con mis amigos | Condividi con i miei amic |
| ✅ | 3 | `lr8ar142` | Envoie une invitation à t | Send an invitation to you | Envía una invitación a tu | Invia un invito ai tuoi a |
| ✅ | 4 | `1vc4jiyq` | Envoyer le match | Send the game | Comparte el partido | Condividi la partita |
| ✅ | 5 | `m3095kh9` | Mon équipe sur Poteau | My team on Poteau | Mi equipo en Poteau | La mia squadra su Poteau |
| ✅ | 6 | `izaivr2d` | Invite les membres de ton | Invite your Poteau team m | Invita a los miembros de  | Invita i membri della tua |

---

## Invoices

**Route:** `/invoices`

**Navigation:**
- ← Comes from: Settings
- → Goes to: (no outbound navigation)

**Displayed Text (4 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `wzf79t1j` | Tes factures pour les mat | Your invoices for Poteau  | Tus facturas de partidos  | Le tue fatture per i fiam |
| ✅ | 2 | `eqwzspz8` | Paiement confirmé | Payment confirmed | Pago confirmado | Pagamento confermato |
| ✅ | 3 | `7r2qmuui` | Paiement annulé | Payment canceled | Pago cancelado | Pagamento annullato |
| ✅ | 4 | `pnmj7qbz` | Autorisation validée | Authorization validated | Autorización validada | Autorizzazione convalidat |

---

## Landing

**Route:** `/welcome`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: CreateAccount

**Displayed Text (8 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `xdal45v4` | 🇫🇷 | 🇫🇷 | 🇫🇷 | 🇫🇷 |
| ✅ | 2 | `ax2n3wpw` | 🇺🇸 | 🇺🇸 | 🇺🇸 | 🇺🇸 |
| ✅ | 3 | `i645ybhk` | 🇪🇸 | 🇪🇸 | 🇪🇸 | 🇪🇸 |
| ✅ | 4 | `qsxnygh4` | 🇮🇹 | 🇮🇹 | 🇮🇹 | 🇮🇹 |
| ✅ | 5 | `me6gigxm` | Continuer par email (5min | Continue by email (5min) | Continuar por correo elec | Continua via e-mail (4 mi |
| ✅ | 6 | `oemc1x3n` | En quelques secondes | In a few seconds | En unos segundos | Tra pochi secondi |
| ✅ | 7 | `xd2ziux3` | Continuer avec Apple | Continue with Apple | Continuar con Apple | Continua con Apple |
| ✅ | 8 | `9xdip6rk` | Continuer avec Google | Continue with Google | Continuar con Google | Continua con Google |

---

## LandingInvite

**Route:** `/invite`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: (no outbound navigation)

**Displayed Text (8 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `ukxl0w0k` | Poteau | Poteau | Poteau | Poteau |
| ✅ | 2 | `9bs7kc1i` | 4.7 | 4.7 | 4.7 | 4.7 |
| ✅ | 3 | `vv1k6ny6` | Voir l'app | View the app | Ver la aplicación | Visualizza l'app |
| ✅ | 4 | `oubx4u62` | veut que tu rejoignes | wants you to join | quiere que te unas | vuole che tu ti unisca |
| ✅ | 5 | `jc47qi8w` | sur Poteau | on Poteau | en Poteau | su Poteau |
| ✅ | 6 | `03hrm36t` | Continuer avec Apple | Continue with Apple | Continuar con Apple | Continua con Apple |
| ✅ | 7 | `rtu5qvvd` | Continuer avec Google | Continue with Google | Continuar con Google | Continua con Google |
| ✅ | 8 | `xk64meif` | Continuer par email (3min | Continue by email (3min) | Continuar por correo elec | Continua via e-mail (3 mi |

---

## LevelPickRole

**Route:** `/level/role`

**Navigation:**
- ← Comes from: MyProfile
- → Goes to: (no outbound navigation)

**Displayed Text (5 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `1dxzfnvi` | On est sur le terrain.\nT | We're on the pitch.\nWher | Estamos en el campo.\n¿Dó | Siamo sul campo.\nDove gi |
| ✅ | 2 | `m2py4pyn` | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE |
| ✅ | 3 | `m71if89w` | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE |
| ✅ | 4 | `oum2rs53` | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA |
| ✅ | 5 | `6xk9t3r6` | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE |

---

## LevelQuestion

**Route:** `/level/question`

**Navigation:**
- ← Comes from: LevelStart
- → Goes to: (no outbound navigation)

**Displayed Text (5 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `5618031b` | PADEL | PADEL | PÁDEL | PADEL |
| ✅ | 2 | `suw9jahv` | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE |
| ✅ | 3 | `1m20jwg7` | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE |
| ✅ | 4 | `ugobebe9` | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA |
| ✅ | 5 | `ijg5ktj9` | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE |

---

## LevelReveal

**Route:** `/level/reveal`

**Navigation:**
- ← Comes from: MyProfile
- → Goes to: (no outbound navigation)

**Displayed Text (16 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `3gb450zm` | PADEL | PADEL | PÁDEL | PADEL |
| ✅ | 2 | `1jl38rtb` | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE |
| ✅ | 3 | `klzi7pk3` | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE |
| ✅ | 4 | `a84mm4rq` | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA |
| ✅ | 5 | `wajwnlgc` | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE |
| ✅ | 6 | `s5l57qp3` | PADEL | PADEL | PÁDEL | PADEL |
| ✅ | 7 | `h3vm9ylo` | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE |
| ✅ | 8 | `fitpjiyi` | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE |
| ✅ | 9 | `mkcp05p7` | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA |
| ✅ | 10 | `fta2sm2y` | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE |
| ✅ | 11 | `chdve5oa` | Partage ton score | Share your score | Muestra tu puntuación | Mostra il tuo punteggio |
| ✅ | 12 | `jrak23tq` | poteau.app/quiz | poteau.app/quiz | poteau.app/quiz | poteau.app/quiz |
| ✅ | 13 | `xvxc6bh8` | Voir mon profil | View my profile | Ver mi perfil | Visualizza il mio profilo |
| ✅ | 14 | `bkjreqlq` | Supprimer mon score | Delete my score | Eliminar mi puntuación | Elimina il mio punteggio |
| ✅ | 15 | `2ps0jpfg` | Télécharger Poteau | Download Poteau | Muestra tu puntuación | Mostra il tuo punteggio |
| ✅ | 16 | `0mldst42` | poteau.app/quiz | poteau.app/quiz | poteau.app/quiz | poteau.app/quiz |

---

## LevelSelfScore

**Route:** `/level/selfscore`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: (no outbound navigation)

**Displayed Text (8 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `jokud392` | PADEL | PADEL | PÁDEL | PADEL |
| ✅ | 2 | `fx9y8v2j` | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE |
| ✅ | 3 | `au96hg0r` | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE |
| ✅ | 4 | `n9bzyy6u` | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA |
| ✅ | 5 | `wld71exx` | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE |
| ✅ | 6 | `08sxviwc` | Ça y est !  | That's it!  | ¡Eso es!  | Ecco fatto!  |
| ✅ | 7 | `emhphyuc` | On a estimé ton niveau av | We estimated your soccer  | Hemos estimado tu nivel c | Abbiamo stimato il tuo li |
| ✅ | 8 | `3juzmnfs` | Avant qu’on te le dise,\n | Before anyone tells you,\ | Antes de que te lo digamo | Prima che te lo diciamo,\ |

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

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `98mrdcyq` | Tape ton numéro de téléph | Enter your phone number t | Introduce tu número de te | Inserisci il tuo numero d |
| ✅ | 2 | `vw1kinm6` | Tu pourras relier ton sco | You can link your score w | Podrás vincular tu puntua | Potrai collegare il tuo p |
| ✅ | 3 | `9v88kq9h` | Pays | Country | País | Paese |
| ✅ | 4 | `e7m9f7pw` | Pays | Country | País | Paese |
| ✅ | 5 | `tj9j7ue8` | Découvrir mon score | Discover my score | Descubre mi puntuación | Scopri il mio punteggio |

---

## LogIn

**Route:** `/connect`

**Navigation:**
- ← Comes from: CreateAccount
- → Goes to: (no outbound navigation)

**Displayed Text (6 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `y1zltcit` | Connexion | Login | Acceso | Login |
| ✅ | 2 | `tnqik021` | Entre ton adresse mail | Enter your email address | Introduce tu dirección de | Inserisci il tuo indirizz |
| ✅ | 3 | `6u9t0fci` | Et ton mot de passe | And your password | Y tu contraseña | E la tua password |
| ✅ | 4 | `oxs6f1gc` | Entre ton adresse mail av | Enter your email address  | Ingrese su dirección de c | Inserisci il tuo indirizz |
| ✅ | 5 | `4m4vnud4` | Mot de passe oublié | Forgot password | ¿Olvidaste tu contraseña? | Hai dimenticato la passwo |
| ✅ | 6 | `w6z9pnmu` | Valider | Validate | Validar | Convalidare |

---

## ManageAlerts

**Route:** `/managealerts`

**Navigation:**
- ← Comes from: ConfigureAlert, Settings
- → Goes to: ConfigureAlert

**Displayed Text (3 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `qq897h9g` | Gérer mes alertes | Manage my alerts | Administrar mis alertas | Gestisci i miei avvisi |
| ✅ | 2 | `t1q3ke5k` | Aucune alerte pour le mom | No alerts at the moment | No hay alertas por el mom | Nessun avviso al momento |
| ✅ | 3 | `nypn71mj` | Ajouter une alerte | Add an alert | Agregar una alerta | Aggiungi un avviso |

---

## MyProfile

**Route:** `/me`

**Navigation:**
- ← Comes from: BecomeGold, GameSheet, EditMyProfile, FavoriteClub, Profile
- → Goes to: Ban, Settings, LevelReveal, LevelPickRole, FavoriteClub, FavoriteSelection

**Displayed Text (16 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `116jm5pc` | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE |
| ✅ | 2 | `snke67gc` | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE |
| ✅ | 3 | `juovzkeq` | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA |
| ✅ | 4 | `alwpx6ya` | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE |
| ✅ | 5 | `niar68zc` | PADEL | PADEL | PÁDEL | PADEL |
| ✅ | 6 | `hv2f2d5c` | joue pour | plays for | juega para | gioca per |
| ✅ | 7 | `pu8t4dyn` | S'amuser | Have fun | Disfrutar | Divertirsi |
| ✅ | 8 | `8tws6i5d` | Tout gagner | Win everything | Ganarlo todo | Vincere tutto |
| ✅ | 9 | `sqv5x6cy` | Ajouter un objectif | Add a goal | Añadir un objetivo | Aggiungi un obiettivo |
| ✅ | 10 | `kxk5iops` | supporte | support | apoya | supporta |
| ✅ | 11 | `jd3pg2oi` | Ajouter un club | Add a club | Añadir un club | Aggiungi un club |
| ✅ | 12 | `4mvd7k8s` | Ajouter une sélection | Add a selection | Agregar una selección | Aggiungi una selezione |
| ✅ | 13 | `v7i2q6s5` | On enregistre la photo… | Saving the photo... | Guardamos la foto… | Salviamo la foto... |
| ✅ | 14 | `3fbtz7di` | C'est bon ! | All good! | ¡Es bueno! | Va bene! |
| ✅ | 15 | `6g7dpxss` | On n'a pas réussi à enreg | We couldn't save the phot | No pudimos guardar la fot | Impossibile salvare la fo |
| ✅ | 16 | `zxowvw8z` | Partager | Share | Compartir | Suddividere |

---

## Notifications

**Route:** `/notifications`

**Navigation:**
- ← Comes from: (entry point or deep link)
- → Goes to: Home

**Displayed Text (2 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `c0g44z9g` | Notifications | Notifications | Notificaciones | Notifiche |
| ✅ | 2 | `39tp6vcx` | Aucune notification reçue | No notifications received | Ninguna notificación reci | Nessuna notifica ricevuta |

---

## Profile

**Route:** `/user/:thisUser`

**Navigation:**
- ← Comes from: GameSheet
- → Goes to: MyProfile, Games

**Displayed Text (12 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `2g1sfc0v` | GARDIEN DE BUT | GOALKEEPER | PORTERO | PORTIERE |
| ✅ | 2 | `4gdhkoqg` | DÉFENSEUR | DEFENDER | DEFENSOR | DIFENSORE |
| ✅ | 3 | `j5wnivet` | MILIEU DE TERRAIN | MIDFIELDER | CENTROCAMPISTA | CENTROCAMPISTA |
| ✅ | 4 | `x174in8j` | ATTAQUANT | FORWARD | DELANTERO | ATTACCANTE |
| ✅ | 5 | `aaz9ehsw` | PADEL | PADEL | PÁDEL | PADEL |
| ✅ | 6 | `l8bbn08n` | joue pour | plays for | juega para | gioca per |
| ✅ | 7 | `8q0qebe0` | S'amuser | Have fun | Disfrutar | Divertirsi |
| ✅ | 8 | `tzrerkwp` | Tout gagner | Win everything | Ganarlo todo | Vincere tutto |
| ✅ | 9 | `dy62pp61` | supporte | support | apoya | supporta |
| ✅ | 10 | `v7i2q6s5` | On enregistre la photo… | Saving the photo... | Guardamos la foto… | Salviamo la foto... |
| ✅ | 11 | `3fbtz7di` | C'est bon ! | All good! | ¡Es bueno! | Va bene! |
| ✅ | 12 | `6g7dpxss` | On n'a pas réussi à enreg | We couldn't save the phot | No pudimos guardar la fot | Impossibile salvare la fo |

---

## Settings

**Route:** `/settings`

**Navigation:**
- ← Comes from: MyProfile
- → Goes to: BecomeGold, EditMyProfile, ManageAlerts, Invoices, Credits, Features

**Displayed Text (48 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `u6fs1jzm` | Devenir Poteau Gold | Become Poteau Gold | Convertirse en Poteau Gol | Diventa Poteau Gold |
| ✅ | 2 | `6lvzzn98` | Fais partie des meilleurs | Join the best Poteau user | Conviértete en uno de los | Diventa uno dei migliori  |
| ✅ | 3 | `x2cv443f` | Mes réglages | My settings | Mis ajustes | Le mie impostazioni |
| ✅ | 4 | `9z5tlq1v` | Modifier mon profil | Edit my profile | Modificar mi perfil | Modifica il mio profilo |
| ✅ | 5 | `56q7a9cn` | ✏️ | ✏️ | ✏️ | ✏️ |
| ✅ | 6 | `ujpdmskr` | Personnalise ton profil e | Customize your profile an | Personaliza tu perfil y g | Personalizza il tuo profi |
| ✅ | 7 | `3zddgolr` | Gérer mes alertes | Manage my alerts | Administrar mis alertas | Gestisci i miei avvisi |
| ✅ | 8 | `ohs44vgi` | 🔔 | 🔔 | 🔔 | 🔔 |
| ✅ | 9 | `pexz1zjg` | Reçois des invitations po | Receive invitations to pl | Recibe invitaciones para  | Ricevi inviti per giocare |
| ✅ | 10 | `o41c4k7k` | Gérer mes notifications | Manage my notifications | Gestionar mis notificacio | Gestisci le mie notifiche |
| ✅ | 11 | `fliiqu2t` | 📳 | 📳 | 📳 | 📳 |
| ✅ | 12 | `b77vxowe` | Tu préfères recevoir tes  | How would you prefer to r | ¿Prefieres recibir tus no | Preferisci ricevere le tu |
| ✅ | 13 | `4jjqku3h` | Push | Push | Push | Push |
| ✅ | 14 | `v5zqiu0z` | Push | Push | Push | Push |
| ✅ | 15 | `670ykhax` | Email | Email | Correo electrónico | Email |
| ✅ | 16 | `ximv2sc8` | Email | Email | Correo electrónico | Email |
| ✅ | 17 | `pepbnbxv` | 🧾 | 🧾 | 🧾 | 🧾 |
| ✅ | 18 | `vmnbyd69` | Changer le langage | Change language | Cambiar el idioma | Cambia lingua |
| ✅ | 19 | `bov2i1ns` | 🌍 | 🌍 | 🌍 | 🌍 |
| ✅ | 20 | `xsawsbrm` | Tu ne veux plus que l'app | Don't want the app to dis | ¿Ya no quieres que la app | Non vuoi più che l'app si |
| ✅ | 21 | `n6bfbi9w` | 🇫🇷 | 🇫🇷 | 🇫🇷 | 🇫🇷 |
| ✅ | 22 | `9z2gjdak` | 🇺🇸 | 🇺🇸 | 🇺🇸 | 🇺🇸 |
| ✅ | 23 | `zcmo33nq` | 🇪🇸 | 🇪🇸 | 🇪🇸 | 🇪🇸 |
| ✅ | 24 | `2mdncldz` | 🇮🇹 | 🇮🇹 | 🇮🇹 | 🇮🇹 |
| ✅ | 25 | `3q22jivp` | Comment soutenir Poteau ? | How to support Poteau? | ¿Cómo apoyar a Poteau? | Come sostenere Poteau? |
| ✅ | 26 | `364q9bdg` | Suivre Poteau sur Insta | Follow Poteau on Insta | Sigue a Poteau en Insta | Segui Poteau su Insta |
| ✅ | 27 | `ynylz7t6` | Suivre Poteau sur TikTok | Follow Poteau on TikTok | Sigue a Poteau en TikTok | Segui Poteau su TikTok |
| ✅ | 28 | `odqgjhvq` | Donner de la force | Give strength | Dar fuerza | Dare forza |
| ✅ | 29 | `qb5vyf5n` | 💪 | 💪 | 💪 | 💪 |
| ✅ | 30 | `juj6q4u1` | Si tu veux soutenir Potea | If you want to support Po | Si quieres apoyar a Potea | Se vuoi supportare Poteau |
| ✅ | 31 | `kxdy6j6l` | Nos remerciements | Our thanks | Nuestros agradecimientos | I nostri ringraziamenti |
| ✅ | 32 | `02lsuzf1` | 🦸‍♂️ | 🦸‍♂️ | 🦸‍♂️ | 🦸‍♂️ |
| ✅ | 33 | `2ubjgyj6` | Retrouve celles et ceux s | Find those without whom P | Encuentra a aquellos sin  | Ritrova coloro senza i qu |
| ✅ | 34 | `auz85449` | Besoin d'aide ? | Need help? | ¿Necesitas ayuda? | Hai bisogno di aiuto? |
| ✅ | 35 | `fnlltynp` | Vos questions sur Poteau | Your questions about Pote | Tus preguntas sobre Potea | Le tue domande su Poteau |
| ✅ | 36 | `6wx5x06d` | ❓ | ❓ | ❓ | ❓ |
| ✅ | 37 | `fgyakkjo` | Voter pour les nouveautés | Vote for new features | Vota por las nuevas funci | Vota per le nuove funzion |
| ✅ | 38 | `m221mq08` | 🗳️ | 🗳️ | 🗳️ | 🗳️ |
| ✅ | 39 | `qq3o5kjx` | Aide-nous à choisir les p | Help us choose the next a | Ayúdanos a elegir las pró | Aiutaci a scegliere le pr |
| ✅ | 40 | `9la67r3r` | Nous envoyer un message | Send us a message | Envíanos un mensaje | Inviaci un messaggio |
| ✅ | 41 | `avomicxc` | 💬 | 💬 | 💬 | 💬 |
| ✅ | 42 | `jkv3j6t8` | Il y a un problème que tu | Is there a problem you're | ¿Hay un problema que está | C'è un problema che incon |
| ✅ | 43 | `8zenkve0` | Tape ton message ici… | Type your message here… | Escribe tu mensaje aquí… | Scrivi il tuo messaggio q |
| ✅ | 44 | `r3j8wkia` | Envoyer | Send | Enviar | Inviare |
| ✅ | 45 | `1xak3y8g` | Se déconnecter | Log out | Cerrar sesión | Disconnettersi |
| ✅ | 46 | `crpkhvgn` | Lire les conditions génér | Read the terms and condit | Leer los términos y condi | Leggi i termini e condizi |
| ✅ | 47 | `i396d6vx` | Lire la politique de conf | Read the privacy policy | Leer la política de priva | Leggi l'informativa sulla |
| ✅ | 48 | `7i740fym` | Supprimer mon compte | Delete my account | Eliminar mi cuenta | Elimina il mio account |

---

## ValidateEmail

**Route:** `/emailvalidation`

**Navigation:**
- ← Comes from: Games, Home, GameSheet, EditMyProfile
- → Goes to: Ban

**Displayed Text (3 items):**

| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |
|--------|---|-----|-----------|------------|------------|------------|
| ✅ | 1 | `bs0hut5f` | Valide ton email | Verify your email | Valida tu email | Conferma la tua email |
| ✅ | 2 | `opjw5nlt` | On a envoyé un code à 4 c | We sent a 4-digit code to | Hemos enviado un código d | Abbiamo inviato un codice |
| ✅ | 3 | `gtjfeha0` | . Entre-le ci-dessous pou | . Enter it below to conti | . Introdúcelo abajo para  | . Inseriscilo qui sotto p |

---


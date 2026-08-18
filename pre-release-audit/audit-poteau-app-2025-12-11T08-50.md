# Pre-Release Audit Report

**App:** Poteau App (B2C)
**Generated:** 2025-12-11T08-50
**Tool Version:** 1.0.0

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Translation Keys | 938 |
| Complete (all 4 languages) | 579 (62%) |
| Partial (missing some) | 322 |
| Empty (all languages) | 37 |

### Coverage by Language

| Language | Filled | Empty | Coverage |
|----------|--------|-------|----------|
| French (fr) | 901 | 37 | 96% |
| English (en) | 900 | 38 | 96% |
| Spanish (es) | 579 | 359 | 62% |
| Italian (it) | 579 | 359 | 62% |

---

## 🚨 Critical Issues (Empty Translations)

### Missing Spanish AND Italian (321 keys)

| Key ID | French Text | English Text |
|--------|-------------|-------------|
| `tp322bwl` | Historique... | - |
| `vwtoqrue` | Partager... | - |
| `pjclf89i` | Match privé... | - |
| `w94jvrfq` | Confirmer... | - |
| `z7rhy7rs` | Tu as envie de jouer ?... | - |
| `pbysew3f` | Une personne veut jouer... | - |
| `go9yyjv2` |  personnes veulent jouer... | - |
| `dgkyral9` | Ouvrir l\... | - |
| `a7f0rvho` | Suivre ce match... | - |
| `h58iit6s` | Arrêter de suivre... | - |
| `e7ov6f6l` | + ... | - |
| `isvub5cm` |  autres joueurs... | - |
| `frboo5yt` | NOUVEAU SUR POTEAU\n... | - |
| `2iu44vh3` | Réagis aux messages : reste appuyé sur n... | - |
| `whsppjk0` | Il n\... | - |
| `7fs24xzg` | 🌍... | - |
| `ysy54p8x` | Visible par tout le monde... | - |
| `fwz7b6lr` | Tous les membres de la communauté peuven... | - |
| `jidec2ik` | Restreindre la visibilité... | - |
| `f3vzdxas` | 🔒... | - |
| `te8rjhj6` | Visible par tes amis... | - |
| `miu8ki1c` | Seuls tes amis Poteau et ceux à qui tu e... | - |
| `e2xjgxii` | Rendre visible par tous... | - |
| `hti1fay2` | Réservé aux membres Gold... | - |
| `ghw93olh` | Ton match est très demandé : on va t\... | - |
| `yrpg8xkf` | Pour que ce soit des joueurs fiables, on... | - |
| `doyhb224` | L’accès s’ouvrira à tout le monde ... | - |
| `us6skh7t` | h avant le coup d’envoi si jamais il man... | - |
| `8yvdcytq` | Tu es membre Gold ✅... | - |
| `29uay1ol` | Tu peux donc choisir de l\... | - |
| `32rgxhnk` | Ouvrir l\... | - |
| `tckcbt9i` | Tu peux choisir de l\... | - |
| `ti91u5a7` | En savoir plus... | - |
| `4lanklkj` | N\... | - |
| `ttxl0k3i` | Actuellement, ton match n\... | - |
| `3o27maq7` | On a mis en place un abonnement Gold pou... | - |
| `csfo0pb9` | On te recommande de contacter les joueur... | - |
| `b2632rcf` | Sinon, tu peux choisir de le réserver au... | - |
| `qa9ccfyf` | Donner la priorité aux membres Gold... | - |
| `edm826sl` | Ton match a lieu dans moins de 3h, tous ... | - |
| `8wl8fj0y` | Ajouter le lien de paiement... | - |
| `zjcphxrs` | Quitter le match... | - |
| `id4spamy` | Annuler mon match... | - |
| `bwfhccm9` | Tu viens juste de publier ton match, tu ... | - |
| `dgxu5lgz` | Match privé... | - |
| `x32dawoy` | C\... | - |
| `c33fs487` | En devenant membre Gold, tu auras la mai... | - |
| `xedtnaa7` | Ajouter des photos dans la discussion... | - |
| `hhjwtogu` | Choisir si ton match est réservé aux Gol... | - |
| `iwbhp92a` | Retirer des joueurs de tes matchs... | - |

*...and 271 more*

---

## ⚠️ Suspicious Duplicates (Possible Copy-Paste Errors)

These translations have the same text in French and another language:

| Key ID | Issue | Text |
|--------|-------|------|
| `gdsxpwkr` | ES same as FR | Karim Boudebouz... |
| `hh6k4gp3` | ES same as FR | Pablo da Fonseca... |
| `hh6k4gp3` | IT same as FR | Pablo da Fonseca... |
| `phjdz1wh` | ES same as FR | Sadio Mané... |
| `139ueuu0` | ES same as FR | Sadio Mané... |
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

## 📱 Screen-by-Screen Analysis

**Screens with issues:** 23  
**Clean screens:** 29

### Settings

- **Path:** `/settings`
- **Translations:** 0 complete, 48 incomplete
- **Navigates to:** BecomeGold, EditMyProfile, ManageAlerts, Invoices, Credits, Features

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `u6fs1jzm` | Devenir Poteau Gold | es, it |
| `6lvzzn98` | Fais partie des meilleurs util | es, it |
| `x2cv443f` | Mes réglages | es, it |
| `9z5tlq1v` | Modifier mon profil | es, it |
| `56q7a9cn` | ✏️ | es, it |
| `ujpdmskr` | Personnalise ton profil et gèr | es, it |
| `3zddgolr` | Gérer mes alertes | es, it |
| `ohs44vgi` | 🔔 | es, it |
| `pexz1zjg` | Reçois des invitations pour jo | es, it |
| `o41c4k7k` | Gérer mes notifications | es, it |

### GameSheet

- **Path:** `/game/:gameId`
- **Translations:** 66 complete, 46 incomplete
- **Navigates to:** Ban, ValidateEmail, BecomeGold, MyProfile, Profile, InviteFriends, EditMyGame, Home

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `vwtoqrue` | Partager | es, it |
| `pjclf89i` | Match privé | es, it |
| `w94jvrfq` | Confirmer | es, it |
| `z7rhy7rs` | Tu as envie de jouer ? | es, it |
| `pbysew3f` | Une personne veut jouer | es, it |
| `go9yyjv2` |  personnes veulent jouer | es, it |
| `dgkyral9` | Ouvrir l\ | es, it |
| `a7f0rvho` | Suivre ce match | es, it |
| `h58iit6s` | Arrêter de suivre | es, it |
| `e7ov6f6l` | +  | es, it |

### BecomeGold

- **Path:** `/gold`
- **Translations:** 15 complete, 24 incomplete
- **Navigates to:** MyProfile, GameSheet

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `x32dawoy` | C\ | es, it |
| `c33fs487` | En devenant membre Gold, tu au | es, it |
| `xedtnaa7` | Ajouter des photos dans la dis | es, it |
| `hhjwtogu` | Choisir si ton match est réser | es, it |
| `iwbhp92a` | Retirer des joueurs de tes mat | es, it |
| `mahsyof3` | Choisis ton abonnement : | es, it |
| `oypkui55` | Hebdo | es, it |
| `infayyyc` | /semaine | es, it |
| `ic7n2cr3` | Mensuel | es, it |
| `x99jm7u1` | /semaine | es, it |

### d_TypeVisibility

- **Path:** `/new/type`
- **Translations:** 1 complete, 12 incomplete
- **Navigates to:** ELevelMood

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `4iu5wat7` | 70% | es, it |
| `lfiodv6n` | C\ | es, it |
| `0bep8m0r` | Pour l\ | es, it |
| `avvle7zg` | Pour l\ | es, it |
| `dsoqvc3r` | Pour l\ | es, it |
| `t301d7dg` | 🔗 | es, it |
| `vqo90y2l` | Par tes amis seulement | es, it |
| `enteqnnr` | Ceux à qui tu enverras le lien | es, it |
| `g6hur4kt` | 🌍 | es, it |
| `sgxqz6ep` | Par tout le monde | es, it |

### BuildMyTeam

- **Path:** `/buildmyteam`
- **Translations:** 0 complete, 11 incomplete
- **Navigates to:** None

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `9g36rf23` | Construire mon équipe | es, it |
| `39p80bof` | Envoyer mon lien d\ | es, it |
| `mcjurwtf` | Invite tes potes à rejoindre t | es, it |
| `tbew63gd` | Comme ça, ils pourront s\ | es, it |
| `a71i64f9` | L\ | es, it |
| `1ssngfzn` |  t\ | es, it |
| `czbbx7jj` | Partager à mes potes | es, it |
| `aj0lq7hj` | Inviter depuis WhatsApp | es, it |
| `hzqawrct` | Ajouter des joueurs Poteau | es, it |
| `ia1f5mir` | Recherche tes amis parmi les m | es, it |

### a_Create

- **Path:** `/new/sport`
- **Translations:** 11 complete, 10 incomplete
- **Navigates to:** Ban, Home, Games

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `d45o0mw9` | Tu organises un match de quoi  | es, it |
| `0117ye8q` | Foot | es, it |
| `92s7zrk8` | Padel | es, it |
| `fq063upp` | Foot | es, it |
| `4pvml5y7` | Padel | es, it |
| `sjvebma2` | Foot | es, it |
| `cpkxc9uy` | Padel | es, it |
| `hg6geiee` | Non, pas encore | es, it |
| `rj0cxne2` | Non, pas encore | es, it |
| `zx6yjsz0` | Non, pas encore | es, it |

### e_LevelMood

- **Path:** `/new/level`
- **Translations:** 1 complete, 9 incomplete
- **Navigates to:** FPrice

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `atfjyc2q` | 80% | es, it |
| `935pphkw` | Quel est le niveau du match ? | es, it |
| `7gt2pv0d` | Et c\ | es, it |
| `qlc6dmzh` | S\ | es, it |
| `s30adgwe` | Tout gagner | es, it |
| `wgfcwe0j` | S\ | es, it |
| `ivtavqrp` | Tout gagner | es, it |
| `n5p1ry81` | S\ | es, it |
| `zg5yj4ax` | Tout gagner | es, it |

### EditMyProfile

- **Path:** `/edit`
- **Translations:** 26 complete, 9 incomplete
- **Navigates to:** ValidateEmail, BPhoto, CPhone, DCity, ANickname, MyProfile, Home

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `dx50op5m` | Modifier mon profil | es, it |
| `1n2bbm5e` | S\ | es, it |
| `5epwtiky` | Tout gagner | es, it |
| `4olfeif4` | S\ | es, it |
| `i7bwdebc` | Tout gagner | es, it |
| `z5johfyv` | S\ | es, it |
| `my4z7vce` | Tout gagner | es, it |
| `f7oqf6gk` | Foot | es, it |
| `okxpgwnn` | Padel | es, it |

### g_SummaryRepeat

- **Path:** `/new/recap`
- **Translations:** 5 complete, 7 incomplete
- **Navigates to:** InviteFriends

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `7frd9teg` | 99% | es, it |
| `dwpmdt8l` | Terrain réservé | es, it |
| `t2dizl3s` | C\ | es, it |
| `ocny1kta` | Oui, répéter ce match chaque s | es, it |
| `d7ylhyjd` | Non, juste pour cette fois | es, it |
| `my1c05hs` | Modifie le nom de la résa et m | es, it |
| `he8eqzdl` | Publier mon match | es, it |

### MyProfile

- **Path:** `/me`
- **Translations:** 11 complete, 5 incomplete
- **Navigates to:** Ban, Settings, LevelReveal, LevelPickRole, FavoriteClub, FavoriteSelection

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `116jm5pc` | GARDIEN DE BUT | es, it |
| `snke67gc` | DÉFENSEUR | es, it |
| `juovzkeq` | MILIEU DE TERRAIN | es, it |
| `alwpx6ya` | ATTAQUANT | es, it |
| `niar68zc` | PADEL | es, it |

### c_DateAndTime

- **Path:** `/new/date`
- **Translations:** 1 complete, 5 incomplete
- **Navigates to:** DTypeVisibility

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `q6wrkd6q` | 50% | es, it |
| `36e4pztv` | Ton match a lieu quel jour ? | es, it |
| `54kfhhgl` | À quelle heure ? | es, it |
| `4l532nl9` | et jusqu\ | es, it |
| `08hx7q5g` | Double check le jour de ton ma | es, it |

### EditMyGame

- **Path:** `/game/:gameId/edit`
- **Translations:** 83 complete, 5 incomplete
- **Navigates to:** GameSheet

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `9ty11xd1` | Le style | es, it |
| `5pcmpiv3` | 😁 Détente | es, it |
| `3bg7dcm5` | 🏆 Compétition | es, it |
| `oa014iw9` | Sélectionner | es, it |
| `1c9su05l` | Le niveau | es, it |

### Profile

- **Path:** `/user/:thisUser`
- **Translations:** 8 complete, 4 incomplete
- **Navigates to:** MyProfile, Games

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `2g1sfc0v` | GARDIEN DE BUT | es, it |
| `4gdhkoqg` | DÉFENSEUR | es, it |
| `j5wnivet` | MILIEU DE TERRAIN | es, it |
| `x174in8j` | ATTAQUANT | es, it |

### Notifications

- **Path:** `/notifications`
- **Translations:** 0 complete, 2 incomplete
- **Navigates to:** Home

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `c0g44z9g` | Notifications | es, it |
| `39tp6vcx` | Aucune notification reçue\n(po | es, it |

### CreateAccount

- **Path:** `/signup`
- **Translations:** 8 complete, 1 incomplete
- **Navigates to:** LogIn

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `738auohw` | Cette adresse n\ | es, it |

### ValidateEmail

- **Path:** `/emailvalidation`
- **Translations:** 2 complete, 1 incomplete
- **Navigates to:** Ban

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `bs0hut5f` | Valide ton email | es, it |

### c_Phone

- **Path:** `/onboarding/phone`
- **Translations:** 6 complete, 1 incomplete
- **Navigates to:** DCity

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `qepqvoce` | Pays | es, it |

### f_Team

- **Path:** `/team`
- **Translations:** 6 complete, 1 incomplete
- **Navigates to:** Home

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `c6fsht1o` | L\ | es, it |

### CitySelector

- **Path:** `/city`
- **Translations:** 2 complete, 1 incomplete
- **Navigates to:** FAlert, Home, Games

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `tp322bwl` | Historique | es, it |

### f_Price

- **Path:** `/new/price`
- **Translations:** 4 complete, 1 incomplete
- **Navigates to:** GSummaryRepeat

**Missing translations:**

| Key | FR Text | Missing |
|-----|---------|--------|
| `j84wpvi1` | 90% | es, it |

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


# Pre-Release Audit Report

**App:** Poteau App (B2C)
**Generated:** 2025-12-13T11-18
**Tool Version:** 1.0.0

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Translation Keys | 938 |
| Complete (all 4 languages) | 900 (96%) |
| Partial (missing some) | 1 |
| Empty (all languages) | 37 |

### Coverage by Language

| Language | Filled | Empty | Coverage |
|----------|--------|-------|----------|
| French (fr) | 901 | 37 | 96% |
| English (en) | 900 | 38 | 96% |
| Spanish (es) | 900 | 38 | 96% |
| Italian (it) | 900 | 38 | 96% |

---

## 🚨 Critical Issues (Empty Translations)

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


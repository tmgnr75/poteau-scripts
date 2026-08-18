// ============================================================
//  POTEAU BILLING — Configuration
// ============================================================

const REPORTING_SHEET_ID = '1jkekhti9_9UgRCmsFN3ceINb5seakO-IqNl7BYHcYjk';
const BILLING_SHEET_ID = '1SDNSA_I0MCemhG5hOLNyn_8QhHLHHGEZ_def1btoRsY';

const GOCARDLESS_ACCESS_TOKEN = process.env.GOCARDLESS_ACCESS_TOKEN;
if (!GOCARDLESS_ACCESS_TOKEN) {
  console.error('Missing GOCARDLESS_ACCESS_TOKEN in the environment.');
  console.error('Run:  source ~/.poteau/gocardless.env');
  process.exit(1);
}

// Pricing tiers (HT in euros) — same as "Pricing model & Data" tab
// 0-5 = free, 6-11 = 99, 12-17 = 199, 18-23 = 299, 24+ = 599
function getPriceHT(gamesPlayed) {
  if (gamesPlayed <= 5) return 0;
  if (gamesPlayed <= 11) return 99;
  if (gamesPlayed <= 17) return 199;
  if (gamesPlayed <= 23) return 299;
  return 599;
}

const TVA_RATE = 0.20;

// French month names for invoice display
const FRENCH_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

// Short french month codes for GoCardless reference
const FRENCH_MONTH_CODES = [
  'JAN', 'FEV', 'MAR', 'AVR', 'MAI', 'JUN',
  'JUL', 'AOU', 'SEP', 'OCT', 'NOV', 'DEC'
];

// ── CENTRE MAPPING ──────────────────────────────────────────
// Maps each centre to:
//   uid:           Firebase organizer UID
//   billingName:   Name as it appears in Billing > Centres (col A) for VLOOKUP
//   reportingName: Name as it appears in Reporting > PLAYERS or Indies (col A)
//   reportingTab:  'PLAYERS' or 'Indies'
//   reportingRow:  Row offset within the revenue section (row in revenue block)
//   matchesRow:    Row offset within the matches section
//   customerID:    GoCardless customer ID (from Billing > Centres col G)
//   skip:          If true, skip this centre entirely (e.g. Stadium Thiais = annual)
//   paymentType:   'on-site' | 'in-app' | 'hybrid' — from Firestore, but we default to on-site

const CENTRES = [
  // ── PLAYERS tab (4PADEL / LE FIVE) ──
  {
    uid: 'gYGkBpA9N0OhLOKlgXx9ja96UA73',
    billingName: null, // no billing — service is free for 4PADEL
    reportingName: '4PADEL Argenteuil',
    reportingTab: 'PLAYERS',
    revenueRow: 4, matchesRow: 25,
    customerID: null,
  },
  {
    uid: 'U3MriTZbPbTUEsU6RtRuHxDMKvg2',
    billingName: 'TRIBAL FOOT (LE FIVE Bezons)',
    reportingName: 'LE FIVE Bezons',
    reportingTab: 'PLAYERS',
    revenueRow: 5, matchesRow: 26,
    customerID: 'CU002ZV6NK3SCT',
  },
  {
    uid: '4owi3i7t8EOvFNF6UQvACOpiDRy1',
    billingName: 'TRIBAL FOOT (LE FIVE Bobigny)',
    reportingName: 'LE FIVE Bobigny',
    reportingTab: 'PLAYERS',
    revenueRow: 6, matchesRow: 27,
    customerID: 'CU00300VYJMBVK',
  },
  {
    uid: 'kiDzYpNkEQWCYPKWN7rYKH3iQrp2',
    billingName: null,
    reportingName: 'LE FIVE Bordeaux',
    reportingTab: 'PLAYERS',
    revenueRow: 7, matchesRow: 28,
    customerID: null,
  },
  {
    uid: 'evlV9mUgATYQ5343zpYZvk4w0r03',
    billingName: 'LE FIVE Champigny',
    reportingName: 'LE FIVE Champigny',
    reportingTab: 'PLAYERS',
    revenueRow: 8, matchesRow: 29,
    customerID: 'CU003012G067VA',
  },
  {
    uid: 'nkME2s5zOrP9Boid6uPgOz1Ssfi1',
    billingName: 'TRIBAL FOOT (LE FIVE Colombes)',
    reportingName: 'LE FIVE Colombes',
    reportingTab: 'PLAYERS',
    revenueRow: 9, matchesRow: 30,
    customerID: 'CU01KQ28ZBA352',
  },
  {
    uid: 'ZmXMWx7aTdPoPkkGOWa2HIQVblq2',
    billingName: 'LE FIVE Créteil',
    reportingName: 'LE FIVE Créteil',
    reportingTab: 'PLAYERS',
    revenueRow: 10, matchesRow: 31,
    customerID: 'CU003018YTRE8E',
  },
  {
    uid: '1GfAHFfqO6dOj37bPrTRuDS5gnk1',
    billingName: 'LE FIVE Marville',
    reportingName: 'LE FIVE Marville',
    reportingTab: 'PLAYERS',
    revenueRow: 11, matchesRow: 32,
    customerID: 'CU003011H209R0',
  },
  {
    uid: 'u9uC1vjdcdQ3UqNxI0SiFxor0m43',
    billingName: 'LE FIVE Montreuil',
    reportingName: 'LE FIVE Montreuil',
    reportingTab: 'PLAYERS',
    revenueRow: 12, matchesRow: 33,
    customerID: 'CU003011PMF4BP',
  },
  {
    uid: 'CtMIzMx3atVuH1nKNOJj6lNQL4A2',
    billingName: null,
    reportingName: 'LE FIVE OL',
    reportingTab: 'PLAYERS',
    revenueRow: 13, matchesRow: 34,
    customerID: null,
  },
  {
    uid: 'aK807pAjR0fYf1xp6STGgehCREy2',
    billingName: null,
    reportingName: 'LE FIVE Orléans Fleury',
    reportingTab: 'PLAYERS',
    revenueRow: 14, matchesRow: 35,
    customerID: null,
  },
  {
    uid: 'MPZxHmcILxgz4kEOK1s2K6T7BiC3',
    billingName: null,
    reportingName: 'LE FIVE Orléans Ingré',
    reportingTab: 'PLAYERS',
    revenueRow: 15, matchesRow: 36,
    customerID: null,
  },
  {
    uid: 'LQNolHuVyKhlYeq7dQTMNOM0Onu2',
    billingName: null,
    reportingName: 'LE FIVE Reims',
    reportingTab: 'PLAYERS',
    revenueRow: 16, matchesRow: 37,
    customerID: null,
  },
  {
    uid: 'FjSnzlRFFfhWVWQJGfIEwRc2ZMj2',
    billingName: 'LE FIVE Paris 13',
    reportingName: 'LE FIVE Paris 13',
    reportingTab: 'PLAYERS',
    revenueRow: 17, matchesRow: 38,
    customerID: 'CU002ZTXRKTV9P',
  },
  {
    uid: 'V6mqbc9C8FNa1RQlUupjeoqOsZL2',
    billingName: 'LE FIVE Paris 17',
    reportingName: 'LE FIVE Paris 17',
    reportingTab: 'PLAYERS',
    revenueRow: 18, matchesRow: 39,
    customerID: 'CU002ZTWHC9PVP',
  },
  {
    uid: 'UQf33jQhVZhle917nO0h7D5qclV2',
    billingName: 'LE FIVE Paris 18',
    reportingName: 'LE FIVE Paris 18',
    reportingTab: 'PLAYERS',
    revenueRow: 19, matchesRow: 40,
    customerID: 'CU002ZRFPK12RQ',
  },
  {
    uid: 'lMCb8tXt3sUq1XWRQSEHiAvQvnX2',
    billingName: null,
    reportingName: 'LE FIVE Valenciennes',
    reportingTab: 'PLAYERS',
    revenueRow: 20, matchesRow: 41,
    customerID: null,
  },
  {
    uid: 'IzKPWsB4aacK86ccCoYIsIi4bEH3',
    billingName: 'TRIBAL FOOT (LE FIVE Villette)',
    reportingName: 'LE FIVE Villette',
    reportingTab: 'PLAYERS',
    revenueRow: 21, matchesRow: 42,
    customerID: 'CU002ZTQZEPNFV',
  },

  // ── Indies tab ──
  {
    uid: '3MO0SZWs09f6yKRmyAM4svj9mjF2',
    billingName: null,
    reportingName: 'Sport dans la Ville Pantin',
    reportingTab: 'Indies',
    revenueRow: 4, matchesRow: 30,
    customerID: null,
  },
  {
    uid: 'tz8MHThPPoaM8GPYtH6x4GCngfT2',
    billingName: null,
    reportingName: 'Firefoot',
    reportingTab: 'Indies',
    revenueRow: 5, matchesRow: 31,
    customerID: null,
  },
  {
    uid: '4K6djqUyJdTgGF3Q7nh7CXQHqVh1',
    billingName: null,
    reportingName: 'FIVE ARENA MEAUX',
    reportingTab: 'Indies',
    revenueRow: 6, matchesRow: 32,
    customerID: null,
  },
  {
    uid: 'fSh9muNltcVTK0WIVstxyAAnx7V2',
    billingName: null,
    reportingName: 'FOOT IN FIVE',
    reportingTab: 'Indies',
    revenueRow: 7, matchesRow: 33,
    customerID: null,
  },
  {
    uid: 'sss3dYi6nzWd7rEjwcQ30LGKudj1',
    billingName: 'MOTANA (Foot Power 5)',
    reportingName: 'Foot POWER 5',
    reportingTab: 'Indies',
    revenueRow: 8, matchesRow: 34,
    customerID: 'CU01KE8JP2NH20',
  },
  {
    uid: 'SuEnyPZ4TgNIkt1yap2yJ3ZHO6p1',
    billingName: 'Foot Max Argenteuil',
    reportingName: 'Foot-Max Argenteuil',
    reportingTab: 'Indies',
    revenueRow: 9, matchesRow: 35,
    customerID: 'CU003HFSA40BY2',
  },
  {
    uid: 'QI89VPazyLhBVnWH871jk4BUEZI3',
    billingName: 'Footbox',
    reportingName: 'Footbox',
    reportingTab: 'Indies',
    revenueRow: 10, matchesRow: 36,
    customerID: 'CU003RAH2W0GBB',
  },
  {
    uid: 'VPHAFtSRRYcwTny1RJ6G8RvLYgo1',
    billingName: null,
    reportingName: 'GINGA STADIUM',
    reportingTab: 'Indies',
    revenueRow: 11, matchesRow: 37,
    customerID: null,
  },
  {
    uid: '4CPt9QJ6GEQgrpyTuzm8CMK844V2',
    billingName: 'GGF (Game 13 Foot Indoor)',
    reportingName: 'Game 13 Foot Indoor',
    reportingTab: 'Indies',
    revenueRow: 12, matchesRow: 38,
    customerID: 'CU003MJSEE1QEH',
  },
  {
    uid: 'W5sO1hPR2vWRMrJvcyWqrFzBoVx2',
    billingName: 'IMPULSTAR PARK',
    reportingName: 'IMPULSTAR PARK',
    reportingTab: 'Indies',
    revenueRow: 13, matchesRow: 39,
    customerID: 'CU01K9FBWT04VE',
  },
  {
    uid: 'CGkxnJ1I4MSr8MVvMSvIOvEJHpT2',
    billingName: null,
    reportingName: 'Kipstadium',
    reportingTab: 'Indies',
    revenueRow: 14, matchesRow: 40,
    customerID: null,
  },
  {
    uid: null, // no uid found for "Le 13 Foot en Salle"
    billingName: null,
    reportingName: 'Le 13 Foot en Salle',
    reportingTab: 'Indies',
    revenueRow: 15, matchesRow: 41,
    customerID: null,
    skip: true,
  },
  {
    uid: 'GzPoiWwRMmZkwvPoB2LII5OoQMw2',
    billingName: null,
    reportingName: 'Le CR5',
    reportingTab: 'Indies',
    revenueRow: 16, matchesRow: 42,
    customerID: null,
  },
  {
    uid: 'bsRK7e37BkUbETMq0Tg3lbm8Fao2',
    billingName: null,
    reportingName: 'Le Street Foot en Salle',
    reportingTab: 'Indies',
    revenueRow: 17, matchesRow: 43,
    customerID: null,
  },
  {
    uid: 'mw9k1ljI9sRtmZY5WRxduCyvssk1',
    billingName: null,
    reportingName: 'Massilia FIVE',
    reportingTab: 'Indies',
    revenueRow: 18, matchesRow: 44,
    customerID: null,
  },
  {
    uid: 'CSTy9rmJRQSyWlqWuGiUhGpAGqf2',
    billingName: 'Monclub Futbol',
    reportingName: 'Monclub Futbol',
    reportingTab: 'Indies',
    revenueRow: 19, matchesRow: 45,
    customerID: 'CU01KEKVZ9RVH6',
  },
  {
    uid: 'iPGJt0M9QdQfe8GNIjXR0DhEZ3J2',
    billingName: 'Power Five',
    reportingName: 'Power Five',
    reportingTab: 'Indies',
    revenueRow: 20, matchesRow: 46,
    customerID: null,
  },
  {
    uid: 'fnjdH1TDJDcBVFnZjcSuXiImF7p2',
    billingName: null,
    reportingName: 'Stadium Foot 5 Village',
    reportingTab: 'Indies',
    revenueRow: 21, matchesRow: 47,
    customerID: null,
  },
  {
    uid: 'MkTJljXziPXBdRdijccndMLBNCC3',
    billingName: null,
    reportingName: 'Speed Soccer Five',
    reportingTab: 'Indies',
    revenueRow: 22, matchesRow: 48,
    customerID: null,
  },
  {
    uid: 'w5VZiCXqSxQ40riMnKYLO11xmeJ2',
    billingName: null,
    reportingName: 'Stadium Antibes',
    reportingTab: 'Indies',
    revenueRow: 23, matchesRow: 49,
    customerID: null,
  },
  {
    uid: 'psf3NmXEPwdCltHKJC7VuvJocrF3',
    billingName: null, // Stadium Thiais = annual 499€, no monthly invoice
    reportingName: 'Stadium Thiais',
    reportingTab: 'Indies',
    revenueRow: 24, matchesRow: 50,
    customerID: null,
    // No skip: count games/revenue in Reporting, but billingName=null means no monthly invoice
  },
  {
    uid: 'i27253AGxOfXgYJK72sBnvUGuMk2',
    billingName: 'Top Ten Lagny',
    reportingName: 'Top Ten',
    reportingTab: 'Indies',
    revenueRow: 25, matchesRow: 51,
    customerID: 'CU0030JSAWEGSD',
  },
  {
    uid: null,
    billingName: null,
    reportingName: 'We Are Sports',
    reportingTab: 'Indies',
    revenueRow: 26, matchesRow: 52,
    customerID: null,
    skip: true,
  },
];

module.exports = {
  REPORTING_SHEET_ID,
  BILLING_SHEET_ID,
  GOCARDLESS_ACCESS_TOKEN,
  getPriceHT,
  TVA_RATE,
  FRENCH_MONTHS,
  FRENCH_MONTH_CODES,
  CENTRES,
};

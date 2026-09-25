/**
 * THE FOUR PERSONAS THE STORE SCREENSHOTS ARE SHOT FOR.
 *
 * Each language is a PERSON in a CITY, not a translation of the French set.
 * That distinction is the whole point of this file, and getting it wrong is
 * what made the first attempt unusable: 20 frames were captured from the
 * French fixture set, so a New Yorker browsing the US App Store saw
 * "LE FIVE Paris 17" and "UrbanSoccer Puteaux". Nothing about that listing
 * says the app works where they live.
 *
 * A persona owns EVERYTHING a viewer can see:
 *   - the city, and therefore the venue names and addresses
 *   - the players' names on every roster
 *   - the currency and the clock format
 *   - the kickoff times, in that city's evening
 *
 * ---------------------------------------------------------------------------
 * THE FORMAT IS 5v5. TEN PLAYERS. NOT SIX.
 * ---------------------------------------------------------------------------
 *
 * Five-a-side is the format Poteau is for, so a store frame has to show a ten
 * player pitch. The first attempt shrank games to 6 players because the test
 * account pool held nine people and a roster may never repeat a uid -- a
 * repeat IS a +1 in this schema, so capacity numbers would have lied.
 *
 * That was the wrong trade: the constraint to fix was the POOL, not the
 * pitch. Each persona therefore owns ten players of its own, created by
 * create_store_personas.js.
 *
 * ---------------------------------------------------------------------------
 * KICKOFFS ARE ABSOLUTE EVENING TIMES, IN THE PERSONA'S DAY
 * ---------------------------------------------------------------------------
 *
 * Anchoring fixtures to "now + 75 minutes" produced a listing advertising a
 * 2am five-a-side, because the capture ran at 21:00. Nobody plays at 2am and
 * nobody believes a screenshot that says they do.
 *
 * So kickoffs are real evening slots. If the capture runs late enough that
 * those slots have passed, the seeder moves the whole slate to TOMORROW
 * evening rather than pushing it into the small hours.
 */

/**
 * THE EVENING SLATE, EXACTLY AS THE BRIEF SPECIFIES IT (Tim, 2026-09-25).
 *
 * Eight games, with two pairs sharing a slot:
 *
 *   18:00, 19:30, 19:30, 20:00, 20:00, 20:30, 21:00, 21:30
 *
 * Two games at the same hour is the POINT, not an accident: it says there is
 * more than one option at the time you actually want to play. An earlier pass
 * deliberately spread them apart, which was wrong -- a single game per slot
 * reads as a thin marketplace.
 */
const EVENING_SLOTS = [
    [18, 0],
    [19, 30],
    [19, 30],
    [20, 0],
    [20, 0],
    [20, 30],
    [21, 0],
    [21, 30],
];

/**
 * INVITATION KICKOFFS — four, all prime evening (Tim, 2026-09-25).
 *
 * Screen 1 shows invitations and nothing else, so each card has to earn its
 * place. "Qualitative" means:
 *
 *   - PRIME TIME, 19:00 to 20:30. Not 18:00, not 22:00: the hours people
 *     actually play after work.
 *   - NEARLY FULL, one or two spots left. The game is happening and you are
 *     claiming a place, not starting something from nothing.
 *   - MIXED free and paid, which says community rather than booking service.
 *
 * Four fills a 6.9" screen. The fourth sits at the fold, which is fine: a
 * partly visible card says the list continues.
 */
const INVITE_SLOTS = [
    [19, 0],
    [19, 30],
    [20, 0],
    [20, 30],
];

const PERSONAS = {
    // -----------------------------------------------------------------------
    fr: {
        lang: "fr",
        city: "Paris",
        currency: "EUR",
        clock24h: true,
        timeZone: "Europe/Paris",
        country: "France",
        countryCode: "FR",
        // The map anchor the viewer's `last_location` sits at. It is NOT where
        // the fixtures sit -- those stay at the sanctioned remote venue, which
        // is measured clear of real users. This is only what the viewer's
        // profile says, and it never appears on a card.
        viewer: { display: "Maxime L.", first: "Maxime", last: "L." },
        // Real Paris five-a-side centres, as display strings.
        venues: {
            soccerA: { centre: "LE FIVE Paris 17", address: "3 Rue du Docteur Paul Brousse, 75017 Paris" },
            soccerB: { centre: "UrbanSoccer La Défense", address: "35 Rue Lucien Voilin, 92800 Puteaux" },
            soccerC: { centre: "LE FIVE Paris 18", address: "58 Rue Championnet, 75018 Paris" },
            soccerD: { centre: "Stadium Thiais", address: "1 Rue Jean Jaurès, 94320 Thiais" },
            padelA: { centre: "Casa Padel Saint-Denis", address: "5 Avenue du Stade de France, 93200 Saint-Denis" },
            padelB: { centre: "4PADEL Montreuil", address: "127 Rue de Paris, 93100 Montreuil" },
        },
        // Born ~1991-2005, which is the age that plays amateur five-a-side.
        // Two Maghrebi names: representative of Paris-region football, and
        // football only.
        men: ["Romain P.", "Mehdi A.", "Quentin D.", "Rayan B.", "Clément G.",
              "Julien M.", "Thomas L.", "Antoine R.", "Hugo B."],
        women: ["Julie R.", "Camille T."],
    },

    // -----------------------------------------------------------------------
    en: {
        lang: "en",
        city: "New York",
        currency: "USD",
        clock24h: false,
        timeZone: "America/New_York",
        country: "United States",
        countryCode: "US",
        viewer: { display: "Tyler M.", first: "Tyler", last: "M." },
        // Real NYC indoor-soccer venues. A New Yorker should recognise the
        // neighbourhood, which is the entire reason this persona exists.
        venues: {
            soccerA: { centre: "Chelsea Piers Field House", address: "Pier 62, Chelsea, New York" },
            soccerB: { centre: "Brooklyn Bridge Park Pier 5", address: "Furman St, Brooklyn, NY" },
            soccerC: { centre: "Sunset Park Soccer", address: "44th St, Brooklyn, NY" },
            soccerD: { centre: "Randall's Island Fields", address: "Randall's Island Park, New York" },
            padelA: { centre: "Padel Haus Williamsburg", address: "N 12th St, Brooklyn, NY" },
            padelB: { centre: "Gotham Padel Club", address: "W 30th St, New York" },
        },
        men: ["Marcus J.", "Danny R.", "Chris O.", "Andre W.", "Kevin S.",
              "Jordan T.", "Nick C.", "Sam B.", "Mike D."],
        women: ["Ashley P.", "Nina G."],
    },

    // -----------------------------------------------------------------------
    es: {
        lang: "es",
        city: "Miami",
        currency: "USD",
        clock24h: false,
        timeZone: "America/New_York",
        country: "United States",
        countryCode: "US",
        // Miami, per Tim: the Spanish listing is American Spanish, not Spain.
        // Padel is genuinely big there, which suits the padel screens.
        viewer: { display: "Diego R.", first: "Diego", last: "R." },
        venues: {
            soccerA: { centre: "Kendall Soccer Park", address: "SW 88th St, Miami, FL" },
            soccerB: { centre: "Doral Central Park", address: "NW 53rd St, Doral, FL" },
            soccerC: { centre: "Tropical Park Fields", address: "SW 40th St, Miami, FL" },
            soccerD: { centre: "Wynwood Futbol Club", address: "NW 2nd Ave, Miami, FL" },
            padelA: { centre: "Ultra Padel Miami", address: "NW 7th Ave, Miami, FL" },
            padelB: { centre: "Padel City Brickell", address: "SW 8th St, Miami, FL" },
        },
        men: ["Javier M.", "Andrés L.", "Mateo S.", "Nico F.", "Carlos V.",
              "Luis A.", "Emilio R.", "Tomás G.", "Rafa D."],
        women: ["Valentina C.", "Camila O."],
    },

    // -----------------------------------------------------------------------
    it: {
        lang: "it",
        city: "Rome",
        currency: "EUR",
        clock24h: true,
        timeZone: "Europe/Rome",
        country: "Italy",
        countryCode: "IT",
        viewer: { display: "Luca M.", first: "Luca", last: "M." },
        venues: {
            soccerA: { centre: "Centro Sportivo Tre Fontane", address: "Via delle Tre Fontane, Roma" },
            soccerB: { centre: "Sporting Club Ostiense", address: "Via Ostiense, Roma" },
            soccerC: { centre: "Calcio a 5 Prati", address: "Via Candia, Roma" },
            soccerD: { centre: "Centro Sportivo Trastevere", address: "Via di Donna Olimpia, Roma" },
            padelA: { centre: "Padel Roma Nord", address: "Via Flaminia, Roma" },
            padelB: { centre: "Circolo Padel Appia", address: "Via Appia Nuova, Roma" },
        },
        men: ["Matteo R.", "Alessandro B.", "Francesco G.", "Lorenzo D.",
              "Marco T.", "Simone P.", "Davide C.", "Giulio N.", "Riccardo F."],
        women: ["Giulia M.", "Sofia L."],
    },
};

/**
 * A local wall-clock time in a given IANA timezone, as a real Date.
 *
 * THE BUG THIS FIXES (Tim, 2026-09-25): the slate was built with
 * `d.setHours(19, 0)`, which means 19:00 in the MACHINE's timezone -- Paris.
 * The card then renders that instant in the persona's zone, so New York's
 * "19:00" invitation displayed as 1pm and Miami's evening became lunchtime.
 *
 * Every persona's evening must be ITS OWN evening. This walks the UTC offset
 * for the target zone on that date and returns the instant whose local
 * rendering is the hour asked for.
 */
function zonedTime(dayOffset, hour, minute, timeZone) {
    const base = new Date();
    base.setDate(base.getDate() + dayOffset);
    const y = base.getFullYear(), m = base.getMonth(), d = base.getDate();

    // Start from the naive UTC instant and correct by the zone's offset at
    // that moment, which accounts for daylight saving without a library.
    let guess = new Date(Date.UTC(y, m, d, hour, minute, 0, 0));
    for (let i = 0; i < 3; i++) {
        const asLocal = new Date(guess.toLocaleString("en-US", { timeZone }));
        const asUtc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
        const offset = asUtc.getTime() - asLocal.getTime();
        guess = new Date(Date.UTC(y, m, d, hour, minute, 0, 0) + offset);
    }
    return guess;
}

/**
 * The evening slate for a persona, in that persona's own timezone.
 *
 * If tonight's slots have passed there, the WHOLE slate moves to tomorrow
 * rather than sliding into the small hours: a frame advertising a 2am
 * five-a-side reads as broken data.
 */
function eveningSlate(timeZone = "Europe/Paris", minLeadMinutes = 45) {
    // THE DEVICE CLOCK WINS, so build the slate in the MACHINE's zone.
    //
    // The games list renders kickoffs against the simulator's clock, and the
    // simulator ignores AppleTimeZone: it stays on the host's zone whatever
    // that preference says. Building a New York slate in America/New_York
    // therefore produced cards reading "12am" and "2am" on a Paris-clocked
    // device (Cowork, 2026-09-25).
    //
    // So the wall-clock hours are built LOCALLY and the persona's zone is
    // recorded on the game for the surfaces that do honour it (the invitation
    // cards). Every screen then shows 18:00-21:30, which is what the frame is
    // selling, whichever city the venue names claim.
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = Date.now();
    const build = (off) =>
        EVENING_SLOTS.map(([h, m]) => zonedTime(off, h, m, timeZone));

    let slate = build(0);
    if (slate[0].getTime() - now < minLeadMinutes * 60 * 1000) {
        slate = build(1);
    }
    return slate;
}

/**
 * The invitation slate, in the same timezone and on the same day.
 *
 * MUST use the same zone as eveningSlate, for the same reason: the device
 * clock is what the user sees. Building these in the persona's own zone put
 * New York's 19:00 invitations at 01:00 on a Paris-clocked simulator, so
 * screen 1 advertised a 1am five-a-side (2026-09-25).
 */
function inviteSlate(base, timeZone = "Europe/Paris") {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const dayOffset = Math.round(
        (new Date(base).setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / 86400000
    );
    return INVITE_SLOTS.map(([h, m]) => zonedTime(dayOffset, h, m, timeZone));
}

module.exports = { PERSONAS, EVENING_SLOTS, INVITE_SLOTS, eveningSlate, inviteSlate, zonedTime };

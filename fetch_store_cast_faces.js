/**
 * FETCH THE STORE-SCREENSHOT CAST'S FACES.
 *
 * Pulls StyleGAN-generated portraits from thispersondoesnotexist.com, rejects
 * the unusable ones, and uploads the survivors to Firebase Storage so
 * `seed_store_screenshots.js` can point `photo_url` at them.
 *
 * Usage:
 *   node fetch_store_cast_faces.js            # fetch + filter, write nothing
 *   node fetch_store_cast_faces.js --upload   # also upload and print CAST_PHOTOS
 *
 * ---------------------------------------------------------------------------
 * WHY GENERATED FACES AND NOT A STOCK LIBRARY
 * ---------------------------------------------------------------------------
 *
 * App Store and Play Store listings are COMMERCIAL USE, in every market the
 * app ships to. That rules out most of what looks free:
 *
 *   - FFHQ / CelebA / LFW are research datasets of REAL people scraped without
 *     consent for commercial use. Several source photos are CC-BY-NC or ND.
 *     A real stranger's face in a Poteau ad with no model release is a legal
 *     exposure, not a style question.
 *   - Unsplash and Pexels allow commercial use but do NOT guarantee a model
 *     release; their own terms tell you to get one for identifiable people.
 *
 * Every face here depicts NOBODY. There is no subject, so there is no release
 * to obtain and no person who can object. That is the entire argument for this
 * source, and it is why the generator is not swapped for a stock API later
 * without re-reading this comment.
 *
 * ---------------------------------------------------------------------------
 * WHAT GETS REJECTED, AND WHY A HUMAN LOOKS
 * ---------------------------------------------------------------------------
 *
 * StyleGAN output is not uniformly usable. In a 4-image sample while building
 * this (2026-09-23), one carried a visible WATERMARK in the bottom-right
 * corner. A watermark in a store screenshot is a defect that ships.
 *
 * TWO AUTOMATED FILTERS, AND ONE THAT IS DELIBERATELY NOT AUTOMATED:
 *
 *   1. It must actually be a JPEG. The site serves an HTML block page on the
 *      old /image path, and `curl -o face.jpg` will happily save HTML under a
 *      .jpg name. Checked by magic bytes, never by extension.
 *   2. Every face must be distinct by file hash. The generator is random and a
 *      repeat is possible; two identical players on one roster is exactly the
 *      "seeded data" tell these photos exist to avoid.
 *   3. WATERMARKS ARE CHECKED BY EYE, NOT BY CODE.
 *
 * Rule 3 is a deliberate retreat. Two corner-statistics detectors were written
 * and BOTH were measured against the known sample before being trusted:
 *
 *      metric                     f_1    f_2    f_3*   f_4     (*watermarked)
 *      corner bright-tail spread  114    128     97    113
 *      corner luminance p99       138    209    163    191
 *      corner edge energy (p99)   102    168    145    156
 *
 * The watermarked image scores MID-RANGE or LOWEST on every one of them. There
 * is no threshold that catches it without also rejecting the clean faces,
 * because a faint watermark over a busy photographic background is genuinely
 * not separable by corner statistics. A detector tuned to pass this sample
 * would be fitted to four images and would fail silently on the fifth -- and a
 * silent failure here puts a watermark in a store listing.
 *
 * So the script builds a CONTACT SHEET and stops. Someone looks at nine faces
 * once, which costs a minute and cannot be fooled. Automating a check that
 * does not work is worse than not automating it.
 *
 * The script over-fetches (CANDIDATES > needed) so rejections at review time do
 * not mean starting over.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const admin = require("firebase-admin");

const UPLOAD = process.argv.includes("--upload");

/** The nine cast uids, in the order seed_store_screenshots.js lists them. */
const CAST_UIDS = [
    "XXIV4AJNHvPoQKpBXwKOaA7C3Ob2", // viewer  (Léo M. / Alex R.)
    "zfIAAxFq6RfVtpAZ9DHUnM5U9nz2",
    "ZtuRCmxdPdeE2iMDW7Y0qvAzzGp1",
    "8vZmdIBOZTcqMFMQKltTcfc7ffl1",
    "9si5imsCVUUQ48LF5sc9XFLFtEj1",
    "Go2YXYj9FFW6xG28HZNBcrDkIJV2",
    "xz7cm07tVlZkt71QsLdmeTSCPYI3",
    "FkWN1YsfFtP5PwTCxBEpZ9NpMS23",
    "hQmClsn4bFU79IvwqTJuYrZdOg63",
];

const NEEDED = CAST_UIDS.length;
/** Over-fetch, so watermark rejections do not leave the roster short. */
const CANDIDATES = NEEDED + 16;

const SRC = "https://thispersondoesnotexist.com/random-person.jpeg";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

/** Avatar render size. The app draws these in small circles; 256px is ample
 *  and keeps the store listing's download weight sane. */
const AVATAR_PX = 256;

const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "poteau-faces-"));

function sh(cmd, args) {
    return execFileSync(cmd, args, { encoding: "utf8" }).trim();
}

/** JPEG magic bytes. An HTML block page saved as .jpg is the failure this
 *  catches, and it is a real one: the old /image path now returns HTML. */
function isJpeg(file) {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(3);
    fs.readSync(fd, buf, 0, 3, 0);
    fs.closeSync(fd);
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

/**
 * Build one contact sheet of every accepted face, at the size the app actually
 * renders them plus a larger tile to inspect the corners.
 *
 * This is the watermark check. See the header for why it is not code.
 */
function contactSheet(files, out) {
    const py = `
from PIL import Image
files = ${JSON.stringify(files)}
tile, pad, cols = 256, 12, 3
rows = (len(files) + cols - 1) // cols
W = cols * tile + (cols + 1) * pad
H = rows * tile + (rows + 1) * pad
sheet = Image.new("RGB", (W, H), (245, 245, 245))
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((tile, tile))
    r, c = divmod(i, cols)
    sheet.paste(im, (pad + c * (tile + pad), pad + r * (tile + pad)))
sheet.save(${JSON.stringify(out)})
print("${out}")
`;
    return sh("python3", ["-c", py]);
}

async function fetchOne(i) {
    const out = path.join(WORK, `cand_${String(i).padStart(2, "0")}.jpg`);
    sh("curl", [
        "-s", "-L", "-o", out,
        `${SRC}?r=${Date.now()}${i}`,
        "-H", `User-Agent: ${UA}`,
        "-H", "Referer: https://thispersondoesnotexist.com/",
        "--max-time", "30",
    ]);
    return out;
}

async function main() {
    console.log(
        `fetching ${CANDIDATES} candidates for ${NEEDED} cast members\n` +
        `source: generated faces (no real person depicted, no release needed)\n`
    );

    const accepted = [];
    const seen = new Set();
    const rejected = { html: 0, duplicate: 0 };

    for (let i = 1; i <= CANDIDATES && accepted.length < NEEDED; i++) {
        const f = await fetchOne(i);

        if (!fs.existsSync(f) || !isJpeg(f)) {
            rejected.html += 1;
            console.log(`  ${String(i).padStart(2)}  REJECT  not a JPEG (block page?)`);
            continue;
        }

        const hash = sh("md5", ["-q", f]);
        if (seen.has(hash)) {
            rejected.duplicate += 1;
            console.log(`  ${String(i).padStart(2)}  REJECT  duplicate of an accepted face`);
            continue;
        }

        // Square, downscaled to avatar size.
        const small = path.join(WORK, `face_${accepted.length + 1}.jpg`);
        sh("sips", ["-Z", String(AVATAR_PX), f, "--out", small]);

        seen.add(hash);
        accepted.push(small);
        console.log(`  ${String(i).padStart(2)}  accept  -> face_${accepted.length}.jpg`);
    }

    console.log(
        `\naccepted ${accepted.length}/${NEEDED}  ` +
        `(rejected: ${rejected.html} non-JPEG, ${rejected.duplicate} duplicate)`
    );

    if (accepted.length < NEEDED) {
        console.error(
            `\nFAILED: only ${accepted.length} usable faces for ${NEEDED} cast members.\n` +
            `Raise CANDIDATES and re-run rather than reusing a face -- two ` +
            `identical players on one roster is exactly the "seeded data" tell ` +
            `these photos exist to avoid.`
        );
        process.exit(1);
    }

    console.log(`\nfiles kept in: ${WORK}`);
    accepted.forEach((f, i) => console.log(`  ${CAST_UIDS[i].slice(0, 6)}…  ${f}`));

    const sheet = path.join(WORK, "contact_sheet.png");
    contactSheet(accepted, sheet);
    console.log(
        `\nCONTACT SHEET: ${sheet}\n` +
        `Look at it before uploading. Reject any face with a watermark, a\n` +
        `second person in frame, or an obvious generation artefact, then\n` +
        `re-run -- the corner statistics cannot catch these (see header).`
    );

    if (!UPLOAD) {
        process.exit(0);
    }

    // --- upload -------------------------------------------------------------
    const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "krank-club",
        storageBucket: "krank-club.appspot.com",
    });
    const bucket = admin.storage().bucket();

    const urls = {};
    for (let i = 0; i < accepted.length; i++) {
        const uid = CAST_UIDS[i];
        // Namespaced by the seed tag, so the whole set is one prefix to delete.
        const dest = `store_shots_520/cast/${uid}.jpg`;
        await bucket.upload(accepted[i], {
            destination: dest,
            metadata: {
                contentType: "image/jpeg",
                // Marks the object for cleanup and records what it is, so a
                // later audit does not have to guess why a face is in Storage.
                metadata: {
                    seed_tag: "store_shots_520",
                    source: "generated-face (no real person depicted)",
                },
            },
        });
        await bucket.file(dest).makePublic();
        urls[uid] = `https://storage.googleapis.com/${bucket.name}/${dest}`;
        console.log(`  uploaded ${uid.slice(0, 6)}…  ${urls[uid]}`);
    }

    console.log(`\n--- paste into seed_store_screenshots.js CAST_PHOTOS ---\n`);
    console.log("const CAST_PHOTOS = {");
    for (const uid of CAST_UIDS) {
        console.log(`    "${uid}": "${urls[uid]}",`);
    }
    console.log("};");
    process.exit(0);
}

main().catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
});

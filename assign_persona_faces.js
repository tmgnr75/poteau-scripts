/**
 * GIVE EVERY PERSONA ACCOUNT A FACE THAT MATCHES ITS NAME.
 *
 * Usage:
 *   node assign_persona_faces.js            # dry run
 *   node assign_persona_faces.js --write    # upload and assign
 *
 * WHAT WENT WRONG (Tim, 2026-09-25)
 *
 * Nine faces were shared across twelve accounts per persona, assigned by
 * index. Two accounts therefore reused a photo, and because the assignment
 * ignored gender entirely, both collisions crossed it: "Camille T." and
 * "Mehdi A." shared one picture, "Julie R." and "Romain P." another. On a
 * roster that reads as broken data, which is the one thing a store screenshot
 * must never do.
 *
 * THE POOL
 *
 * 42 real Poteau users consented (cast-outreach/candidates.csv): 40 men and 2
 * women. So:
 *
 *   - Each persona gets NINE DISTINCT men, and no man appears in two
 *     personas. 36 of the 40 are used.
 *   - The two women appear in all four personas. There is no alternative with
 *     two consented women, and it is the same reasoning already applied to
 *     venue names: no two personas are ever on screen together.
 *   - The viewer keeps Tim's own back-view photo, which contains no face and
 *     therefore needs no consent.
 *
 * Faces are cropped around the DETECTED FACE BOX rather than the image
 * centre. Centre-cropping cut foreheads and chins off: one candidate lost
 * their eyes, another was mostly wall.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
const { PERSONAS } = require("./lib/store_personas");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "krank-club",
    storageBucket: "krank-club.appspot.com",
});

const db = admin.firestore();
const bucket = admin.storage().bucket();
const WRITE = process.argv.includes("--write");

const CSV = "/Users/tmgnr/poteau-store-screenshots/cast-outreach/candidates.csv";
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "persona-faces-"));
const PREFIX = "store_shots_520/persona";

/** Tim's own photo: a back view, no face, so no consent question. */
const VIEWER_PHOTO =
    "https://storage.googleapis.com/krank-club.appspot.com/store_shots_520/cast/" +
    "Y3V5WDgZGTWsQ3vSZDvNlu0Uo1D2.jpg";

function readCsv() {
    const lines = fs.readFileSync(CSV, "utf8").trim().split("\n");
    const head = lines[0].split(",");
    return lines.slice(1).map((l) => {
        // naive split is wrong for quoted fields, so parse properly
        const out = []; let cur = ""; let q = false;
        for (const ch of l) {
            if (ch === '"') { q = !q; continue; }
            if (ch === "," && !q) { out.push(cur); cur = ""; continue; }
            cur += ch;
        }
        out.push(cur);
        const row = {};
        head.forEach((h, i) => { row[h] = out[i]; });
        return row;
    });
}

function sh(cmd, args) {
    return execFileSync(cmd, args, { encoding: "utf8" }).trim();
}

/**
 * Crop around the detected face, not the image centre.
 *
 * `/tmp/facebox` is a tiny Swift tool over Apple's Vision framework, built
 * during the cast selection. If it is missing the crop falls back to centre,
 * which is worse but not fatal.
 */
function cropFace(src, dst, override) {
    let box = override || null;
    if (!box) try {
        // EVERY face, not just the largest.
        //
        // One consented photo is a wide shot of the subject standing in front
        // of a Maradona MURAL, and the painted face is the bigger of the two.
        // Taking the largest box cropped the wall, so a woman's roster row
        // rendered Maradona. When several faces are found, prefer the one
        // nearest the frame's centre, which is the subject in a portrait.
        const lines = sh("/tmp/faceall", [src]).split("\n").filter(Boolean);
        const boxes = lines.map((l) => l.split(/\s+/).map(Number))
            .filter((b) => b.length === 4);
        if (boxes.length === 1) {
            box = boxes[0];
        } else if (boxes.length > 1) {
            boxes.sort((a, b) => {
                const da = Math.hypot(a[0] + a[2] / 2 - 0.5, a[1] + a[3] / 2 - 0.5);
                const dbb = Math.hypot(b[0] + b[2] / 2 - 0.5, b[1] + b[3] / 2 - 0.5);
                return da - dbb;
            });
            box = boxes[0];
        }
    } catch (e) { /* fall through to centre crop */ }

    const py = `
from PIL import Image
im = Image.open(${JSON.stringify(src)}).convert("RGB")
W, H = im.size
box = ${box ? JSON.stringify(box) : "None"}
if box:
    fx, fy, fw, fh = box
    cx = (fx + fw/2) * W
    cy = (1 - (fy + fh/2)) * H          # Vision origin is bottom-left
    side = min(max(fw*W, fh*H) * 2.0, min(W, H))
    x0 = max(0, min(W - side, cx - side/2))
    y0 = max(0, min(H - side, cy - side/2*1.12))   # bias up: keep hair
else:
    side = min(W, H); x0 = (W-side)//2; y0 = (H-side)//2
im.crop((int(x0), int(y0), int(x0+side), int(y0+side))) \\
  .resize((256, 256), Image.LANCZOS) \\
  .save(${JSON.stringify(dst)}, quality=93)
`;
    sh("python3", ["-c", py]);
}

/**
 * Photos whose automatic crop is wrong, with the box to use instead.
 *
 * Capucine's picture is a wide shot of her standing in front of a MARADONA
 * MURAL. The painted face is both larger than hers AND closer to the frame's
 * centre, so neither "biggest" nor "most central" picks the right one, and
 * her roster row rendered Maradona. Her face is the second detection, at the
 * lower right; these are its normalised Vision coordinates.
 *
 * Keyed by the photo's own filename, so it survives a re-run.
 */
const CROP_OVERRIDES = {
    // Capucine Cst
    "capucine": [0.6061945557594299, 0.28344592452049255,
                 0.15982063114643097, 0.11998546123504639],
};

function overrideFor(row) {
    const n = (row.display_name || "").toLowerCase();
    for (const [k, box] of Object.entries(CROP_OVERRIDES)) {
        if (n.includes(k)) return box;
    }
    return null;
}

async function fetchAndUpload(row, destName) {
    const raw = path.join(WORK, `${destName}_raw.jpg`);
    sh("curl", ["-s", "-L", "--max-time", "25", "-o", raw, row.photo_url]);
    const out = path.join(WORK, `${destName}.jpg`);
    cropFace(raw, out, overrideFor(row));
    const dest = `${PREFIX}/${destName}.jpg`;
    await bucket.upload(out, {
        destination: dest,
        metadata: {
            contentType: "image/jpeg",
            metadata: {
                seed_tag: "store_shots_520",
                source: `real Poteau user ${row.display_name}, consent 2026-09-23`,
            },
        },
    });
    await bucket.file(dest).makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${dest}`;
}

async function main() {
    const rows = readCsv().filter((r) => r.CONSENT === "yes");
    const men = rows.filter((r) => r.sex === "M")
        .sort((a, b) => Number(b.face_pct) - Number(a.face_pct));
    const women = rows.filter((r) => r.sex === "F");

    const langs = Object.keys(PERSONAS);
    const needMen = langs.length * 9;
    console.log(
        `consented: ${men.length} men, ${women.length} women\n` +
        `need: ${needMen} distinct men (9 per persona), ` +
        `${women.length} women shared across all ${langs.length}\n`
    );
    if (men.length < needMen) {
        throw new Error(`only ${men.length} consented men, need ${needMen}`);
    }

    let mi = 0;
    for (const lang of langs) {
        const p = PERSONAS[lang];
        console.log(`${lang.toUpperCase()} — ${p.city}`);

        const snap = await db.collection("users")
            .where("store_persona", "==", lang).get();
        const byName = {};
        snap.forEach((d) => { byName[d.data().display_name] = d.ref; });

        // The viewer keeps the faceless photo.
        const vRef = byName[p.viewer.display];
        if (vRef && WRITE) await vRef.update({ photo_url: VIEWER_PHOTO, hash_pic: "" });
        console.log(`  ${p.viewer.display.padEnd(14)} <- back-view photo (no face)`);

        for (const name of p.men) {
            const row = men[mi++];
            console.log(`  ${name.padEnd(14)} <- ${row.display_name} (${row.face_pct}%)`);
            if (!WRITE) continue;
            const ref = byName[name];
            if (!ref) continue;
            const url = await fetchAndUpload(row, `${lang}_${name.replace(/\W/g, "")}`);
            await ref.update({ photo_url: url, hash_pic: "" });
        }

        for (let i = 0; i < p.women.length; i++) {
            const name = p.women[i];
            const row = women[i % women.length];
            console.log(`  ${name.padEnd(14)} <- ${row.display_name} (shared)`);
            if (!WRITE) continue;
            const ref = byName[name];
            if (!ref) continue;
            const url = await fetchAndUpload(row, `${lang}_${name.replace(/\W/g, "")}`);
            await ref.update({ photo_url: url, hash_pic: "" });
        }
        console.log("");
    }

    if (!WRITE) {
        console.log("DRY RUN — nothing uploaded. Re-run with --write.");
    }
    process.exit(0);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

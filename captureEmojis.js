const fs = require('fs');
const emojiData = require('unicode-emoji-json');

const EMOJI_SKIN_MODIFIERS = /\p{Emoji_Modifier}/gu;

function normalizeEmoji(emoji) {
    return emoji.replace(EMOJI_SKIN_MODIFIERS, '');
}

const grouped = {};

for (const [key, value] of Object.entries(emojiData)) {
    const base = normalizeEmoji(key);
    if (!grouped[base]) {
        grouped[base] = {
            emoji: base,
            slug: value.slug,
            keywords: (value.tags || []).join(','),
        };
    }
}

const emojiList = Object.values(grouped);

// Optional: sort alphabetically by slug
emojiList.sort((a, b) => a.slug.localeCompare(b.slug));

fs.writeFileSync(
    'emojis-remote-config.json',
    JSON.stringify(emojiList, null, 2),
);

console.log(`✅ ${emojiList.length} emojis written to emojis-remote-config.json`);
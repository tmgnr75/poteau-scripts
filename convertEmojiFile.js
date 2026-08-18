const fs = require('fs');
const path = require('path');

// Path to your input file
const inputPath = path.join(__dirname, 'emoji_base_file.json');
// Path to your output file
const outputPath = path.join(__dirname, 'emoji_cleaned.json');

// Read and parse the input JSON
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const result = Object.entries(data).map(([emoji, obj]) => ({
  emoji,
  name: obj.name,
  group: obj.group,
  skin_tone_support: obj.skin_tone_support
}));

// Write the result to a new file
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');

console.log(`Done! Output written to ${outputPath}`);
#!/usr/bin/env node

/**
 * Poteau Pre-Release Audit Tool
 *
 * A comprehensive static analysis tool that audits Flutter apps before release.
 * Checks for:
 * - Missing/empty translations
 * - Duplicate translations (copy-paste errors)
 * - Screen-by-screen translation coverage
 * - Navigation flow mapping
 * - Actionable items per screen (buttons, links)
 *
 * Usage:
 *   node index.js [app]          Run full audit (app: 'poteau-app' or 'poteau-max' or 'both')
 *   node index.js --help         Show help
 *
 * Output:
 *   Creates audit-report-YYYY-MM-DD-HH-MM.json and audit-report-YYYY-MM-DD-HH-MM.md
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  languages: ['fr', 'en', 'es', 'it'],
  primaryLanguage: 'fr',
  apps: {
    'poteau-app': {
      name: 'Poteau App (B2C)',
      path: path.join(__dirname, '../../poteau-app'),
      i18nFile: 'lib/flutter_flow/internationalization.dart',
      navFile: 'lib/flutter_flow/nav/nav.dart',
      pagesDir: 'lib/pages',
      componentsDir: 'lib/components',
    },
    'poteau-max': {
      name: 'Poteau Max (B2B)',
      path: path.join(__dirname, '../../poteau-max'),
      i18nFile: 'lib/flutter_flow/internationalization.dart',
      navFile: 'lib/flutter_flow/nav/nav.dart',
      pagesDir: 'lib',
      componentsDir: 'lib/components',
    }
  }
};

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(` ${title}`, 'bold');
  console.log('='.repeat(60));
}

// ============================================================================
// TRANSLATION PARSER
// ============================================================================

function parseTranslationsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const translations = {};

  // Match the kTranslationsMap entries
  // Pattern: 'keyId': { 'fr': '...', 'en': '...', ... }
  const entryRegex = /'([a-z0-9]+)':\s*\{([^}]+)\}/g;
  // Updated regex to handle escaped quotes (\') in values
  const langRegex = /'(fr|en|es|it)':\s*'((?:[^'\\]|\\.)*)'/g;

  let match;
  while ((match = entryRegex.exec(content)) !== null) {
    const keyId = match[1];
    const langBlock = match[2];

    translations[keyId] = {
      fr: '',
      en: '',
      es: '',
      it: '',
    };

    let langMatch;
    while ((langMatch = langRegex.exec(langBlock)) !== null) {
      // Unescape the value (convert \' back to ')
      translations[keyId][langMatch[1]] = langMatch[2].replace(/\\'/g, "'");
    }
    langRegex.lastIndex = 0; // Reset regex for next iteration
  }

  // Also extract section comments (// SectionName)
  const sectionRegex = /\/\/\s*([A-Za-z_]+)\s*\n\s*\{/g;
  const sections = [];
  while ((match = sectionRegex.exec(content)) !== null) {
    sections.push({
      name: match[1],
      position: match.index,
    });
  }

  return { translations, sections, rawContent: content };
}

// ============================================================================
// TRANSLATION ANALYZER
// ============================================================================

function analyzeTranslations(translations) {
  const issues = {
    emptyTranslations: [],      // Keys with empty values in some languages
    allEmpty: [],               // Keys where ALL languages are empty
    duplicateAcrossLanguages: [], // Same text in all languages (possible copy-paste)
    suspiciousDuplicates: [],   // FR text appears in other language slots
    leadingTrailingSpaceMismatch: [], // FR has leading/trailing spaces but other langs don't
  };

  const stats = {
    totalKeys: 0,
    completeKeys: 0,
    partialKeys: 0,
    emptyKeys: 0,
    byLanguage: {
      fr: { filled: 0, empty: 0 },
      en: { filled: 0, empty: 0 },
      es: { filled: 0, empty: 0 },
      it: { filled: 0, empty: 0 },
    }
  };

  // Helper: check if text is a proper name (2+ words that look like a person's name)
  // Handles: "Karim Boudebouz", "Pablo da Fonseca", "Jean-Pierre", "María García"
  const isProperName = (text) => {
    if (!text || text.length < 3) return false;
    const trimmed = text.trim();
    // Must have at least 2 words separated by space or hyphen
    const words = trimmed.split(/[\s-]+/);
    if (words.length < 2) return false;
    // First word must be capitalized, and at least one other word must be capitalized
    // (allows for particles like "da", "de", "von", "van", etc.)
    const firstCapitalized = /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇÑ]/.test(words[0]);
    const hasOtherCapitalized = words.slice(1).some(w => /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇÑ]/.test(w));
    // Should not contain numbers or special chars (except accents and hyphens)
    const noSpecialChars = /^[A-Za-zÀÂÄÉÈÊËÏÎÔÙÛÜÇÑàâäéèêëïîôùûüçñ\s-]+$/.test(trimmed);
    return firstCapitalized && hasOtherCapitalized && noSpecialChars;
  };

  // Helper: check if text is a URL or contains domain patterns (should be same in all languages)
  const isUrlOrDomain = (text) => {
    if (!text) return false;
    const trimmed = text.trim().toLowerCase();
    // Check for common URL patterns and domains
    return (
      trimmed.includes('.com') ||
      trimmed.includes('.app') ||
      trimmed.includes('.fr') ||
      trimmed.includes('.io') ||
      trimmed.includes('.org') ||
      trimmed.includes('.net') ||
      trimmed.includes('http://') ||
      trimmed.includes('https://') ||
      trimmed.includes('www.')
    );
  };

  // Helper: check if text is the brand name "Poteau" (should be same in all languages)
  const isBrandName = (text) => {
    if (!text) return false;
    const trimmed = text.trim();
    // "Poteau" alone or as part of product name
    return trimmed === 'Poteau' || trimmed === 'Poteau Max' || trimmed === 'Poteau App';
  };

  // Helper: check if text should NOT be translated (same across all languages)
  const shouldNotTranslate = (text) => {
    return isProperName(text) || isUrlOrDomain(text) || isBrandName(text);
  };

  // Helper: check leading/trailing spaces
  const hasLeadingSpace = (text) => text && text.length > 0 && text[0] === ' ';
  const hasTrailingSpace = (text) => text && text.length > 0 && text[text.length - 1] === ' ';

  for (const [keyId, langs] of Object.entries(translations)) {
    stats.totalKeys++;

    const frValue = langs.fr || '';

    // Rule 1: If FR is empty or just a space, other languages must match exactly
    // This is not an error, just expected behavior - skip further checks
    if (frValue === '' || frValue === ' ') {
      // Check if all other langs match FR exactly
      const allMatch = ['en', 'es', 'it'].every(lang => langs[lang] === frValue);
      if (allMatch) {
        stats.completeKeys++;
        // Count as filled for stats purposes (intentionally empty/space)
        for (const lang of CONFIG.languages) {
          stats.byLanguage[lang].filled++;
        }
      } else {
        // Mismatch: FR is empty/space but others are not
        stats.partialKeys++;
        const mismatchLangs = ['en', 'es', 'it'].filter(lang => langs[lang] !== frValue);
        issues.emptyTranslations.push({
          keyId,
          emptyLangs: mismatchLangs,
          filledLangs: ['fr'],
          sampleText: frValue === ' ' ? '(single space)' : '(empty)',
          frText: frValue,
          note: frValue === ' ' ? 'FR is single space, others should match' : 'FR is empty, others should match',
        });
      }
      continue;
    }

    // Rule 3: If FR is a proper name (2+ capitalized words), no translation needed
    if (isProperName(frValue)) {
      // Names don't need translation - count as complete
      stats.completeKeys++;
      for (const lang of CONFIG.languages) {
        stats.byLanguage[lang].filled++;
      }
      continue;
    }

    const emptyLangs = [];
    const filledLangs = [];

    for (const lang of CONFIG.languages) {
      const value = langs[lang] || '';
      if (value.trim() === '') {
        emptyLangs.push(lang);
        stats.byLanguage[lang].empty++;
      } else {
        filledLangs.push(lang);
        stats.byLanguage[lang].filled++;
      }
    }

    // Check for issues
    if (emptyLangs.length === 4) {
      stats.emptyKeys++;
      issues.allEmpty.push({
        keyId,
        comment: findCommentForKey(keyId, translations),
      });
    } else if (emptyLangs.length > 0) {
      stats.partialKeys++;
      issues.emptyTranslations.push({
        keyId,
        emptyLangs,
        filledLangs,
        sampleText: langs[filledLangs[0]] || '',
        frText: langs.fr,
      });
    } else {
      stats.completeKeys++;
    }

    // Rule 2: Check for leading/trailing space mismatch (important for UI)
    const frHasLeading = hasLeadingSpace(frValue);
    const frHasTrailing = hasTrailingSpace(frValue);

    if (frHasLeading || frHasTrailing) {
      const spaceMismatch = [];
      for (const lang of ['en', 'es', 'it']) {
        const langValue = langs[lang] || '';
        if (langValue.trim() !== '') { // Only check if there's a translation
          const langHasLeading = hasLeadingSpace(langValue);
          const langHasTrailing = hasTrailingSpace(langValue);

          if ((frHasLeading && !langHasLeading) || (frHasTrailing && !langHasTrailing)) {
            spaceMismatch.push({
              lang,
              frLeading: frHasLeading,
              frTrailing: frHasTrailing,
              langLeading: langHasLeading,
              langTrailing: langHasTrailing,
            });
          }
        }
      }

      if (spaceMismatch.length > 0) {
        issues.leadingTrailingSpaceMismatch.push({
          keyId,
          frText: frValue,
          frHasLeading,
          frHasTrailing,
          mismatch: spaceMismatch,
        });
      }
    }

    // Check for duplicate text across all languages (possible copy-paste error)
    const uniqueValues = new Set(Object.values(langs).filter(v => v.trim() !== ''));
    if (uniqueValues.size === 1 && filledLangs.length === 4) {
      const text = langs.fr;
      // Ignore if it's just an emoji, number, very short, a proper name, URL, or brand name
      if (text.length > 3 && !/^[\d\s.,%€$]+$/.test(text) && !/^[\u{1F000}-\u{1FFFF}]+$/u.test(text) && !shouldNotTranslate(text)) {
        issues.duplicateAcrossLanguages.push({
          keyId,
          text,
        });
      }
    }

    // Check if FR text appears in ES or IT (common copy-paste error)
    // Skip if it's a proper name, URL, or brand name (these should be the same in all languages)
    if (langs.fr && langs.fr.trim() !== '' && !shouldNotTranslate(langs.fr)) {
      const sameAsLangs = [];
      if (langs.es === langs.fr && langs.es.length > 5) {
        sameAsLangs.push('ES');
      }
      if (langs.it === langs.fr && langs.it.length > 5) {
        sameAsLangs.push('IT');
      }
      // Only add one entry per key, listing all affected languages
      if (sameAsLangs.length > 0) {
        issues.suspiciousDuplicates.push({
          keyId,
          issue: `${sameAsLangs.join(', ')} same as FR`,
          text: langs.fr,
        });
      }
    }
  }

  return { issues, stats };
}

function findCommentForKey(keyId, translations) {
  // This would require more context from the raw file
  return null;
}

// ============================================================================
// SCREEN ANALYZER
// ============================================================================

function parseWidgetFile(filePath) {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf8');
  const result = {
    filePath,
    routeName: null,
    routePath: null,
    translationKeys: [],
    variableTexts: [],
    navigationsTo: [],
    buttons: [],
    requiresAuth: false,
  };

  // Extract route info
  const routeNameMatch = content.match(/static\s+String\s+routeName\s*=\s*'([^']+)'/);
  const routePathMatch = content.match(/static\s+String\s+routePath\s*=\s*'([^']+)'/);

  if (routeNameMatch) result.routeName = routeNameMatch[1];
  if (routePathMatch) result.routePath = routePathMatch[1];

  // Extract translation keys used: getText('keyId') - handles multiline
  // Pattern: .getText( followed by any whitespace (including newlines), then 'keyId'
  // Using [\s\S] to match any character including newlines
  const getTextRegex = /\.getText\([\s\S]*?'([a-z0-9]+)'/g;
  let match;
  while ((match = getTextRegex.exec(content)) !== null) {
    if (!result.translationKeys.includes(match[1])) {
      result.translationKeys.push(match[1]);
    }
  }

  // Extract variable texts: getVariableText(frText: '...', enText: '...', ...)
  const varTextRegex = /getVariableText\(\s*\n?\s*frText:\s*'([^']*)'/g;
  while ((match = varTextRegex.exec(content)) !== null) {
    result.variableTexts.push(match[1]);
  }

  // Extract navigations: context.pushNamed, context.goNamed, etc.
  const navRegex = /context\.(pushNamed|goNamed|go|push)\(\s*(?:'([^']+)'|([A-Za-z]+Widget)\.routeName)/g;
  while ((match = navRegex.exec(content)) !== null) {
    let target = match[2] || match[3];
    // Clean up Widget suffix for readability
    if (target) {
      target = target.replace(/Widget$/, '');
      if (!result.navigationsTo.includes(target)) {
        result.navigationsTo.push(target);
      }
    }
  }

  // Extract FFButtonWidget usage (buttons)
  const buttonRegex = /FFButtonWidget\([^)]*text:\s*(?:FFLocalizations\.of\(context\)\.getText\(\s*'([^']+)'|'([^']+)')/g;
  while ((match = buttonRegex.exec(content)) !== null) {
    result.buttons.push({
      type: 'FFButton',
      textKey: match[1] || null,
      staticText: match[2] || null,
    });
  }

  // Check for ElevatedButton, TextButton, etc with Text children
  const genericButtonRegex = /(ElevatedButton|TextButton|OutlinedButton|InkWell|GestureDetector)\(/g;
  while ((match = genericButtonRegex.exec(content)) !== null) {
    result.buttons.push({
      type: match[1],
      textKey: null,
      staticText: null,
    });
  }

  return result;
}

function findAllWidgetFiles(appConfig) {
  const widgetFiles = [];

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('_widget.dart')) {
        widgetFiles.push(fullPath);
      }
    }
  }

  scanDir(path.join(appConfig.path, appConfig.pagesDir));
  if (appConfig.componentsDir) {
    scanDir(path.join(appConfig.path, appConfig.componentsDir));
  }

  return widgetFiles;
}

// ============================================================================
// NAVIGATION PARSER
// ============================================================================

function parseNavigationFile(filePath) {
  if (!fs.existsSync(filePath)) return { routes: [] };

  const content = fs.readFileSync(filePath, 'utf8');
  const routes = [];

  // Match FFRoute definitions
  const routeRegex = /FFRoute\(\s*name:\s*(?:'([^']+)'|([A-Za-z]+Widget)\.routeName),\s*path:\s*(?:'([^']+)'|[A-Za-z]+Widget\.routePath),?\s*(requireAuth:\s*(true|false))?/g;

  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    routes.push({
      name: match[1] || match[2]?.replace('Widget.routeName', ''),
      path: match[3] || null,
      requiresAuth: match[5] === 'true',
    });
  }

  return { routes };
}

// ============================================================================
// REPORT GENERATOR
// ============================================================================

function generateScreenReport(screens, translations, appName) {
  const report = [];

  for (const screen of screens) {
    if (!screen.routeName) continue;

    const screenReport = {
      name: screen.routeName,
      path: screen.routePath,
      file: screen.filePath,
      translations: {
        total: screen.translationKeys.length,
        complete: 0,
        incomplete: 0,
        missing: 0,
        details: [],
      },
      navigatesTo: screen.navigationsTo,
      buttons: screen.buttons.length,
      issues: [],
    };

    // Analyze each translation key used by this screen
    for (const keyId of screen.translationKeys) {
      const trans = translations[keyId];
      if (!trans) {
        screenReport.translations.missing++;
        screenReport.issues.push({
          severity: 'error',
          message: `Translation key '${keyId}' not found in translations map`,
        });
        continue;
      }

      const frValue = trans.fr || '';

      // Rule: If FR is empty or single space, other langs should match exactly
      if (frValue === '' || frValue === ' ') {
        const allMatch = ['en', 'es', 'it'].every(lang => trans[lang] === frValue);
        if (allMatch) {
          screenReport.translations.complete++;
        } else {
          const mismatchLangs = ['en', 'es', 'it'].filter(lang => trans[lang] !== frValue);
          screenReport.translations.incomplete++;
          screenReport.translations.details.push({
            keyId,
            frText: frValue === ' ' ? '(single space)' : '(empty)',
            emptyLangs: mismatchLangs,
            allTexts: trans,
          });
          screenReport.issues.push({
            severity: 'warning',
            message: `Should match FR (${frValue === ' ' ? 'space' : 'empty'}): ${mismatchLangs.join(', ')}`,
            keyId,
            frText: trans.fr,
          });
        }
        continue;
      }

      const emptyLangs = CONFIG.languages.filter(lang => !trans[lang] || trans[lang].trim() === '');

      if (emptyLangs.length === 0) {
        screenReport.translations.complete++;
      } else {
        screenReport.translations.incomplete++;
        screenReport.translations.details.push({
          keyId,
          frText: trans.fr || '(empty)',
          emptyLangs,
          allTexts: trans,
        });
        screenReport.issues.push({
          severity: 'warning',
          message: `Missing translations for: ${emptyLangs.join(', ')}`,
          keyId,
          frText: trans.fr,
        });
      }
    }

    report.push(screenReport);
  }

  // Sort by number of issues (most problematic first)
  report.sort((a, b) => b.issues.length - a.issues.length);

  return report;
}

function generateNavigationGraph(screens) {
  const graph = {};

  for (const screen of screens) {
    if (!screen.routeName) continue;

    graph[screen.routeName] = {
      path: screen.routePath,
      navigatesTo: screen.navigationsTo || [],
      navigatesFrom: [],
    };
  }

  // Build reverse links (who navigates TO this screen)
  for (const [screenName, data] of Object.entries(graph)) {
    for (const target of data.navigatesTo) {
      if (graph[target]) {
        if (!graph[target].navigatesFrom.includes(screenName)) {
          graph[target].navigatesFrom.push(screenName);
        }
      }
    }
  }

  return graph;
}

// ============================================================================
// ACTIONABLE SUMMARY GENERATOR
// ============================================================================

function generateActionableSummary(appName, analysis, screenReports, translations) {
  let summary = `# 🎯 ACTION REQUIRED - ${appName}

Generated: ${new Date().toLocaleString()}

---

`;

  const coverage = Math.round(analysis.stats.completeKeys / analysis.stats.totalKeys * 100);

  // Release readiness assessment
  let releaseStatus = '🟢 READY';
  let releaseMessage = 'All translations are complete.';

  if (coverage < 70) {
    releaseStatus = '🔴 NOT READY';
    releaseMessage = 'Critical translation gaps. Do not release to Spanish/Italian markets.';
  } else if (coverage < 90) {
    releaseStatus = '🟡 CAUTION';
    releaseMessage = 'Some translations missing. Review before release.';
  } else if (analysis.stats.partialKeys > 0) {
    releaseStatus = '🟡 MINOR ISSUES';
    releaseMessage = 'A few translations missing. Can release with known gaps.';
  }

  summary += `## Release Status: ${releaseStatus}

${releaseMessage}

**Coverage:** ${coverage}% (${analysis.stats.completeKeys}/${analysis.stats.totalKeys} keys complete)

---

## By Language

`;

  const langStats = analysis.stats.byLanguage;
  const langs = [
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
  ];

  for (const lang of langs) {
    const filled = langStats[lang.code].filled;
    const empty = langStats[lang.code].empty;
    const pct = Math.round(filled / analysis.stats.totalKeys * 100);

    let status = '✅';
    if (pct < 70) status = '❌';
    else if (pct < 95) status = '⚠️';

    summary += `${lang.flag} **${lang.name}**: ${pct}% complete (${empty} missing) ${status}\n`;
  }

  // ========== ALL MISSING TRANSLATIONS (EXHAUSTIVE) ==========
  if (analysis.issues.emptyTranslations.length > 0) {
    summary += `\n---

## 🔴 Missing Translations (${analysis.issues.emptyTranslations.length} keys)

| Key | French Text | Missing |
|-----|-------------|---------|
`;
    for (const issue of analysis.issues.emptyTranslations) {
      const frText = (issue.frText || '').substring(0, 50).replace(/\|/g, '∣').replace(/\n/g, '↵');
      const missingLangs = issue.emptyLangs.map(l => l.toUpperCase()).join(', ');
      summary += `| \`${issue.keyId}\` | ${frText || '(empty)'} | ${missingLangs} |\n`;
    }
  }

  // ========== ALL COPY-PASTE ERRORS (EXHAUSTIVE) ==========
  if (analysis.issues.suspiciousDuplicates.length > 0) {
    summary += `\n---

## ⚠️ Possible Copy-Paste Errors (${analysis.issues.suspiciousDuplicates.length} keys)

These have French text in Spanish/Italian slots (likely forgot to translate):

| Key | Issue | French Text |
|-----|-------|-------------|
`;
    for (const dup of analysis.issues.suspiciousDuplicates) {
      const text = dup.text.substring(0, 40).replace(/\|/g, '∣').replace(/\n/g, '↵');
      summary += `| \`${dup.keyId}\` | ${dup.issue} | ${text} |\n`;
    }
  }

  // ========== ALL SPACE MISMATCHES (EXHAUSTIVE) ==========
  if (analysis.issues.leadingTrailingSpaceMismatch.length > 0) {
    summary += `\n---

## ⚠️ Leading/Trailing Space Issues (${analysis.issues.leadingTrailingSpaceMismatch.length} keys)

These have leading or trailing spaces in French but not in other languages (UI issue):

| Key | French Text | Issue |
|-----|-------------|-------|
`;
    for (const issue of analysis.issues.leadingTrailingSpaceMismatch) {
      const text = issue.frText.substring(0, 30).replace(/\|/g, '∣').replace(/\n/g, '↵');
      const spaceInfo = [];
      if (issue.frHasLeading) spaceInfo.push('leading');
      if (issue.frHasTrailing) spaceInfo.push('trailing');
      const missingLangs = issue.mismatch.map(m => m.lang.toUpperCase()).join(', ');
      summary += `| \`${issue.keyId}\` | "${text}" | Missing ${spaceInfo.join('+')} space in: ${missingLangs} |\n`;
    }
  }

  // ========== QUICK ACTION CHECKLIST ==========
  const hasIssues =
    analysis.issues.emptyTranslations.length > 0 ||
    analysis.issues.suspiciousDuplicates.length > 0 ||
    analysis.issues.leadingTrailingSpaceMismatch.length > 0;

  if (hasIssues) {
    summary += `\n---

## Quick Action Checklist

`;

    if (analysis.issues.emptyTranslations.length > 0) {
      summary += `- [ ] Fix ${analysis.issues.emptyTranslations.length} missing translations (see table above)\n`;
    }

    if (analysis.issues.suspiciousDuplicates.length > 0) {
      summary += `- [ ] Fix ${analysis.issues.suspiciousDuplicates.length} copy-paste errors (see table above)\n`;
    }

    if (analysis.issues.leadingTrailingSpaceMismatch.length > 0) {
      summary += `- [ ] Fix ${analysis.issues.leadingTrailingSpaceMismatch.length} space issues (see table above)\n`;
    }

    summary += `- [ ] Re-run audit after fixes: \`audit-poteau\` or \`audit-poteau-max\`\n`;
  }

  return summary;
}

function getMostCommonMissingLangs(details) {
  if (!details || details.length === 0) return null;

  const langCounts = { es: 0, it: 0, en: 0, fr: 0 };
  for (const d of details) {
    for (const lang of d.emptyLangs) {
      langCounts[lang]++;
    }
  }

  const missing = [];
  if (langCounts.es > 0) missing.push('ES');
  if (langCounts.it > 0) missing.push('IT');
  if (langCounts.en > 0) missing.push('EN');
  if (langCounts.fr > 0) missing.push('FR');

  return missing.join(', ');
}

// ============================================================================
// OUTPUT FORMATTERS
// ============================================================================

function generateDetailedScreenCatalog(screens, translations, navGraph) {
  let md = `# 📚 Screen Catalog - Complete Text Reference

This document shows ALL text displayed on each screen in all 4 languages.
Use this as a reference to verify what users see.

---

`;

  // Sort screens alphabetically by routeName
  const sortedScreens = [...screens]
    .filter(s => s && s.routeName)
    .sort((a, b) => (a.routeName || '').localeCompare(b.routeName || ''));

  for (const screen of sortedScreens) {
    if (!screen.routeName) continue;

    const navData = navGraph[screen.routeName] || { navigatesFrom: [], navigatesTo: [] };

    md += `## ${screen.routeName}\n\n`;
    md += `**Route:** \`${screen.routePath || 'N/A'}\`\n\n`;

    // Navigation info
    md += `**Navigation:**\n`;
    md += `- ← Comes from: ${navData.navigatesFrom && navData.navigatesFrom.length > 0 ? navData.navigatesFrom.join(', ') : '(entry point or deep link)'}\n`;
    const cleanedNavTo = (screen.navigationsTo || []).map(n => n.replace(/Widget$/, ''));
    md += `- → Goes to: ${cleanedNavTo.length > 0 ? cleanedNavTo.join(', ') : '(no outbound navigation)'}\n\n`;

    // Translation table
    if (screen.translationKeys && screen.translationKeys.length > 0) {
      md += `**Displayed Text (${screen.translationKeys.length} items):**\n\n`;
      md += `| Status | # | Key | 🇫🇷 French | 🇬🇧 English | 🇪🇸 Spanish | 🇮🇹 Italian |\n`;
      md += `|--------|---|-----|-----------|------------|------------|------------|\n`;

      let i = 1;
      for (const keyId of screen.translationKeys) {
        const trans = translations[keyId];
        if (!trans) {
          md += `| ❌ | ${i} | \`${keyId}\` | ⚠️ KEY NOT FOUND | - | - | - |\n`;
          i++;
          continue;
        }

        const fr = (trans.fr || '').substring(0, 25).replace(/\|/g, '∣').replace(/\n/g, '↵');
        const en = (trans.en || '').substring(0, 25).replace(/\|/g, '∣').replace(/\n/g, '↵');
        const es = (trans.es || '').substring(0, 25).replace(/\|/g, '∣').replace(/\n/g, '↵');
        const it = (trans.it || '').substring(0, 25).replace(/\|/g, '∣').replace(/\n/g, '↵');

        // Determine status - handle single-space values correctly
        // Rule: If FR is empty or single space, other langs should match exactly
        const frVal = trans.fr || '';
        let status = '✅';

        if (frVal === '' || frVal === ' ') {
          // FR is empty/space - check if all others match
          const allMatch = [trans.en, trans.es, trans.it].every(v => v === frVal);
          if (!allMatch) status = '⚠️';
        } else {
          // FR has content - check for empty translations (using trim)
          const emptyCount = [trans.fr, trans.en, trans.es, trans.it].filter(v => !v || v.trim() === '').length;
          if (emptyCount === 4) status = '❌';
          else if (emptyCount > 0) status = '⚠️';
        }

        md += `| ${status} | ${i} | \`${keyId}\` | ${fr || '❌'} | ${en || '❌'} | ${es || '❌'} | ${it || '❌'} |\n`;
        i++;
      }
    } else {
      md += `*No translation keys found in this screen (may use dynamic content or components)*\n`;
    }

    md += `\n---\n\n`;
  }

  return md;
}

function generateMarkdownReport(appName, analysis, screenReports, navGraph, timestamp) {
  let md = `# Pre-Release Audit Report

**App:** ${appName}
**Generated:** ${timestamp}
**Tool Version:** 1.0.0

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Translation Keys | ${analysis.stats.totalKeys} |
| Complete (all 4 languages) | ${analysis.stats.completeKeys} (${Math.round(analysis.stats.completeKeys / analysis.stats.totalKeys * 100)}%) |
| Partial (missing some) | ${analysis.stats.partialKeys} |
| Empty (all languages) | ${analysis.stats.emptyKeys} |

### Coverage by Language

| Language | Filled | Empty | Coverage |
|----------|--------|-------|----------|
| French (fr) | ${analysis.stats.byLanguage.fr.filled} | ${analysis.stats.byLanguage.fr.empty} | ${Math.round(analysis.stats.byLanguage.fr.filled / analysis.stats.totalKeys * 100)}% |
| English (en) | ${analysis.stats.byLanguage.en.filled} | ${analysis.stats.byLanguage.en.empty} | ${Math.round(analysis.stats.byLanguage.en.filled / analysis.stats.totalKeys * 100)}% |
| Spanish (es) | ${analysis.stats.byLanguage.es.filled} | ${analysis.stats.byLanguage.es.empty} | ${Math.round(analysis.stats.byLanguage.es.filled / analysis.stats.totalKeys * 100)}% |
| Italian (it) | ${analysis.stats.byLanguage.it.filled} | ${analysis.stats.byLanguage.it.empty} | ${Math.round(analysis.stats.byLanguage.it.filled / analysis.stats.totalKeys * 100)}% |

---

## 🚨 Critical Issues (Empty Translations)

`;

  // Group empty translations by missing languages
  const byMissingLang = { es: [], it: [], en: [], 'es,it': [], other: [] };

  for (const issue of analysis.issues.emptyTranslations) {
    const key = issue.emptyLangs.sort().join(',');
    if (key === 'es' || key === 'it' || key === 'en' || key === 'es,it') {
      byMissingLang[key].push(issue);
    } else {
      byMissingLang.other.push(issue);
    }
  }

  if (byMissingLang['es,it'].length > 0) {
    md += `### Missing Spanish AND Italian (${byMissingLang['es,it'].length} keys)\n\n`;
    md += `| Key ID | French Text | English Text |\n|--------|-------------|-------------|\n`;
    for (const issue of byMissingLang['es,it'].slice(0, 50)) {
      const frText = (issue.frText || '').substring(0, 40).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      md += `| \`${issue.keyId}\` | ${frText}... | - |\n`;
    }
    if (byMissingLang['es,it'].length > 50) {
      md += `\n*...and ${byMissingLang['es,it'].length - 50} more*\n`;
    }
    md += '\n';
  }

  if (byMissingLang.es.length > 0) {
    md += `### Missing Spanish Only (${byMissingLang.es.length} keys)\n\n`;
    md += `<details><summary>Click to expand</summary>\n\n`;
    md += `| Key ID | French Text |\n|--------|-------------|\n`;
    for (const issue of byMissingLang.es.slice(0, 30)) {
      const frText = (issue.frText || '').substring(0, 50).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      md += `| \`${issue.keyId}\` | ${frText} |\n`;
    }
    md += `\n</details>\n\n`;
  }

  if (byMissingLang.it.length > 0) {
    md += `### Missing Italian Only (${byMissingLang.it.length} keys)\n\n`;
    md += `<details><summary>Click to expand</summary>\n\n`;
    md += `| Key ID | French Text |\n|--------|-------------|\n`;
    for (const issue of byMissingLang.it.slice(0, 30)) {
      const frText = (issue.frText || '').substring(0, 50).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      md += `| \`${issue.keyId}\` | ${frText} |\n`;
    }
    md += `\n</details>\n\n`;
  }

  // Suspicious duplicates
  if (analysis.issues.suspiciousDuplicates.length > 0) {
    md += `---\n\n## ⚠️ Suspicious Duplicates (Possible Copy-Paste Errors)\n\n`;
    md += `These translations have the same text in French and another language:\n\n`;
    md += `| Key ID | Issue | Text |\n|--------|-------|------|\n`;
    for (const issue of analysis.issues.suspiciousDuplicates.slice(0, 30)) {
      const text = issue.text.substring(0, 40).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      md += `| \`${issue.keyId}\` | ${issue.issue} | ${text}... |\n`;
    }
    md += '\n';
  }

  // Leading/trailing space mismatch (UI issue)
  if (analysis.issues.leadingTrailingSpaceMismatch.length > 0) {
    md += `---\n\n## ⚠️ Leading/Trailing Space Mismatch (UI Issue)\n\n`;
    md += `These translations have leading or trailing spaces in French but not in other languages.\n`;
    md += `This can cause UI alignment issues when text is concatenated.\n\n`;
    md += `| Key ID | FR Text | Issue |\n|--------|---------|-------|\n`;
    for (const issue of analysis.issues.leadingTrailingSpaceMismatch.slice(0, 30)) {
      const text = issue.frText.substring(0, 30).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const spaceInfo = [];
      if (issue.frHasLeading) spaceInfo.push('leading');
      if (issue.frHasTrailing) spaceInfo.push('trailing');
      const missingLangs = issue.mismatch.map(m => m.lang.toUpperCase()).join(', ');
      md += `| \`${issue.keyId}\` | "${text}" | Missing ${spaceInfo.join('+')} space in: ${missingLangs} |\n`;
    }
    if (analysis.issues.leadingTrailingSpaceMismatch.length > 30) {
      md += `\n*...and ${analysis.issues.leadingTrailingSpaceMismatch.length - 30} more*\n`;
    }
    md += '\n';
  }

  // Screen-by-screen report
  md += `---\n\n## 📱 Screen-by-Screen Analysis\n\n`;

  const screensWithIssues = screenReports.filter(s => s.issues.length > 0);
  const screensClean = screenReports.filter(s => s.issues.length === 0);

  md += `**Screens with issues:** ${screensWithIssues.length}  \n`;
  md += `**Clean screens:** ${screensClean.length}\n\n`;

  for (const screen of screensWithIssues.slice(0, 20)) {
    md += `### ${screen.name}\n\n`;
    md += `- **Path:** \`${screen.path}\`\n`;
    md += `- **Translations:** ${screen.translations.complete} complete, ${screen.translations.incomplete} incomplete\n`;
    md += `- **Navigates to:** ${screen.navigatesTo.length > 0 ? screen.navigatesTo.join(', ') : 'None'}\n`;

    if (screen.translations.details.length > 0) {
      md += `\n**Missing translations:**\n\n`;
      md += `| Key | FR Text | Missing |\n|-----|---------|--------|\n`;
      for (const detail of screen.translations.details.slice(0, 10)) {
        const frText = (detail.frText || '').substring(0, 30).replace(/\|/g, '\\|').replace(/\n/g, ' ');
        md += `| \`${detail.keyId}\` | ${frText} | ${detail.emptyLangs.join(', ')} |\n`;
      }
    }
    md += '\n';
  }

  // Navigation map
  md += `---\n\n## 🗺️ Navigation Map\n\n`;
  md += `This shows how screens connect to each other.\n\n`;

  for (const [screenName, data] of Object.entries(navGraph)) {
    if (data.navigatesFrom.length > 0 || data.navigatesTo.length > 0) {
      md += `### ${screenName}\n`;
      md += `- **From:** ${data.navigatesFrom.length > 0 ? data.navigatesFrom.join(', ') : '(entry point)'}\n`;
      md += `- **To:** ${data.navigatesTo.length > 0 ? data.navigatesTo.join(', ') : '(terminal)'}\n\n`;
    }
  }

  return md;
}

function generateJsonReport(appName, analysis, screenReports, navGraph, timestamp) {
  return {
    meta: {
      app: appName,
      timestamp,
      toolVersion: '1.0.0',
    },
    summary: analysis.stats,
    issues: analysis.issues,
    screens: screenReports,
    navigation: navGraph,
  };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function auditApp(appKey) {
  const appConfig = CONFIG.apps[appKey];
  if (!appConfig) {
    log(`Unknown app: ${appKey}`, 'red');
    return null;
  }

  logSection(`Auditing ${appConfig.name}`);

  // 1. Parse translations
  log('\n📖 Parsing translations...', 'cyan');
  const i18nPath = path.join(appConfig.path, appConfig.i18nFile);
  const { translations } = parseTranslationsFile(i18nPath);
  log(`   Found ${Object.keys(translations).length} translation keys`, 'dim');

  // 2. Analyze translations
  log('\n🔍 Analyzing translations...', 'cyan');
  const analysis = analyzeTranslations(translations);

  log(`   ✅ Complete: ${analysis.stats.completeKeys}`, 'green');
  log(`   ⚠️  Partial: ${analysis.stats.partialKeys}`, 'yellow');
  log(`   ❌ Empty: ${analysis.stats.emptyKeys}`, 'red');

  // 3. Parse all widget files
  log('\n📱 Scanning screens...', 'cyan');
  const widgetFiles = findAllWidgetFiles(appConfig);
  const screens = widgetFiles.map(f => parseWidgetFile(f)).filter(s => s !== null);
  log(`   Found ${screens.length} screen/widget files`, 'dim');

  // 4. Generate screen reports
  log('\n📊 Generating screen reports...', 'cyan');
  const screenReports = generateScreenReport(screens, translations, appConfig.name);

  // 5. Build navigation graph
  log('\n🗺️  Building navigation map...', 'cyan');
  const navGraph = generateNavigationGraph(screens);

  // 6. Parse nav file for additional route info
  const navPath = path.join(appConfig.path, appConfig.navFile);
  const navData = parseNavigationFile(navPath);

  return {
    appKey,
    appConfig,
    translations,
    analysis,
    screens,
    screenReports,
    navGraph,
    navData,
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Poteau Pre-Release Audit Tool

Usage:
  node index.js [app]          Run audit (app: 'poteau-app', 'poteau-max', or 'both')
  node index.js --help         Show this help

Examples:
  node index.js                Audit both apps
  node index.js poteau-app     Audit only Poteau App (B2C)
  node index.js poteau-max     Audit only Poteau Max (B2B)

Output:
  Creates timestamped reports in the current directory:
  - audit-report-YYYY-MM-DD-HH-MM.md   (Human-readable)
  - audit-report-YYYY-MM-DD-HH-MM.json (Machine-readable)
`);
    return;
  }

  const appArg = args[0] || 'both';
  const appsToAudit = appArg === 'both' ? ['poteau-app', 'poteau-max'] : [appArg];

  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(15) + 'POTEAU PRE-RELEASE AUDIT' + ' '.repeat(17) + '║');
  console.log('╚' + '═'.repeat(58) + '╝\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
  const allResults = {};

  for (const appKey of appsToAudit) {
    const result = await auditApp(appKey);
    if (result) {
      allResults[appKey] = result;
    }
  }

  // Generate reports
  logSection('Generating Reports');

  const { execSync } = require('child_process');
  const generatedFiles = [];

  for (const [appKey, result] of Object.entries(allResults)) {
    // Generate actionable summary (the key part at the top)
    const actionSummary = generateActionableSummary(
      result.appConfig.name,
      result.analysis,
      result.screenReports,
      result.translations
    );

    // Generate detailed report
    const mdReport = generateMarkdownReport(
      result.appConfig.name,
      result.analysis,
      result.screenReports,
      result.navGraph,
      timestamp
    );

    // Generate screen catalog
    const catalogReport = generateDetailedScreenCatalog(
      result.screens,
      result.translations,
      result.navGraph
    );

    // Combine into ONE file: Action Summary → Details → Screen Catalog
    const combinedReport = `${actionSummary}

---

# 📋 Detailed Analysis

${mdReport}

---

${catalogReport}`;

    const reportPath = path.join(__dirname, `audit-${appKey}-${timestamp}.md`);
    fs.writeFileSync(reportPath, combinedReport);
    generatedFiles.push(reportPath);

    log(`\n✅ ${result.appConfig.name}:`, 'green');
    log(`   📄 ${reportPath}`, 'cyan');

    // Print quick summary in terminal
    const { analysis } = result;
    const coverage = Math.round(analysis.stats.completeKeys / analysis.stats.totalKeys * 100);
    log(`   Coverage: ${coverage}%`, coverage >= 90 ? 'green' : coverage >= 70 ? 'yellow' : 'red');
    log(`   Missing translations: ${analysis.issues.emptyTranslations.length}`, analysis.issues.emptyTranslations.length === 0 ? 'green' : 'yellow');
  }

  console.log('\n' + '─'.repeat(60));
  log('Audit complete! Opening report...', 'cyan');
  console.log('─'.repeat(60) + '\n');

  // Open the generated file(s) in default app
  for (const filePath of generatedFiles) {
    try {
      execSync(`open "${filePath}"`);
    } catch (e) {
      // Silently fail if open command doesn't work (non-macOS)
    }
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

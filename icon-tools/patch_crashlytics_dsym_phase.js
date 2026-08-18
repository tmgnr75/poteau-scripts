#!/usr/bin/env node
/*
 * Adds the Crashlytics "Upload dSYMs" run-script build phase to the Runner
 * target. FlutterFlow regenerates project.pbxproj on every export and does NOT
 * include this phase, so without re-applying it after each export every release
 * lands in Crashlytics with "Missing dSYM (required)" and all iOS crash traces
 * stay unsymbolicated (addresses instead of file/line).
 *
 * The phase must run AFTER "Thin Binary", because that phase is what produces
 * the final App.framework binary the dSYM is matched against.
 *
 * Note: upload-symbols lives in ios/Pods/, so `pod install` must have run
 * before an Xcode build reaches this phase. The script is written to warn and
 * exit 0 (never fail the build) if the binary is missing.
 *
 * Idempotent: skips if the phase is already present.
 */

const xcode = require('xcode');
const fs = require('fs');

const PROJECT_PATH = '/Users/tmgnr/poteau-workspace/poteau-app/ios/Runner.xcodeproj/project.pbxproj';

const PHASE_NAME = 'Upload Crashlytics dSYMs';

// -gsp points at GoogleService-Info.plist so upload-symbols picks up the right
// Firebase app id. DWARF_DSYM_* resolve to the dSYM Xcode just produced.
// `-p ios` sets the platform. Guarded so a missing Pods dir (or a build with no
// dSYM, e.g. Debug) warns rather than failing the build.
const SHELL_SCRIPT = [
  '"${PODS_ROOT}/FirebaseCrashlytics/upload-symbols" \\',
  '  -gsp "${PROJECT_DIR}/Runner/GoogleService-Info.plist" \\',
  '  -p ios \\',
  '  "${DWARF_DSYM_FOLDER_PATH}/${DWARF_DSYM_FILE_NAME}"',
].join('\n');

const GUARDED_SCRIPT = `if [ ! -f "\${PODS_ROOT}/FirebaseCrashlytics/upload-symbols" ]; then
  echo "warning: upload-symbols not found — run 'pod install'. Skipping dSYM upload."
  exit 0
fi
if [ ! -d "\${DWARF_DSYM_FOLDER_PATH}/\${DWARF_DSYM_FILE_NAME}" ]; then
  echo "warning: no dSYM at \${DWARF_DSYM_FOLDER_PATH}/\${DWARF_DSYM_FILE_NAME}. Skipping dSYM upload."
  exit 0
fi
${SHELL_SCRIPT}
`;

function findRunnerTargetKey(project) {
  const targets = project.hash.project.objects.PBXNativeTarget;
  for (const key of Object.keys(targets)) {
    if (key.endsWith('_comment')) continue;
    const t = targets[key];
    if (t && t.name === 'Runner') return key;
  }
  return null;
}

function phaseAlreadyPresent(project) {
  const phases = project.hash.project.objects.PBXShellScriptBuildPhase || {};
  for (const key of Object.keys(phases)) {
    if (key.endsWith('_comment')) continue;
    const p = phases[key];
    if (!p) continue;
    const name = (p.name || '').replace(/"/g, '');
    if (name === PHASE_NAME) return true;
    // Also treat any hand-added phase invoking upload-symbols as present, so we
    // never create a duplicate uploader under a different name.
    if (p.shellScript && p.shellScript.includes('upload-symbols')) return true;
  }
  return false;
}

function main() {
  const project = xcode.project(PROJECT_PATH);
  project.parseSync();

  if (phaseAlreadyPresent(project)) {
    console.log('pbxproj already has a Crashlytics dSYM upload phase');
    return;
  }

  const runnerTargetKey = findRunnerTargetKey(project);
  if (!runnerTargetKey) {
    console.error('Could not locate Runner target in project.pbxproj');
    process.exit(1);
  }

  const phaseUuid = project.generateUuid();

  // pbxproj grammar: the shellScript value is emitted literally, so it must be
  // a quoted string with escaped newlines/quotes.
  const encodedScript =
    '"' +
    GUARDED_SCRIPT.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') +
    '"';

  project.hash.project.objects.PBXShellScriptBuildPhase =
    project.hash.project.objects.PBXShellScriptBuildPhase || {};

  project.hash.project.objects.PBXShellScriptBuildPhase[phaseUuid] = {
    isa: 'PBXShellScriptBuildPhase',
    // The dSYM changes on every build, so this phase must never be skipped by
    // Xcode's up-to-date check.
    alwaysOutOfDate: 1,
    buildActionMask: 2147483647,
    files: [],
    inputPaths: [],
    name: `"${PHASE_NAME}"`,
    outputPaths: [],
    runOnlyForDeploymentPostprocessing: 0,
    shellPath: '/bin/sh',
    shellScript: encodedScript,
  };
  project.hash.project.objects.PBXShellScriptBuildPhase[phaseUuid + '_comment'] = PHASE_NAME;

  // Append last so it runs after Thin Binary has produced the final binary.
  const runnerTarget = project.hash.project.objects.PBXNativeTarget[runnerTargetKey];
  runnerTarget.buildPhases = runnerTarget.buildPhases || [];
  runnerTarget.buildPhases.push({ value: phaseUuid, comment: PHASE_NAME });

  fs.writeFileSync(PROJECT_PATH, project.writeSync());
  console.log(`pbxproj: added "${PHASE_NAME}" build phase to Runner target`);
}

main();

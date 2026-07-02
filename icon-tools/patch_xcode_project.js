#!/usr/bin/env node
/*
 * Adds the alternate-icon PNGs to the Runner Xcode target so they get bundled
 * into the .app. Files must already exist at ios/Runner/<filename>.png.
 *
 * Uses xcode lib's lower-level API rather than addResourceFile, which has a
 * fragile group-lookup that fails on FlutterFlow-generated projects.
 *
 * Idempotent: skips files already referenced.
 */

const xcode = require('xcode');
const fs = require('fs');
const path = require('path');

const PROJECT_PATH = '/Users/tmgnr/poteau-workspace/poteau-app/ios/Runner.xcodeproj/project.pbxproj';
const RUNNER_DIR = '/Users/tmgnr/poteau-workspace/poteau-app/ios/Runner';

function listAlternateIconFiles() {
  return fs
    .readdirSync(RUNNER_DIR)
    // Suffix allows a dot so iPad Pro's fractional point size (-83.5@2x) matches too.
    .filter((f) => /^AppIcon-(PoteauLegacy|KrankLegacy)(-[\d.]+)?@\dx\.png$/.test(f))
    .sort();
}

function findRunnerGroupKey(project) {
  const groups = project.hash.project.objects.PBXGroup;
  for (const key of Object.keys(groups)) {
    if (key.endsWith('_comment')) continue;
    const g = groups[key];
    if (g && g.path === 'Runner') return key;
  }
  // Fall back to name-based match.
  for (const key of Object.keys(groups)) {
    if (key.endsWith('_comment')) continue;
    const g = groups[key];
    if (g && g.name === 'Runner') return key;
  }
  return null;
}

function findResourcesBuildPhaseKey(project) {
  // The project has two PBXResourcesBuildPhase entries: one for the main
  // Runner target (where alternate icon PNGs need to live) and one for the
  // ImageNotification notification-service extension. We must pick Runner's.
  //
  // Strategy: find the PBXNativeTarget named "Runner", then locate the
  // build-phase UUID it lists which is of type PBXResourcesBuildPhase.
  const targets = project.hash.project.objects.PBXNativeTarget;
  let runnerTargetKey = null;
  for (const key of Object.keys(targets)) {
    if (key.endsWith('_comment')) continue;
    const t = targets[key];
    if (t && t.name === 'Runner') {
      runnerTargetKey = key;
      break;
    }
  }
  if (!runnerTargetKey) return null;

  const runnerTarget = targets[runnerTargetKey];
  const phases = project.hash.project.objects.PBXResourcesBuildPhase;
  for (const phaseRef of runnerTarget.buildPhases || []) {
    const phaseKey = typeof phaseRef === 'object' ? phaseRef.value : phaseRef;
    if (phases[phaseKey]) return phaseKey;
  }
  return null;
}

function isAlreadyReferenced(project, filename) {
  const fileRefs = project.hash.project.objects.PBXFileReference;
  for (const key of Object.keys(fileRefs)) {
    if (key.endsWith('_comment')) continue;
    const ref = fileRefs[key];
    if (ref && ref.path && ref.path.replace(/"/g, '') === filename) return true;
  }
  return false;
}

function main() {
  const files = listAlternateIconFiles();
  if (files.length === 0) {
    console.error('No alternate icon PNGs found in Runner/. Did you copy them first?');
    process.exit(1);
  }

  const project = xcode.project(PROJECT_PATH);
  project.parseSync();

  const runnerGroupKey = findRunnerGroupKey(project);
  if (!runnerGroupKey) {
    console.error('Could not locate Runner group in project.pbxproj');
    process.exit(1);
  }
  const resourcesPhaseKey = findResourcesBuildPhaseKey(project);
  if (!resourcesPhaseKey) {
    console.error('Could not locate Resources build phase');
    process.exit(1);
  }

  let added = 0;
  let skipped = 0;
  for (const filename of files) {
    if (isAlreadyReferenced(project, filename)) {
      skipped++;
      continue;
    }

    // Build a PBXFileReference + PBXBuildFile pair manually, then attach to
    // the Runner group and the Resources build phase.
    //
    // pbxproj grammar requires identifiers containing special characters
    // (like @) to be double-quoted. The `path` value passed here is emitted
    // literally by xcode.writeSync, so we wrap it in quotes ourselves.
    const fileRefUuid = project.generateUuid();
    const buildFileUuid = project.generateUuid();
    const quotedPath = `"${filename}"`;

    project.hash.project.objects.PBXFileReference[fileRefUuid] = {
      isa: 'PBXFileReference',
      lastKnownFileType: 'image.png',
      path: quotedPath,
      sourceTree: '"<group>"',
    };
    project.hash.project.objects.PBXFileReference[fileRefUuid + '_comment'] = filename;

    project.hash.project.objects.PBXBuildFile[buildFileUuid] = {
      isa: 'PBXBuildFile',
      fileRef: fileRefUuid,
      fileRef_comment: filename,
    };
    project.hash.project.objects.PBXBuildFile[buildFileUuid + '_comment'] =
      `${filename} in Resources`;

    // Add to the Runner group's children.
    const runnerGroup = project.hash.project.objects.PBXGroup[runnerGroupKey];
    runnerGroup.children = runnerGroup.children || [];
    runnerGroup.children.push({ value: fileRefUuid, comment: filename });

    // Add to the Resources build phase.
    const resourcesPhase = project.hash.project.objects.PBXResourcesBuildPhase[resourcesPhaseKey];
    resourcesPhase.files = resourcesPhase.files || [];
    resourcesPhase.files.push({
      value: buildFileUuid,
      comment: `${filename} in Resources`,
    });

    added++;
  }

  if (added === 0) {
    console.log(`pbxproj already references all ${files.length} alternate icons`);
    return;
  }

  fs.writeFileSync(PROJECT_PATH, project.writeSync());
  console.log(`pbxproj: added ${added}, skipped ${skipped}`);
}

main();

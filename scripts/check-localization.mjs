#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LANGS = ["cn", "jp", "ko"];
const SOURCE_DIRS = ["pages", "snippets", "api-reference"];

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, files = []) {
  const entries = await fs.readdir(path.join(ROOT, dir), { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(relativePath, files);
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(relativePath);
    }
  }
  return files;
}

async function main() {
  let sourceFiles = [];
  for (const dir of SOURCE_DIRS) {
    if (await exists(path.join(ROOT, dir))) {
      sourceFiles = sourceFiles.concat(await walk(dir));
    }
  }

  sourceFiles.sort();

  let missing = 0;
  for (const lang of LANGS) {
    for (const file of sourceFiles) {
      const localizedFile = path.join(ROOT, lang, file);
      if (!(await exists(localizedFile))) {
        console.log(`Missing: ${lang}/${file}`);
        missing += 1;
      }
    }
  }

  if (missing > 0) {
    console.error(`Found ${missing} missing localized files.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Verified ${sourceFiles.length} source files across ${LANGS.length} locales.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

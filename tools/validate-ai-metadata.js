#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const requiredPages = new Set([
  'index.html',
  'lectures.html',
  'assignments.html',
  'attendance.html',
  'resources.html'
]);

const ignoredDirs = new Set([
  '.git',
  '.github',
  'node_modules',
  'archive-duplicate',
  'Port-Engineering-Course-main'
]);

const scriptRegex = /<script[^>]*class=["'][^"']*\bpe-ai-meta\b[^"']*["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i;

const htmlFiles = getHtmlFiles(rootDir);
let hasError = false;
let validatedCount = 0;

requiredPages.forEach((page) => {
  const fullPath = path.join(rootDir, page);
  if (!fs.existsSync(fullPath)) {
    hasError = true;
    console.error(`[ERROR] Required page not found: ${page}`);
  }
});

htmlFiles.forEach((filePath) => {
  const relativePath = path.relative(rootDir, filePath);
  const html = fs.readFileSync(filePath, 'utf8');
  const match = html.match(scriptRegex);
  const isRequired = requiredPages.has(relativePath);

  if (!match) {
    if (isRequired) {
      hasError = true;
      console.error(`[ERROR] Missing pe-ai-meta block in required page: ${relativePath}`);
    }
    return;
  }

  validatedCount += 1;

  let metadata;
  try {
    metadata = JSON.parse(match[1]);
  } catch (error) {
    hasError = true;
    console.error(`[ERROR] Invalid JSON in ${relativePath}: ${error.message}`);
    return;
  }

  const errors = validateMetadata(metadata, relativePath);
  if (errors.length) {
    hasError = true;
    errors.forEach((message) => console.error(`[ERROR] ${message}`));
  } else {
    console.log(`[OK] ${relativePath}`);
  }
});

if (!validatedCount) {
  hasError = true;
  console.error('[ERROR] No pe-ai-meta blocks were found in scanned HTML files.');
}

if (hasError) {
  console.error('\nMetadata validation failed.');
  process.exit(1);
}

console.log(`\nMetadata validation passed for ${validatedCount} page(s).`);

function getHtmlFiles(startDir) {
  const files = [];
  walk(startDir, files);
  return files;
}

function walk(currentDir, files) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  entries.forEach((entry) => {
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        return;
      }
      walk(path.join(currentDir, entry.name), files);
      return;
    }

    if (!entry.isFile()) {
      return;
    }

    if (entry.name.toLowerCase().endsWith('.html')) {
      files.push(path.join(currentDir, entry.name));
    }
  });
}

function validateMetadata(metadata, relativePath) {
  const issues = [];

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    issues.push(`${relativePath}: metadata root must be a JSON object.`);
    return issues;
  }

  if (!isNonEmptyString(metadata.page)) {
    issues.push(`${relativePath}: "page" must be a non-empty string.`);
  }

  if (metadata.facts !== undefined && !isStringArray(metadata.facts)) {
    issues.push(`${relativePath}: "facts" must be an array of strings.`);
  }

  if (metadata.quickAnswers !== undefined) {
    if (!Array.isArray(metadata.quickAnswers)) {
      issues.push(`${relativePath}: "quickAnswers" must be an array.`);
    } else {
      metadata.quickAnswers.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          issues.push(`${relativePath}: quickAnswers[${index}] must be an object.`);
          return;
        }
        if (!isStringArray(item.keywords) || item.keywords.length === 0) {
          issues.push(`${relativePath}: quickAnswers[${index}].keywords must be a non-empty array of strings.`);
        }
        if (!isNonEmptyString(item.answer)) {
          issues.push(`${relativePath}: quickAnswers[${index}].answer must be a non-empty string.`);
        }
      });
    }
  }

  if (metadata.deadlines !== undefined) {
    if (!Array.isArray(metadata.deadlines)) {
      issues.push(`${relativePath}: "deadlines" must be an array.`);
    } else {
      metadata.deadlines.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          issues.push(`${relativePath}: deadlines[${index}] must be an object.`);
          return;
        }
        if (!isNonEmptyString(item.label)) {
          issues.push(`${relativePath}: deadlines[${index}].label must be a non-empty string.`);
        }
        if (!isNonEmptyString(item.due)) {
          issues.push(`${relativePath}: deadlines[${index}].due must be a non-empty string.`);
        }
      });
    }
  }

  if (metadata.links !== undefined) {
    if (!Array.isArray(metadata.links)) {
      issues.push(`${relativePath}: "links" must be an array.`);
    } else {
      metadata.links.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          issues.push(`${relativePath}: links[${index}] must be an object.`);
          return;
        }
        if (!isNonEmptyString(item.label)) {
          issues.push(`${relativePath}: links[${index}].label must be a non-empty string.`);
        }
      });
    }
  }

  return issues;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

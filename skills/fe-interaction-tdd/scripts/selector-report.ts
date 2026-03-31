#!/usr/bin/env tsx
/**
 * selector-report.ts — Selector stability analysis for Playwright tests
 *
 * Parses a .spec.ts file and classifies each selector by stability.
 * Informational only — helps developers spot fragile selectors early.
 *
 * Usage:
 *   npx tsx selector-report.ts --file <spec.ts> [--json]
 *
 * Exit codes:
 *   0 = success
 *   1 = error
 */

import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';
import { parseArgs } from 'util';

// --- Types ---

type Grade = 'stable' | 'caution' | 'warning';

interface SelectorEntry {
  selector: string;
  grade: Grade;
  line: number;
  reason: string;
  suggestion?: string;
}

interface Report {
  file: string;
  selectors: SelectorEntry[];
  summary: {
    total: number;
    stable: number;
    caution: number;
    warning: number;
    score: number;
  };
}

// --- Args ---

const { values } = parseArgs({
  options: {
    help: { type: 'boolean', short: 'h' },
    file: { type: 'string' },
    json: { type: 'boolean' },
  },
  strict: false,
});

if (values.help) {
  console.log(`Usage: npx tsx selector-report.ts --file <spec.ts> [--json]

Analyze Playwright test selectors for stability and maintainability.

Options:
  --file    Path to .spec.ts file to analyze (required)
  --json    Output result as JSON
  --help    Show this help

Grades:
  Stable:  data-testid, getByRole, getByLabel, getByTestId
  Caution: input[name], button:has-text(), semantic but changeable
  Warning: CSS paths, nth-child, class-based — suggest data-testid

Examples:
  npx tsx selector-report.ts --file e2e/login.spec.ts
  npx tsx selector-report.ts --file e2e/dashboard.spec.ts --json`);
  process.exit(0);
}

const filePath = values.file as string | undefined;

if (!filePath) {
  console.error('Usage: npx tsx selector-report.ts --file <spec.ts>');
  process.exit(1);
}

if (!existsSync(filePath)) {
  console.error(`[ERROR] File not found: ${filePath}`);
  process.exit(1);
}

const outputJson = !!values.json;

// --- Selector extraction patterns ---

// Matches: page.click('selector'), page.fill('selector', ...), page.locator('selector'),
// page.waitForSelector('selector'), page.$('selector'), page.$$('selector')
const PAGE_METHOD_RE = /\.(?:click|fill|locator|waitForSelector|\$\$?)\(\s*['"`]([^'"`]+)['"`]/g;

// Matches: getByRole('role', { name: 'text' }), getByLabel('text'), getByText('text'),
// getByTestId('id'), getByPlaceholder('text'), getByAltText('text'), getByTitle('text')
const GET_BY_RE = /(getBy(?:Role|Label|Text|TestId|Placeholder|AltText|Title))\(([^)]*)\)/g;

// Matches: [data-testid="value"] inside any selector string
const DATA_TESTID_RE = /\[data-testid=['"]?([^'"\]]+)['"]?\]/;

function extractSelectors(source: string): SelectorEntry[] {
  const entries: SelectorEntry[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Extract getBy* calls
    let match: RegExpExecArray | null;
    const getByRe = new RegExp(GET_BY_RE.source, 'g');
    while ((match = getByRe.exec(line)) !== null) {
      const method = match[1];
      const fullMatch = match[0];
      entries.push({
        selector: fullMatch,
        line: lineNum,
        ...classifyGetBy(method),
      });
    }

    // Extract page method selectors (skip if already captured as getBy*)
    const pageRe = new RegExp(PAGE_METHOD_RE.source, 'g');
    while ((match = pageRe.exec(line)) !== null) {
      const selector = match[1];
      // Skip if this line already has a getBy match at this position
      if (line.includes('getBy')) continue;
      entries.push({
        selector,
        line: lineNum,
        ...classifySelector(selector),
      });
    }
  }

  return entries;
}

function classifyGetBy(method: string): { grade: Grade; reason: string } {
  switch (method) {
    case 'getByRole':
      return { grade: 'stable', reason: 'ARIA role-based — resilient to markup changes' };
    case 'getByLabel':
      return { grade: 'stable', reason: 'Label association — accessible and stable' };
    case 'getByTestId':
      return { grade: 'stable', reason: 'Explicit test ID — dedicated for testing' };
    case 'getByText':
      return { grade: 'caution', reason: 'Text content may change with i18n or copy updates' };
    case 'getByPlaceholder':
      return { grade: 'caution', reason: 'Placeholder text may change' };
    case 'getByAltText':
      return { grade: 'caution', reason: 'Alt text may change' };
    case 'getByTitle':
      return { grade: 'caution', reason: 'Title attribute may change' };
    default:
      return { grade: 'caution', reason: `Unknown getBy method: ${method}` };
  }
}

function classifySelector(selector: string): { grade: Grade; reason: string; suggestion?: string } {
  // data-testid
  if (DATA_TESTID_RE.test(selector)) {
    return { grade: 'stable', reason: 'Explicit data-testid — dedicated for testing' };
  }

  // Role-based: [role="..."]
  if (/\[role=['"]/.test(selector)) {
    return { grade: 'stable', reason: 'ARIA role attribute — resilient to markup changes' };
  }

  // Semantic selectors with name/type attributes
  if (/^(input|select|textarea|button)\[(?:name|type)=/.test(selector)) {
    return { grade: 'caution', reason: 'Attribute-based — breaks if name/type changes' };
  }

  // :has-text() pseudo
  if (/:has-text\(/.test(selector)) {
    return { grade: 'caution', reason: 'Text-based — breaks if text content changes' };
  }

  // text= selector
  if (/^text=/.test(selector)) {
    return { grade: 'caution', reason: 'Text-based — breaks if text content changes' };
  }

  // ID selector: #id (not data- attributes)
  if (/^#[\w-]+$/.test(selector)) {
    return { grade: 'caution', reason: 'ID-based — stable if IDs are maintained' };
  }

  // nth-child, nth-of-type
  if (/nth-(?:child|of-type)/.test(selector)) {
    const tag = selector.match(/^(\w+)/)?.[1] || 'element';
    return {
      grade: 'warning',
      reason: 'Positional selector — breaks when sibling order changes',
      suggestion: `add data-testid to the target ${tag}`,
    };
  }

  // Class-based selectors (contains a dot for class)
  if (/^\.[\w-]/.test(selector) || /\s\.[\w-]/.test(selector)) {
    return {
      grade: 'warning',
      reason: 'Class-based — breaks with CSS module hash changes or refactoring',
      suggestion: 'add data-testid to the target element',
    };
  }

  // Complex CSS path with multiple combinators
  if (/\s*>\s*/.test(selector) && selector.split('>').length > 2) {
    return {
      grade: 'warning',
      reason: 'Deep CSS path — fragile to DOM structure changes',
      suggestion: 'add data-testid to the target element',
    };
  }

  // Simple tag selector
  if (/^[a-z]+(\[|$)/.test(selector)) {
    return { grade: 'caution', reason: 'Tag-based — may match multiple elements' };
  }

  // Default: treat as warning for unknown patterns
  return {
    grade: 'warning',
    reason: 'Non-semantic selector — may break with refactoring',
    suggestion: 'add data-testid to the target element',
  };
}

// --- Main ---

const source = readFileSync(filePath, 'utf-8');
const selectors = extractSelectors(source);
const fileName = basename(filePath);

const summary = {
  total: selectors.length,
  stable: selectors.filter(s => s.grade === 'stable').length,
  caution: selectors.filter(s => s.grade === 'caution').length,
  warning: selectors.filter(s => s.grade === 'warning').length,
  score: selectors.length === 0 ? 100 : Math.round(
    (selectors.filter(s => s.grade === 'stable').length / selectors.length) * 100
  ),
};

const report: Report = { file: fileName, selectors, summary };

if (outputJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const GRADE_ICON: Record<Grade, string> = {
    stable:  '✅',
    caution: '⚠️ ',
    warning: '❌',
  };

  const GRADE_LABEL: Record<Grade, string> = {
    stable:  'Stable',
    caution: 'Caution',
    warning: 'Warning',
  };

  console.log(`\n📋 Selector Stability Report (${fileName})`);
  console.log('─'.repeat(50));

  if (selectors.length === 0) {
    console.log('No selectors found in this file.');
  } else {
    for (const entry of selectors) {
      const icon = GRADE_ICON[entry.grade];
      const label = GRADE_LABEL[entry.grade];
      const selectorStr = entry.selector.length > 50
        ? entry.selector.slice(0, 47) + '...'
        : entry.selector;
      console.log(`${icon} L${entry.line}: ${selectorStr}`);
      console.log(`     → ${label}: ${entry.reason}`);
      if (entry.suggestion) {
        console.log(`     → Suggest: ${entry.suggestion}`);
      }
    }
  }

  console.log('─'.repeat(50));
  console.log(`Stability score: ${summary.score}% (${summary.stable}/${summary.total} stable)`);
  console.log(`  ✅ Stable: ${summary.stable}  ⚠️  Caution: ${summary.caution}  ❌ Warning: ${summary.warning}`);
  console.log();
}

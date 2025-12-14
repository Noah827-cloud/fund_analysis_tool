import fs from 'node:fs/promises';
import path from 'node:path';

const PAGES = ['index.html', 'analysis.html', 'alerts.html', 'chat.html', 'reports.html', 'vue-demo.html'];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeRef(ref) {
  const cleaned = String(ref || '').split(/[?#]/)[0];
  return cleaned.replace(/^\.?\//, '');
}

async function main() {
  const root = process.cwd();
  const distDir = path.join(root, 'dist');

  const errors = [];
  if (!(await exists(distDir))) {
    errors.push(`Missing dist directory: ${distDir}`);
  }

  for (const page of PAGES) {
    const pagePath = path.join(distDir, page);
    if (!(await exists(pagePath))) {
      errors.push(`Missing page: dist/${page}`);
      continue;
    }

    const html = await fs.readFile(pagePath, 'utf8');
    const refs = new Set();

    for (const match of html.matchAll(/\b(?:src|href)\s*=\s*"([^"]+)"/g)) {
      const ref = match[1];
      if (!ref || !ref.includes('assets/')) continue;
      refs.add(ref);
    }

    for (const ref of refs) {
      const normalized = normalizeRef(ref);
      const assetPath = path.join(distDir, normalized);
      if (!(await exists(assetPath))) {
        errors.push(`Missing asset referenced by dist/${page}: ${ref}`);
      }
    }
  }

  if (errors.length) {
    console.error('Smoke check failed:\n' + errors.map((e) => `- ${e}`).join('\n'));
    process.exit(1);
  }

  console.log(`Smoke check passed (${PAGES.length} pages).`);
}

await main();


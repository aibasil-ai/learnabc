import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const docsIndexPath = resolve(process.cwd(), 'docs/index.html');
const docsFaviconPath = resolve(process.cwd(), 'docs/favicon.svg');

test('docs/index.html 有設定 favicon link', () => {
  const html = readFileSync(docsIndexPath, 'utf8');

  assert.match(
    html,
    /<link[^>]*rel=["']icon["'][^>]*href=["']\.\/favicon\.svg["'][^>]*>/i
  );
});

test('docs/favicon.svg 有可用的 svg 結構', () => {
  const svg = readFileSync(docsFaviconPath, 'utf8');

  assert.match(svg, /<svg[\s\S]*viewBox=["']0 0 64 64["']/i);
  assert.match(svg, /<title[\s\S]*ABC/i);
});

test('docs/index.html 的開啟應用程式連結指向正式網址', () => {
  const html = readFileSync(docsIndexPath, 'utf8');

  assert.match(
    html,
    /<a[^>]*class=["'][^"']*btn primary[^"']*["'][^>]*href=["']https:\/\/learnabc\.games\.aibasil\.com\/["'][^>]*>開啟應用程式<\/a>/i
  );
});

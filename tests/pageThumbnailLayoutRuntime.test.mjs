import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { webkit } from 'playwright';
import { createServer } from 'vite';

const thumbnailSizes = [
  { name: 'landscape', width: 440, height: 182 },
  { name: 'near-square', width: 440, height: 381 },
  { name: 'portrait', width: 281, height: 440 },
];

test('Page thumbnails stay inside their preview frame in WebKit for every orientation', async (context) => {
  if (!existsSync(webkit.executablePath())) {
    context.skip('Playwright WebKit is not installed');
    return;
  }

  const server = await createServer({
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  let browser;
  try {
    await server.listen();
    const address = server.httpServer?.address();
    assert.ok(address && typeof address === 'object');
    browser = await webkit.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 300 } });
    const origin = `http://127.0.0.1:${address.port}`;

    await page.setContent(`
      <link rel="stylesheet" href="${origin}/src/index.css">
      <style>
        body { margin: 0; padding: 20px; }
        #fixtures { display: flex; gap: 12px; }
        .ideanote-page-organizer__preview {
          box-sizing: border-box;
          width: 194px;
          height: 108px;
          flex: 0 0 auto;
          margin: 0;
          padding: 0;
        }
      </style>
      <div id="fixtures">
        ${thumbnailSizes.map(({ name }) => `
          <button type="button" class="ideanote-page-organizer__preview" data-name="${name}">
            <img alt="">
          </button>
        `).join('')}
      </div>
    `);
    await page.waitForFunction(() => {
      const preview = document.querySelector('.ideanote-page-organizer__preview');
      return preview && getComputedStyle(preview).display === 'grid';
    });

    await page.evaluate((sizes) => {
      for (const { name, width, height } of sizes) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const drawing = canvas.getContext('2d');
        drawing.fillStyle = '#ffffff';
        drawing.fillRect(0, 0, width, height);
        drawing.fillStyle = '#6965db';
        drawing.fillRect(0, 0, width, Math.max(8, Math.floor(height * 0.08)));
        drawing.fillStyle = '#2eb67d';
        drawing.fillRect(0, Math.floor(height * 0.8), width, Math.ceil(height * 0.2));
        document.querySelector(`[data-name="${name}"] img`).src = canvas.toDataURL('image/png');
      }
    }, thumbnailSizes);
    await page.locator('img').evaluateAll((images) => Promise.all(images.map((image) => image.decode())));

    const layouts = await page.locator('.ideanote-page-organizer__preview').evaluateAll((previews) =>
      previews.map((preview) => {
        const image = preview.querySelector('img');
        const frameRect = preview.getBoundingClientRect();
        const imageRect = image.getBoundingClientRect();
        const style = getComputedStyle(preview);
        const borderTop = Number.parseFloat(style.borderTopWidth);
        const borderRight = Number.parseFloat(style.borderRightWidth);
        const borderBottom = Number.parseFloat(style.borderBottomWidth);
        const borderLeft = Number.parseFloat(style.borderLeftWidth);
        return {
          name: preview.dataset.name,
          image: {
            top: imageRect.top,
            right: imageRect.right,
            bottom: imageRect.bottom,
            left: imageRect.left,
          },
          content: {
            top: frameRect.top + borderTop,
            right: frameRect.right - borderRight,
            bottom: frameRect.bottom - borderBottom,
            left: frameRect.left + borderLeft,
          },
        };
      }),
    );

    for (const layout of layouts) {
      const tolerance = 1.5;
      assert.ok(
        Math.abs(layout.image.top - layout.content.top) <= tolerance,
        `${layout.name} thumbnail was displaced ${layout.image.top - layout.content.top}px vertically`,
      );
      assert.ok(
        Math.abs(layout.image.right - layout.content.right) <= tolerance,
        `${layout.name} thumbnail right edge differed by ${layout.image.right - layout.content.right}px`,
      );
      assert.ok(
        Math.abs(layout.image.bottom - layout.content.bottom) <= tolerance,
        `${layout.name} thumbnail bottom edge differed by ${layout.image.bottom - layout.content.bottom}px`,
      );
      assert.ok(
        Math.abs(layout.image.left - layout.content.left) <= tolerance,
        `${layout.name} thumbnail left edge differed by ${layout.image.left - layout.content.left}px`,
      );
    }
  } finally {
    await browser?.close();
    await server.close();
  }
});

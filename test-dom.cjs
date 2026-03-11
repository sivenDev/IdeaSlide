#!/usr/bin/env node

/**
 * DOM Test - Checks rendered HTML from localhost using safe http module
 */

const http = require('http');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Testing DOM rendering...\n');

  // Check main page HTML
  const html = await fetchUrl('http://localhost:1420/');
  console.log('HTML contains #root:', html.includes('id="root"') ? 'YES' : 'NO');
  console.log('HTML contains excalidraw.css:', html.includes('excalidraw.css') ? 'YES' : 'NO');
  console.log('HTML contains main.tsx:', html.includes('main.tsx') ? 'YES' : 'NO');

  // Check compiled App.tsx
  console.log('\n--- Checking compiled App.tsx ---');
  const appTsx = await fetchUrl('http://localhost:1420/src/App.tsx');
  console.log('Has LaunchScreen:', appTsx.includes('LaunchScreen') ? 'YES' : 'NO');
  console.log('Has EditorLayout:', appTsx.includes('EditorLayout') ? 'YES' : 'NO');
  console.log('Has SlideStoreProvider:', appTsx.includes('SlideStoreProvider') ? 'YES' : 'NO');
  console.log('Has showEditor state:', appTsx.includes('showEditor') ? 'YES' : 'NO');

  // Check SlideCanvas
  console.log('\n--- Checking SlideCanvas ---');
  const canvasTsx = await fetchUrl('http://localhost:1420/src/components/SlideCanvas.tsx');
  console.log('Has Excalidraw:', canvasTsx.includes('Excalidraw') ? 'YES' : 'NO');
  console.log('Module length:', canvasTsx.length, 'bytes');

  // Check EditorLayout
  console.log('\n--- Checking EditorLayout ---');
  const editorTsx = await fetchUrl('http://localhost:1420/src/components/EditorLayout.tsx');
  console.log('Has SlideCanvas:', editorTsx.includes('SlideCanvas') ? 'YES' : 'NO');
  console.log('Has Toolbar:', editorTsx.includes('Toolbar') ? 'YES' : 'NO');
  console.log('Module length:', editorTsx.length, 'bytes');

  // Check CSS contains our fixes
  console.log('\n--- Checking CSS ---');
  const css = await fetchUrl('http://localhost:1420/src/index.css');
  console.log('Has Tailwind:', css.includes('tailwindcss') ? 'YES' : 'NO');
  console.log('Has excalidraw canvas fix:', css.includes('excalidraw canvas') ? 'YES' : 'NO');
  console.log('Has root height:', css.includes('#root') ? 'YES' : 'NO');
  console.log('Has h-screen:', css.includes('h-screen') ? 'YES' : 'NO');
  console.log('Has flex-1:', css.includes('flex-1') ? 'YES' : 'NO');

  // Check excalidraw CSS
  console.log('\n--- Checking Excalidraw CSS ---');
  const excalidrawCss = await fetchUrl('http://localhost:1420/excalidraw.css');
  console.log('Excalidraw CSS loaded:', excalidrawCss.length > 1000 ? 'YES (' + excalidrawCss.length + ' bytes)' : 'NO');
  console.log('Has .excalidraw rules:', excalidrawCss.includes('.excalidraw') ? 'YES' : 'NO');

  console.log('\nAll checks complete!');
}

main().catch(console.error);

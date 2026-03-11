#!/usr/bin/env node

/**
 * Visual Test for ideaSlide
 * This script creates a minimal test to verify Excalidraw renders
 */

const fs = require('fs');
const path = require('path');

// Create a minimal test HTML file
const testHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Excalidraw Minimal Test</title>
  <link rel="stylesheet" href="/excalidraw.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    #root { width: 100%; height: 100%; background: #f0f0f0; }
    .test-info {
      position: fixed;
      top: 10px;
      left: 10px;
      background: yellow;
      padding: 10px;
      border: 2px solid red;
      z-index: 9999;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="test-info">
    <h3>Excalidraw Test</h3>
    <p>If you see this yellow box, HTML is loading.</p>
    <p id="status">Loading...</p>
  </div>
  <div id="root"></div>

  <script type="module">
    console.log('Test script loaded');
    document.getElementById('status').textContent = 'Script executed!';

    // Check if Excalidraw CSS is loaded
    const styles = Array.from(document.styleSheets);
    const excalidrawCSS = styles.some(sheet => {
      try {
        return sheet.href && sheet.href.includes('excalidraw');
      } catch (e) {
        return false;
      }
    });

    if (excalidrawCSS) {
      console.log('✅ Excalidraw CSS loaded');
      document.getElementById('status').textContent += ' | CSS loaded ✅';
    } else {
      console.log('❌ Excalidraw CSS NOT loaded');
      document.getElementById('status').textContent += ' | CSS missing ❌';
    }

    // Try to import and render Excalidraw
    import('@excalidraw/excalidraw').then(module => {
      console.log('✅ Excalidraw module loaded', module);
      document.getElementById('status').textContent += ' | Module loaded ✅';

      // Try to render
      const { Excalidraw } = module;
      if (Excalidraw) {
        console.log('✅ Excalidraw component available');
        document.getElementById('status').textContent += ' | Component available ✅';
      }
    }).catch(err => {
      console.error('❌ Failed to load Excalidraw:', err);
      document.getElementById('status').textContent += ' | Module error ❌';
    });
  </script>
</body>
</html>`;

// Write test file
const testPath = path.join(process.cwd(), 'public', 'test-minimal.html');
fs.writeFileSync(testPath, testHTML);

console.log('✅ Created minimal test file at:', testPath);
console.log('📝 Open http://localhost:1420/test-minimal.html in the Tauri app');
console.log('');
console.log('Expected results:');
console.log('  - Yellow box visible with status messages');
console.log('  - Console logs showing module loading');
console.log('  - No errors in browser console');

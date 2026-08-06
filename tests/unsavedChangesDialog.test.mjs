import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Unsaved changes use one accessible three-action Radix decision card', async () => {
  const component = await readSource('src/components/UnsavedChangesDialog.tsx');
  const hook = await readSource('src/hooks/useUnsavedChangesDialog.ts');
  const editor = await readSource('src/components/EditorLayout.tsx');
  const packageJson = JSON.parse(await readSource('package.json'));

  assert.equal(typeof packageJson.dependencies['@radix-ui/react-alert-dialog'], 'string');
  assert.match(component, /@radix-ui\/react-alert-dialog/);
  assert.match(component, /AlertDialogPrimitive\.Portal/);
  assert.match(component, /AlertDialogPrimitive\.Overlay/);
  assert.match(component, /AlertDialogPrimitive\.Content/);
  assert.match(component, /AlertDialogPrimitive\.Title/);
  assert.match(component, /AlertDialogPrimitive\.Description/);
  assert.match(component, /Save changes before (closing|leaving)\?/);
  assert.match(component, /Discard Changes/);
  assert.match(component, /Cancel/);
  assert.ok(component.indexOf('>Save<') < component.indexOf('Discard Changes'));
  assert.ok(component.indexOf('Discard Changes') < component.lastIndexOf('>Cancel<'));
  assert.match(component, /onOpenChange/);
  assert.match(component, /onEscapeKeyDown/);
  const overlay = component.match(/<AlertDialogPrimitive\.Overlay[^>]*\/>/)?.[0] ?? '';
  assert.doesNotMatch(overlay, /onClick=/);

  assert.match(hook, /"save" \| "discard" \| "cancel"/);
  assert.match(hook, /Promise<UnsavedChangesDecision>/);
  assert.match(hook, /pendingResolverRef/);
  assert.match(hook, /return \(\) =>/);
  assert.match(editor, /useUnsavedChangesDialog/);
  assert.match(editor, /requestUnsavedChangesDecision/);
  assert.match(editor, /<UnsavedChangesDialog/);
  assert.doesNotMatch(editor, /cancelLabel: "More Options"/);
  assert.doesNotMatch(editor, /Discard the unsaved changes\?/);
});

test('Unsaved dialog styling creates a responsive decision hierarchy with reduced motion', async () => {
  const styles = await readSource('src/index.css');

  assert.match(styles, /\.ideanote-unsaved-dialog__overlay/);
  assert.match(styles, /backdrop-filter:\s*blur\(/);
  assert.match(styles, /\.ideanote-unsaved-dialog__content/);
  assert.match(styles, /width:\s*min\(calc\(100vw - 2rem\), 16\.25rem\)/);
  assert.match(styles, /height:\s*min\(calc\(100vh - 2rem\), 12\.5rem\)/);
  assert.match(styles, /box-sizing:\s*border-box/);
  assert.match(styles, /border-radius:\s*1\.125rem/);
  assert.match(styles, /padding:\s*0\.875rem/);
  assert.match(styles, /\.ideanote-unsaved-dialog__action\s*\{[\s\S]*?height:\s*2\.125rem/);
  assert.match(styles, /\.ideanote-unsaved-dialog__action\.is-save/);
  assert.match(styles, /#0a7cff/i);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?ideanote-unsaved-dialog/);
});

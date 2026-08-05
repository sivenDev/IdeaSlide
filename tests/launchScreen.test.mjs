import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Home offers the approved IdeaNote entry points without an Agent placeholder', async () => {
  const source = await readFile(new URL('../src/components/LaunchScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, />IdeaNote</);
  assert.match(source, />New File</);
  assert.match(source, />Open Workspace</);
  assert.match(source, />Open File</);
  assert.doesNotMatch(source, /AI-Powered/);
  assert.doesNotMatch(source, /Agent Panel/);
});

test('Home uses framework icons for Workspace and file open actions', async () => {
  const source = await readFile(new URL('../src/components/LaunchScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{[^}]*FileInput[^}]*FolderOpen[^}]*\} from "lucide-react"/s);
  assert.match(source, /const launchActionIconProps = \{[\s\S]*"aria-hidden": true/);
  assert.match(source, /<FolderOpen \{\.\.\.launchActionIconProps\}/);
  assert.match(source, /<FileInput \{\.\.\.launchActionIconProps\}/);
  assert.doesNotMatch(source, /▱|◇/);
});

test('Home presents and wires separate recent Workspace and file histories', async () => {
  const launchSource = await readFile(new URL('../src/components/LaunchScreen.tsx', import.meta.url), 'utf8');
  const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const commandSource = await readFile(new URL('../src/lib/tauriCommands.ts', import.meta.url), 'utf8');

  assert.match(launchSource, />Recent Workspaces</);
  assert.match(launchSource, />Recent Files</);
  assert.match(launchSource, /Tabs, TabsContent, TabsList, TabsTrigger/);
  assert.match(launchSource, /<TabsTrigger[\s\S]*value="workspaces"/);
  assert.match(launchSource, /<TabsTrigger[\s\S]*value="files"/);
  assert.match(launchSource, /useState<RecentTab>\("files"\)/);
  assert.ok(launchSource.indexOf('value="files"') < launchSource.indexOf('value="workspaces"'));
  assert.doesNotMatch(launchSource, /grid-rows-2/);
  assert.doesNotMatch(launchSource, /Standalone IdeaSketch documents|Local folders opened as IdeaNote Workspaces/);
  assert.match(launchSource, /getRecentWorkspaces/);
  assert.match(launchSource, /removeRecentWorkspace/);
  assert.match(launchSource, /onOpenRecentWorkspace\(workspace\.path\)/);
  assert.match(launchSource, /onOpenRecentFile\(file\.path\)/);

  assert.match(appSource, /handleOpenWorkspace = useCallback\(async \(root\?: string\)/);
  assert.match(appSource, /openWorkspace\(root\)/);
  assert.match(appSource, /onOpenRecentWorkspace=\{handleOpenWorkspace\}/);
  assert.match(appSource, /onOpenRecentFile=\{openStandalonePath\}/);

  assert.match(commandSource, /invoke<RecentWorkspace\[]>\("get_recent_workspaces"\)/);
  assert.match(commandSource, /invoke\("remove_recent_workspace", \{ path \}\)/);
});

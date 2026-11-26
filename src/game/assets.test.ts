import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  ATLAS_PATHS,
  EVENT_PROTAGONIST_ATLAS_PATH,
  STANDALONE_SPRITE_PATHS,
} from './assetPaths';

const publicFile = (path: string) => new URL(`../../public/${path}`, import.meta.url);

test('every configured image path exists under public/', () => {
  const paths = [
    ...Object.values(ATLAS_PATHS),
    EVENT_PROTAGONIST_ATLAS_PATH,
    ...Object.values(STANDALONE_SPRITE_PATHS),
  ].filter((path): path is string => path !== null);
  for (const path of paths) assert.ok(existsSync(publicFile(path)), `missing asset: ${path}`);
});

test('the props atlas has no opaque full-canvas background', () => {
  const svg = readFileSync(publicFile(ATLAS_PATHS.fieldProps), 'utf8');
  assert.doesNotMatch(svg, /C1\.000000,342\.333344/);
});

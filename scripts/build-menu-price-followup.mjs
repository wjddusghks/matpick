import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPriceFollowupPatch } from './menu-research/price-followup.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = JSON.parse(await fs.readFile(path.join(root, 'source-data/menu-price-followup-2026-09-21/price-evidence-70.json'), 'utf8'));
if (input.restaurants.length !== 70 || new Set(input.restaurants.map(r => r.id)).size !== 70) throw new Error('Expected 70 unique evidence records');
const patches = Object.fromEntries(input.restaurants.map(r => [r.id, buildPriceFollowupPatch(r)]));
await fs.writeFile(path.join(root, 'matpick_all/client/src/data/generated/menu-price-followup.generated.json'), JSON.stringify(patches, null, 2) + '\n');
console.log(JSON.stringify({ evidence: 70, menuSnapshots: Object.values(patches).filter(p => p.menus).length, reviewNotesOnly: Object.values(patches).filter(p => !p.menus).length, menuItems: Object.values(patches).reduce((n,p) => n+(p.menus?.length||0),0) }));

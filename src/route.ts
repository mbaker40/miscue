// Route pre-generation (dossier D5): the whole run's offered options exist at run start,
// generated once from the seed in its own RNG stream — independent of what the player picks.
import { Rng } from './rng';

export const ROUTE_TAG   = 0x057000de;
export const RACK_TAG    = 0x5ac00001;
export const DRAFT_TAG   = 0xd7af0002;
export const SHOP_TAG    = 0x540f0003;
export const MYSTERY_TAG = 0xe7e20004;
export const FORGE_TAG   = 0xf0f60005;
export const AI_TAG      = 0xa11a0007;

export type NodeKind = 'rack' | 'shop' | 'forge' | 'money' | 'rest' | 'mystery' | 'miniboss' | 'boss';
export interface NodeOption { kind: NodeKind; title: string; desc: string; cls?: string }
export interface RouteSlot { depth: number; act: 1 | 2 | 3; options: NodeOption[] }
export type Route = RouteSlot[];              // length 12, index = depth - 1

export function actOf(depth: number): 1 | 2 | 3 {
  return depth <= 4 ? 1 : depth <= 8 ? 2 : 3;
}

const RACK_OPTION: NodeOption = { kind: 'rack', title: 'Rack', desc: 'A fresh table of trouble. Clear it, get paid, re-forge.' };

const SIDE_OPTIONS: Record<'shop' | 'rest' | 'money' | 'forge' | 'mystery', NodeOption> = {
  shop:    { kind: 'shop',    title: 'Re-chalk',     desc: 'Spend chalk: repairs, Stroke, back-room upgrades.' },
  rest:    { kind: 'rest',    title: 'Rest',         desc: 'Polish out a crack and steady your Stroke.' },
  money:   { kind: 'money',   title: 'Money table',  desc: 'Ante up. Elite-heavy rack, double chalk, a wider re-forge.', cls: 'gold' },
  forge:   { kind: 'forge',   title: 'The Forge',    desc: 'Crack yourself on purpose. Power has a price.', cls: 'pink' },
  mystery: { kind: 'mystery', title: '???',          desc: 'Something hums behind a curtain of smoke.', cls: 'gold' },
};

const SIDE_BAG: (keyof typeof SIDE_OPTIONS)[] = ['shop', 'rest', 'money', 'forge', 'mystery'];

export function generateRoute(seed: number): Route {
  const rng = new Rng((seed ^ ROUTE_TAG) >>> 0);
  const route: Route = [];

  for (let i = 0; i < 12; i++) {
    const depth = i + 1;
    const act = actOf(depth);

    if (depth === 1) {
      route.push({ depth, act, options: [
        { kind: 'rack', title: 'First rack', desc: 'The underhall opens. Clear it, get paid, re-forge.' },
      ] });
      continue;
    }
    if (depth === 4) {
      route.push({ depth, act, options: [
        { kind: 'miniboss', title: 'The Rack-Master', desc: 'Act I ends here. It wants to see your build.', cls: 'pink' },
      ] });
      continue;
    }
    if (depth === 12) {
      route.push({ depth, act, options: [
        { kind: 'boss', title: 'The bottom of the run', desc: 'Something black is waiting at the last table.', cls: 'pink' },
      ] });
      continue;
    }

    const sideCount = rng.next() < 0.55 ? 2 : 1;
    const options: NodeOption[] = [RACK_OPTION];
    let bag = [...SIDE_BAG];

    if (depth === 3 || depth === 7 || depth === 11) {
      options.push(SIDE_OPTIONS.shop);
      bag = bag.filter(k => k !== 'shop');
    }

    while (options.length < sideCount + 1 && bag.length > 0) {
      const pick = rng.pick(bag);
      options.push(SIDE_OPTIONS[pick]);
      bag = bag.filter(k => k !== pick);
    }

    route.push({ depth, act, options });
  }

  return route;
}

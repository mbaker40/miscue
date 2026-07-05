// DOM HUD. Words are design material: name what the player controls.
import { Upgrade } from './upgrades';
import type { NodeOption, NodeKind, RouteSlot } from './route';

const $ = (id: string) => document.getElementById(id)!;

export class Hud {
  private bannerTimer: number | null = null;

  showHud(on: boolean) { $('hud').classList.toggle('on', on); }

  setDepth(d: number, max: number) { $('depth').parentElement!.innerHTML = `TABLE <b id="depth">${d}</b>/${max}`; }
  setWave(w: number, total: number) { $('wave').parentElement!.innerHTML = `WAVE <b id="wave">${w}</b>/${total}`; }
  setChalk(c: number) { $('chalk').textContent = `◆ ${c}`; }
  setStroke(v: number, max: number) { ($('strokefill') as HTMLElement).style.width = `${(100 * v) / max}%`; }

  setCracks(taken: number, max: number) {
    const el = $('cracks');
    el.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const pip = document.createElement('div');
      pip.className = 'pip' + (i < taken ? ' lost' : '');
      el.appendChild(pip);
    }
  }

  banner(text: string, bad = false, ms = 1400) {
    const b = $('banner');
    b.textContent = text;
    b.classList.toggle('bad', bad);
    b.classList.add('show');
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => b.classList.remove('show'), ms);
  }

  private panel(html: string) {
    $('panel').innerHTML = html;
    $('overlay').classList.add('on');
  }
  hidePanel() { $('overlay').classList.remove('on'); }

  private wire(handlers: Record<string, () => void>) {
    for (const [id, fn] of Object.entries(handlers)) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn, { once: true });
    }
  }

  menu(onNew: () => void, onDaily: () => void, dailyLabel: string) {
    this.panel(`
      <h1>MISCUE</h1>
      <div class="sub">You're the cue ball. Everything else is a target.<br>
      Drag back to aim · release to fire · spin pad bends your path.<br>
      Sink them all. Don't fall in. Don't shatter.</div>
      <button class="btn center" id="b-new"><b>New run</b></button>
      <button class="btn center gold" id="b-daily"><b>Daily table · ${dailyLabel}</b></button>
      <div class="tiny">A 3D pool roguelike · web prototype</div>
    `);
    this.wire({
      'b-new': () => { this.hidePanel(); onNew(); },
      'b-daily': () => { this.hidePanel(); onDaily(); },
    });
  }

  nodeChoice(depth: number, options: NodeOption[], fan: RouteSlot[], pick: (k: NodeKind) => void) {
    const btns = options.map((o, i) =>
      `<button class="btn ${o.cls ?? ''}" id="node-${i}"><b>${o.title}</b><small>${o.desc}</small></button>`).join('');
    const strip = fan.length > 0
      ? `<div class="tiny">coming up · ${fan.map(s => `T${s.depth}: ${s.options.map(o => o.title).join(' / ')}`).join(' · ')}</div>`
      : '';
    this.panel(`<h2>Table ${depth}</h2><div class="sub">Choose your table.</div>${btns}${strip}`);
    const h: Record<string, () => void> = {};
    options.forEach((o, i) => { h[`node-${i}`] = () => { this.hidePanel(); pick(o.kind); }; });
    this.wire(h);
  }

  forge(options: { label: string; desc: string }[], onPick: (i: number | null) => void) {
    const sub = options.length > 0
      ? 'Press your soul against the wheel. One crack, one gift.'
      : 'The wheel turns you away. One more crack would be your last.';
    const btns = options.map((o, i) =>
      `<button class="btn pink" id="fg-${i}"><b>${o.label} · +1 crack</b><small>${o.desc}</small></button>`).join('');
    this.panel(`<h2>The Forge</h2><div class="sub">${sub}</div>${btns}<button class="btn center" id="fg-walk"><b>Walk away</b></button>`);
    const h: Record<string, () => void> = {};
    options.forEach((o, i) => { h[`fg-${i}`] = () => { this.hidePanel(); onPick(i); }; });
    h['fg-walk'] = () => { this.hidePanel(); onPick(null); };
    this.wire(h);
  }

  mystery(ev: { title: string; desc: string }, onDone: () => void) {
    this.panel(`<h2>${ev.title}</h2><div class="sub">${ev.desc}</div>
      <button class="btn center gold" id="my-go"><b>Move on</b></button>`);
    this.wire({ 'my-go': () => { this.hidePanel(); onDone(); } });
  }

  wager(chalk: number, canCrack: boolean, actions: { ante: () => void; anteCrack: () => void; decline: () => void }) {
    const canAnte = chalk >= 5;
    const crackBtn = !canAnte
      ? `<button class="btn pink" id="w-crack" ${canCrack ? '' : 'disabled'}><b>Ante a crack</b><small>Broke players pay in bone. +1 crack, buy in anyway.</small></button>`
      : '';
    this.panel(`
      <h2>Money table</h2>
      <div class="sub">Double chalk and a wider re-forge — if you can cover the ante.<br>You hold <b style="color:var(--gold)">◆ ${chalk}</b>.</div>
      <button class="btn gold" id="w-ante" ${canAnte ? '' : 'disabled'}><b>Ante ◆ 5</b><small>Buy in. Elite-heavy rack, double payout.</small></button>
      ${crackBtn}
      <button class="btn center" id="w-decline"><b>Walk on</b><small>Take a plain rack instead.</small></button>
    `);
    const h: Record<string, () => void> = {};
    if (canAnte) h['w-ante'] = () => { this.hidePanel(); actions.ante(); };
    if (!canAnte && canCrack) h['w-crack'] = () => { this.hidePanel(); actions.anteCrack(); };
    h['w-decline'] = () => { this.hidePanel(); actions.decline(); };
    this.wire(h);
  }

  draft(upgrades: Upgrade[], pick: (u: Upgrade | null) => void) {
    const btns = upgrades.map((u, i) =>
      `<button class="btn" id="up-${i}"><b>${u.name}</b><small>${u.desc}</small></button>`).join('');
    this.panel(`<h2>Re-forge</h2><div class="sub">The felt hums. Take one change into the next table.</div>
      ${btns}<button class="btn center" id="up-skip"><b>Skip · +5 chalk</b></button>`);
    const h: Record<string, () => void> = {};
    upgrades.forEach((u, i) => { h[`up-${i}`] = () => { this.hidePanel(); pick(u); }; });
    h['up-skip'] = () => { this.hidePanel(); pick(null); };
    this.wire(h);
  }

  shop(chalk: number, cracks: number, actions: { repair: () => boolean; stroke: () => boolean; upgrade: () => boolean; leave: () => void }) {
    const render = () => {
      this.panel(`
        <h2>Re-chalk</h2><div class="sub">You hold <b style="color:var(--gold)">◆ ${chalkNow()}</b>. Spend it or bank it.</div>
        <button class="btn" id="s-repair" ${cracksNow() <= 0 ? 'disabled' : ''}><b>Polish a crack · ◆ 8</b><small>Repair one crack.</small></button>
        <button class="btn" id="s-stroke"><b>Chalk up · ◆ 5</b><small>Refill your Stroke meter.</small></button>
        <button class="btn" id="s-up"><b>Back-room deal · ◆ 14</b><small>A random upgrade, no questions asked.</small></button>
        <button class="btn center pink" id="s-leave"><b>Walk on</b></button>
      `);
      this.wire({
        's-repair': () => { if (actions.repair()) {} render(); },
        's-stroke': () => { if (actions.stroke()) {} render(); },
        's-up': () => { if (actions.upgrade()) {} render(); },
        's-leave': () => { this.hidePanel(); actions.leave(); },
      });
    };
    // live values captured through closures set by game
    let chalkNow = () => chalk, cracksNow = () => cracks;
    this.shopRefresh = (c: number, k: number) => { chalkNow = () => c; cracksNow = () => k; render(); };
    render();
  }
  shopRefresh: (chalk: number, cracks: number) => void = () => {};

  rest(onDone: () => void) {
    this.panel(`<h2>Rest</h2>
      <div class="sub">You settle into the felt. A crack polishes out.<br>Your Stroke steadies.</div>
      <button class="btn center" id="r-go"><b>Back to the tables</b></button>`);
    this.wire({ 'r-go': () => { this.hidePanel(); onDone(); } });
  }

  gameOver(reason: 'scratch' | 'shatter', depth: number, onRetry: () => void, seedLabel: string) {
    const title = reason === 'scratch' ? 'SCRATCHED' : 'SHATTERED';
    const sub = reason === 'scratch'
      ? 'The pocket takes you. Down there is worse than here.'
      : 'One crack too many. The table sweeps the pieces.';
    this.panel(`<h2 class="bad">${title}</h2>
      <div class="sub">${sub}<br>You made it to table <b>${depth}</b>.</div>
      <button class="btn center" id="g-retry"><b>Re-rack</b></button>
      <div class="tiny">${seedLabel}</div>`);
    this.wire({ 'g-retry': () => { this.hidePanel(); onRetry(); } });
  }

  victory(onAgain: () => void, seedLabel: string) {
    this.panel(`<h2>THE 8-BALL DROPS</h2>
      <div class="sub">The underhall goes quiet. Somewhere above, a door you don't remember opens.<br><br>
      Whether that's the way out — or the throne — is next run's problem.</div>
      <button class="btn center gold" id="v-again"><b>Rack it again</b></button>
      <div class="tiny">${seedLabel}</div>`);
    this.wire({ 'v-again': () => { this.hidePanel(); onAgain(); } });
  }
}

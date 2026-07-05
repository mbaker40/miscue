// DOM HUD, combat slice only (dossier: words are design material). Ported from v1
// /src/hud.ts — panels (menu/draft/shop/forge/mystery/wager/rest/gameOver/victory) are
// M2's job; this class only drives the combat-readout IDs already in v2/index.html.
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
}

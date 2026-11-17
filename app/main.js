// Router + rendering for the make.fun client. Hash routes (each surface has a URL):
//
//   #/                              the bounty board
//   #/bounty/<slug>                one bounty: summary, rules, rewards, leaderboard preview
//   #/bounty/<slug>/leaderboard    that bounty's full leaderboard
//   #/u/<handle>                   an account's public profile
//
// window.__shotReady is false while a route loads and true once its data is on
// screen, so a screenshot script knows when to capture. Time-left labels tick
// every 30 s by updating only their own text nodes — the page is never rebuilt.
// Rebuilt in sealed recording (attempt 3).
import { getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { board, bounty, leaderboardPage, leaderboardRows, profile } from './views.js';
import { timeLeft } from './format.js';

const app = document.getElementById('app');
const boardState = { q: '', sort: 'pot', openOnly: false, page: 1 };
let boardData = null, ticker = null;

function tick() {
  for (const el of document.querySelectorAll('[data-deadline]')) el.textContent = timeLeft(el.dataset.deadline);
}

function startTicker() {
  if (!ticker) ticker = setInterval(tick, 30_000);
}

function fail(err) {
  return `<h1>Could not load this page</h1><p>${err.message}</p><p><a href="#/">Back to the board</a> · <a href="${location.hash || '#/'}">Try again</a></p>`;
}

function done(title) {
  document.title = `${title} | make.fun client`;
  window.scrollTo(0, 0);
  const h1 = app.querySelector('h1');
  if (h1) h1.setAttribute('tabindex', '-1');
  startTicker();
  window.__shotReady = true;
}

/** Re-render the board list in place from cached data (no refetch, no scroll jump). */
function rerenderBoard() {
  const grid = document.getElementById('board-grid');
  if (!grid || !boardData) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = board(boardData, boardState);
  const newGrid = tmp.querySelector('#board-grid');
  const newPager = tmp.querySelector('.pager');
  const oldPager = document.querySelector('.pager');
  grid.replaceWith(newGrid);
  if (oldPager && newPager) oldPager.replaceWith(newPager);
  else if (oldPager) oldPager.remove();
  else if (newPager) newGrid.after(newPager);
  wireBoard();
}

function wireBoard() {
  const q = document.getElementById('board-q');
  const sort = document.getElementById('board-sort');
  const open = document.getElementById('board-open');
  // Form controls survive a list re-render, so bind them only once; the pager
  // buttons are rebuilt each time, so they are bound on every render.
  const once = (el, type, fn) => { if (el && !el.dataset.wired) { el.dataset.wired = type; el.addEventListener(type, fn); } };
  once(q, 'input', () => { boardState.q = q.value; boardState.page = 1; rerenderBoard(); });
  once(sort, 'change', () => { boardState.sort = sort.value; boardState.page = 1; rerenderBoard(); });
  once(open, 'change', () => { boardState.openOnly = open.checked; boardState.page = 1; rerenderBoard(); });
  for (const btn of document.querySelectorAll('.pager button')) {
    btn.addEventListener('click', () => {
      boardState.page = Number(btn.dataset.page);
      rerenderBoard();
      document.getElementById('board-grid')?.scrollIntoView();
    });
  }
}

/** Reveal the next 50 leaderboard rows from the list already fetched — no refetch. */
function wireLeaderboard(lb) {
  const btn = document.getElementById('lb-more');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const shown = Number(btn.dataset.shown);
    const total = Number(btn.dataset.total);
    const next = Math.min(shown + 50, total);
    document.getElementById('lb-body')?.insertAdjacentHTML('beforeend', leaderboardRows(lb, shown, next));
    btn.dataset.shown = String(next);
    const label = document.getElementById('lb-shown');
    if (label) label.textContent = String(next);
    btn.hidden = next >= total;
  });
}

async function render() {
  window.__shotReady = false;
  app.innerHTML = '<p class="loading">Loading live data from make.fun…</p>';
  const hash = location.hash || '#/';
  try {
    let m;
    if ((m = hash.match(/^#\/bounty\/([^/]+)\/leaderboard$/))) {
      const slug = decodeURIComponent(m[1]);
      const [b, lb] = await Promise.all([getBounty(slug), getLeaderboard(slug)]);
      app.innerHTML = leaderboardPage(b, lb);
      wireLeaderboard(lb);
      done(`Leaderboard — ${b.title}`);
    } else if ((m = hash.match(/^#\/bounty\/([^/]+)$/))) {
      const slug = decodeURIComponent(m[1]);
      const b = await getBounty(slug);
      let lb = null;
      try { lb = await getLeaderboard(slug); } catch { lb = null; }
      app.innerHTML = bounty(b, lb);
      done(b.title);
    } else if ((m = hash.match(/^#\/u\/([^/]+)$/))) {
      const p = await getProfile(decodeURIComponent(m[1]));
      app.innerHTML = profile(p);
      done(`@${p.handle}`);
    } else {
      boardData = await getBounties();
      app.innerHTML = board(boardData, boardState);
      wireBoard();
      done('Live bounties');
    }
  } catch (err) {
    app.innerHTML = fail(err);
    document.title = 'Error | make.fun client';
    window.__shotReady = true;
  }
}

window.addEventListener('hashchange', render);
render();

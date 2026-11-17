// The four views, each a function from live API data to HTML. Every link is also
// a route (see main.js), so each surface opens by URL as well as by clicking.
import { date, esc, md, money, num, shortAddr, takesEntries, timeLeft } from './format.js';

/** The reward as it stands now: the prize plus any entry fees paid into it. */
export const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** Open / closed badge, judged by deadline, not by status alone. */
export function badge(b) {
  return takesEntries(b)
    ? '<span class="badge open">Taking entries</span>'
    : '<span class="badge closed">Closed — deadline passed</span>';
}

/** An API avatar/share image: crossorigin set before src (CORP: same-origin). */
export function avatarImg(path, alt, cls) {
  if (!path) return `<span class="${cls} avatar-fallback" aria-hidden="true">${esc((alt || '?')[0].toUpperCase())}</span>`;
  const src = path.startsWith('http') ? path : `https://make.fun${path}`;
  return `<img class="${cls}" crossorigin="anonymous" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`;
}

/** One bounty card on the board: pot, fee, time left and entries up front. */
export function bountyCard(b) {
  return `<article class="card">
    <h3><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h3>
    <p class="cat">${esc(b.category || '')}${b.sponsor?.isVerified ? ' · ✓ verified sponsor' : ''}</p>
    <p class="pot">${pot(b)} <span class="pot-label">live pot</span></p>
    <dl class="facts">
      <div><dt>Entry fee</dt><dd>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</dd></div>
      <div><dt>Time left</dt><dd><span data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span></dd></div>
      <div><dt>Entries</dt><dd>${num(b.submissionCount)}</dd></div>
    </dl>
    <p class="card-foot">${badge(b)} <a class="more" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard →</a></p>
  </article>`;
}

/** Board: sortable, searchable, paginated cards; totals across all open bounties. */
export function board(data, state) {
  const items = data.items ?? [];
  const q = state.q.toLowerCase();
  const open = items.filter(takesEntries);
  const shown = items.filter((b) => (!state.openOnly || takesEntries(b)) && (!q || `${b.title} ${b.category || ''}`.toLowerCase().includes(q)));
  const sorted = [...shown].sort((a, b) =>
    state.sort === 'deadline' ? new Date(a.deadline) - new Date(b.deadline)
    : state.sort === 'entries' ? (b.submissionCount ?? 0) - (a.submissionCount ?? 0)
    : Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0));
  const per = 8, pages = Math.max(1, Math.ceil(sorted.length / per));
  const page = Math.min(state.page, pages);
  const slice = sorted.slice((page - 1) * per, page * per);
  const totalPot = items.reduce((s, b) => s + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  return `<h1>Live bounties</h1>
  <p class="lede">${num(items.length)} bounties · ${num(open.length)} taking entries · <strong>${money(totalPot)}</strong> in live pots · ${num(items.reduce((s, b) => s + (b.submissionCount ?? 0), 0))} entries</p>
  <form class="controls" id="board-controls" action="#/" onsubmit="return false">
    <label>Search <input type="search" id="board-q" value="${esc(state.q)}" placeholder="Search bounties…" aria-label="Search bounties"></label>
    <label>Sort <select id="board-sort" aria-label="Sort bounties">
      <option value="pot"${state.sort === 'pot' ? ' selected' : ''}>Biggest pot</option>
      <option value="deadline"${state.sort === 'deadline' ? ' selected' : ''}>Ending soonest</option>
      <option value="entries"${state.sort === 'entries' ? ' selected' : ''}>Most entries</option>
    </select></label>
    <label class="check"><input type="checkbox" id="board-open"${state.openOnly ? ' checked' : ''}> Taking entries only</label>
  </form>
  <div class="grid" id="board-grid">${slice.map(bountyCard).join('') || '<p>No bounties match.</p>'}</div>
  ${pages > 1 ? `<nav class="pager" aria-label="Board pages">${Array.from({ length: pages }, (_, i) =>
    `<button type="button" data-page="${i + 1}"${i + 1 === page ? ' aria-current="page" class="on"' : ''}>${i + 1}</button>`).join('')}</nav>` : ''}`;
}

/** Rewards table: the live pot split over places (rewardsNow), else the base table. */
export function rewardsTable(b) {
  const rows = (b.rewardsNow?.length ? b.rewardsNow : Object.entries(b.rewards ?? {}).map(([place, amountUsd]) => ({ place: Number(place), amountUsd })))
    .map((r) => `<tr><td>${r.place === 1 ? '🥇' : r.place === 2 ? '🥈' : r.place === 3 ? '🥉' : ''} ${r.place}${r.place === 1 ? 'st' : r.place === 2 ? 'nd' : r.place === 3 ? 'rd' : 'th'}</td><td class="r">${money(r.amountUsd)}</td></tr>`)
    .join('');
  return rows ? `<table class="rewards"><caption>Rewards — live pot ${pot(b)}</caption><thead><tr><th scope="col">Place</th><th scope="col" class="r">Prize</th></tr></thead><tbody>${rows}</tbody></table>` : '';
}

/** Leaderboard rows for entries [from, to), using the API's own columns. */
export function leaderboardRows(lb, from = 0, to = Infinity) {
  const cols = (lb.columns ?? []).filter((c) => !c.hidden);
  return (lb.entries ?? []).slice(from, to).map((e) => {
    const cells = cols.map((c) => `<td class="r">${esc(e.display?.[c.key] ?? e.values?.[c.key] ?? '—')}</td>`).join('');
    return `<tr><td class="rank">#${num(e.rank)}</td>
      <td><span class="who">${avatarImg(e.image, e.handle, 'ava-sm')}<a href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a></span>${e.title ? `<br><span class="entry-title">${esc(e.title)}</span>` : ''}</td>${cells}</tr>`;
  }).join('');
}

/** The leaderboard table, first `shown` rows; more append client-side (see main.js). */
export function leaderboardTable(lb, shown = 50) {
  const cols = (lb.columns ?? []).filter((c) => !c.hidden);
  return `<div class="scroll"><table class="lb">
    <thead><tr><th scope="col">Rank</th><th scope="col">Entry</th>${cols.map((c) => `<th scope="col" class="r">${esc(c.title)}</th>`).join('')}</tr></thead>
    <tbody id="lb-body">${leaderboardRows(lb, 0, shown)}</tbody></table></div>`;
}

/** A bounty's page: summary, facts, rewards table, leaderboard preview, rules. */
export function bounty(b, lb) {
  return `<p class="crumb"><a href="#/">← All bounties</a></p>
  <h1>${esc(b.title)}</h1>
  <p class="lede">${esc(b.summary || '')}</p>
  <p>${badge(b)} <span class="status">Status: ${esc(b.status || '—')}</span></p>
  <dl class="stats">
    <div><dt>Live pot</dt><dd class="big">${pot(b)}</dd></div>
    <div><dt>Entry fee</dt><dd class="big">${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</dd></div>
    <div><dt>Time left</dt><dd class="big"><span data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span></dd></div>
    <div><dt>Entries</dt><dd class="big">${num(b.submissionCount)}</dd></div>
  </dl>
  <dl class="dates">
    <div><dt>Opens</dt><dd>${date(b.publishedAt || b.opensAt)}</dd></div>
    <div><dt>Deadline</dt><dd>${date(b.deadline)}</dd></div>
    <div><dt>Category</dt><dd>${esc(b.category || '—')}</dd></div>
    <div><dt>Skills</dt><dd>${(b.skills ?? []).map(esc).join(', ') || '—'}</dd></div>
  </dl>
  <div class="cols">
    <section class="desc" aria-label="Description and rules"><h2>Description &amp; rules</h2>${md(b.description)}</section>
    <aside aria-label="Rewards and leaderboard">
      ${rewardsTable(b)}
      <h2>Leaderboard — top ${Math.min(8, lb?.entries?.length ?? 0)}</h2>
      ${lb?.entries?.length ? leaderboardTable({ ...lb, entries: lb.entries.slice(0, 8) }) : '<p>No ranked entries yet.</p>'}
      <p><a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Full leaderboard →</a></p>
    </aside>
  </div>`;
}

/** A bounty's full leaderboard page: 50 rows at first, more on click, no refetch. */
export function leaderboardPage(b, lb) {
  const total = lb.entries?.length ?? 0;
  return `<p class="crumb"><a href="#/bounty/${encodeURIComponent(b.slug)}">← ${esc(b.title)}</a> · <a href="#/">All bounties</a></p>
  <h1>Leaderboard — ${esc(b.title)}</h1>
  <p class="lede">Live pot <strong>${pot(b)}</strong> · ${b.entryFeeUsd ? `${money(b.entryFeeUsd)} entry fee · ` : ''}<span data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span> · ${num(b.submissionCount)} entries · ${esc(lb.title || lb.view || '')} · showing <span id="lb-shown">${Math.min(50, total)}</span> of ${num(total)}</p>
  ${total ? leaderboardTable(lb, 50) : '<p>No ranked entries yet — check back once entries are scored.</p>'}
  <p><button type="button" id="lb-more" data-shown="50" data-total="${total}"${total > 50 ? '' : ' hidden'}>Show more entries</button></p>`;
}

/** An account's public profile: identity, record, entries, wallet. */
export function profile(p) {
  const r = p.record ?? {};
  const sols = p.solutions ?? [];
  return `<p class="crumb"><a href="#/">← All bounties</a></p>
  <section class="who-card">
    ${avatarImg(p.avatar?.url || p.image, p.display_name || p.handle, 'ava-lg')}
    <div><h1>${esc(p.display_name || p.handle)}</h1>
    <p class="handle">@${esc(p.handle)}${p.house ? ' · house' : ''}</p>
    ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
    <p class="meta">Joined ${date(p.joined_at)} · <a href="${esc(p.profile_url || '#')}">make.fun profile ↗</a></p></div>
  </section>
  <dl class="stats">
    <div><dt>Entered</dt><dd class="big">${num(r.competitions_entered)}</dd></div>
    <div><dt>Placed</dt><dd class="big">${num(r.competitions_placed)}</dd></div>
    <div><dt>Won</dt><dd class="big">${num(r.competitions_won)}</dd></div>
    <div><dt>Best place</dt><dd class="big">${r.best_placement ? `#${num(r.best_placement)}` : '—'}</dd></div>
    <div><dt>Prize money</dt><dd class="big">${money(r.prize_usd)}</dd></div>
  </dl>
  ${p.wallet?.address ? `<p>Wallet <code>${esc(shortAddr(p.wallet.address))}</code> <a href="${esc(p.wallet.explorer_url)}">Solscan ↗</a></p>` : ''}
  <h2>Entries (${num(sols.length)})</h2>
  ${sols.length ? `<ul class="sols">${sols.map((s) => `<li>
      <a href="#/bounty/${encodeURIComponent(s.competition.slug)}">${esc(s.competition.title)}</a>
      <span class="entry-title">${esc(s.title || '')}</span>
      <span>${s.placement ? `Placed #${num(s.placement)}` : 'Awaiting result'}${s.prize_usd ? ` · won ${money(s.prize_usd)}` : ''}</span>
      <span>${date(s.entered_at)}</span></li>`).join('')}</ul>`
    : '<p>No public entries yet.</p>'}`;
}

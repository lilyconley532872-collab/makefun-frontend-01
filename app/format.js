// Small helpers for showing API values. Every value the API returns is escaped
// before it reaches HTML; markdown in descriptions is rendered by md() below.

// Rebuilt in sealed recording (attempt 3).
/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('1000.00', 0.5, null) as '$1,000', '$0.50', or '—'. */
export function money(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });
}

/** A count as '13,066'. */
export function num(value) {
  return Number(value ?? 0).toLocaleString('en-US');
}

/** A deadline as a date in UTC. */
export function date(iso) {
  if (!iso) return '—';
  return `${new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** Whether a bounty still takes entries: judged by its deadline, never by its status alone. */
export function takesEntries(b) {
  return !!b?.deadline && new Date(b.deadline).getTime() > Date.now();
}

/** The time until a deadline: '6d 4h left', '35m left', '12s left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return `${s}s left`;
}

/** A wallet address shortened for display. */
export function shortAddr(addr) {
  return addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : '—';
}

/** Minimal markdown for bounty descriptions: headings, bullets, bold, paragraphs. */
export function md(text) {
  const lines = String(text ?? '').split('\n');
  let out = '', list = false;
  const closeList = () => { if (list) { out += '</ul>'; list = false; } };
  const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line)) {
      closeList();
      out += `<h3>${inline(line.replace(/^#{1,3}\s+/, ''))}</h3>`;
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (!list) { out += '<ul>'; list = true; }
      out += `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`;
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return out;
}

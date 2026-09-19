// The "Saved tents" column: renders history entries as cards (thumbnail,
// name, style, when) and reports clicks. The host owns the list itself.
import { describeEntry, configKey } from './tent-history.js';

const THUMB_W = 240;      // px; the JPEG stored with each entry
const THUMB_QUALITY = 0.72;
const ACTIVE_CLASS = 'on';
const SOURCE_LABEL = Object.freeze({ manual: 'Saved', bleed: 'PDF with bleed', trim: 'PDF, no bleed' });
const DAY_MS = 24 * 60 * 60 * 1000;

/** Small JPEG data-URL of the sheet, for the card. */
export function makeThumb(source) {
  const c = document.createElement('canvas');
  c.width = THUMB_W;
  c.height = Math.round(THUMB_W * source.height / source.width);
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', THUMB_QUALITY);
}

/** "Today 14:52", "Yesterday 09:10" or "3 Sep 2026". */
export function whenLabel(savedAt, now = Date.now()) {
  const d = new Date(savedAt);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const age = startOfToday.getTime() - savedAt;
  if (age <= 0) return 'Today ' + time;
  if (age <= DAY_MS) return 'Yesterday ' + time;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function createHistoryPanel({ listEl, emptyEl, onLoad, onDelete }) {
  let activeKey = null;

  function card(entry) {
    const { title, subtitle } = describeEntry(entry);
    const el = document.createElement('div');
    el.className = 'hist';
    el.dataset.key = configKey(entry);
    el.classList.toggle(ACTIVE_CLASS, el.dataset.key === activeKey);

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'histOpen';
    open.title = 'Bring this tent back to edit it';
    if (entry.thumb) {
      const im = document.createElement('img');
      im.src = entry.thumb; im.alt = ''; im.loading = 'lazy';
      open.appendChild(im);
    }
    const meta = document.createElement('div');
    meta.className = 'histMeta';
    const t = document.createElement('strong'); t.textContent = title;
    const s = document.createElement('span'); s.textContent = subtitle;
    const w = document.createElement('small'); w.textContent = `${whenLabel(entry.savedAt)} · ${SOURCE_LABEL[entry.source] || 'Saved'}`;
    meta.append(t, s, w);
    open.appendChild(meta);
    open.onclick = () => onLoad(entry);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'histDel';
    del.title = 'Remove from saved tents';
    del.setAttribute('aria-label', 'Remove ' + title);
    del.textContent = '×';
    del.onclick = e => { e.stopPropagation(); onDelete(entry); };

    el.append(open, del);
    return el;
  }

  return {
    /** Rebuild the list from scratch (entries newest first). */
    render(entries) {
      listEl.replaceChildren(...entries.map(card));
      emptyEl.style.display = entries.length ? 'none' : '';
    },
    /** Highlight the card whose design matches `key` (null = none). */
    setActive(key) {
      if (key === activeKey) return;
      activeKey = key;
      for (const el of listEl.children) el.classList.toggle(ACTIVE_CLASS, el.dataset.key === key);
    },
  };
}

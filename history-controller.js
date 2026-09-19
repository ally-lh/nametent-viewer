// Glue between the page's design state and the saved-tents history:
// snapshots the design on save / download, restores an entry on click,
// removes entries, and keeps the column's collapsed state. The page stays
// the owner of its state and passes it in through `readDesign` / `applyEntry`.
import { makeEntry, addEntry, removeEntry, parseHistory, serializeHistory, configKey, describeEntry } from './tent-history.js';
import { putImage, getImage, deleteImage } from './image-store.js';
import { createHistoryPanel, makeThumb } from './history-panel.js';

const CUSTOM_CHAR = -1;
const errText = err => (err && err.message ? err.message : String(err));
const QUOTA_MSG = 'the browser storage is full — remove a few saved tents and try again';
const isQuotaError = err => !!err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22);
const friendly = err => (isQuotaError(err) ? QUOTA_MSG : errText(err).replace(/^history: /, ''));
export const newId = () => (globalThis.crypto && crypto.randomUUID
  ? crypto.randomUUID()
  : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));

/**
 * @param els       { aside, toggle, save, note, list, empty } DOM elements
 * @param keys      { history, open } localStorage keys
 * @param persist   (key, value) => void — the page's guarded localStorage write
 * @param sheet     the print-clean sheet canvas (for thumbnails)
 * @param readDesign () => { mode, tent, bgKey, charSel, name, layout, customImageId, customBlob }
 * @param applyEntry async (entry, custom | null) => void — put the entry on
 *                  screen; `custom` = { img, blob, id } for a custom character
 * @param loadImg   src => Promise<HTMLImageElement>
 */
export function createHistoryController({ els, keys, persist, sheet, readDesign, applyEntry, loadImg }) {
  let history = parseHistory(localStorage.getItem(keys.history));
  const panel = createHistoryPanel({ listEl: els.list, emptyEl: els.empty, onLoad: load, onDelete: remove });
  panel.render(history);

  function setNote(text, kind = '') {
    els.note.className = kind;
    els.note.textContent = text;
  }
  function currentEntry(source, thumb) {
    const { tent, bgKey, charSel, name, layout, customImageId } = readDesign();
    return makeEntry({ tent, bgKey, charSel, name, layout, customImageId }, { id: newId(), now: Date.now(), source, thumb });
  }
  /** Key of the design on screen (null in preview mode or when it cannot be saved). */
  function currentKey() {
    if (readDesign().mode !== 'design') return null;
    try { return configKey(currentEntry('manual', '')); } catch (e) { return null; }
  }
  /** Write a candidate list, and only then make it the current one — a failed
   *  write (storage full, private mode) leaves memory, storage and screen in step. */
  function commit(next) {
    localStorage.setItem(keys.history, serializeHistory(next)); // throws when storage is full
    history = next;
    panel.render(history);
  }

  async function save(source) {
    const design = readDesign();
    if (design.mode !== 'design') { setNote('Switch to Design to save a tent.', 'err'); return false; }
    try {
      const entry = currentEntry(source, makeThumb(sheet));
      if (entry.customImageId) {
        if (!design.customBlob) throw new Error('the custom image is no longer available — upload it again');
        await putImage(entry.customImageId, design.customBlob);
      }
      commit(addEntry(history, entry));
      panel.setActive(configKey(entry));
      setNote(`Saved “${describeEntry(entry).title}”.`, 'ok');
      return true;
    } catch (err) {
      console.error('Could not save to history', err);
      setNote('Could not save: ' + friendly(err), 'err');
      return false;
    }
  }

  async function customFor(entry) {
    if (entry.charSel !== CUSTOM_CHAR) return null;
    const blob = await getImage(entry.customImageId);
    if (!blob) throw new Error('its custom image is no longer stored');
    const img = await loadImg(URL.createObjectURL(blob));
    return { img, blob, id: entry.customImageId };
  }
  // Fetching a custom image can take a moment; if another card is clicked
  // meanwhile, only the latest click is applied.
  let loadTicket = 0;
  async function load(entry) {
    const ticket = ++loadTicket;
    try {
      const custom = await customFor(entry);
      if (ticket !== loadTicket) return;
      await applyEntry(entry, custom);
      panel.setActive(currentKey());
      setNote(`Loaded “${describeEntry(entry).title}” — edit away.`, 'ok');
    } catch (err) {
      if (ticket !== loadTicket) return;
      console.error('Could not load saved tent', err);
      setNote('Could not load that tent: ' + friendly(err), 'err');
    }
  }

  async function remove(entry) {
    if (!confirm(`Remove “${describeEntry(entry).title}” from saved tents?`)) return;
    try { commit(removeEntry(history, entry.id)); }
    catch (err) {
      console.error('Could not update history', err);
      setNote('Could not remove it: ' + friendly(err), 'err');
      return; // nothing changed, so its image must stay too
    }
    panel.setActive(currentKey());
    setNote('Removed.', '');
    const stillUsed = entry.customImageId && history.some(e => e.customImageId === entry.customImageId);
    if (entry.customImageId && !stillUsed) deleteImage(entry.customImageId).catch(err => console.warn('Could not delete stored image', err));
  }

  function setCollapsed(closed) {
    els.aside.classList.toggle('collapsed', closed);
    els.toggle.textContent = closed ? 'Saved tents' : 'Hide';
    els.toggle.setAttribute('aria-expanded', String(!closed));
  }
  els.toggle.onclick = () => {
    const closed = !els.aside.classList.contains('collapsed');
    setCollapsed(closed);
    persist(keys.open, closed ? 'closed' : 'open');
  };
  if (localStorage.getItem(keys.open) === 'closed') setCollapsed(true);
  els.save.onclick = () => save('manual');

  return {
    save,
    /** Re-highlight the card matching what is on screen (cheap; call after every redraw). */
    markCurrent: () => panel.setActive(currentKey()),
    /** Saving only makes sense while designing. */
    setDesignMode(on) { els.save.disabled = !on; els.save.title = on ? '' : 'Switch to Design to save a tent'; },
  };
}

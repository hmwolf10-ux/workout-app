import { $ } from './util.js';

// Shared UI state that is not persisted.
export const ui = { tab: 'today', planEdit: null, progressEx: null, volWeek: 0 };

// data-act handlers registered by each view module
export const actions = {};

let toastTimer = null;
export function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function openSheet(html, cls = '') {
  const el = $('#sheet');
  el.innerHTML = `<div class="sheet-backdrop" data-act="close-sheet"></div><div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  el.hidden = false;
  document.body.classList.add('noscroll');
}
export function closeSheet() {
  const el = $('#sheet');
  el.hidden = true;
  el.innerHTML = '';
  document.body.classList.remove('noscroll');
}
export const sheetOpen = () => !$('#sheet').hidden;
actions['close-sheet'] = () => closeSheet();

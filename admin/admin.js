/* Tallinn Tastebuds — the editor.
 *
 * A form over data/restaurants.json. It never touches the file directly: it
 * reads the current one through /api/state and posts the whole array back
 * through /api/save, which turns it into one commit on GitHub. Cloudflare
 * Pages notices the push and redeploys, so a save lands on the map about a
 * minute later.
 *
 * Photos are resized here, in the page, before they are uploaded — a phone
 * photo is 5 MB and 4000px wide, and the repo would carry that for ever.
 * Drawing them through a canvas is also what drops the EXIF block, and with
 * it the GPS coordinates of wherever the shutter was pressed.
 *
 * Plain modules, no framework, no build step, same as the map.
 */

import {
  validatePlace, slugify, parseCoordinates, insertPlace, PHOTO_FILE
} from './place-rules.js';

const $ = (selector) => document.querySelector(selector);
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of [].concat(children)) node.append(child);
  return node;
};

/* Photos are held to the same shape photos/README.md asks for by hand: the
   long edge first, quality second, and leaves are where quality 70 hides. */
const PHOTO_TARGET_BYTES = 300 * 1024;
const PHOTO_ATTEMPTS = [[1600, 0.75], [1400, 0.70], [1200, 0.70]];

const state = {
  sha: null,
  branch: '',
  repo: 'etibarhasanov/tallinntastebuds',
  types: [],
  languages: [],
  photosById: {},      /* what is in the repo now, per place id */
  original: [],        /* the array as loaded, for the dirty check */
  places: [],          /* the array being edited */
  uploads: new Map(),  /* "photos/<id>/<file>" -> { base64, url, bytes } */
  deletions: new Set(),
  editing: null,       /* the place object open in the form, by reference */
  fresh: new Set(),    /* ids added in this session, for the list badge */
  lang: 'en',
  query: ''
};

/* ------------------------------------------------------------------ talking
   Every call goes through here so that a session that has quietly expired
   sends you back to the password box instead of failing silently. */

async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });

  let body = {};
  try { body = await response.json(); } catch { /* an empty body is fine */ }

  if (response.status === 401) {
    view('gate');
    throw Object.assign(new Error('Signed out'), { handled: true });
  }
  if (!response.ok) throw Object.assign(new Error(body.error || `Request failed (${response.status})`), { body, status: response.status });
  return body;
}

/* -------------------------------------------------------------------- shell */

function view(name) {
  document.body.dataset.view = name;
  $('#gate').hidden = name !== 'gate';
  $('#browse').hidden = name !== 'browse';
  $('#editor').hidden = name !== 'edit';
  $('#back').hidden = name !== 'edit';
  if (name === 'gate') $('#password').focus();
}

let toastTimer = null;
function toast(html, seconds = 6) {
  const node = $('#toast');
  node.innerHTML = html;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, seconds * 1000);
}

function banner(text, tone = '') {
  const node = $('#banner');
  node.textContent = text;
  node.dataset.tone = tone;
}

/* ------------------------------------------------------------------- dirty */

const clone = (value) => JSON.parse(JSON.stringify(value));

function changes() {
  const before = new Map(state.original.map((place) => [place.id, JSON.stringify(place)]));
  const after = new Map(state.places.map((place) => [place.id, JSON.stringify(place)]));

  const added = [...after.keys()].filter((id) => !before.has(id));
  const removed = [...before.keys()].filter((id) => !after.has(id));
  const edited = [...after.keys()].filter((id) => before.has(id) && before.get(id) !== after.get(id));

  return { added, removed, edited, photos: state.uploads.size, dropped: state.deletions.size };
}

function isDirty() {
  const { added, removed, edited, photos, dropped } = changes();
  return Boolean(added.length || removed.length || edited.length || photos || dropped);
}

function nameOf(id) {
  const place = state.places.find((p) => p.id === id) || state.original.find((p) => p.id === id);
  return place ? place.name : id;
}

function commitMessage() {
  const { added, removed, edited } = changes();
  const touched = added.length + removed.length + edited.length;

  if (touched === 1) {
    if (added.length) return `Add ${nameOf(added[0])}`;
    if (removed.length) return `Remove ${nameOf(removed[0])}`;
    return `Update ${nameOf(edited[0])}`;
  }
  if (touched === 0 && state.uploads.size) return `Add photos for ${nameOf([...state.uploads.keys()][0].split('/')[1])}`;
  return `Update ${touched} places from the editor`;
}

function refreshSaveButton() {
  const dirty = isDirty();
  $('#save').disabled = !dirty;
  if (!dirty) return banner(`${state.places.length} places, nothing to save`);

  const { added, removed, edited, photos } = changes();
  const bits = [];
  if (added.length) bits.push(`${added.length} new`);
  if (edited.length) bits.push(`${edited.length} edited`);
  if (removed.length) bits.push(`${removed.length} removed`);
  if (photos) bits.push(`${photos} photo${photos === 1 ? '' : 's'}`);
  banner(bits.join(', '), 'good');
}

/* -------------------------------------------------------------------- list */

function renderList() {
  const list = $('#list');
  const query = state.query.trim().toLowerCase();
  list.textContent = '';

  const matches = state.places.filter((place) => {
    if (!query) return true;
    const haystack = [place.name, place.id, place.address, ...(place.types || [])].join(' ').toLowerCase();
    return haystack.includes(query);
  });

  const { added, edited } = changes();

  for (const place of matches) {
    const flag = added.includes(place.id) ? 'new'
      : edited.includes(place.id) ? 'edited'
      : place.closed ? 'closed' : null;

    const button = el('button', { type: 'button', className: 'place' }, [
      el('span', { className: 'place__name', textContent: place.name || '(no name)' })
    ]);
    if (flag) {
      const badge = el('span', { className: 'place__flag', textContent: flag });
      badge.dataset.flag = flag;
      button.append(badge);
    }
    button.append(el('span', { className: 'place__id', textContent: place.id || 'no id yet' }));
    if (state.editing === place) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => openPlace(place));
    list.append(el('li', {}, button));
  }

  $('#listEmpty').hidden = matches.length > 0;
  $('#search').placeholder = `Search ${state.places.length} places`;
}

/* -------------------------------------------------------------------- form */

function openPlace(place) {
  state.editing = place;
  state.lang = state.languages.includes('en') ? 'en' : state.languages[0];
  fillForm();
  view('edit');
  renderList();
  window.scrollTo(0, 0);
}

function blankPlace() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: '', name: '', address: '', lat: 59.437, lng: 24.7536, price: 2,
    types: [], blurb: {}, mustOrder: [], reel: '', photos: [], website: '',
    added: today, visited: today.slice(0, 7), closed: false
  };
}

const field = (name) => $(`.form [name="${name}"]`);

function fillForm() {
  const place = state.editing;
  if (!place) return;

  field('name').value = place.name || '';
  field('id').value = place.id || '';
  field('address').value = place.address || '';
  field('lat').value = place.lat ?? '';
  field('lng').value = place.lng ?? '';
  field('reel').value = place.reel || '';
  field('website').value = place.website || '';
  field('added').value = place.added || '';
  field('visited').value = place.visited || '';
  field('closed').checked = Boolean(place.closed);

  /* An id is in every shared link and is the photo folder's name, so it is
     writable only while the place is new. */
  const isNew = state.fresh.has(place.id) || !place.id;
  field('id').readOnly = !isNew;
  $('#idNote').textContent = isNew
    ? 'filled in from the name; edit it now, never later'
    : 'fixed — it is in every ?spot= link already shared';

  $('#mapsPaste').value = '';
  $('#mapsHint').hidden = true;

  renderPrice();
  renderTypes();
  renderLangTabs();
  renderDishes();
  renderPhotos();
  renderChecks();
  $('#remove').hidden = false;
}

function renderPrice() {
  const box = $('#price');
  box.textContent = '';
  for (let n = 1; n <= 4; n++) {
    const button = el('button', {
      type: 'button',
      textContent: '€'.repeat(n),
      role: 'radio'
    });
    button.setAttribute('aria-checked', String(state.editing.price === n));
    button.addEventListener('click', () => {
      state.editing.price = n;
      renderPrice();
      touched();
    });
    box.append(button);
  }
}

function renderTypes() {
  const box = $('#types');
  box.textContent = '';
  for (const type of state.types) {
    const input = el('input', { type: 'checkbox', checked: (state.editing.types || []).includes(type.id) });
    input.addEventListener('change', () => {
      const types = new Set(state.editing.types || []);
      if (input.checked) types.add(type.id); else types.delete(type.id);
      /* Kept in taxonomy order rather than click order, so the diff of a
         re-tick is empty rather than a reshuffle. */
      state.editing.types = state.types.map((t) => t.id).filter((id) => types.has(id));
      touched();
    });
    box.append(el('label', {}, [input, el('span', { textContent: type.en || type.id })]));
  }
}

function renderLangTabs() {
  const tabs = $('#langTabs');
  tabs.textContent = '';

  /* English first: it is the one every other language gets translated from. */
  const order = [...state.languages].sort((a, b) => (a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b)));

  for (const lang of order) {
    const filled = String((state.editing.blurb || {})[lang] || '').trim().length > 0;
    const button = el('button', { type: 'button', textContent: lang, role: 'tab' });
    button.setAttribute('aria-selected', String(lang === state.lang));
    button.dataset.filled = filled ? 'yes' : 'no';
    button.addEventListener('click', () => {
      state.lang = lang;
      renderLangTabs();
      $('#blurb').focus();
    });
    tabs.append(button);
  }

  $('#blurb').value = (state.editing.blurb || {})[state.lang] || '';
  $('#blurbHint').textContent = `${state.lang.toUpperCase()} — ${$('#blurb').value.trim().length} characters`;
}

function renderDishes() {
  const box = $('#dishes');
  box.textContent = '';
  const dishes = state.editing.mustOrder || [];

  dishes.forEach((dish, index) => {
    const input = el('input', { className: 'field', type: 'text', value: dish, placeholder: 'As the menu prints it' });
    input.addEventListener('input', () => {
      state.editing.mustOrder[index] = input.value;
      touched({ redrawList: false });
    });
    const drop = el('button', { type: 'button', textContent: '×', title: 'Remove' });
    drop.addEventListener('click', () => {
      state.editing.mustOrder.splice(index, 1);
      renderDishes();
      touched();
    });
    box.append(el('div', { className: 'dish' }, [input, drop]));
  });
}

/* ------------------------------------------------------------------ photos */

const photoPath = (id, file) => `photos/${id}/${file}`;

function photoURL(id, file) {
  const pending = state.uploads.get(photoPath(id, file));
  return pending ? pending.url : `../photos/${id}/${file}`;
}

function renderPhotos() {
  const box = $('#shots');
  box.textContent = '';
  const place = state.editing;
  const photos = place.photos || [];

  photos.forEach((file, index) => {
    const figure = el('div', { className: 'shot' });
    figure.append(el('img', { src: photoURL(place.id, file), alt: '', loading: 'lazy' }));
    if (index === 0) figure.append(el('span', { className: 'shot__lead', textContent: 'leads' }));
    if (state.uploads.has(photoPath(place.id, file))) {
      figure.append(el('span', { className: 'shot__lead shot__new', textContent: 'new' }));
    }

    const bar = el('div', { className: 'shot__bar' });
    const move = (to) => {
      const [moved] = photos.splice(index, 1);
      photos.splice(to, 0, moved);
      renderPhotos();
      touched();
    };

    const up = el('button', { type: 'button', textContent: '←', title: 'Earlier', disabled: index === 0 });
    up.addEventListener('click', () => move(index - 1));
    const down = el('button', { type: 'button', textContent: '→', title: 'Later', disabled: index === photos.length - 1 });
    down.addEventListener('click', () => move(index + 1));
    const drop = el('button', { type: 'button', textContent: 'Remove' });
    drop.dataset.act = 'drop';
    drop.addEventListener('click', () => dropPhoto(index));

    bar.append(up, down, drop);
    figure.append(bar);
    box.append(el('li', {}, figure));
  });
}

function dropPhoto(index) {
  const place = state.editing;
  const file = place.photos[index];
  const path = photoPath(place.id, file);

  if (state.uploads.has(path)) {
    URL.revokeObjectURL(state.uploads.get(path).url);
    state.uploads.delete(path);
  } else {
    if (!confirm(`Delete ${file}? It is in the repository, so this removes the file itself.`)) return;
    state.deletions.add(path);
  }

  place.photos.splice(index, 1);
  renderPhotos();
  touched();
}

/** The next free 01.webp / 02.webp / … for this place. */
function nextPhotoName(id, extension) {
  const known = new Set([
    ...(state.photosById[id] || []),
    ...[...state.uploads.keys()].filter((p) => p.startsWith(`photos/${id}/`)).map((p) => p.split('/')[2])
  ]);
  for (let n = 1; n < 100; n++) {
    const name = `${String(n).padStart(2, '0')}.${extension}`;
    if (!known.has(name)) return name;
  }
  return `${Date.now()}.${extension}`;
}

const toBlob = (canvas, type, quality) => new Promise((done) => canvas.toBlob(done, type, quality));

/**
 * Phone photo in, something the repo can carry for ever out.
 *
 * Long edge first and quality second, because that is the order that costs
 * the least visible detail — a frame full of leaves is the expensive one.
 */
async function shrink(file) {
  let source;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    /* Older Safari: an <img> applies the EXIF rotation on its own. */
    source = await new Promise((done, fail) => {
      const image = new Image();
      image.onload = () => done(image);
      image.onerror = () => fail(new Error(`${file.name} is not an image this browser can read`));
      image.src = URL.createObjectURL(file);
    });
  }

  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  let best = null;

  for (const [edge, quality] of PHOTO_ATTEMPTS) {
    const scale = Math.min(1, edge / Math.max(width, height));
    const canvas = el('canvas', { width: Math.round(width * scale), height: Math.round(height * scale) });
    const context = canvas.getContext('2d');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);

    /* A fresh canvas carries no metadata: no GPS, no serial number, no
       timestamp. That is the point of redrawing rather than re-encoding. */
    let blob = await toBlob(canvas, 'image/webp', quality);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality + 0.05);
    if (!blob) continue;

    best = blob;
    if (blob.size <= PHOTO_TARGET_BYTES) break;
  }

  if (!best) throw new Error(`${file.name} could not be converted`);
  return best;
}

const asBase64 = (blob) => new Promise((done, fail) => {
  const reader = new FileReader();
  reader.onload = () => done(String(reader.result).split(',')[1]);
  reader.onerror = () => fail(new Error('Could not read the resized photo'));
  reader.readAsDataURL(blob);
});

async function addPhotos(files) {
  const place = state.editing;
  if (!place.id) {
    toast('Give the place a name first — the photos need a folder to go in.');
    return;
  }

  let added = 0;
  for (const file of files) {
    banner(`Resizing ${file.name}…`);
    try {
      const blob = await shrink(file);
      const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
      const name = nextPhotoName(place.id, extension);
      if (!PHOTO_FILE.test(name)) continue;

      state.uploads.set(photoPath(place.id, name), {
        base64: await asBase64(blob),
        url: URL.createObjectURL(blob),
        bytes: blob.size
      });
      place.photos.push(name);
      added++;
    } catch (err) {
      toast(err.message);
    }
  }

  if (added) {
    const total = [...state.uploads.values()].reduce((sum, one) => sum + one.bytes, 0);
    toast(`${added} photo${added === 1 ? '' : 's'} ready — ${Math.round(total / 1024)} KB in total. Nothing is uploaded until you press Save.`);
  }
  renderPhotos();
  touched();
}

/* ------------------------------------------------------------------ checks */

function renderChecks() {
  const box = $('#checks');
  box.textContent = '';
  const place = state.editing;
  if (!place) return;

  const { errors, warnings } = validatePlace(place, {
    typeIds: state.types.map((t) => t.id),
    languages: state.languages,
    photoFiles: existingPhotos(place.id),
    otherIds: state.places.filter((other) => other !== place).map((other) => other.id)
  });

  for (const message of errors) box.append(tagged(message, 'error'));
  for (const message of warnings) box.append(tagged(message, 'warn'));
}

/** Every filename that will be in photos/<id>/ once this save has landed. */
function existingPhotos(id) {
  return [
    ...(state.photosById[id] || []),
    ...[...state.uploads.keys()]
      .filter((path) => path.startsWith(`photos/${id}/`))
      .map((path) => path.split('/')[2])
  ].filter((file) => !state.deletions.has(`photos/${id}/${file}`));
}

function tagged(message, kind) {
  const node = el('p', { textContent: message });
  node.dataset.kind = kind;
  return node;
}

/* Anything that changed the place object funnels through here. */
function touched({ redrawList = true } = {}) {
  renderChecks();
  refreshSaveButton();
  if (redrawList) renderList();
}

/* -------------------------------------------------------------------- wiring */

function wireForm() {
  const form = $('#form');

  form.addEventListener('input', (event) => {
    const place = state.editing;
    if (!place) return;
    const input = event.target;
    const name = input.name;

    if (name === 'name') {
      place.name = input.value;
      /* While it is new, the id follows the name. The moment it is saved the
         id is frozen: it is in every link already shared. */
      if (state.fresh.has(place.id) || !place.id) {
        const previous = place.id;
        const next = slugify(input.value, state.places.filter((p) => p !== place).map((p) => p.id));
        if (next !== previous) {
          rehomePhotos(previous, next);
          state.fresh.delete(previous);
          state.fresh.add(next);
          place.id = next;
          field('id').value = next;
        }
      }
    } else if (name === 'id') {
      const previous = place.id;
      const next = input.value.trim();
      rehomePhotos(previous, next);
      state.fresh.delete(previous);
      state.fresh.add(next);
      place.id = next;
    } else if (name === 'address') {
      place.address = input.value;
    } else if (name === 'lat' || name === 'lng') {
      const value = Number(String(input.value).replace(',', '.'));
      place[name] = Number.isFinite(value) ? value : input.value;
    } else if (name === 'reel' || name === 'website') {
      place[name] = input.value.trim();
    } else if (name === 'added' || name === 'visited') {
      place[name] = input.value;
    } else if (input.id === 'blurb') {
      place.blurb = place.blurb || {};
      const text = input.value;
      if (text.trim()) place.blurb[state.lang] = text;
      else delete place.blurb[state.lang];
      $('#blurbHint').textContent = `${state.lang.toUpperCase()} — ${text.trim().length} characters`;
      const tab = [...$('#langTabs').children].find((button) => button.textContent === state.lang);
      if (tab) tab.dataset.filled = text.trim() ? 'yes' : 'no';
    } else {
      return;
    }

    touched({ redrawList: name === 'name' || name === 'id' });
  });

  form.addEventListener('change', (event) => {
    if (event.target.name !== 'closed' || !state.editing) return;
    state.editing.closed = event.target.checked;
    touched();
  });

  form.addEventListener('submit', (event) => event.preventDefault());

  $('#mapsPaste').addEventListener('input', (event) => {
    const hint = $('#mapsHint');
    const value = event.target.value.trim();
    if (!value) { hint.hidden = true; return; }

    const found = parseCoordinates(value);
    hint.hidden = false;
    if (found && found.error === 'short link') {
      hint.dataset.tone = 'bad';
      hint.textContent = 'A maps.app.goo.gl link hides the coordinates. Open it, then copy the long URL from the address bar.';
      return;
    }
    if (!found) {
      hint.dataset.tone = 'bad';
      hint.textContent = 'No coordinates in that. A /maps/place/… URL, a ?q=lat,lng link or a plain "59.44, 24.72" all work.';
      return;
    }

    state.editing.lat = found.lat;
    state.editing.lng = found.lng;
    field('lat').value = found.lat;
    field('lng').value = found.lng;
    hint.dataset.tone = '';
    hint.textContent = `Taken from the link: ${found.lat}, ${found.lng}`;
    touched();
  });

  $('#addDish').addEventListener('click', () => {
    state.editing.mustOrder = state.editing.mustOrder || [];
    state.editing.mustOrder.push('');
    renderDishes();
    $('#dishes').querySelector('.dish:last-child .field')?.focus();
  });

  $('#pick').addEventListener('change', async (event) => {
    const files = [...event.target.files];
    event.target.value = '';
    if (files.length) await addPhotos(files);
  });

  $('#remove').addEventListener('click', () => {
    const place = state.editing;
    if (!confirm(`Remove ${place.name || place.id} from the map?\n\nA place that has shut down is better marked closed — it stays on the map, struck through, and the link keeps working.`)) return;

    for (const file of place.photos || []) {
      const path = photoPath(place.id, file);
      if (state.uploads.has(path)) {
        URL.revokeObjectURL(state.uploads.get(path).url);
        state.uploads.delete(path);
      } else {
        state.deletions.add(path);
      }
    }

    state.places = state.places.filter((other) => other !== place);
    state.fresh.delete(place.id);
    state.editing = null;
    view('browse');
    renderList();
    refreshSaveButton();
  });
}

/* An id typed or generated before any photo was uploaded leaves the pending
   uploads pointing at a folder that will not exist. Move them with it. */
function rehomePhotos(from, to) {
  if (!from || from === to) return;
  for (const [path, value] of [...state.uploads]) {
    if (!path.startsWith(`photos/${from}/`)) continue;
    state.uploads.delete(path);
    state.uploads.set(path.replace(`photos/${from}/`, `photos/${to}/`), value);
  }
}

/* --------------------------------------------------------------------- save */

async function saveAll() {
  const button = $('#save');
  button.disabled = true;
  banner('Saving…');

  try {
    const result = await api('save', {
      method: 'POST',
      body: JSON.stringify({
        baseSha: state.sha,
        places: state.places,
        uploads: [...state.uploads].map(([path, one]) => ({ path, base64: one.base64 })),
        deletions: [...state.deletions],
        message: commitMessage()
      })
    });

    if (result.unchanged) {
      toast('Nothing had actually changed, so nothing was committed.');
    } else {
      const short = String(result.sha).slice(0, 7);
      toast(`Committed as <a href="https://github.com/${state.repo}/commit/${result.sha}" target="_blank" rel="noopener">${short}</a>. Cloudflare is rebuilding — it is on the map in about a minute.`, 10);
    }

    /* The commit is the new baseline. Photos that were pending are now in the
       repo, so they move from "uploads" to "what exists". */
    for (const path of state.uploads.keys()) {
      const [, id, file] = path.split('/');
      (state.photosById[id] = state.photosById[id] || []).push(file);
      URL.revokeObjectURL(state.uploads.get(path).url);
    }
    for (const path of state.deletions) {
      const [, id, file] = path.split('/');
      if (state.photosById[id]) state.photosById[id] = state.photosById[id].filter((name) => name !== file);
    }
    state.uploads.clear();
    state.deletions.clear();
    state.fresh.clear();
    state.sha = result.sha || state.sha;
    state.original = clone(state.places);

    if (state.editing) fillForm();
    renderList();
    refreshSaveButton();

    for (const warning of result.warnings || []) console.info('validator:', warning);
  } catch (err) {
    if (err.handled) return;
    if (err.status === 409) {
      banner('The repository moved on', 'bad');
      toast('Something else pushed to the repository while you were editing. Reload to pick that up — your unsaved edits will be lost, so copy anything you cannot retype.', 20);
    } else if (err.status === 422) {
      banner('Not valid yet', 'bad');
      toast(`The server refused it: ${(err.body.errors || []).slice(0, 3).join('; ')}`, 14);
    } else {
      banner('Save failed', 'bad');
      toast(err.message);
    }
    refreshSaveButton();
  }
}

/* --------------------------------------------------------------------- boot */

async function load() {
  banner('Loading…');
  const data = await api('state');

  state.sha = data.sha;
  state.branch = data.branch;
  state.repo = data.repo || state.repo;
  state.types = data.types;
  state.languages = data.languages;
  state.photosById = data.photosById || {};
  state.places = data.places;
  state.original = clone(data.places);
  state.uploads.clear();
  state.deletions.clear();
  state.fresh.clear();
  state.editing = null;

  view('browse');
  renderList();
  refreshSaveButton();
}

function wireShell() {
  $('#gateForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = $('#gateError');
    error.hidden = true;
    banner('Checking…');
    try {
      await api('login', { method: 'POST', body: JSON.stringify({ password: $('#password').value }) });
      $('#password').value = '';
      await load();
    } catch (err) {
      if (err.handled) {
        error.textContent = 'That is not the password.';
        error.hidden = false;
        banner('');
      } else {
        error.textContent = err.message;
        error.hidden = false;
      }
    }
  });

  $('#search').addEventListener('input', (event) => {
    state.query = event.target.value;
    renderList();
  });

  $('#add').addEventListener('click', () => {
    const place = blankPlace();
    state.places = insertPlace(state.places, place);
    state.fresh.add(place.id);
    openPlace(place);
    field('name').focus();
  });

  $('#back').addEventListener('click', () => {
    state.editing = null;
    view('browse');
    renderList();
  });

  $('#save').addEventListener('click', saveAll);

  window.addEventListener('beforeunload', (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

wireShell();
wireForm();

load().catch((err) => {
  if (!err.handled) {
    view('gate');
    if (err.status === 503) toast(err.message, 20);
  }
});

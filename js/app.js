/* ═══════════════════════════════════════════════════════════════
   LIFE DASHBOARD  –  app.js
   Vanilla JS · LocalStorage · No dependencies
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── STORAGE HELPERS ──────────────────────────────────────────── */
const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* storage quota */ }
  }
};

/* ── HTML ESCAPE ──────────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── TOAST ────────────────────────────────────────────────────── */
const Toast = (() => {
  const el    = document.getElementById('toast');
  let   timer = null;

  /**
   * @param {string} msg
   * @param {'info'|'success'|'error'} type
   * @param {number} duration  ms
   */
  function show(msg, type = 'info', duration = 2800) {
    clearTimeout(timer);
    el.textContent = msg;
    el.className   = `toast toast--${type} show`;
    timer = setTimeout(() => el.classList.remove('show'), duration);
  }

  return { show };
})();

/* ═══════════════════════════════════════════════════════════════
   MODULE 1 – THEME
═══════════════════════════════════════════════════════════════ */
const ThemeModule = (() => {
  const STORAGE_KEY = 'ld_theme';
  const html        = document.documentElement;
  const btn         = document.getElementById('themeToggle');
  const icon        = document.getElementById('themeIcon');

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    Store.set(STORAGE_KEY, theme);
  }

  function toggle() {
    const current = html.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  function init() {
    // Saved preference → OS preference → default light
    const saved = Store.get(STORAGE_KEY, null);
    const preferred = saved
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(preferred);
    btn.addEventListener('click', toggle);
  }

  return { init };
})();

/* ═══════════════════════════════════════════════════════════════
   MODULE 2 – CLOCK & GREETING
═══════════════════════════════════════════════════════════════ */
const ClockModule = (() => {
  const clockEl   = document.getElementById('clock');
  const dateEl    = document.getElementById('date');
  const greetEl   = document.getElementById('greetingText');
  const nameEl    = document.getElementById('greetingName');
  const editBtn   = document.getElementById('editNameBtn');
  const cancelBtn = document.getElementById('cancelNameBtn');
  const nameForm  = document.getElementById('nameForm');
  const nameInput = document.getElementById('nameInput');

  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const NAME_KEY = 'ld_name';

  function getGreetingPhrase(hour) {
    if (hour >= 5  && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'Good night';
  }

  function getGreetingEmoji(hour) {
    if (hour >= 5  && hour < 12) return '☀️';
    if (hour >= 12 && hour < 17) return '🌤️';
    if (hour >= 17 && hour < 21) return '🌆';
    return '🌙';
  }

  function tick() {
    const now = new Date();
    const h   = now.getHours();
    const hh  = String(h).padStart(2, '0');
    const m   = String(now.getMinutes()).padStart(2, '0');
    const s   = String(now.getSeconds()).padStart(2, '0');

    clockEl.textContent = `${hh}:${m}:${s}`;
    dateEl.textContent  = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

    const name = Store.get(NAME_KEY, null);
    const suffix = name ? `, ${name}` : '';
    greetEl.textContent = `${getGreetingPhrase(h)}${suffix}! ${getGreetingEmoji(h)}`;
  }

  function renderName() {
    const name = Store.get(NAME_KEY, null);
    nameEl.textContent = name || 'Stranger';
  }

  function showNameForm() {
    nameInput.value = Store.get(NAME_KEY, '');
    nameForm.classList.remove('hidden');
    editBtn.classList.add('hidden');
    nameInput.focus();
    nameInput.select();
  }

  function hideNameForm() {
    nameForm.classList.add('hidden');
    editBtn.classList.remove('hidden');
  }

  function saveName(e) {
    e.preventDefault();
    const val = nameInput.value.trim();
    if (val) {
      Store.set(NAME_KEY, val);
      nameEl.textContent = val;
      Toast.show(`Welcome, ${val}! 👋`, 'success');
    } else {
      Store.set(NAME_KEY, null);
      nameEl.textContent = 'Stranger';
    }
    hideNameForm();
    tick();
  }

  function init() {
    renderName();
    tick();
    setInterval(tick, 1000);
    editBtn.addEventListener('click', showNameForm);
    cancelBtn.addEventListener('click', hideNameForm);
    nameForm.addEventListener('submit', saveName);
  }

  return { init };
})();

/* ═══════════════════════════════════════════════════════════════
   MODULE 3 – FOCUS TIMER (POMODORO)
═══════════════════════════════════════════════════════════════ */
const TimerModule = (() => {
  const display   = document.getElementById('timerDisplay');
  const startBtn  = document.getElementById('timerStart');
  const pauseBtn  = document.getElementById('timerPause');
  const resetBtn  = document.getElementById('timerReset');
  const statusEl  = document.getElementById('timerStatus');
  const ring      = document.getElementById('timerRing');
  const minInput  = document.getElementById('timerMinutes');
  const applyBtn  = document.getElementById('timerApply');

  const CIRCUMFERENCE = 2 * Math.PI * 52; // ≈ 326.73  (r = 52 from SVG)
  const STORAGE_KEY   = 'ld_timer_duration';

  let totalSeconds = 0;
  let remaining    = 0;
  let interval     = null;
  let isRunning    = false;

  /* ── helpers ── */
  function loadDuration() {
    return Store.get(STORAGE_KEY, 25);
  }

  function clampMinutes(val) {
    return Math.min(120, Math.max(1, parseInt(val, 10) || 25));
  }

  function fmt(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  /* ── render ring + time ── */
  function render() {
    display.textContent = fmt(remaining);
    const ratio  = totalSeconds > 0 ? remaining / totalSeconds : 1;
    const offset = CIRCUMFERENCE * (1 - ratio);
    ring.style.strokeDashoffset = offset;
    // Turn green when finished
    ring.style.stroke = remaining === 0 ? 'var(--timer-ring-done)' : '';
  }

  /* ── core tick ── */
  function tick() {
    if (remaining <= 0) {
      clearInterval(interval);
      isRunning = false;
      switchButtons(false);
      statusEl.textContent = '🎉 Session complete! Great work!';
      Toast.show('Focus session complete! 🎉', 'success', 4000);
      render();
      return;
    }
    remaining--;
    render();
    if (remaining === 60) statusEl.textContent = '⏰ 1 minute left!';
    if (remaining === 10) statusEl.textContent = '🔥 Almost there!';
  }

  /* ── controls ── */
  function start() {
    if (remaining === 0) remaining = totalSeconds;
    isRunning = true;
    interval  = setInterval(tick, 1000);
    switchButtons(true);
    statusEl.textContent = '🧠 Stay focused…';
  }

  function pause() {
    clearInterval(interval);
    isRunning = false;
    switchButtons(false);
    statusEl.textContent = '⏸ Paused. Come back soon!';
  }

  function reset() {
    clearInterval(interval);
    isRunning = false;
    remaining = totalSeconds;
    switchButtons(false);
    render();
    statusEl.textContent = 'Ready to focus? 🎯';
  }

  function applyDuration(minutes) {
    const mins     = clampMinutes(minutes);
    totalSeconds   = mins * 60;
    remaining      = totalSeconds;
    minInput.value = mins;
    Store.set(STORAGE_KEY, mins);
    render();
    statusEl.textContent = `Timer set to ${mins} minute${mins !== 1 ? 's' : ''} 🎯`;
  }

  function switchButtons(running) {
    startBtn.classList.toggle('hidden', running);
    pauseBtn.classList.toggle('hidden', !running);
  }

  /* ── init ── */
  function init() {
    applyDuration(loadDuration());

    startBtn.addEventListener('click', start);
    pauseBtn.addEventListener('click', pause);
    resetBtn.addEventListener('click', reset);

    applyBtn.addEventListener('click', () => {
      if (isRunning) pause();
      applyDuration(minInput.value);
    });

    minInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (isRunning) pause();
        applyDuration(minInput.value);
      }
    });
  }

  return { init };
})();

/* ═══════════════════════════════════════════════════════════════
   MODULE 4 – TO-DO LIST
═══════════════════════════════════════════════════════════════ */
const TodoModule = (() => {
  const form       = document.getElementById('todoForm');
  const input      = document.getElementById('todoInput');
  const listEl     = document.getElementById('todoList');
  const countEl    = document.getElementById('todoCount');
  const clearBtn   = document.getElementById('clearDone');
  const filterBtns = document.querySelectorAll('.filter-btn');

  const STORAGE_KEY = 'ld_todos';
  let tasks         = [];
  let activeFilter  = 'all';

  /* ── persistence ── */
  function load() { tasks = Store.get(STORAGE_KEY, []); }
  function save() { Store.set(STORAGE_KEY, tasks); }

  /* ── helpers ── */
  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function isDuplicate(text) {
    return tasks.some(t => t.text.toLowerCase() === text.toLowerCase());
  }

  /* ── render ── */
  function render() {
    const filtered = tasks.filter(t => {
      if (activeFilter === 'active') return !t.done;
      if (activeFilter === 'done')   return  t.done;
      return true;
    });

    if (filtered.length === 0) {
      const msgs = {
        all:    '🎉 No tasks yet. Add one above!',
        done:   '✨ No completed tasks.',
        active: '🎯 All done! Nothing active.'
      };
      listEl.innerHTML = `<li class="todo-empty">${msgs[activeFilter]}</li>`;
    } else {
      listEl.innerHTML = '';
      filtered.forEach(task => listEl.appendChild(buildItem(task)));
    }

    const left = tasks.filter(t => !t.done).length;
    countEl.textContent = `${left} task${left !== 1 ? 's' : ''} left`;
  }

  /* ── build one task item ── */
  function buildItem(task) {
    const li = document.createElement('li');
    li.className  = `todo-item${task.done ? ' done' : ''}`;
    li.dataset.id = task.id;

    li.innerHTML = `
      <input
        type="checkbox"
        class="todo-item__check"
        aria-label="Mark as done"
        ${task.done ? 'checked' : ''}
      />
      <span class="todo-item__text">${escHtml(task.text)}</span>
      <div class="todo-item__actions" role="group" aria-label="Task actions">
        <button class="todo-item__btn" data-action="edit"   title="Edit"   aria-label="Edit task">✏️</button>
        <button class="todo-item__btn" data-action="delete" title="Delete" aria-label="Delete task">🗑️</button>
      </div>
    `;

    li.querySelector('.todo-item__check').addEventListener('change', e => {
      toggleDone(task.id, e.target.checked);
    });

    li.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'edit')   startEdit(task.id, li);
      if (btn.dataset.action === 'delete') deleteTask(task.id);
    });

    return li;
  }

  /* ── inline edit ── */
  function startEdit(id, li) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const textSpan  = li.querySelector('.todo-item__text');
    const actionsEl = li.querySelector('.todo-item__actions');

    const editInput = document.createElement('input');
    editInput.type      = 'text';
    editInput.className = 'todo-item__edit-input';
    editInput.value     = task.text;
    editInput.maxLength = 120;

    textSpan.replaceWith(editInput);
    actionsEl.innerHTML = `
      <button class="todo-item__btn" data-action="save"   title="Save"   aria-label="Save">✅</button>
      <button class="todo-item__btn" data-action="cancel" title="Cancel" aria-label="Cancel">❌</button>
    `;

    editInput.focus();
    editInput.select();

    function commitSave() {
      const newText = editInput.value.trim();
      if (!newText) {
        Toast.show('Task cannot be empty.', 'error');
        return;
      }
      // Duplicate check – exclude current task
      const dup = tasks.some(t => t.id !== id && t.text.toLowerCase() === newText.toLowerCase());
      if (dup) {
        Toast.show('Task already exists! 🚫', 'error');
        return;
      }
      task.text = newText;
      save();
      render();
    }

    actionsEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'save')   commitSave();
      if (btn.dataset.action === 'cancel') render();
    });

    editInput.addEventListener('keydown', e => {
      if (e.key === 'Enter')  commitSave();
      if (e.key === 'Escape') render();
    });
  }

  /* ── mutations ── */
  function addTask(text) {
    if (isDuplicate(text)) {
      Toast.show('Task already exists! 🚫', 'error');
      return false;
    }
    tasks.unshift({ id: genId(), text, done: false });
    save();
    return true;
  }

  function toggleDone(id, done) {
    const task = tasks.find(t => t.id === id);
    if (task) { task.done = done; save(); render(); }
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    save();
    render();
    Toast.show('Task deleted.', 'info');
  }

  function clearDone() {
    const before = tasks.length;
    tasks = tasks.filter(t => !t.done);
    save();
    render();
    const removed = before - tasks.length;
    if (removed > 0) {
      Toast.show(`Cleared ${removed} completed task${removed !== 1 ? 's' : ''} ✨`, 'success');
    }
  }

  /* ── init ── */
  function init() {
    load();
    render();

    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      if (addTask(text)) {
        input.value  = '';
        activeFilter = 'all';
        filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
        render();
        Toast.show('Task added! 📝', 'success');
      }
    });

    clearBtn.addEventListener('click', clearDone);

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render();
      });
    });
  }

  return { init };
})();

/* ═══════════════════════════════════════════════════════════════
   MODULE 5 – QUICK LINKS
   Tiles show ONLY the favicon/initial icon – no label text.
   The label is used as the tooltip (title attribute) only.
═══════════════════════════════════════════════════════════════ */
const LinksModule = (() => {
  const form     = document.getElementById('linkForm');
  const labelInp = document.getElementById('linkLabel');
  const urlInp   = document.getElementById('linkUrl');
  const grid     = document.getElementById('linkGrid');

  const STORAGE_KEY = 'ld_links';
  let links         = [];

  /* ── persistence ── */
  function load() { links = Store.get(STORAGE_KEY, []); }
  function save() { Store.set(STORAGE_KEY, links); }
  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ── favicon via Google S2 ── */
  function faviconUrl(url) {
    try {
      const origin = new URL(url).origin;
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(origin)}&sz=32`;
    } catch {
      return null;
    }
  }

  /* ── first letter initial ── */
  function initial(label) {
    return (label.trim().charAt(0) || '?').toUpperCase();
  }

  /* ── normalize URL ── */
  function normalizeUrl(raw) {
    const trimmed = raw.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
  }

  /* ── render grid ── */
  function render() {
    if (links.length === 0) {
      grid.innerHTML = '<p class="links-empty">No links yet. Add your favorites above!</p>';
      return;
    }
    grid.innerHTML = '';
    links.forEach(link => grid.appendChild(buildTile(link)));
  }

  /* ── build one tile ── */
  function buildTile(link) {
    const a = document.createElement('a');
    a.className = 'link-tile';
    a.href      = link.url;
    a.target    = '_blank';
    a.rel       = 'noopener noreferrer';
    // Label shown only as tooltip – not rendered as visible text
    a.title     = link.label;
    a.setAttribute('aria-label', link.label);

    const fav = faviconUrl(link.url);

    /* ── icon element ──
       We try the Google favicon first; if it errors we swap in the
       initial-letter placeholder. No <span> label is appended.       */
    if (fav) {
      const img = document.createElement('img');
      img.src       = fav;
      img.alt       = '';
      img.className = 'link-tile__favicon';
      img.loading   = 'lazy';
      img.width     = 24;
      img.height    = 24;

      // On error → replace with initial placeholder
      img.addEventListener('error', () => {
        img.replaceWith(makePlaceholder(link.label));
      }, { once: true });

      a.appendChild(img);
    } else {
      a.appendChild(makePlaceholder(link.label));
    }

    /* ── delete button ── */
    const del = document.createElement('button');
    del.className        = 'link-tile__del';
    del.setAttribute('aria-label', `Remove ${link.label}`);
    del.title            = 'Remove';
    del.textContent      = '✕';
    del.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      removeLink(link.id);
    });

    a.appendChild(del);
    return a;
  }

  function makePlaceholder(label) {
    const span = document.createElement('span');
    span.className   = 'link-tile__favicon-placeholder';
    span.textContent = initial(label);
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  /* ── mutations ── */
  function addLink(label, url) {
    const normalized = normalizeUrl(url);
    const dup = links.some(
      l =>
        l.label.toLowerCase() === label.toLowerCase() ||
        l.url.toLowerCase()   === normalized.toLowerCase()
    );
    if (dup) {
      Toast.show('Link already exists! 🚫', 'error');
      return false;
    }
    links.unshift({ id: genId(), label: label.trim(), url: normalized });
    save();
    return true;
  }

  function removeLink(id) {
    links = links.filter(l => l.id !== id);
    save();
    render();
    Toast.show('Link removed.', 'info');
  }

  /* ── init ── */
  function init() {
    load();
    render();

    form.addEventListener('submit', e => {
      e.preventDefault();
      const label = labelInp.value.trim();
      const url   = urlInp.value.trim();

      if (!label) { Toast.show('Please enter a label.', 'error'); labelInp.focus(); return; }
      if (!url)   { Toast.show('Please enter a URL.',   'error'); urlInp.focus();   return; }

      if (addLink(label, url)) {
        labelInp.value = '';
        urlInp.value   = '';
        render();
        Toast.show(`"${label}" added! 🔗`, 'success');
      }
    });
  }

  return { init };
})();

/* ═══════════════════════════════════════════════════════════════
   BOOT  –  initialise all modules after DOM is ready
═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  ThemeModule.init();
  ClockModule.init();
  TimerModule.init();
  TodoModule.init();
  LinksModule.init();
});

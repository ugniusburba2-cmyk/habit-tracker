/* Įpročių apskaita — pagrindinė logika.
 * Visi duomenys saugomi naršyklės localStorage. Nieko neperduodama į serverį.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'ipr.registras.v1';
  const THEME_KEY = 'ipr.tema';
  const COLORS = ['#2b6cb0', '#2f855a', '#b7791f', '#9b2c2c', '#6b46c1', '#285e61'];
  const WEEKDAYS = ['Sk', 'Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št']; // pagal Date.getDay()
  const RING_LENGTH = 314.16;
  const REMINDER_INTERVAL_MS = 20000;

  const $ = (id) => document.getElementById(id);

  const el = {
    today: $('today-date'),
    list: $('habit-list'),
    addBtn: $('add-btn'),
    themeToggle: $('theme-toggle'),
    themeLabel: $('theme-label'),
    ringFill: $('ring-fill'),
    ringLabel: $('ring-label'),
    statDone: $('stat-done'),
    statStreak: $('stat-streak'),
    statWeek: $('stat-week'),
    weekTable: $('week-table'),
    chart: $('chart'),
    exportCsv: $('export-csv'),
    exportJson: $('export-json'),
    importJson: $('import-json'),
    reset: $('reset'),
    dialog: $('habit-dialog'),
    form: $('habit-form'),
    formId: $('habit-id'),
    formName: $('habit-name'),
    formNameError: $('name-error'),
    formTime: $('habit-time'),
    swatches: $('swatches'),
    cancel: $('cancel-btn'),
    dialogTitle: $('dialog-title'),
    toast: $('toast'),
  };

  let state = loadState();
  let formColor = COLORS[0];
  let toastTimer = null;
  const firedReminders = new Set();

  /* ---------- Duomenys ---------- */

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (isValidState(parsed)) return parsed;
    } catch (err) {
      /* sugadinti duomenys — pradedame iš naujo */
    }
    return { habits: [], log: {} };
  }

  function isValidState(s) {
    return !!s && Array.isArray(s.habits) && typeof s.log === 'object' && s.log !== null &&
      s.habits.every((h) => h && typeof h.id === 'string' && typeof h.name === 'string');
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function lastDays(n) {
    const today = new Date();
    return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
  }

  function isDone(habitId, d) {
    const day = state.log[dateKey(d)];
    return !!(day && day[habitId]);
  }

  function setDone(habitId, d, done) {
    const k = dateKey(d);
    state.log[k] = state.log[k] || {};
    if (done) state.log[k][habitId] = true;
    else delete state.log[k][habitId];
  }

  function currentStreak(habitId) {
    let d = new Date();
    if (!isDone(habitId, d)) d = addDays(d, -1);
    let n = 0;
    while (isDone(habitId, d)) {
      n++;
      d = addDays(d, -1);
    }
    return n;
  }

  function dayPercent(d) {
    if (!state.habits.length) return 0;
    const done = state.habits.filter((h) => isDone(h.id, d)).length;
    return Math.round((done / state.habits.length) * 100);
  }

  /* ---------- Veiksmai ---------- */

  function toggleHabit(habitId) {
    const today = new Date();
    setDone(habitId, today, !isDone(habitId, today));
    saveState();
    render();
    if (state.habits.length && dayPercent(today) === 100) {
      showToast('Visi šiandienos įpročiai atlikti.');
    }
  }

  function openDialog(habit) {
    el.form.reset();
    el.formNameError.hidden = true;
    el.formName.removeAttribute('aria-invalid');
    if (habit) {
      el.dialogTitle.textContent = 'Redaguoti įprotį';
      el.formId.value = habit.id;
      el.formName.value = habit.name;
      el.formTime.value = habit.time || '';
      formColor = habit.color;
    } else {
      el.dialogTitle.textContent = 'Naujas įprotis';
      el.formId.value = '';
      formColor = COLORS[state.habits.length % COLORS.length];
    }
    renderSwatches();
    el.dialog.showModal();
    el.formName.focus();
  }

  function saveHabitFromForm(e) {
    e.preventDefault();
    const name = el.formName.value.trim();
    if (!name) {
      el.formNameError.hidden = false;
      el.formName.setAttribute('aria-invalid', 'true');
      el.formName.focus();
      return;
    }
    const time = el.formTime.value;
    const id = el.formId.value;

    if (id) {
      const habit = state.habits.find((h) => h.id === id);
      if (habit) Object.assign(habit, { name, time, color: formColor });
    } else {
      state.habits.push({ id: newId(), name, time, color: formColor });
    }

    saveState();
    el.dialog.close();
    render();
    showToast(id ? 'Įprotis atnaujintas.' : 'Įprotis pridėtas.');

    if (time && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function deleteHabit(habitId) {
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return;
    if (!window.confirm(`Ištrinti įprotį „${habit.name}“? Jo istorija taip pat bus pašalinta.`)) return;
    state.habits = state.habits.filter((h) => h.id !== habitId);
    Object.values(state.log).forEach((day) => delete day[habitId]);
    saveState();
    render();
    showToast('Įprotis ištrintas.');
  }

  function resetAll() {
    if (!window.confirm('Ištrinti visus įpročius ir istoriją? Šio veiksmo atšaukti negalima.')) return;
    state = { habits: [], log: {} };
    saveState();
    render();
    showToast('Visi duomenys ištrinti.');
  }

  /* ---------- Eksportas ir importas ---------- */

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCsv() {
    const quote = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = ['Data;Įprotis;Atlikta'];
    Object.keys(state.log).sort().forEach((date) => {
      state.habits.forEach((h) => {
        const done = state.log[date][h.id] ? 'taip' : 'ne';
        rows.push([date, quote(h.name), done].join(';'));
      });
    });
    if (rows.length === 1) {
      showToast('Eksportui dar nėra duomenų.');
      return;
    }
    download(`ipročiai-${dateKey(new Date())}.csv`, '﻿' + rows.join('\r\n'), 'text/csv;charset=utf-8');
  }

  function exportJson() {
    const payload = { format: 'ipr-registras', version: 1, exportedAt: new Date().toISOString(), data: state };
    download(`ipročiai-kopija-${dateKey(new Date())}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const data = parsed && parsed.format === 'ipr-registras' ? parsed.data : null;
        if (!isValidState(data)) throw new Error('invalid');
        if (!window.confirm('Atkurti duomenis iš kopijos? Dabartiniai duomenys bus pakeisti.')) return;
        state = data;
        saveState();
        render();
        showToast('Duomenys atkurti.');
      } catch (err) {
        showToast('Failas netinkamas arba sugadintas.');
      }
    };
    reader.readAsText(file);
  }

  /* ---------- Atvaizdavimas ---------- */

  function render() {
    renderHeader();
    renderHabits();
    renderWeekTable();
    renderChart();
  }

  function renderHeader() {
    el.today.textContent = new Date().toLocaleDateString('lt-LT', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const percent = dayPercent(new Date());
    el.ringFill.style.strokeDashoffset = RING_LENGTH * (1 - percent / 100);
    el.ringLabel.textContent = `${percent} %`;

    const doneToday = state.habits.filter((h) => isDone(h.id, new Date())).length;
    el.statDone.textContent = `${doneToday} / ${state.habits.length}`;

    const longest = Math.max(0, ...state.habits.map((h) => currentStreak(h.id)));
    el.statStreak.textContent = `${longest} d.`;

    const week = lastDays(7);
    const avg = Math.round(week.reduce((sum, d) => sum + dayPercent(d), 0) / 7);
    el.statWeek.textContent = `${avg} %`;
  }

  function renderHabits() {
    el.list.textContent = '';
    if (!state.habits.length) {
      const empty = document.createElement('li');
      empty.className = 'empty-cell';
      empty.textContent = 'Įpročių dar nėra. Pridėkite pirmąjį įprotį.';
      el.list.appendChild(empty);
      return;
    }

    state.habits.forEach((h) => {
      const done = isDone(h.id, new Date());
      const streak = currentStreak(h.id);

      const li = document.createElement('li');
      li.className = 'habit-item';
      li.style.setProperty('--habit-color', h.color);

      const check = document.createElement('button');
      check.type = 'button';
      check.className = 'habit-check';
      check.setAttribute('aria-pressed', String(done));
      check.setAttribute('aria-label', `Pažymėti kaip atliktą: ${h.name}`);
      check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
      check.addEventListener('click', () => toggleHabit(h.id));

      const info = document.createElement('div');
      info.className = 'habit-info';
      const name = document.createElement('div');
      name.className = 'habit-name';
      name.textContent = h.name;
      const meta = document.createElement('div');
      meta.className = 'habit-meta';
      const parts = [streak > 0 ? `Serija: ${streak} d.` : 'Serija dar nepradėta'];
      if (h.time) parts.push(`Priminimas ${h.time}`);
      meta.textContent = parts.join(' · ');
      info.append(name, meta);

      const actions = document.createElement('div');
      actions.className = 'habit-actions';
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-ghost btn-small';
      editBtn.textContent = 'Redaguoti';
      editBtn.addEventListener('click', () => openDialog(h));
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-danger btn-small';
      delBtn.textContent = 'Ištrinti';
      delBtn.addEventListener('click', () => deleteHabit(h.id));
      actions.append(editBtn, delBtn);

      li.append(check, info, actions);
      el.list.appendChild(li);
    });
  }

  function renderWeekTable() {
    const days = lastDays(7);
    const table = el.weekTable;
    table.textContent = '';

    if (!state.habits.length) {
      const body = document.createElement('tbody');
      body.innerHTML = '<tr><td class="empty-cell">Pridėkite įpročių, kad matytumėte savaitės ataskaitą.</td></tr>';
      table.appendChild(body);
      return;
    }

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.scope = 'col';
    corner.textContent = 'Įprotis';
    headRow.appendChild(corner);
    days.forEach((d) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    state.habits.forEach((h) => {
      const tr = document.createElement('tr');
      tr.style.setProperty('--habit-color', h.color);
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = h.name;
      th.style.fontWeight = '600';
      tr.appendChild(th);
      days.forEach((d) => {
        const td = document.createElement('td');
        const done = isDone(h.id, d);
        const dot = document.createElement('span');
        dot.className = 'dot' + (done ? ' on' : '');
        const srText = document.createElement('span');
        srText.className = 'sr-only';
        srText.textContent = done ? 'atlikta' : 'neatlikta';
        dot.appendChild(srText);
        td.appendChild(dot);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function renderChart() {
    const days = lastDays(14);
    el.chart.textContent = '';
    days.forEach((d) => {
      const pct = dayPercent(d);
      const wrap = document.createElement('div');
      wrap.className = 'bar-wrap';
      wrap.title = `${d.toLocaleDateString('lt-LT')}: ${pct} %`;
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = `${pct}%`;
      const label = document.createElement('div');
      label.className = 'bar-label';
      label.textContent = `${d.getDate()}`;
      wrap.append(bar, label);
      el.chart.appendChild(wrap);
    });
  }

  function renderSwatches() {
    el.swatches.textContent = '';
    COLORS.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.setProperty('--sw', c);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(c === formColor));
      b.setAttribute('aria-label', `Spalva ${c}`);
      b.addEventListener('click', () => {
        formColor = c;
        renderSwatches();
      });
      el.swatches.appendChild(b);
    });
  }

  /* ---------- Tema ---------- */

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    const dark = theme === 'dark';
    el.themeLabel.textContent = dark ? 'Šviesi tema' : 'Tamsi tema';
    el.themeToggle.setAttribute('aria-pressed', String(dark));
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  }

  /* ---------- Pranešimai ---------- */

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 3000);
  }

  function checkReminders() {
    const now = new Date();
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    state.habits.forEach((h) => {
      if (!h.time || h.time !== hm || isDone(h.id, now)) return;
      const key = `${h.id}|${dateKey(now)}|${hm}`;
      if (firedReminders.has(key)) return;
      firedReminders.add(key);
      const body = 'Priminimas: laikas atlikti įprotį.';
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(h.name, { body });
      }
      showToast(`${h.name}: ${body}`);
    });
  }

  /* ---------- Paleidimas ---------- */

  function bindEvents() {
    el.addBtn.addEventListener('click', () => openDialog(null));
    el.form.addEventListener('submit', saveHabitFromForm);
    el.cancel.addEventListener('click', () => el.dialog.close());
    el.themeToggle.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
    el.exportCsv.addEventListener('click', exportCsv);
    el.exportJson.addEventListener('click', exportJson);
    el.importJson.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importJson(file);
      e.target.value = '';
    });
    el.reset.addEventListener('click', resetAll);
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  function init() {
    initTheme();
    bindEvents();
    renderSwatches();
    render();
    setInterval(checkReminders, REMINDER_INTERVAL_MS);
    registerServiceWorker();
  }

  init();
})();

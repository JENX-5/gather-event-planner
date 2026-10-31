import { demoPlan, validateEvent, validDate } from '/planner.js';
const $ = (s) => document.querySelector(s);
// A template tag for readable HTML formatting; dynamic text is explicitly escaped.
const html = (parts, ...values) =>
  parts.reduce((result, part, i) => result + part + (values[i] ?? ''), '');
import { escapeHtml as esc, daysUntil, captureFocus } from '/ui-utils.js';
const today = () => new Date().toLocaleDateString('en-CA');
const future = new Date();
future.setDate(future.getDate() + 60);
const sample = {
  id: 'sample',
  name: 'A little magic, a lot of memories',
  type: 'Birthday',
  date: future.toISOString().slice(0, 10),
  location: 'Bengaluru',
  guests: 40,
  budget: 75000,
  currency: 'INR',
  preferences:
    'An intimate garden party with warm lights, seasonal food, and a playful terracotta theme.',
  source: 'demo',
};
sample.plan = demoPlan(sample);
function isSavedEvent(event) {
  try {
    validateEvent(event);
    const p = event.plan;
    return (
      typeof event.id === 'string' &&
      typeof p.summary === 'string' &&
      Array.isArray(p.tasks) &&
      p.tasks.length > 0 &&
      p.tasks.every((t) => typeof t.title === 'string' && validDate(t.date)) &&
      Array.isArray(p.budget) &&
      p.budget.every(
        (b) =>
          typeof b.category === 'string' &&
          Number.isFinite(b.planned) &&
          b.planned >= 0 &&
          Number.isFinite(b.actual) &&
          b.actual >= 0,
      ) &&
      Array.isArray(p.vendors) &&
      p.vendors.every(
        (v) => typeof v.category === 'string' && typeof v.notes === 'string',
      ) &&
      Array.isArray(p.ideas) &&
      p.ideas.length > 0 &&
      p.ideas.every(
        (i) => typeof i.title === 'string' && typeof i.description === 'string',
      )
    );
  } catch {
    return false;
  }
}
let events;
try {
  events = JSON.parse(localStorage.getItem('gather.events.v1'));
  if (!Array.isArray(events) || events.some((e) => !isSavedEvent(e)))
    events = null;
} catch {}
events = events || [sample];
let active = events[0]?.id,
  tab = 'Overview',
  status = { mode: 'demo' },
  loading = false;
let notice = '';
const tabs = ['Overview', 'Budget', 'Timeline', 'Vendors', 'Ideas'];
const current = () => events.find((e) => e.id === active);
const money = (n, e = current()) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: e?.currency || 'INR',
    maximumFractionDigits: 0,
  }).format(n);
const date = (s) =>
  new Date(s + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
function toast(s) {
  $('#toast').textContent = s;
  $('#toast').classList.add('show');
  setTimeout(() => $('#toast').classList.remove('show'), 3500);
}
function save() {
  try {
    localStorage.setItem('gather.events.v1', JSON.stringify(events));
  } catch {
    toast('Storage is full or unavailable. Export your plan to keep a copy.');
  }
}
function taskRows(e, limit) {
  return e.plan.tasks
    .slice(0, limit)
    .map(
      (t, i) =>
        html`<label class="task ${t.done ? 'complete' : ''}"
          ><input
            type="checkbox"
            data-task="${i}"
            ${t.done ? 'checked' : ''}
          /><span
            >${esc(t.title)}<small
              >${date(t.date)}${!t.done && t.date < today() ? ' · Needs attention' : ''}</small
            ></span
          ><span class="task-arrow">↗</span></label
        >`,
    )
    .join('');
}
function render() {
  const restoreFocus = captureFocus(document);
  const e = current();
  const done = e?.plan.tasks.filter((t) => t.done).length || 0;
  const actual =
    e?.plan.budget.reduce((s, b) => s + Number(b.actual || 0), 0) || 0;
  $('#app').innerHTML = html`<a class="skip-link" href="#main-content"
      >Skip to planning dashboard</a
    >
    <aside class="sidebar" aria-label="Workspace">
      <a class="brand" href="/"
        >✳ <span>gather<span class="brand-dot">.</span></span></a
      >
      <div class="workspace-label">YOUR PLANNING STUDIO</div>
      <button class="nav selected" data-action="home">
        <span>▦</span> My events
        <span class="count">${events.length}</span></button
      ><button class="nav" data-action="new">
        <span>＋</span> Create an event
      </button>
      <div class="event-list">
        <p>YOUR EVENTS</p>
        ${events.map((x) => html`<button class="event-link ${x.id === active ? 'active' : ''}" data-event="${esc(x.id)}"><span class="event-dot"></span><span>${esc(x.name)}</span></button>`).join('')}
      </div>
      <div class="sidebar-bottom">
        <div class="small-spark">✧</div>
        <h3>A little help. A lot of joy.</h3>
        <p>Thoughtful plans, powered by your imagination and Gemini.</p>
        <div class="connection">
          <span></span>
          ${status.mode === 'gemini' ? 'Gemini key configured' : 'Demo mode · No key needed'}
        </div>
      </div>
      <div class="profile">
        <span class="avatar">Y</span>
        <div>Your personal studio<small>Saved on this browser</small></div>
      </div>
    </aside>
    <main id="main-content" tabindex="-1">
      <header>
        <div>My workspace <span>/</span> <strong>My events</strong></div>
        <button class="button primary small" data-action="new">
          ＋ New event
        </button>
      </header>
      <div class="page">
        <div class="page-title">
          <div>
            <div class="eyebrow">LESS STRESS. MORE CELEBRATING.</div>
            <h1>Good things start with a plan.</h1>
            <p>
              Bring your people together. We’ll help with the little details.
            </p>
          </div>
          <span class="title-flower">✳</span>
        </div>
        ${
          !e
            ? html`<section class="card empty">
                <h2>Your next celebration starts here.</h2>
                <p>Create a wedding, birthday, or community event.</p>
                <button class="button primary" data-action="new">
                  Plan an event →
                </button>
              </section>`
            : html`<section class="hero">
                  <div class="hero-copy">
                    <div class="pill">
                      ${e.type === 'Wedding' ? '♡' : e.type === 'Birthday' ? '✧' : '☀'}
                      ${esc(e.type)} celebration
                    </div>
                    <h2>${esc(e.name)}</h2>
                    <div class="countdown">
                      ${daysUntil(e.date) > 0 ? `${daysUntil(e.date)} days to make it unforgettable` : daysUntil(e.date) === 0 ? 'Today is the day. Let’s celebrate!' : 'A celebration to remember'}
                    </div>
                    <div class="hero-meta">
                      <span>◷ ${date(e.date)}</span
                      ><span
                        >⌖ ${esc(e.location || 'Location to be decided')}</span
                      ><span>♧ ${e.guests} guests</span>
                    </div>
                    <button class="hero-edit" data-action="edit">
                      Edit event details ↗
                    </button>
                  </div>
                  <div class="hero-art" aria-hidden="true">
                    <div class="arch arch-one"></div>
                    <div class="arch arch-two"></div>
                    <div class="art-sun">✳</div>
                    <div class="vase"></div>
                    <div class="stem stem-one"></div>
                    <div class="stem stem-two"></div>
                    <div class="flower flower-one">✳</div>
                    <div class="flower flower-two">✳</div>
                    <div class="art-caption">
                      a reason to<br /><i>celebrate.</i>
                    </div>
                  </div>
                </section>
                <section class="stats">
                  <div class="stat">
                    <span class="stat-icon green">◈</span>
                    <div>
                      <small>Total budget</small
                      ><strong>${money(e.budget)}</strong
                      ><span
                        >${money(Math.abs(e.budget - actual))}
                        ${actual > e.budget ? 'over budget' : 'remaining'}</span
                      >
                    </div>
                  </div>
                  <div class="stat">
                    <span class="stat-icon peach">♧</span>
                    <div>
                      <small>Guest list</small
                      ><strong>${e.guests} <em>people</em></strong
                      ><span
                        >${money(e.budget / e.guests)} budget per guest</span
                      >
                    </div>
                  </div>
                  <div class="stat">
                    <span class="stat-icon yellow">✓</span>
                    <div>
                      <small>Planning progress</small
                      ><strong
                        >${Math.round((done / e.plan.tasks.length) * 100)}<em
                          >% complete</em
                        ></strong
                      ><span
                        >${done} of ${e.plan.tasks.length} tasks checked
                        off</span
                      ><progress
                        class="completion-track"
                        max="${e.plan.tasks.length}"
                        value="${done}"
                        aria-label="Planning tasks completed"
                      >
                        ${done} of ${e.plan.tasks.length}
                      </progress>
                    </div>
                  </div>
                </section>
                <div class="tabbar">
                  <nav aria-label="Plan sections">
                    ${tabs.map((t) => html`<button class="tab ${tab === t ? 'active' : ''}" data-tab="${t}" aria-current="${tab === t ? 'page' : 'false'}">${t}</button>`).join('')}
                  </nav>
                  <button class="text-button" data-action="export">
                    ↓ Export plan
                  </button>
                </div>
                ${notice ? html`<div class="notice" role="alert">${esc(notice)}<button class="text-button" data-action="dismiss-notice" aria-label="Dismiss notification">Dismiss ×</button></div>` : ''}
                <div id="content">${content(e, actual)}</div>
                <footer>
                  <span>Made for moments that matter.</span
                  ><span
                    >${e.source === 'gemini' ? '✧ Gemini-generated plan' : '◌ Demo template'}
                    · Estimates, not vendor quotes</span
                  >
                </footer>`
        }
      </div>
    </main>
    <dialog id="event-dialog" aria-labelledby="dialog-title"></dialog>`;
  bind();
  restoreFocus();
}
function content(e, actual) {
  if (tab === 'Overview')
    return html`<div class="overview-grid">
      <section class="card">
        <div class="section-heading">
          <div>
            <div class="eyebrow">ONE STEP AT A TIME</div>
            <h2>Your next little steps</h2>
          </div>
          <button class="text-button" data-tab="Timeline">
            View timeline ↗
          </button>
        </div>
        ${taskRows(e, 4)}
        <div class="card-note">
          Every checked box brings the celebration a little closer.
        </div>
      </section>
      <section class="inspiration" aria-busy="${loading}">
        <span class="spark">✧</span>
        <div class="eyebrow">YOUR CREATIVE CO-PILOT</div>
        <h2>A celebration that<br />feels like <i>you.</i></h2>
        <p>${esc(e.plan.summary)}</p>
        <button
          class="button primary"
          data-action="generate"
          ${loading ? 'disabled' : ''}
        >
          ${loading ? 'Creating your plan…' : '✧ ' + (status.mode === 'gemini' ? 'Create a fresh AI plan' : 'Refresh demo plan')}</button
        >${e.previousPlan ? '<button class="text-button" data-action="undo">Restore previous plan ↶</button>' : ''}<small
          >${status.mode === 'gemini' ? 'Sends event details to Gemini. Replaces this plan; saves a backup.' : 'Add your Gemini key in .env for personalized AI plans.'}</small
        >
      </section>
      <section class="card budget-preview">
        <div class="section-heading">
          <h2>A happy budget balance</h2>
          <button class="text-button" data-tab="Budget">Manage budget ↗</button>
        </div>
        <div class="budget-bars">
          ${e.plan.budget
            .map(
              (b, i) =>
                html`<div class="budget-line">
                  <span><i class="dot dot-${i % 6}"></i>${esc(b.category)}</span
                  ><strong>${money(b.planned)}</strong
                  ><progress
                    class="allocation-track"
                    max="${Math.max(e.budget, b.planned, 1)}"
                    value="${b.planned}"
                    aria-label="${esc(b.category)} allocation"
                  >
                    ${money(b.planned)}
                  </progress>
                </div>`,
            )
            .join('')}
        </div>
      </section>
      <section class="card idea-preview">
        <div class="eyebrow">A LITTLE INSPIRATION</div>
        <div class="idea-illustration" aria-hidden="true">
          ✿ <span>✧</span> ✿
        </div>
        <h2>${esc(e.plan.ideas[0].title)}</h2>
        <p>${esc(e.plan.ideas[0].description)}</p>
        <button class="text-button" data-tab="Ideas">
          Explore your ideas →
        </button>
      </section>
    </div>`;
  if (tab === 'Budget')
    return html`<section class="card">
      <div class="section-heading">
        <div>
          <h2>Make every detail count.</h2>
          <p>Track real costs alongside your estimated allocations.</p>
        </div>
        <strong class="${actual > e.budget ? 'danger' : ''}"
          >${money(actual)} spent of ${money(e.budget)}</strong
        >
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Planned</th>
              <th>Actual cost</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            ${e.plan.budget
              .map(
                (b, i) =>
                  html`<tr>
                    <td>${esc(b.category)}</td>
                    <td>
                      <input
                        aria-label="${esc(b.category)} planned cost"
                        class="cost"
                        type="number"
                        min="0"
                        max="10000000000"
                        data-budget="${i}"
                        data-field="planned"
                        value="${b.planned}"
                      />
                    </td>
                    <td>
                      <input
                        aria-label="${esc(b.category)} actual cost"
                        class="cost"
                        type="number"
                        min="0"
                        max="10000000000"
                        data-budget="${i}"
                        data-field="actual"
                        value="${b.actual || 0}"
                      />
                    </td>
                    <td class="${b.actual > b.planned ? 'danger' : ''}">
                      ${money(b.planned - b.actual)}
                    </td>
                  </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <div class="card-note">
        Allocated: ${money(e.plan.budget.reduce((s, b) => s + b.planned, 0))} ·
        Unallocated:
        ${money(e.budget - e.plan.budget.reduce((s, b) => s + b.planned, 0))}.
        Keep a contingency for the unexpected.
      </div>
    </section>`;
  if (tab === 'Timeline')
    return html`<section class="card">
      <div class="section-heading">
        <div>
          <h2>From first idea to final toast.</h2>
          <p>Your checklist, one manageable step at a time.</p>
        </div>
      </div>
      ${taskRows(e)}
      <form id="task-form" class="inline-form">
        <input
          name="title"
          placeholder="Add a task…"
          aria-label="Task title"
          maxlength="200"
          required
        /><input
          name="date"
          type="date"
          aria-label="Task due date"
          max="${e.date}"
          value="${e.date}"
          required
        /><button class="button primary">＋ Add task</button>
      </form>
    </section>`;
  if (tab === 'Vendors')
    return html`<div class="section-heading">
        <div>
          <h2>Your celebration team.</h2>
          <p>Keep quotes, contacts, and booking details in one place.</p>
        </div>
      </div>
      <div class="vendor-grid">
        ${e.plan.vendors
          .map(
            (v, i) =>
              html`<section class="card vendor-card">
                <div class="eyebrow">${esc(v.category)}</div>
                <label
                  >Vendor or business<input
                    data-vendor="${i}"
                    data-field="name"
                    value="${esc(v.name)}"
                    placeholder="Add a vendor name"
                    maxlength="200" /></label
                ><label
                  >Booking status<select data-vendor="${i}" data-field="status">
                    ${['To research', 'Contacted', 'Quote received', 'Booked'].map((s) => html`<option ${v.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                  </select></label
                ><label
                  >Checklist & notes<textarea
                    data-vendor="${i}"
                    data-field="notes"
                    rows="4"
                    maxlength="3000"
                  >
${esc(v.notes)}</textarea>
                </label>
              </section>`,
          )
          .join('')}
      </div>`;
  return html`<div class="section-heading">
      <div>
        <h2>Little details. Lasting memories.</h2>
        <p>Personal touches to make this celebration yours.</p>
      </div>
    </div>
    <div class="ideas-grid">
      ${e.plan.ideas
        .map(
          (x, i) =>
            html`<article class="card idea-card">
              <div class="idea-number">
                0${i + 1} <span>${['✳', '✿', '✧', '☀'][i % 4]}</span>
              </div>
              <h2>${esc(x.title)}</h2>
              <p>${esc(x.description)}</p>
            </article>`,
        )
        .join('')}
    </div>`;
}
function bind() {
  document.querySelectorAll('[data-tab]').forEach(
    (b) =>
      (b.onclick = () => {
        tab = b.dataset.tab;
        render();
      }),
  );
  document.querySelectorAll('[data-event]').forEach(
    (b) =>
      (b.onclick = () => {
        active = b.dataset.event;
        tab = 'Overview';
        render();
      }),
  );
  document.querySelectorAll('[data-action]').forEach(
    (b) =>
      (b.onclick = () => {
        const a = b.dataset.action;
        if (a === 'new' || a === 'edit') openForm(a === 'edit');
        if (a === 'home') {
          tab = 'Overview';
          render();
        }
        if (a === 'dismiss-notice') {
          notice = '';
          render();
        }
        if (a === 'export') exportPlan();
        if (a === 'generate') generate();
        if (a === 'undo') {
          const e = current();
          [e.plan, e.previousPlan] = [e.previousPlan, e.plan];
          save();
          render();
          toast('Previous plan restored.');
        }
      }),
  );
  document.querySelectorAll('[data-task]').forEach(
    (c) =>
      (c.onchange = () => {
        current().plan.tasks[c.dataset.task].done = c.checked;
        save();
        render();
      }),
  );
  document.querySelectorAll('[data-budget]').forEach(
    (c) =>
      (c.onchange = () => {
        if (!c.checkValidity() || c.value === '') {
          toast('Enter a valid non-negative amount.');
          render();
          return;
        }
        current().plan.budget[c.dataset.budget][c.dataset.field] = Number(
          c.value,
        );
        save();
        render();
      }),
  );
  document.querySelectorAll('[data-vendor]').forEach(
    (c) =>
      (c.onchange = () => {
        current().plan.vendors[c.dataset.vendor][c.dataset.field] = c.value;
        save();
      }),
  );
  if ($('#task-form'))
    $('#task-form').onsubmit = (ev) => {
      ev.preventDefault();
      const d = new FormData(ev.target);
      current().plan.tasks.push({
        title: d.get('title'),
        date: d.get('date'),
        done: false,
      });
      current().plan.tasks.sort((a, b) => a.date.localeCompare(b.date));
      save();
      render();
    };
}
function openForm(edit = false) {
  const e = edit
    ? current()
    : {
        name: '',
        type: 'Wedding',
        date: future.toISOString().slice(0, 10),
        location: '',
        guests: 50,
        budget: 100000,
        currency: 'INR',
        preferences: '',
      };
  const d = $('#event-dialog');
  d.innerHTML = html`<form id="event-form">
    <div class="section-heading">
      <div>
        <div class="eyebrow">LET’S MAKE SOMETHING MEMORABLE</div>
        <h2 id="dialog-title">
          ${edit ? 'The little details' : 'What are we celebrating?'}
        </h2>
      </div>
      <button type="button" class="close" aria-label="Close dialog">×</button>
    </div>
    <label
      >Event name<input
        name="name"
        value="${esc(e.name)}"
        placeholder="e.g. Maya & Arjun’s garden wedding"
        required
        maxlength="100"
    /></label>
    <div class="form-grid">
      <label
        >Celebration type<select name="type">
          ${['Wedding', 'Birthday', 'Community'].map((s) => html`<option ${e.type === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></label
      ><label
        >Event date<input
          type="date"
          name="date"
          value="${e.date}"
          required /></label
      ><label
        >Location<input
          name="location"
          value="${esc(e.location)}"
          placeholder="City or venue"
          maxlength="150"
          required /></label
      ><label
        >Number of guests<input
          name="guests"
          type="number"
          min="1"
          max="100000"
          value="${e.guests}"
          required /></label
      ><label
        >Total budget<input
          name="budget"
          type="number"
          min="1"
          max="10000000000"
          value="${e.budget}"
          required /></label
      ><label
        >Currency<select name="currency">
          ${['INR', 'USD', 'EUR', 'GBP'].map((s) => html`<option ${e.currency === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></label
      >
    </div>
    <label
      >Make it personal<textarea
        name="preferences"
        rows="3"
        maxlength="1500"
        placeholder="Your theme, traditions, favorite things, dietary or accessibility needs…"
      >
${esc(e.preferences)}</textarea>
    </label>
    <p class="form-help">
      ${edit ? 'Existing tasks and allocations stay as they are. Generate a fresh plan to reflect your changes.' : 'Start with an editable template, then personalize it with Gemini.'}
    </p>
    <button class="button primary full">
      ${edit ? 'Save event details' : 'Create my celebration →'}
    </button>
  </form>`;
  d.showModal();
  d.querySelector('.close').onclick = () => d.close();
  $('#event-form').onsubmit = (ev) => {
    ev.preventDefault();
    const value = Object.fromEntries(new FormData(ev.target));
    value.guests = Number(value.guests);
    value.budget = Number(value.budget);
    try {
      validateEvent(value);
    } catch (error) {
      toast(error.message);
      return;
    }
    if (edit) Object.assign(e, value);
    else {
      value.id = crypto.randomUUID();
      value.source = 'demo';
      value.plan = demoPlan(value);
      events.unshift(value);
      active = value.id;
      tab = 'Overview';
    }
    save();
    d.close();
    render();
    toast(edit ? 'Event details saved.' : 'Your celebration is ready to plan.');
  };
}
async function generate() {
  if (loading) return;
  const e = current();
  loading = true;
  notice = '';
  render();
  try {
    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        Object.fromEntries(
          [
            'name',
            'type',
            'date',
            'location',
            'guests',
            'budget',
            'currency',
            'preferences',
          ].map((k) => [k, e[k]]),
        ),
      ),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    e.previousPlan = e.plan;
    e.plan = data.plan;
    e.source = data.source;
    save();
    toast(
      data.source === 'demo'
        ? 'Demo template refreshed. Add your Gemini key for AI.'
        : 'Your personalized plan is ready.',
    );
  } catch (err) {
    notice = err.message || 'Could not reach the server.';
  } finally {
    loading = false;
    render();
  }
}
function exportPlan() {
  const e = current();
  const lines = [
    `# ${e.name}`,
    `${e.type} · ${date(e.date)} · ${e.location}`,
    `${e.guests} guests · Budget: ${money(e.budget)}`,
    `Source: ${e.source}`,
    e.plan.summary,
    '\n## Budget',
    ...e.plan.budget.map(
      (b) =>
        `${b.category}: ${money(b.planned)} planned / ${money(b.actual)} actual`,
    ),
    '\n## Timeline',
    ...e.plan.tasks.map(
      (t) => `[${t.done ? 'x' : ' '}] ${t.date} — ${t.title}`,
    ),
    '\n## Vendors',
    ...e.plan.vendors.map(
      (v) =>
        `${v.category}: ${v.name || 'Not selected'} (${v.status})\n${v.notes}`,
    ),
    '\n## Ideas',
    ...e.plan.ideas.map((i) => `${i.title}\n${i.description}`),
  ];
  const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gather-event-plan.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Plan exported.');
}
render();
fetch('/api/status')
  .then((r) => r.json())
  .then((s) => {
    status = s;
    if (!$('#event-dialog')?.open) render();
  })
  .catch(() => toast('Server unavailable. Your saved plans are still here.'));

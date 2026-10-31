import { eventPath, resolveRoute } from '/router.js';
import {
  library,
  guestPanel,
  budgetPanel,
  timelinePanel,
  vendorPanel,
  assistantPanel,
  download,
  calendarText,
  editRecord,
} from '/workspace.js';
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
events = (events || [sample]).map((e) => {
  const clean = sanitizeSavedEvent(e);
  if (e.previousPlan && isSavedEvent({ ...e, plan: e.previousPlan }))
    clean.previousPlan = sanitizeSavedEvent({
      ...e,
      plan: e.previousPlan,
    }).plan;
  return clean;
});
let active = events[0]?.id,
  tab = 'Overview',
  status = { mode: 'demo' },
  loading = false;
let notice = '';
let view = 'event',
  showArchived = false,
  taskFilter = 'All',
  chatBusy = false,
  undoMutation = null;
const tabs = [
  'Overview',
  'Budget',
  'Timeline',
  'Vendors',
  'Guests',
  'Ideas',
  'Assistant',
];
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
function navigate(path) {
  if (window.location.pathname !== path) history.pushState({}, '', path);
  applyRoute();
  document.querySelector('#main-content')?.focus({ preventScroll: true });
  window.scrollTo?.({ top: 0, behavior: 'instant' });
}
function applyRoute() {
  const route = resolveRoute(window.location.pathname);
  view = route.view;
  showArchived = Boolean(route.archived);
  if (view === 'event') {
    active = route.id;
    tab = route.section;
    if (!current()) view = 'not-found';
  }
  render();
}
window.addEventListener('popstate', applyRoute);
function render() {
  const restoreFocus = captureFocus(document);
  const e = current();
  document.title = `${view === 'library' ? (showArchived ? 'Archived events' : 'My events') : view === 'new' ? 'Create an event' : view === 'event' ? tab + ' · ' + e.name : 'Page not found'} — Gather`;
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
        ${events
          .filter((x) => !x.archived)
          .map(
            (x) =>
              html`<button
                class="event-link ${x.id === active ? 'active' : ''}"
                data-event="${esc(x.id)}"
              >
                <span class="event-dot"></span><span>${esc(x.name)}</span>
              </button>`,
          )
          .join('')}
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
    <main
      id="main-content"
      tabindex="-1"
      class="${view === 'event' && tab !== 'Overview' ? 'section-page' : ''}"
    >
      <header>
        <div>
          My workspace <span>/</span>
          <strong
            >${view === 'new' ? 'Create an event' : view === 'event' ? esc(e.name) + ' / ' + tab : 'My events'}</strong
          >
        </div>
        <button class="button primary small" data-action="new">
          ＋ New event
        </button>
      </header>
      <div class="page">
        <div class="page-title">
          <div>
            <div class="eyebrow">LESS STRESS. MORE CELEBRATING.</div>
            <h1>
              ${view === 'new' ? 'A new reason to celebrate.' : view === 'event' && tab !== 'Overview' ? esc(e.name) : 'Good things start with a plan.'}
            </h1>
            <p>
              Bring your people together. We’ll help with the little details.
            </p>
          </div>
          <span class="title-flower">✳</span>
        </div>
        ${
          view === 'new'
            ? html`<div class="creation-layout">
                <section class="card" id="creation-page"></section>
                <aside class="creation-aside">
                  <span aria-hidden="true">✳</span>
                  <h2>Big memories.<br />Small, thoughtful steps.</h2>
                  <p>
                    Tell us what you’re imagining. We’ll turn it into a
                    practical starting plan you can make your own.
                  </p>
                  <ol>
                    <li>Set the scene and your budget.</li>
                    <li>Personalize your plan with Gemini.</li>
                    <li>Bring every little detail together.</li>
                  </ol>
                </aside>
              </div>`
            : view === 'not-found'
              ? html`<section class="card empty">
                  <h2>This celebration isn’t on this device.</h2>
                  <p>
                    Open your event library or import a backup to restore it.
                  </p>
                  <button class="button primary" data-action="home">
                    Go to my events
                  </button>
                </section>`
              : view === 'library'
                ? library(events, showArchived)
                : !e
                  ? html`<section class="card empty">
                      <h2>Your next celebration starts here.</h2>
                      <p>Create a wedding, birthday, or community event.</p>
                      <button class="button primary" data-action="new">
                        Plan an event →
                      </button>
                    </section>`
                  : html`<div class="event-tools">
                        <button class="text-button" data-action="home">
                          ← All events
                        </button>
                        <div class="action-group">
                          <button class="text-button" data-work="duplicate">
                            Duplicate event</button
                          ><button class="text-button" data-work="print">
                            Print / PDF</button
                          ><button
                            class="text-button"
                            data-work="archive"
                            data-id="${esc(e.id)}"
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                      <section class="hero">
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
                              >⌖
                              ${esc(e.location || 'Location to be decided')}</span
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
                              >${money(e.budget / e.guests)} budget per
                              guest</span
                            >
                          </div>
                        </div>
                        <div class="stat">
                          <span class="stat-icon yellow">✓</span>
                          <div>
                            <small>Planning progress</small
                            ><strong
                              >${Math.round((done / (e.plan.tasks.length || 1)) * 100)}<em
                                >% complete</em
                              ></strong
                            ><span
                              >${done} of ${e.plan.tasks.length} tasks checked
                              off</span
                            ><progress
                              class="completion-track"
                              max="${e.plan.tasks.length || 1}"
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
                      ${undoMutation ? '<div class="undo-banner" role="status">Item removed. <button class="text-button" data-work="undo-remove">Undo</button></div>' : ''}
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
  if (view === 'new') openForm(false);
  restoreFocus();
}
function content(e, actual) {
  if (tab === 'Guests') return guestPanel(e);
  if (tab === 'Budget') return budgetPanel(e);
  if (tab === 'Timeline') return timelinePanel(e, taskFilter);
  if (tab === 'Vendors') return vendorPanel(e);
  if (tab === 'Assistant') return assistantPanel(e, chatBusy, status.mode);

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
        <h2>
          ${esc(e.plan.ideas[0]?.title || 'Make room for a personal touch')}
        </h2>
        <p>
          ${esc(e.plan.ideas[0]?.description || 'Explore ideas or generate a new plan.')}
        </p>
        <button class="text-button" data-tab="Ideas">
          Explore your ideas →
        </button>
      </section>
    </div>`;
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
              <button
                class="button secondary"
                data-work="idea-task"
                data-index="${i}"
              >
                ＋ Add to timeline
              </button>
            </article>`,
        )
        .join('')}
    </div>`;
}
function bind() {
  bindWorkspace();
  document.querySelectorAll('[data-tab]').forEach(
    (b) =>
      (b.onclick = () => {
        navigate(eventPath(active, b.dataset.tab));
      }),
  );
  document.querySelectorAll('[data-event]').forEach(
    (b) =>
      (b.onclick = () => {
        navigate(eventPath(b.dataset.event));
      }),
  );
  document.querySelectorAll('[data-action]').forEach(
    (b) =>
      (b.onclick = () => {
        const a = b.dataset.action;
        if (a === 'new') navigate('/events/new');
        if (a === 'edit') openForm(true);
        if (a === 'home') {
          navigate('/events');
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
  const d = edit ? $('#event-dialog') : $('#creation-page');
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
  if (edit) d.showModal();
  d.querySelector('.close').onclick = () =>
    edit ? d.close() : navigate('/events');
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
      view = 'event';
      tab = 'Overview';
    }
    save();
    if (edit) {
      d.close();
      render();
    } else navigate(eventPath(active));
    toast(edit ? 'Event details saved.' : 'Your celebration is ready to plan.');
  };
}
async function generate() {
  if (loading) return;
  const e = current();
  if (chatBusy) {
    toast('Please wait for the assistant to finish.');
    return;
  }
  loading = true;
  notice = '';
  const revision = JSON.stringify(validateEvent(e));
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
    if (JSON.stringify(validateEvent(e)) !== revision)
      throw new Error(
        'Event details changed while generating. Your existing plan was kept. Generate again with the updated details.',
      );
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
function bindWorkspace() {
  document.querySelectorAll('[data-work]').forEach(
    (button) =>
      (button.onclick = () => {
        const action = button.dataset.work,
          index = Number(button.dataset.index),
          e = current();
        if (action === 'toggle-archive') {
          showArchived = !showArchived;
          render();
        }
        if (action === 'archive') {
          const target = events.find((x) => x.id === button.dataset.id);
          target.archived = !target.archived;
          save();
          view = 'library';
          render();
          toast(
            target.archived
              ? 'Event archived. Restore it from View archived.'
              : 'Event restored.',
          );
        }
        if (action === 'duplicate') {
          const copy = structuredClone(e);
          copy.id = crypto.randomUUID();
          copy.name = e.name + ' (copy)';
          delete copy.previousPlan;
          events.unshift(copy);
          active = copy.id;
          save();
          render();
          toast('Event duplicated.');
        }
        if (action === 'backup') {
          download(
            'gather-backup.json',
            JSON.stringify({ version: 1, events }, null, 2),
            'application/json',
          );
          toast('Workspace backup downloaded.');
        }
        if (action === 'print') printPlan();
        if (action === 'calendar') {
          download('gather-timeline.ics', calendarText(e), 'text/calendar');
          toast('Calendar file downloaded.');
        }
        if (action === 'task-filter') {
          taskFilter = button.dataset.value;
          render();
        }
        if (action === 'prompt') {
          document.querySelector('#assistant-question').value =
            button.dataset.value;
          document.querySelector('#assistant-question').focus();
        }
        if (action === 'idea-task') {
          e.plan.tasks.push({
            title: e.plan.ideas[index].title,
            date: e.date,
            done: false,
            owner: '',
          });
          save();
          toast('Idea added to your timeline.');
        }
        if (action === 'undo-remove' && undoMutation) {
          undoMutation();
          undoMutation = null;
          save();
          render();
          toast('Item restored.');
        }
        const match = action.match(
          /^(add|edit|remove)-(guest|task|budget|vendor)$/,
        );
        if (!match) return;
        const [, operation, kind] = match;
        const rows =
          kind === 'guest'
            ? (e.guestList ||= [])
            : e.plan[
                { task: 'tasks', budget: 'budget', vendor: 'vendors' }[kind]
              ];
        if (operation === 'remove') {
          const removed = rows.splice(index, 1)[0];
          undoMutation = () => rows.splice(index, 0, removed);
          save();
          render();
          return;
        }
        editRecord(
          kind,
          operation === 'edit' ? rows[index] : {},
          e,
          (value) => {
            if (kind === 'task') value.done = Boolean(value.done);
            if (operation === 'edit') rows[index] = value;
            else rows.push(value);
            if (kind === 'task')
              rows.sort((a, b) => a.date.localeCompare(b.date));
            save();
            render();
            toast('Changes saved.');
          },
        );
      }),
  );
  document.querySelectorAll('[data-budget-name]').forEach(
    (input) =>
      (input.onchange = () => {
        if (!input.value.trim()) {
          toast('Category name is required.');
          render();
          return;
        }
        current().plan.budget[input.dataset.budgetName].category =
          input.value.trim();
        save();
      }),
  );
  const importer = document.querySelector('#import-backup');
  if (importer)
    importer.onchange = async () => {
      try {
        const file = importer.files[0];
        if (!file) return;
        if (file.size > 2000000)
          throw new Error('Backup must be smaller than 2 MB.');
        const data = JSON.parse(await file.text());
        if (
          data.version !== 1 ||
          !Array.isArray(data.events) ||
          data.events.length > 100 ||
          !data.events.every(isSavedEvent)
        )
          throw new Error('This is not a valid Gather backup.');
        const imported = data.events.map((e) => ({
          ...sanitizeSavedEvent(e),
          id: crypto.randomUUID(),
        }));
        events.push(...imported);
        save();
        render();
        toast(`${imported.length} events imported.`);
      } catch (error) {
        toast(error.message || 'Could not import backup.');
      }
    };
  const form = document.querySelector('#assistant-form');
  if (form)
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      if (chatBusy || loading) {
        toast('Please wait for the current AI request.');
        return;
      }
      const question = new FormData(form).get('question').trim();
      if (!question) return;
      const e = current();
      const history = (e.messages || [])
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 2500) }));
      (e.messages ||= []).push({ role: 'user', text: question });
      chatBusy = true;
      save();
      render();
      try {
        const response = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: validateEvent(e), question, history }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        e.messages.push({
          role: 'assistant',
          text: data.answer,
          source: data.source,
        });
        save();
      } catch (error) {
        notice = error.message || 'Could not reach the assistant.';
      } finally {
        chatBusy = false;
        render();
        document.querySelector('#assistant-question')?.focus();
      }
    };
}
function sanitizeSavedEvent(e) {
  const clean = {
    ...validateEvent(e),
    id: e.id,
    source: e.source === 'gemini' ? 'gemini' : 'demo',
    archived: Boolean(e.archived),
    plan: {
      summary: e.plan.summary,
      budget: e.plan.budget.map((b) => ({
        category: b.category,
        planned: b.planned,
        actual: b.actual,
      })),
      tasks: e.plan.tasks.map((t) => ({
        title: t.title,
        date: t.date,
        done: Boolean(t.done),
        owner: typeof t.owner === 'string' ? t.owner : '',
      })),
      vendors: e.plan.vendors.map((v) => ({
        category: v.category,
        name: typeof v.name === 'string' ? v.name : '',
        status: [
          'To research',
          'Contacted',
          'Quote received',
          'Booked',
        ].includes(v.status)
          ? v.status
          : 'To research',
        notes: v.notes,
        contact: typeof v.contact === 'string' ? v.contact : '',
        quote: Number.isFinite(v.quote) && v.quote >= 0 ? v.quote : 0,
        deposit: Number.isFinite(v.deposit) && v.deposit >= 0 ? v.deposit : 0,
      })),
      ideas: e.plan.ideas.map((i) => ({
        title: i.title,
        description: i.description,
      })),
    },
  };
  clean.guestList = Array.isArray(e.guestList)
    ? e.guestList
        .filter(
          (g) =>
            g &&
            typeof g.name === 'string' &&
            Number.isInteger(g.partySize) &&
            g.partySize > 0 &&
            g.partySize <= 1000,
        )
        .map((g) => ({
          name: g.name,
          contact: typeof g.contact === 'string' ? g.contact : '',
          partySize: g.partySize,
          rsvp: ['Pending', 'Confirmed', 'Declined'].includes(g.rsvp)
            ? g.rsvp
            : 'Pending',
          notes: typeof g.notes === 'string' ? g.notes : '',
        }))
    : [];
  clean.messages = Array.isArray(e.messages)
    ? e.messages
        .filter(
          (m) =>
            m &&
            ['user', 'assistant'].includes(m.role) &&
            typeof m.text === 'string',
        )
        .slice(-30)
        .map((m) => ({
          role: m.role,
          text: m.text,
          source: m.source === 'gemini' ? 'gemini' : 'demo',
        }))
    : [];
  return clean;
}
function planText(e) {
  const guests = e.guestList || [];
  return [
    e.name,
    `${e.type} · ${date(e.date)} · ${e.location}`,
    `${e.guests} planned guests · Budget: ${money(e.budget, e)}`,
    `Plan source: ${e.source === 'gemini' ? 'Gemini' : 'Demo template'}`,
    e.plan.summary,
    'BUDGET',
    ...e.plan.budget.map(
      (b) =>
        `${b.category}: ${money(b.planned, e)} planned / ${money(b.actual, e)} actual`,
    ),
    'TIMELINE',
    ...e.plan.tasks.map(
      (t) =>
        `[${t.done ? 'x' : ' '}] ${t.date} — ${t.title}${t.owner ? ' (Owner: ' + t.owner + ')' : ''}`,
    ),
    'VENDORS',
    ...e.plan.vendors.map(
      (v) =>
        `${v.category}: ${v.name || 'Not selected'} (${v.status})\nQuote: ${money(v.quote || 0, e)} / Deposit: ${money(v.deposit || 0, e)}\n${v.notes}`,
    ),
    'GUEST SUMMARY',
    `${guests.reduce((n, g) => n + g.partySize, 0)} invited people; ${guests.filter((g) => g.rsvp === 'Confirmed').reduce((n, g) => n + g.partySize, 0)} confirmed people. Guest contact details excluded.`,
    'IDEAS',
    ...e.plan.ideas.map((i) => `${i.title}\n${i.description}`),
    'Planning estimates only. Confirm costs and arrangements with your vendors.',
  ].join('\n\n');
}
function exportPlan() {
  download('gather-event-plan.txt', planText(current()));
  toast('Complete plan exported.');
}
function printPlan() {
  document.querySelector('#print-report')?.remove();
  const report = document.createElement('section');
  report.id = 'print-report';
  const pre = document.createElement('pre');
  pre.textContent = planText(current());
  report.append(pre);
  document.body.append(report);
  window.print();
}

applyRoute();
fetch('/api/status')
  .then((r) => r.json())
  .then((s) => {
    status = s;
    if (!$('#event-dialog')?.open && view !== 'new') render();
  })
  .catch(() => toast('Server unavailable. Your saved plans are still here.'));

import { escapeHtml as esc, daysUntil } from './ui-utils.js';
const html = (parts, ...values) =>
  parts.reduce((out, part, i) => out + part + (values[i] ?? ''), '');
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && parsed.toISOString().slice(0, 10) === value;
}
const cash = (n, e) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: e.currency,
    maximumFractionDigits: 0,
  }).format(n);
const empty = (title, text) =>
  html`<div class="empty-state">
    <span aria-hidden="true">✧</span>
    <h3>${title}</h3>
    <p>${text}</p>
  </div>`;
export function library(events, archived = false) {
  const visible = events.filter((e) => Boolean(e.archived) === archived);
  return html`<div class="library-toolbar">
      <div>
        <div class="eyebrow">YOUR CELEBRATIONS, ALL TOGETHER</div>
        <h2>
          ${archived ? 'The memory box' : 'A little space for every occasion.'}
        </h2>
      </div>
      <div class="action-group">
        <button class="button secondary" data-work="toggle-archive">
          ${archived ? 'Active events' : 'View archived'}</button
        ><button class="button secondary" data-work="backup">↓ Backup</button
        ><label class="button secondary file-button"
          >↑ Import<input
            id="import-backup"
            type="file"
            accept="application/json,.json"
            aria-label="Import a Gather backup"
        /></label>
      </div>
    </div>
    <div class="event-grid">
      ${visible
        .map(
          (e) =>
            html`<article class="event-card ${e.type.toLowerCase()}">
              <div class="event-card-art" aria-hidden="true">
                ${e.type === 'Wedding' ? '♡' : e.type === 'Birthday' ? '✳' : '☀'}
              </div>
              <div class="event-card-body">
                <div class="eyebrow">${esc(e.type)} · ${esc(e.date)}</div>
                <h2>${esc(e.name)}</h2>
                <p>${esc(e.location)} · ${e.guests} planned guests</p>
                <div class="event-card-stats">
                  <span>${cash(e.budget, e)}</span
                  ><span
                    >${daysUntil(e.date) >= 0 ? `${daysUntil(e.date)} days to go` : 'Past celebration'}</span
                  >
                </div>
                <div class="action-group">
                  <button class="button primary" data-event="${esc(e.id)}">
                    Open plan →</button
                  ><button
                    class="text-button"
                    data-work="archive"
                    data-id="${esc(e.id)}"
                  >
                    ${archived ? 'Restore' : 'Archive'}
                  </button>
                </div>
              </div>
            </article>`,
        )
        .join('')}<button class="event-card new-event-card" data-action="new">
        <span>＋</span>
        <h2>Make a new memory.</h2>
        <p>Wedding, birthday, or community gathering</p>
      </button>
    </div>
    ${visible.length ? '' : empty(archived ? 'No archived celebrations yet' : 'Your next good thing starts here', archived ? 'Archive a celebration to keep it here.' : 'Create an event to turn your ideas into a plan.')}
    <div class="card library-help">
      <h3>Your workspace stays yours.</h3>
      <p>
        Events are saved in this browser. Download a backup to move your plans
        to another device. Imports add events without overwriting existing work.
      </p>
    </div>`;
}
export function guestPanel(e) {
  const guests = e.guestList || [];
  const confirmed = guests
    .filter((g) => g.rsvp === 'Confirmed')
    .reduce((n, g) => n + g.partySize, 0);
  const invited = guests.reduce((n, g) => n + g.partySize, 0);
  return html`<div class="section-heading">
      <div>
        <div class="eyebrow">THE PEOPLE MAKE THE PARTY</div>
        <h2>A seat for everyone.</h2>
        <p>
          Track invitations, RSVPs, and the details that make guests feel
          welcome.
        </p>
      </div>
      <button class="button primary" data-work="add-guest">＋ Add guest</button>
    </div>
    <div class="mini-stats">
      <div><strong>${invited}</strong><span>Invited people</span></div>
      <div><strong>${confirmed}</strong><span>Confirmed people</span></div>
      <div><strong>${e.guests}</strong><span>Planned capacity</span></div>
    </div>
    ${invited > e.guests ? '<p class="notice">Your invited headcount exceeds the planned capacity. Update the event details or guest list.</p>' : ''}
    <section class="card">
      ${
        guests.length
          ? html`<div class="table-wrap">
              <table>
                <caption class="sr-only">
                  Guest list and RSVP status
                </caption>
                <thead>
                  <tr>
                    <th>Name & contact</th>
                    <th>Party size</th>
                    <th>RSVP</th>
                    <th>Dietary / access notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${guests
                    .map(
                      (g, i) =>
                        html`<tr>
                          <td>
                            <strong>${esc(g.name)}</strong
                            ><small class="cell-note">${esc(g.contact)}</small>
                          </td>
                          <td>${g.partySize}</td>
                          <td>
                            <span class="status-pill">${esc(g.rsvp)}</span>
                          </td>
                          <td>${esc(g.notes) || '—'}</td>
                          <td>
                            <div class="action-group">
                              <button
                                class="text-button"
                                data-work="edit-guest"
                                data-index="${i}"
                                aria-label="Edit ${esc(g.name)}"
                              >
                                Edit</button
                              ><button
                                class="text-button danger"
                                data-work="remove-guest"
                                data-index="${i}"
                                aria-label="Remove ${esc(g.name)}"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>`,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
          : empty(
              'Your favorite people belong here.',
              'Add your first guest to start tracking RSVPs.',
            )
      }
      <p class="card-note">
        Guest names and contact details stay in your browser and are excluded
        from AI requests. Invitations are tracked here; no messages are sent.
      </p>
    </section>`;
}
export function budgetPanel(e) {
  const total = e.plan.budget.reduce((n, b) => n + b.planned, 0);
  const spent = e.plan.budget.reduce((n, b) => n + b.actual, 0);
  return html`<div class="section-heading">
      <div>
        <div class="eyebrow">ROOM FOR WHAT MATTERS</div>
        <h2>Make every detail count.</h2>
        <p>Keep estimates and actual costs in balance.</p>
      </div>
      <button class="button primary" data-work="add-budget">
        ＋ Add category
      </button>
    </div>
    <div class="mini-stats">
      <div><strong>${cash(e.budget, e)}</strong><span>Total budget</span></div>
      <div><strong>${cash(spent, e)}</strong><span>Actual spending</span></div>
      <div>
        <strong class="${total > e.budget ? 'danger' : ''}"
          >${cash(e.budget - total, e)}</strong
        ><span>Unallocated budget</span>
      </div>
    </div>
    ${spent > e.budget ? '<p class="notice">Spending exceeds your event budget. Review actual costs or adjust the total budget in event details.</p>' : ''}
    <section class="card">
      <div class="table-wrap">
        <table>
          <caption class="sr-only">
            Budget estimates and actual costs
          </caption>
          <thead>
            <tr>
              <th>Category</th>
              <th>Planned</th>
              <th>Actual cost</th>
              <th>Remaining</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${e.plan.budget
              .map(
                (b, i) =>
                  html`<tr>
                    <td>
                      <input
                        aria-label="Category name ${i + 1}"
                        value="${esc(b.category)}"
                        data-budget-name="${i}"
                        maxlength="100"
                        required
                      />
                    </td>
                    <td>
                      <input
                        class="cost"
                        type="number"
                        min="0"
                        max="10000000000"
                        step="1"
                        value="${b.planned}"
                        data-budget="${i}"
                        data-field="planned"
                        aria-label="${esc(b.category)} planned cost"
                      />
                    </td>
                    <td>
                      <input
                        class="cost"
                        type="number"
                        min="0"
                        max="10000000000"
                        step="1"
                        value="${b.actual}"
                        data-budget="${i}"
                        data-field="actual"
                        aria-label="${esc(b.category)} actual cost"
                      />
                    </td>
                    <td class="${b.actual > b.planned ? 'danger' : ''}">
                      ${cash(b.planned - b.actual, e)}
                    </td>
                    <td>
                      <button
                        class="text-button danger"
                        data-work="remove-budget"
                        data-index="${i}"
                        aria-label="Remove ${esc(b.category)}"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      ${e.plan.budget.length ? '' : empty('A fresh budget canvas', 'Add a category to start allocating your budget.')}
      <p class="card-note">
        All amounts are in ${e.currency}. A negative remaining amount means that
        category is over budget. Keep a contingency for unexpected costs.
      </p>
    </section>`;
}
export function timelinePanel(e, filter = 'All') {
  const rows = e.plan.tasks
    .map((t, i) => ({ ...t, index: i }))
    .filter(
      (t) => filter === 'All' || (filter === 'Complete' ? t.done : !t.done),
    );
  return html`<div class="section-heading">
      <div>
        <div class="eyebrow">ONE STEP CLOSER</div>
        <h2>From first idea to final toast.</h2>
        <p>
          Edit dates, assign responsibilities, and celebrate every checked box.
        </p>
      </div>
      <div class="action-group">
        <button class="button secondary" data-work="calendar">↓ Calendar</button
        ><button class="button primary" data-work="add-task">
          ＋ Add task
        </button>
      </div>
    </div>
    <div class="filter-row" aria-label="Filter tasks">
      ${['All', 'Pending', 'Complete'].map((f) => html`<button class="filter-chip ${filter === f ? 'active' : ''}" data-work="task-filter" data-value="${f}" aria-pressed="${filter === f}">${f}</button>`).join('')}
    </div>
    <section class="card">
      ${
        rows
          .map(
            (t) =>
              html`<div class="timeline-row ${t.done ? 'complete' : ''}">
                <label class="task"
                  ><input
                    type="checkbox"
                    data-task="${t.index}"
                    ${t.done ? 'checked' : ''}
                  /><span
                    >${esc(t.title)}<small
                      >${esc(t.date)} ·
                      ${esc(t.owner || 'Unassigned')}${!t.done && daysUntil(t.date) < 0 ? ' · Overdue' : ''}</small
                    ></span
                  ></label
                >
                <div class="action-group">
                  <button
                    class="text-button"
                    data-work="edit-task"
                    data-index="${t.index}"
                    aria-label="Edit ${esc(t.title)}"
                  >
                    Edit</button
                  ><button
                    class="text-button danger"
                    data-work="remove-task"
                    data-index="${t.index}"
                    aria-label="Remove ${esc(t.title)}"
                  >
                    Remove
                  </button>
                </div>
              </div>`,
          )
          .join('') ||
        empty(
          'All clear here.',
          filter === 'Pending'
            ? 'You’ve completed every task. Time to celebrate!'
            : 'Add a task or choose another filter.',
        )
      }
      <p class="card-note">
        Calendar export downloads an .ics file that you can import into Google
        Calendar, Apple Calendar, or Outlook. It does not send invitations.
      </p>
    </section>`;
}
export function vendorPanel(e) {
  return html`<div class="section-heading">
      <div>
        <div class="eyebrow">GOOD PEOPLE, GREAT CELEBRATIONS</div>
        <h2>Your celebration team.</h2>
        <p>Compare options, track quotes, and keep booking details close.</p>
      </div>
      <button class="button primary" data-work="add-vendor">
        ＋ Add vendor
      </button>
    </div>
    <div class="vendor-grid">
      ${e.plan.vendors
        .map(
          (v, i) =>
            html`<section class="card vendor-card">
              <div class="section-heading">
                <span class="eyebrow">${esc(v.category)}</span
                ><span class="status-pill">${esc(v.status)}</span>
              </div>
              <h2>
                ${esc(v.name || 'Find your ' + v.category.toLowerCase() + ' partner')}
              </h2>
              <p>${esc(v.contact || 'Contact details not added')}</p>
              <div class="vendor-amounts">
                <span>Quote <strong>${cash(v.quote || 0, e)}</strong></span
                ><span
                  >Deposit paid
                  <strong>${cash(v.deposit || 0, e)}</strong></span
                >
              </div>
              <p class="preserve-lines">${esc(v.notes)}</p>
              <div class="action-group">
                <button
                  class="button secondary"
                  data-work="edit-vendor"
                  data-index="${i}"
                >
                  Edit details</button
                ><button
                  class="text-button danger"
                  data-work="remove-vendor"
                  data-index="${i}"
                  aria-label="Remove ${esc(v.name || v.category)}"
                >
                  Remove
                </button>
              </div>
            </section>`,
        )
        .join('')}
    </div>
    ${e.plan.vendors.length ? '' : empty('Build your dream team.', 'Add a vendor category or a business you’re considering.')}
    <p class="card-note">
      Quotes and deposits are vendor records, not payments. Update the Budget
      tab separately when an expense is incurred.
    </p>`;
}
export function assistantPanel(e, busy, mode) {
  return html`<div class="section-heading">
      <div>
        <div class="eyebrow">YOUR CREATIVE CO-PILOT</div>
        <h2>Let’s figure out the little things.</h2>
        <p>
          Ask about your event, refine an idea, or work through a planning
          problem.
        </p>
      </div>
      <span class="status-pill"
        >${mode === 'gemini' ? 'Gemini' : 'Demo guidance'}</span
      >
    </div>
    <section class="card assistant-card">
      <div class="chat-messages" aria-live="polite" aria-relevant="additions">
        ${
          (e.messages || [])
            .map(
              (m) =>
                html`<article class="chat-message ${m.role}">
                  <strong
                    >${m.role === 'user' ? 'You' : 'Gather'}${m.source === 'demo' ? ' · Demo' : ''}</strong
                  >
                  <p class="preserve-lines">${esc(m.text)}</p>
                </article>`,
            )
            .join('') ||
          html`<div class="assistant-welcome">
            <span aria-hidden="true">✧</span>
            <h2>A thoughtful second pair of hands.</h2>
            <p>
              I know your event details and can help you make a plan that fits.
            </p>
            <div class="prompt-chips">
              ${['How can I reduce costs without losing the experience?', 'Suggest an event-day schedule.', 'What should I ask my caterer?'].map((q) => html`<button class="filter-chip" data-work="prompt" data-value="${esc(q)}">${esc(q)}</button>`).join('')}
            </div>
          </div>`
        }${busy ? '<p class="thinking" role="status">Gather is thinking…</p>' : ''}
      </div>
      <form id="assistant-form">
        <label for="assistant-question" class="sr-only"
          >Ask your planning assistant</label
        ><textarea
          id="assistant-question"
          name="question"
          maxlength="1500"
          rows="2"
          placeholder="e.g. How can we make this celebration more accessible?"
          required
          ${busy ? 'disabled' : ''}
        ></textarea
        ><button class="button primary" ${busy ? 'disabled' : ''}>
          ${busy ? 'Thinking…' : 'Ask Gather ↗'}
        </button>
      </form>
      <p class="card-note">
        ${mode === 'gemini' ? 'Your question, recent conversation, and event brief are sent to Gemini. Guest lists and vendor contact details are excluded.' : 'Demo guidance uses local templates. Configure your Gemini key for personalized answers.'}
        Advice does not change your plan automatically.
      </p>
    </section>`;
}

export function download(name, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function calendarText(event) {
  const safe = (s) =>
    String(s)
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gather//Event Planner//EN',
    'CALSCALE:GREGORIAN',
    ...event.plan.tasks.flatMap((t, i) => [
      'BEGIN:VEVENT',
      `UID:${safe(event.id)}-${i}@gather.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${t.date.replaceAll('-', '')}`,
      `SUMMARY:${safe(t.title)}`,
      `DESCRIPTION:${safe(event.name)}${t.owner ? ' — ' + safe(t.owner) : ''}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** Shared modal editor. Native dialog provides focus trapping and Escape handling. */
export function editRecord(kind, record, event, onSave) {
  const dialog = document.querySelector('#event-dialog');
  const input = (name, label, value = '', type = 'text', extra = '') =>
    html`<label
      >${label}<input
        name="${name}"
        type="${type}"
        value="${esc(value)}"
        ${extra}
    /></label>`;
  const select = (name, label, choices, value) =>
    html`<label
      >${label}<select name="${name}">
        ${choices.map((c) => html`<option ${c === value ? 'selected' : ''}>${c}</option>`).join('')}
      </select></label
    >`;
  let fields = '';
  if (kind === 'guest')
    fields =
      input(
        'name',
        'Guest name',
        record.name,
        'text',
        'required maxlength="100"',
      ) +
      input(
        'contact',
        'Email or phone (optional)',
        record.contact,
        'text',
        'maxlength="200"',
      ) +
      input(
        'partySize',
        'Party size',
        record.partySize || 1,
        'number',
        'min="1" max="1000" required',
      ) +
      select(
        'rsvp',
        'RSVP',
        ['Pending', 'Confirmed', 'Declined'],
        record.rsvp,
      ) +
      input(
        'notes',
        'Dietary / accessibility notes',
        record.notes,
        'text',
        'maxlength="1000"',
      );
  if (kind === 'task')
    fields =
      input('title', 'Task', record.title, 'text', 'required maxlength="200"') +
      input(
        'date',
        'Due date',
        record.date || event.date,
        'date',
        `required max="${event.date}"`,
      ) +
      input(
        'owner',
        'Assigned to (optional)',
        record.owner,
        'text',
        'maxlength="100"',
      );
  if (kind === 'budget')
    fields =
      input(
        'category',
        'Category name',
        record.category,
        'text',
        'required maxlength="100"',
      ) +
      input(
        'planned',
        'Planned amount',
        record.planned || 0,
        'number',
        'min="0" max="10000000000" required',
      ) +
      input(
        'actual',
        'Actual amount',
        record.actual || 0,
        'number',
        'min="0" max="10000000000" required',
      );
  if (kind === 'vendor')
    fields =
      input(
        'category',
        'Service category',
        record.category,
        'text',
        'required maxlength="100"',
      ) +
      input('name', 'Business name', record.name, 'text', 'maxlength="200"') +
      input(
        'contact',
        'Contact details',
        record.contact,
        'text',
        'maxlength="200"',
      ) +
      select(
        'status',
        'Booking status',
        ['To research', 'Contacted', 'Quote received', 'Booked'],
        record.status,
      ) +
      input(
        'quote',
        'Quoted amount',
        record.quote || 0,
        'number',
        'min="0" max="10000000000" required',
      ) +
      input(
        'deposit',
        'Deposit paid',
        record.deposit || 0,
        'number',
        'min="0" max="10000000000" required',
      ) +
      html`<label
        >Checklist & notes<textarea name="notes" rows="4" maxlength="3000">
${esc(record.notes)}</textarea>
      </label>`;
  dialog.innerHTML = html`<form id="record-form">
    <div class="section-heading">
      <h2 id="dialog-title">
        ${Object.keys(record).length ? 'Edit' : 'Add'} ${kind}
      </h2>
      <button type="button" class="close" aria-label="Close dialog">×</button>
    </div>
    <div class="record-fields">${fields}</div>
    <p id="record-error" class="danger" role="alert"></p>
    <button class="button primary full">Save ${kind}</button>
  </form>`;
  dialog.showModal();
  dialog.querySelector('.close').onclick = () => dialog.close();
  dialog.querySelector('form').onsubmit = (ev) => {
    ev.preventDefault();
    const value = Object.fromEntries(new FormData(ev.target));
    for (const key of ['partySize', 'planned', 'actual', 'quote', 'deposit'])
      if (key in value) value[key] = Number(value[key]);
    if (
      (value.name !== undefined && kind === 'guest' && !value.name.trim()) ||
      (value.title !== undefined && !value.title.trim()) ||
      (value.category !== undefined && !value.category.trim()) ||
      (value.date && !validDate(value.date))
    ) {
      dialog.querySelector('#record-error').textContent =
        'Please complete all required fields with valid values.';
      return;
    }
    dialog.close();
    onSave({ ...record, ...value });
  };
}

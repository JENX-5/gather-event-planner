import test from 'node:test';
import { eventPath, resolveRoute } from '../public/router.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { demoPlan, validateEvent, validDate } from '../planner.js';
import { escapeHtml, daysUntil, captureFocus } from '../public/ui-utils.js';

async function mount(saved) {
  const dom = new JSDOM(
    '<div id="app"></div><div id="toast" role="status"></div>',
    {
      url: 'http://localhost:3000/events/sample/overview',
      runScripts: 'outside-only',
    },
  );
  const { window } = dom;
  window.helpers = {
    eventPath,
    resolveRoute,
    demoPlan,
    validateEvent,
    validDate,
    esc: escapeHtml,
    daysUntil,
    captureFocus,
  };
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  window.scrollTo = () => {};
  window.structuredClone = structuredClone;
  window.fetch = async () => ({ json: async () => ({ mode: 'demo' }) });
  if (saved)
    window.localStorage.setItem('gather.events.v1', JSON.stringify(saved));
  const source = (
    await readFile(new URL('../public/app.js', import.meta.url), 'utf8')
  ).replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
  const workspace = (
    await readFile(new URL('../public/workspace.js', import.meta.url), 'utf8')
  )
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
    .replaceAll('export function ', 'function ');
  const names =
    'library,guestPanel,budgetPanel,timelinePanel,vendorPanel,assistantPanel,download,calendarText,editRecord';
  window.eval(
    'const {eventPath,resolveRoute,demoPlan, validateEvent, validDate, esc, daysUntil, captureFocus} = window.helpers;\n' +
      `const {${names}} = (()=>{${workspace}; return {${names}};})();\n` +
      source,
  );
  await new Promise((resolve) => setImmediate(resolve));
  return dom;
}

test('dashboard renders all sections and navigates them', async () => {
  const dom = await mount();
  try {
    const d = dom.window.document;
    assert.match(d.querySelector('h1').textContent, /Good things/);
    assert.ok(d.querySelector('.skip-link'));
    assert.equal(d.querySelectorAll('progress').length, 7);
    for (const section of [
      'Budget',
      'Timeline',
      'Vendors',
      'Ideas',
      'Guests',
      'Assistant',
      'Overview',
    ]) {
      d.querySelector(`.tab[data-tab="${section}"]`).click();
      assert.equal(
        d.querySelector('.tab[aria-current="page"]').textContent,
        section,
      );
      assert.ok(d.querySelector('#content').textContent.length > 50);
    }
  } finally {
    dom.window.close();
  }
});

test('task toggling saves state and preserves keyboard focus', async () => {
  const dom = await mount();
  try {
    const d = dom.window.document;
    const checkbox = d.querySelector('[data-task="0"]');
    checkbox.focus();
    checkbox.click();
    assert.equal(d.activeElement.dataset.task, '0');
    const saved = JSON.parse(
      dom.window.localStorage.getItem('gather.events.v1'),
    );
    assert.equal(saved[0].plan.tasks[0].done, true);
    assert.equal(d.querySelector('.completion-track').value, 1);
  } finally {
    dom.window.close();
  }
});

test('budget edits update totals and vendor details persist', async () => {
  const dom = await mount();
  try {
    const { document: d, Event } = dom.window;
    d.querySelector('.tab[data-tab="Budget"]').click();
    const cost = d.querySelector('[data-budget="0"][data-field="actual"]');
    cost.value = '100000';
    cost.dispatchEvent(new Event('change'));
    assert.match(d.querySelector('.stats').textContent, /over budget/);
    d.querySelector('.tab[data-tab="Vendors"]').click();
    d.querySelector('[data-work="edit-vendor"]').click();
    const form = d.querySelector('#record-form');
    form.elements.namedItem('name').value = 'Garden Venue';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    const saved = JSON.parse(
      dom.window.localStorage.getItem('gather.events.v1'),
    );
    assert.equal(saved[0].plan.budget[0].actual, 100000);
    assert.equal(saved[0].plan.vendors[0].name, 'Garden Venue');
  } finally {
    dom.window.close();
  }
});

test('create-event form adds a personalized event safely', async () => {
  const dom = await mount();
  try {
    const d = dom.window.document;
    d.querySelector('[data-action="new"]').click();
    const form = d.querySelector('#event-form');
    form.elements.namedItem('name').value = '<img src=x onerror=alert(1)>';
    form.elements.namedItem('location').value = 'Pune';
    form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    assert.equal(d.querySelectorAll('.event-link').length, 2);
    assert.equal(
      d.querySelector('.hero h2').textContent,
      '<img src=x onerror=alert(1)>',
    );
    assert.equal(d.querySelectorAll('img').length, 0);
  } finally {
    dom.window.close();
  }
});

test('corrupt saved events recover to a usable demo', async () => {
  const dom = await mount([{ id: 'bad', plan: { tasks: [] } }]);
  try {
    assert.ok(dom.window.document.querySelector('.hero'));
  } finally {
    dom.window.close();
  }
});

test('escaping and countdown handle edge cases', () => {
  assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
  assert.equal(daysUntil('2027-01-01', new Date(2026, 11, 31, 23, 59)), 1);
  assert.equal(validDate('2027-02-29'), false);
  assert.equal(validDate('2028-02-29'), true);
});

test('event library supports duplicate, archive, and restore', async () => {
  const dom = await mount();
  try {
    const d = dom.window.document;
    d.querySelector('[data-work="duplicate"]').click();
    assert.equal(d.querySelectorAll('.event-link').length, 2);
    d.querySelector('[data-work="archive"]').click();
    assert.equal(d.querySelectorAll('.event-card-body').length, 1);
    d.querySelector('[data-work="toggle-archive"]').click();
    assert.equal(d.querySelectorAll('.event-card-body').length, 1);
    d.querySelector('[data-work="archive"]').click();
    d.querySelector('[data-work="toggle-archive"]').click();
    assert.equal(d.querySelectorAll('.event-card-body').length, 2);
  } finally {
    dom.window.close();
  }
});

test('guest RSVP workflow supports add, edit, remove, and undo', async () => {
  const dom = await mount();
  try {
    const d = dom.window.document;
    d.querySelector('[data-tab="Guests"]').click();
    d.querySelector('[data-work="add-guest"]').click();
    let form = d.querySelector('#record-form');
    form.elements.namedItem('name').value = 'Alex';
    form.elements.namedItem('partySize').value = '3';
    form.elements.namedItem('rsvp').value = 'Confirmed';
    form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    assert.match(d.querySelector('#content').textContent, /Alex/);
    assert.equal(
      JSON.parse(dom.window.localStorage.getItem('gather.events.v1'))[0]
        .guestList[0].partySize,
      3,
    );
    d.querySelector('[data-work="edit-guest"]').click();
    form = d.querySelector('#record-form');
    form.elements.namedItem('rsvp').value = 'Declined';
    form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    assert.match(d.querySelector('.status-pill').textContent, /Declined/);
    d.querySelector('[data-work="remove-guest"]').click();
    assert.equal(d.querySelectorAll('[data-work="edit-guest"]').length, 0);
    d.querySelector('[data-work="undo-remove"]').click();
    assert.equal(d.querySelectorAll('[data-work="edit-guest"]').length, 1);
  } finally {
    dom.window.close();
  }
});

test('task and budget CRUD remain usable when every row is removed', async () => {
  const dom = await mount();
  try {
    const d = dom.window.document;
    d.querySelector('[data-tab="Timeline"]').click();
    while (d.querySelector('[data-work="remove-task"]'))
      d.querySelector('[data-work="remove-task"]').click();
    assert.ok(!d.querySelector('.stats').textContent.includes('NaN'));
    d.querySelector('[data-work="add-task"]').click();
    let form = d.querySelector('#record-form');
    form.elements.namedItem('title').value = 'Prepare welcome table';
    form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    assert.equal(d.querySelectorAll('.timeline-row').length, 1);
    d.querySelector('[data-tab="Budget"]').click();
    while (d.querySelector('[data-work="remove-budget"]'))
      d.querySelector('[data-work="remove-budget"]').click();
    d.querySelector('[data-work="add-budget"]').click();
    form = d.querySelector('#record-form');
    form.elements.namedItem('category').value = 'Gifts';
    form.elements.namedItem('planned').value = '5000';
    form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    assert.equal(d.querySelectorAll('[data-budget-name]').length, 1);
  } finally {
    dom.window.close();
  }
});

test('assistant sends only the brief and conversation, and displays the answer', async () => {
  const dom = await mount();
  try {
    const d = dom.window.document;
    let payload;
    dom.window.fetch = async (_url, options) => {
      payload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ answer: 'Use seasonal flowers.', source: 'demo' }),
      };
    };
    d.querySelector('[data-tab="Assistant"]').click();
    d.querySelector('#assistant-question').value = 'How do I save money?';
    d.querySelector('#assistant-form').dispatchEvent(
      new dom.window.Event('submit', { cancelable: true }),
    );
    await new Promise((r) => setImmediate(r));
    assert.match(
      d.querySelector('.chat-messages').textContent,
      /Use seasonal flowers/,
    );
    assert.ok(!('guestList' in payload.event));
    assert.ok(!('vendors' in payload.event));
  } finally {
    dom.window.close();
  }
});

test('page navigation updates URLs and handles history and missing event links', async () => {
  const dom = await mount();
  try {
    const { document: d, history } = dom.window;
    d.querySelector('[data-tab="Budget"]').click();
    assert.equal(dom.window.location.pathname, '/events/sample/budget');
    assert.match(d.title, /Budget/);
    history.replaceState({}, '', '/events/sample/guests');
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
    assert.ok(d.querySelector('[data-work="add-guest"]'));
    history.replaceState({}, '', '/events/unknown/overview');
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
    assert.match(d.body.textContent, /isn’t on this device/);
    d.querySelector('[data-action="home"]').click();
    assert.equal(dom.window.location.pathname, '/events');
    d.querySelector('[data-action="new"]').click();
    assert.equal(dom.window.location.pathname, '/events/new');
    assert.ok(d.querySelector('#creation-page #event-form'));
    assert.equal(d.querySelector('dialog').open, false);
  } finally {
    dom.window.close();
  }
});

test('backup import validates data and gives imported events fresh IDs', async () => {
  const dom = await mount();
  try {
    const d = dom.window.document;
    d.querySelector('[data-task]').click();
    const events = JSON.parse(
      dom.window.localStorage.getItem('gather.events.v1'),
    );
    d.querySelector('[data-action="home"]').click();
    const input = d.querySelector('#import-backup');
    Object.defineProperty(input, 'files', {
      value: [
        { size: 100, text: async () => JSON.stringify({ version: 1, events }) },
      ],
    });
    input.dispatchEvent(new dom.window.Event('change'));
    await new Promise((r) => setImmediate(r));
    const saved = JSON.parse(
      dom.window.localStorage.getItem('gather.events.v1'),
    );
    assert.equal(saved.length, 2);
    assert.notEqual(saved[0].id, saved[1].id);
  } finally {
    dom.window.close();
  }
});

test('print includes the entire plan from any section', async () => {
  const dom = await mount();
  try {
    const d = dom.window.document;
    let printed = false;
    dom.window.print = () => {
      printed = true;
    };
    d.querySelector('[data-tab="Guests"]').click();
    d.querySelector('[data-work="print"]').click();
    assert.equal(printed, true);
    const text = d.querySelector('#print-report').textContent;
    for (const heading of [
      'BUDGET',
      'TIMELINE',
      'VENDORS',
      'GUEST SUMMARY',
      'IDEAS',
    ])
      assert.ok(text.includes(heading));
  } finally {
    dom.window.close();
  }
});

test('browser modules use resolvable relative imports for Vercel builds', async () => {
  for (const file of ['app.js', 'workspace.js', 'router.js', 'ui-utils.js']) {
    const source = await readFile(
      new URL(`../public/${file}`, import.meta.url),
      'utf8',
    );
    for (const [, specifier] of source.matchAll(/from\\s+['"]([^'"]+)['"]/g)) {
      assert.ok(
        !specifier.startsWith('/'),
        `${file} has an unresolved root-absolute module import: ${specifier}`,
      );
      const resolved = new URL(
        specifier,
        new URL(`../public/${file}`, import.meta.url),
      );
      await readFile(resolved, 'utf8');
    }
  }
});

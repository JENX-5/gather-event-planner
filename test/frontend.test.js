import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { demoPlan, validateEvent, validDate } from '../planner.js';
import { escapeHtml, daysUntil, captureFocus } from '../public/ui-utils.js';

async function mount(saved) {
  const dom = new JSDOM(
    '<div id="app"></div><div id="toast" role="status"></div>',
    { url: 'http://localhost:3000', runScripts: 'outside-only' },
  );
  const { window } = dom;
  window.helpers = {
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
  window.fetch = async () => ({ json: async () => ({ mode: 'demo' }) });
  if (saved)
    window.localStorage.setItem('gather.events.v1', JSON.stringify(saved));
  const source = (
    await readFile(new URL('../public/app.js', import.meta.url), 'utf8')
  ).replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
  window.eval(
    'const {demoPlan, validateEvent, validDate, esc, daysUntil, captureFocus} = window.helpers;\n' +
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
    const name = d.querySelector('[data-vendor="0"][data-field="name"]');
    name.value = 'Garden Venue';
    name.dispatchEvent(new Event('change'));
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

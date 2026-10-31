import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPlan, validateEvent, normalizePlan } from '../planner.js';
const event = {
  name: 'Garden gathering',
  type: 'Birthday',
  date: '2027-01-15',
  location: 'Bengaluru',
  preferences: 'Outdoor',
  currency: 'INR',
  budget: 999,
  guests: 20,
};
test('budget allocation sums exactly to the budget, including rounding', () => {
  for (const budget of [1, 999, 75000, 123456]) {
    const p = demoPlan({ ...event, budget });
    assert.equal(
      p.budget.reduce((s, b) => s + b.planned, 0),
      budget,
    );
  }
});
test('all three celebration types have relevant ideas and dated tasks', () => {
  const titles = new Set();
  for (const type of ['Birthday', 'Wedding', 'Community']) {
    const p = demoPlan({ ...event, type });
    titles.add(p.ideas[0].title);
    assert.ok(p.tasks.every((t) => t.date <= event.date));
  }
  assert.equal(titles.size, 3);
});
test('validation rejects unsafe numbers, currencies and invalid event types', () => {
  for (const patch of [
    { budget: -1 },
    { guests: 0 },
    { guests: 1.5 },
    { currency: 'xyz' },
    { type: 'other' },
    { date: 'invalid' },
  ])
    assert.throws(() => validateEvent({ ...event, ...patch }));
  assert.equal(validateEvent({ ...event, secret: 'hidden' }).secret, undefined);
});
test('normalization enforces total budget and initializes tracking fields', () => {
  const p = demoPlan(event);
  p.budget[0].planned = 10000;
  const result = normalizePlan(p, event);
  assert.equal(
    result.budget.reduce((s, b) => s + b.planned, 0),
    event.budget,
  );
  assert.ok(result.tasks.every((t) => t.done === false));
  assert.ok(result.vendors.every((v) => v.status === 'To research'));
});
test('malformed generated plans are rejected', () => {
  assert.throws(() => normalizePlan({}, event));
  const p = demoPlan(event);
  p.budget[0].planned = -10;
  assert.throws(() => normalizePlan(p, event));
});
test('server serves the app, validates input and keeps secrets private', async () => {
  process.env.NODE_ENV = 'test';
  const { server } = await import('../server.js');
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base)).status, 200);
    const status = await (await fetch(base + '/api/status')).json();
    assert.ok(!('key' in status));
    const invalid = await fetch(base + '/api/plan', {
      method: 'POST',
      body: '{}',
    });
    assert.equal(invalid.status, 400);
    const forbidden = await fetch(base + '/api/plan', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
      body: JSON.stringify(event),
    });
    assert.equal(forbidden.status, 403);
    assert.equal((await fetch(base + '/.env')).status, 404);
    if (status.mode === 'demo') {
      const r = await fetch(base + '/api/plan', {
        method: 'POST',
        body: JSON.stringify(event),
      });
      const data = await r.json();
      assert.equal(data.source, 'demo');
      assert.equal(
        data.plan.budget.reduce((s, b) => s + b.planned, 0),
        999,
      );
    }
  } finally {
    await new Promise((r) => server.close(r));
  }
});

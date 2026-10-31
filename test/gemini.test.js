import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { demoPlan } from '../planner.js';
process.env.NODE_ENV = 'test';
const { createApp } = await import('../server.js');
const event = {
  name: 'Community picnic',
  type: 'Community',
  date: '2027-03-20',
  location: 'Pune',
  preferences: 'Accessible and vegetarian',
  currency: 'INR',
  budget: 50000,
  guests: 80,
};
async function withApp(options, run) {
  const app = createApp(options);
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.address().port}`;
  const plan = (input = event) =>
    fetch(base + '/api/plan', { method: 'POST', body: JSON.stringify(input) });
  try {
    await run(plan, base);
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
}
test('Gemini uses server-side credentials, caches identical requests, and throttles new ones', async () => {
  let calls = 0;
  await withApp(
    {
      key: 'test-only-key',
      now: () => 20000,
      request: async (url, options) => {
        calls++;
        assert.ok(!url.includes('test-only-key'));
        assert.equal(options.headers['x-goog-api-key'], 'test-only-key');
        assert.equal(
          JSON.parse(options.body).generationConfig.responseMimeType,
          'application/json',
        );
        return Response.json({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(demoPlan(event)) }] } },
          ],
        });
      },
    },
    async (plan) => {
      assert.equal((await (await plan()).json()).source, 'gemini');
      assert.equal((await (await plan()).json()).cached, true);
      assert.equal(calls, 1);
      assert.equal(
        (await plan({ ...event, name: 'Different event' })).status,
        429,
      );
    },
  );
});
test('Gemini quota failure is actionable and never leaks provider details', async () => {
  await withApp(
    {
      key: 'test-only-key',
      request: async () =>
        Response.json(
          { error: 'sensitive provider response' },
          { status: 429 },
        ),
    },
    async (plan) => {
      const result = await plan();
      assert.equal(result.status, 429);
      const text = await result.text();
      assert.match(text, /quota/);
      assert.ok(!text.includes('sensitive'));
    },
  );
});
test('malformed Gemini responses fail safely', async () => {
  await withApp(
    {
      key: 'test-only-key',
      request: async () => Response.json({ candidates: [] }),
    },
    async (plan) => {
      assert.equal((await plan()).status, 502);
    },
  );
});
test('host validation blocks DNS rebinding requests', async () => {
  await withApp({ key: '' }, async (_plan, base) => {
    const status = await new Promise((resolve, reject) => {
      http
        .get(
          base + '/api/status',
          { headers: { Host: 'evil.example' } },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          },
        )
        .on('error', reject);
    });
    assert.equal(status, 403);
  });
});

test('assistant endpoint returns a Gemini answer and excludes private records', async () => {
  await withApp(
    {
      key: 'test-only-key',
      request: async (_url, options) => {
        const body = JSON.parse(options.body);
        assert.ok(!options.body.includes('Private guest'));
        assert.equal(body.generationConfig.maxOutputTokens, 1400);
        return Response.json({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'Choose seasonal flowers and compare quotes.' },
                ],
              },
            },
          ],
        });
      },
    },
    async (_plan, base) => {
      const response = await fetch(base + '/api/assistant', {
        method: 'POST',
        body: JSON.stringify({
          event: { ...event, guestList: [{ name: 'Private guest' }] },
          question: 'How can we reduce costs?',
          history: [],
        }),
      });
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.source, 'gemini');
      assert.match(data.answer, /seasonal/);
    },
  );
});
test('assistant endpoint offers labeled demo guidance and rejects empty questions', async () => {
  await withApp({ key: '' }, async (_plan, base) => {
    const good = await fetch(base + '/api/assistant', {
      method: 'POST',
      body: JSON.stringify({
        event,
        question: 'What should I ask the caterer?',
        history: [],
      }),
    });
    const data = await good.json();
    assert.equal(data.source, 'demo');
    assert.match(data.answer, /caterer/);
    const bad = await fetch(base + '/api/assistant', {
      method: 'POST',
      body: JSON.stringify({ event, question: '' }),
    });
    assert.equal(bad.status, 400);
  });
});

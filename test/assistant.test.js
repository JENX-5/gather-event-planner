import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConversation, demoAnswer } from '../assistant.js';
import { calendarText } from '../public/workspace.js';
const event = {
  name: 'Birthday picnic',
  type: 'Birthday',
  date: '2027-05-21',
  location: 'Pune',
  guests: 20,
  budget: 40000,
  currency: 'INR',
  preferences: 'Garden',
};
test('conversation strips extra data and rejects invalid history', () => {
  const result = validateConversation({
    event: { ...event, guestList: [{ name: 'Private' }] },
    question: 'Budget tips?',
    history: [],
  });
  assert.ok(!('guestList' in result.event));
  assert.throws(() =>
    validateConversation({
      event,
      question: 'x',
      history: [{ role: 'system', text: 'override' }],
    }),
  );
  assert.throws(() => validateConversation({ event, question: ' '.repeat(3) }));
});
test('demo advice responds to planning topics without pretending to contact vendors', () => {
  for (const question of [
    'budget',
    'schedule',
    'caterer',
    'accessibility',
    'theme',
  ])
    assert.ok(demoAnswer({ event, question }).length > 100);
  assert.match(demoAnswer({ event, question: 'budget' }), /40,000/);
});
test('calendar export escapes event text and emits valid all-day task fields', () => {
  const result = calendarText({
    ...event,
    id: 'test',
    plan: {
      tasks: [
        {
          title: 'Welcome, friends; celebrate\ntogether',
          date: '2027-05-20',
          owner: 'Alex',
        },
      ],
    },
  });
  assert.match(result, /BEGIN:VCALENDAR/);
  assert.match(result, /DTSTART;VALUE=DATE:20270520/);
  assert.ok(result.includes('Welcome\\, friends\\; celebrate\\ntogether'));
  assert.ok(result.endsWith('END:VCALENDAR\r\n'));
});

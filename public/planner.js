/** Reject impossible calendar dates instead of letting Date normalize them. */
export function validDate(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value &&
    value >= '1900-01-01'
  );
}

export function validateEvent(e) {
  if (!e || typeof e !== 'object')
    throw new Error('Event details are required.');
  for (const k of [
    'name',
    'type',
    'date',
    'location',
    'preferences',
    'currency',
  ])
    if (typeof e[k] !== 'string' || e[k].length > 1500)
      throw new Error(`Invalid ${k}.`);
  if (
    !e.name.trim() ||
    !['Wedding', 'Birthday', 'Community'].includes(e.type) ||
    !['INR', 'USD', 'EUR', 'GBP'].includes(e.currency) ||
    !validDate(e.date)
  )
    throw new Error('Please provide valid event details.');
  if (
    !Number.isFinite(e.budget) ||
    e.budget < 1 ||
    e.budget > 1e10 ||
    !Number.isInteger(e.guests) ||
    e.guests < 1 ||
    e.guests > 100000
  )
    throw new Error('Enter a valid budget and guest count.');
  return Object.fromEntries(
    [
      'name',
      'type',
      'date',
      'location',
      'preferences',
      'currency',
      'budget',
      'guests',
    ].map((k) => [k, e[k]]),
  );
}
export function demoPlan(e) {
  const categories = [
    'Venue',
    'Food & drinks',
    'Decor & flowers',
    'Entertainment',
    'Photography',
    'Contingency',
  ];
  const shares = [0.25, 0.35, 0.12, 0.08, 0.1, 0.1];
  let remaining = e.budget;
  const budget = categories.map((category, i) => {
    const planned = i === 5 ? remaining : Math.floor(e.budget * shares[i]);
    remaining -= planned;
    return { category, planned, actual: 0 };
  });
  const tasks = [
    ['Define the guest list and accessibility needs', 60],
    ['Compare venues and request written quotes', 45],
    ['Choose catering and collect dietary requirements', 30],
    ['Send invitations and track RSVPs', 21],
    ['Confirm vendors and the event schedule', 7],
    ['Prepare signage, supplies, and a weather backup', 2],
    ['Set up, welcome guests, and celebrate', 0],
  ].map(([title, days]) => {
    const d = new Date(e.date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - days);
    return { title, date: d.toISOString().slice(0, 10), done: false };
  });
  const ideas =
    e.type === 'Wedding'
      ? [
          'A handwritten note at every place setting',
          'A shared-memory guestbook corner',
          'Seasonal flowers with reusable table decor',
        ]
      : e.type === 'Birthday'
        ? [
            'A photo timeline of favorite memories',
            'A build-your-own dessert station',
            'A playlist with a song from every guest',
          ]
        : [
            'A neighborhood story-sharing wall',
            'A swap table for books and plants',
            'A volunteer-led games and activity corner',
          ];
  return {
    summary: `A thoughtful ${e.type.toLowerCase()} for ${e.guests} guests in ${e.location || 'your chosen location'}. Start with the essentials, protect your contingency, and add personal touches.`,
    budget,
    tasks,
    vendors: ['Venue', 'Catering', 'Decor', 'Entertainment'].map(
      (category) => ({
        category,
        name: '',
        status: 'To research',
        notes:
          'Compare 3 quotes; confirm inclusions, deposit, cancellation policy, and accessibility.',
      }),
    ),
    ideas: ideas.map((title) => ({
      title,
      description:
        'Adapt this idea to your theme, guests, and available budget.',
    })),
  };
}
export const planSchema = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    budget: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING' },
          planned: { type: 'NUMBER' },
        },
        required: ['category', 'planned'],
      },
    },
    tasks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { title: { type: 'STRING' }, date: { type: 'STRING' } },
        required: ['title', 'date'],
      },
    },
    vendors: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { category: { type: 'STRING' }, notes: { type: 'STRING' } },
        required: ['category', 'notes'],
      },
    },
    ideas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          description: { type: 'STRING' },
        },
        required: ['title', 'description'],
      },
    },
  },
  required: ['summary', 'budget', 'tasks', 'vendors', 'ideas'],
};
export function normalizePlan(p, e) {
  if (!p || typeof p.summary !== 'string') throw new Error('Invalid plan');
  for (const k of ['budget', 'tasks', 'vendors', 'ideas'])
    if (!Array.isArray(p[k]) || !p[k].length || p[k].length > 30)
      throw new Error('Invalid plan');
  const str = (v) => typeof v === 'string' && v.length > 0 && v.length <= 3000;
  if (
    p.budget.some(
      (x) => !str(x.category) || !Number.isFinite(x.planned) || x.planned < 0,
    ) ||
    p.tasks.some(
      (x) =>
        !str(x.title) ||
        !validDate(x.date) ||
        !Number.isFinite(Date.parse(x.date)) ||
        x.date > e.date,
    ) ||
    p.vendors.some((x) => !str(x.category) || !str(x.notes)) ||
    p.ideas.some((x) => !str(x.title) || !str(x.description))
  )
    throw new Error('Invalid plan');
  const total = p.budget.reduce((s, x) => s + x.planned, 0);
  if (total <= 0) throw new Error('Invalid budget');
  let remaining = e.budget;
  p.budget = p.budget.map((x, i) => {
    const planned =
      i === p.budget.length - 1
        ? remaining
        : Math.floor((x.planned / total) * e.budget);
    remaining -= planned;
    return { category: x.category, planned, actual: 0 };
  });
  p.tasks = p.tasks
    .map((x) => ({ ...x, done: false }))
    .sort((a, b) => a.date.localeCompare(b.date));
  p.vendors = p.vendors.map((x) => ({ ...x, name: '', status: 'To research' }));
  return p;
}

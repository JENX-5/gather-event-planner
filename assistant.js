import { validateEvent } from './planner.js';
export function validateConversation(input) {
  if (
    !input ||
    typeof input.question !== 'string' ||
    !input.question.trim() ||
    input.question.length > 1500
  )
    throw new Error('Enter a question of up to 1,500 characters.');
  const history = input.history ?? [];
  if (
    !Array.isArray(history) ||
    history.length > 6 ||
    history.some(
      (m) =>
        !m ||
        !['user', 'assistant'].includes(m.role) ||
        typeof m.text !== 'string' ||
        m.text.length > 12000,
    )
  )
    throw new Error('Invalid conversation history.');
  return {
    event: validateEvent(input.event),
    question: input.question.trim(),
    history: history.map((m) => ({ role: m.role, text: m.text })),
  };
}
export function demoAnswer({ event: e, question }) {
  const q = question.toLowerCase();
  const perGuest = Math.floor(e.budget / e.guests);
  if (/cost|budget|sav|cheap/.test(q))
    return `For your ${e.type.toLowerCase()} with ${e.guests} guests, your ${e.currency} ${e.budget.toLocaleString('en-IN')} budget works out to about ${e.currency} ${perGuest.toLocaleString('en-IN')} per guest.\n\n1. Protect a 10% contingency before committing to vendors.\n2. Compare three itemized venue and catering quotes, including taxes, service, delivery, and cleanup.\n3. Choose seasonal food and reusable decor.\n4. Prioritize your two most meaningful experiences and simplify the rest.\n\nThese are demo planning principles, not live quotes. Connect Gemini for advice tailored to your preferences.`;
  if (/schedule|timeline|day/.test(q))
    return `A sample event-day flow for ${e.name}:\n\n3 hours before: vendor access, setup, sound check, and accessible route check.\n1 hour before: brief helpers, confirm food labels, and prepare the welcome area.\nStart: welcome guests and introduce the plan.\n30 minutes in: begin your main activity or ceremony.\n90 minutes in: food, conversation, and a relaxed activity.\nFinal 30 minutes: thank guests, share keepsakes, and coordinate departures.\nAfterward: cleanup, return rentals, and record final expenses.\n\nAdjust times for your venue and event length. Add the actions you choose in Timeline.`;
  if (/cater|food|diet/.test(q))
    return `Ask potential caterers these questions:\n\n1. What does the per-person quote include for ${e.guests} guests?\n2. Can you label allergens and provide vegetarian, vegan, and other dietary options?\n3. Are staff, serving equipment, water, cleanup, taxes, and travel included?\n4. When is the final headcount due, and what happens if it changes?\n5. What are the deposit, cancellation, and refund terms?\n6. How will you keep food at safe serving temperatures?\n\nRecord their answers and quotes in Vendors. This is a demo checklist; no vendor has been contacted.`;
  if (/access|inclusive/.test(q))
    return 'Start with step-free entry, accessible toilets, clear routes, and nearby seating. Ask guests privately about needs rather than making assumptions. Offer readable signs, a quiet area, dietary labels, and alternatives to loud or physically demanding activities. Confirm transport and venue access in writing. Assign a helper to welcome anyone who needs support.\n\nStore relevant guest notes in Guests; those notes are not included in AI requests.';
  return `For ${e.name}, start with three decisions: what guests should experience, which two details matter most to you, and what your budget can comfortably support.\n\nYour plan is for ${e.guests} guests in ${e.location}. Confirm the venue and catering first, work backward from ${e.date} for deadlines, and give every essential task an owner. Keep a weather or venue backup.\n\nThis answer uses demo guidance. Connect Gemini for an answer tailored to your exact question and preferences. You can also ask about costs, the event-day schedule, caterers, or accessibility.`;
}

# Gather — Celebration & Event Planner

**Public repository:** https://github.com/JENX-5/gather-event-planner

A GenAI-powered planning assistant for weddings, birthdays, and community events. Built for Challenge 5 with Gemini, a Node.js backend, and a responsive vanilla JavaScript frontend. No runtime npm dependencies or build step required. Prettier and jsdom are development-only tools.

## Application pages

Gather is a routed web application with distinct screens and browser history:

| Page                  | Route                   |
| --------------------- | ----------------------- |
| Event library         | `/events`               |
| Create a celebration  | `/events/new`           |
| Archived celebrations | `/events/archive`       |
| Event overview        | `/events/:id/overview`  |
| Budget                | `/events/:id/budget`    |
| Timeline              | `/events/:id/timeline`  |
| Vendor team           | `/events/:id/vendors`   |
| Guests and RSVPs      | `/events/:id/guests`    |
| Personalized ideas    | `/events/:id/ideas`     |
| Planning assistant    | `/events/:id/assistant` |

Each route works on refresh. Browser Back and Forward restore the correct screen. Event links require that event's data in the same browser; use backup/import to move events between devices.

## Chosen vertical

**Challenge 5: Celebration & Event Planner.** Gather serves individuals and volunteer organizers planning weddings, birthdays, and community events. The core problem is turning an open-ended celebration idea into an actionable, budget-aware plan without requiring professional planning experience.

## Approach and logic

Gather separates creative generation from deterministic accounting. Gemini proposes a structured plan based on the event type, location, date, guest count, budget, currency, and personal preferences. The server validates the response and proportionally normalizes category allocations to the user's budget, assigning rounding remainder to the final category. Task dates must be valid calendar dates on or before the event. Tracking fields are initialized in code rather than entrusted to the model.

The browser turns the validated plan into separate editable pages. Budget totals, remaining funds, RSVP counts, and task completion recalculate locally, so ordinary edits never consume API tokens. The dedicated Assistant page accepts follow-up questions and shows conversational suggestions without silently changing the plan. A deterministic template allows evaluation without credentials and is always labeled as a demo. Regeneration keeps one previous plan for restoration.

## How the solution works

1. Create an event and provide the important details and preferences.
2. Explore the initial template and edit its budget, checklist, and vendor notes.
3. Configure a Gemini key, then request a personalized plan from Overview.
4. The server validates input, checks its cache and throttle, and makes one structured-output API call.
5. The generated response is validated and budget-normalized before reaching the dashboard.
6. Track spending and tasks, record vendor progress, and export the plan for sharing.

## Run locally

Requires Node.js 22 or newer.

```sh
cp .env.example .env
npm start
```

Open **http://localhost:3000**. Without an API key, the app runs in clearly labeled demo mode with editable templates. For automatic server restarts during development, use `npm run dev`.

## Where GenAI is used

Gather uses Gemini in **two explicit, user-triggered actions**. It does not send automatic requests in the background.

1. **Build or regenerate an event plan.** On the event Overview, selecting **Create a fresh AI plan** sends the event name, type, date, location, guest count, budget, currency, and planning preferences to the server. The server calls Gemini 3.1 Flash-Lite with a structured JSON schema. Gemini drafts the summary, budget-category proportions, dated planning tasks, vendor categories and procurement checklists, and personalized ideas. The server validates the result, normalizes the category amounts to the exact budget, and initializes expense and completion fields before the plan is shown.
2. **Ask the planning assistant.** On the Assistant page, submitting a question sends the same event brief, the question, and up to six recent conversation messages. Gemini returns advice in plain text. It does not edit or regenerate the saved plan; the user chooses which suggestions to apply.

The two AI actions use `/api/plan` and `/api/assistant`. The browser never receives the Gemini API key. The server adds it to the request to Google. The complete workspace—including saved event records, RSVPs, vendor records, actual costs, and chat history—is stored in this browser. For a plan request, only the selected event brief above is sent; it includes the event budget total but excludes the editable expense breakdown. For an assistant request, the selected event brief plus the current question and up to six recent chat messages are sent.

**The app does not automatically include guest names, guest contact details, RSVP records, vendor names, vendor contact details, vendor quotes or deposits, actual expenses, task ownership, or downloaded backups in an AI request.** The assistant question and recent messages are free text, so a user could choose to type any of those details into them. Do not include sensitive personal information in free-text preferences or assistant messages: text in those fields is sent to Gemini when the corresponding AI action is requested.

Without an API key, the same screens use deterministic, clearly labeled demo templates and sample assistant guidance. Budget math, RSVP counts, task completion, vendor tracking, archive/restore, calendar export, and print/export are application logic and do **not** use GenAI. Gemini does not discover or contact vendors, send invitations, make bookings, process payments, or change the plan without the user's action.

## Enable Gemini

1. Create a key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Set it in your local `.env` file:

```dotenv
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
PORT=3000
```

3. Restart the server. The sidebar will show **Gemini key configured** when a key is configured (this is not an API credential verification).
4. Create an event, enter your preferences, then click **Create a fresh AI plan** on Overview.

The key stays on the server and is never sent to the browser. `.env` is excluded from Git. Event briefs are sent to Google only when you explicitly generate a plan or ask the AI assistant. Guest and vendor records are excluded; free-text preferences and assistant messages are sent with those requests.

The default model supports structured output and has free-tier access subject to Google's current availability and account limits. You can change `GEMINI_MODEL` to another compatible model available in your account. Consult [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits); free quotas vary and are not guaranteed. This app does not enable billing or select a paid fallback.

## Features

- Event library, dedicated creation page, event duplication, and recoverable archive/restore.
- Multiple saved events with names, dates, location, guest count, currency, and preferences.
- AI-generated budgets, dated task timelines, vendor procurement checklists, and personalized ideas.
- Editable planned and actual expenses, remaining budget, and category differences.
- Add, edit, remove, and undo removal for tasks and budget categories; task owners, filters, and overall progress.
- Vendor records with booking status, contact information, quotes, deposits, and procurement notes.
- Guest parties, RSVP status, dietary/accessibility notes, capacity warnings, and confirmed headcounts.
- Follow-up assistant conversation using the event brief and recent messages.
- Turn ideas into timeline tasks with one click.
- INR, USD, EUR, and GBP formatting.
- Local browser persistence, complete text export, print/save as PDF, JSON backup/import, and calendar (.ics) export.
- Restore the previous plan after regeneration.
- Demo mode with templates for all three celebration types.
- Responsive dashboard with keyboard-accessible forms and dialogs.

## Free-tier usage controls

Each plan generation or assistant question makes one `generateContent` request. Both endpoints share the same throttle and a bounded in-memory cache (up to 50 results). Identical requests reuse their cached response. The server allows one active AI request and a minimum 15-second gap between uncached requests. It caps plan output at 4,500 tokens and assistant output at 1,400 tokens and applies a 45-second timeout. No automatic retries or background AI calls occur. These controls reduce usage but do not guarantee staying within your account quota. A 429 response is shown as a helpful quota message; existing plans remain intact.

## Architecture

```text
Browser UI → POST /api/plan or /api/assistant → input validation → cache / throttle
                                            → Gemini REST API
                                            → response validation
                                            → normalized editable plan
Browser localStorage ← events, budgets, tasks, vendors, previous plan
```

- `server.js`: localhost HTTP server, static allowlist, API proxy, quota handling, and security headers.
- `planner.js`: input validation, demo templates, Gemini response schema, plan validation, and budget normalization.
- `public/app.js`: application state, navigation, editing, storage, import/export, and event management.
- `public/workspace.js`: event library, focused planning pages, guest workflow, assistant UI, record forms, and calendar generation.
- `public/router.js`: URL resolution and event route generation.
- `assistant.js`: conversation validation and clearly labeled demo guidance.
- `public/styles.css`: responsive visual design and CSS illustration.
- `test/planner.test.js`: budget, validation, event-type, and HTTP integration tests.

## Validation

```sh
npm ci
npm run check
npm test
```

The suite includes 28 tests across planning logic, HTTP security, mocked Gemini success/failure paths, caching and throttling, and frontend interactions. The GitHub Actions workflow runs formatting, tests, and a production dependency audit on Node 22 and 24. Mocked Gemini tests consume no API quota.

Tests cover exact budget totals, planning templates, invalid inputs, generated-plan validation, static serving, request origin checks, and blocking access to `.env`.

## Evaluation evidence

| Criterion     | Implementation and evidence                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code quality  | Separate planning logic, HTTP service, UI helpers, styling, and tests; consistent Prettier formatting; locked development dependencies.                                                       |
| Security      | Server-only API key, static file allowlist, strict CSP, origin and Host checks, input/output validation, escaped model/user content, bounded request body, no secret logging.                 |
| Efficiency    | No production dependencies or external fonts/images, local computations, one request per generation, bounded cache, request throttling and timeout.                                           |
| Testing       | Unit, HTTP, mocked provider, and jsdom interaction tests; CI workflow; desktop dashboard visually reviewed in Chrome.                                                                         |
| Accessibility | Semantic headings and labels, skip link, visible focus, keyboard-focus restoration, native dialog, labeled progress indicators, persistent errors, reduced-motion support, responsive layout. |
| Alignment     | All three requested event types, configurable budgets and currencies, dated checklists, vendor workflow, and preference-driven AI ideas.                                                      |

Accessibility measures are implemented, but this is not a claim of a full WCAG audit. Automated DOM tests do not replace screen-reader or mobile-device testing.

## Assumptions

- One organizer uses a local server and a modern browser; multi-user collaboration is outside this prototype's scope.
- Users supply their own Gemini key with access to the selected model; free-tier limits depend on their account.
- Budget values use whole currency units. Suggested category costs are estimates, not vendor quotes.
- Vendors are tracked manually. The model suggests procurement categories and checklists, not verified businesses.
- The user reviews generated ideas and timelines before relying on them.
- Browser storage is acceptable for a challenge prototype; export is the portable backup.
- This submission contains no real API key or private event data.

## Reviewer walkthrough

Run the app without a key to open the event library and sample birthday. Navigate between the separate pages, use browser Back, and refresh a deep link. Create a wedding or community event, edit an actual cost to exceed its planned allocation, complete a task, and record a vendor quote status. Reload to check persistence. Configure your key and generate a plan with specific preferences, such as a vegetarian garden wedding with step-free access. Review its ideas and checklist, ask a follow-up question on Assistant, then export the plan. Add a guest party with a confirmed RSVP, edit a vendor quote, archive and restore a duplicate event, and download/import a JSON backup. If quota is unavailable, existing work remains editable.

## Scope and storage

This is a local, single-user project, not a hosted multi-user service. It binds to `127.0.0.1`. Saved events belong to the current browser profile and origin; clearing browser storage removes them. Export a copy of important plans. There is no login, cloud database, live vendor search, automatic vendor booking, or message delivery. Guest contacts and vendor details are local records and are excluded from AI requests. Backup files include these records, so store backups privately. Text and PDF reports include only aggregate guest counts. Budget amounts are planning estimates, not live prices or quotes. Existing task dates and allocations are preserved when event details are edited; generate a fresh plan to update them. Demo templates intentionally use fixed lead times, so tasks may already be overdue for a near-term event.

Before deploying a shared instance, add authentication, per-user storage, durable quota controls, and hosting configuration. Live Gemini plan generation and follow-up assistance were verified with synthetic event details on 31 October 2026 using Gemini 3.1 Flash-Lite. The generated plan correctly totaled the supplied ₹60,000 budget and included tasks, vendor categories, and personalized ideas. API keys are never included in the repository.

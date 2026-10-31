/** All user and model content must pass through this before HTML interpolation. */
export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ],
  );

/** Calendar-day difference independent of daylight-saving transitions. */
export function daysUntil(date, now = new Date()) {
  const localDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(date + 'T00:00:00Z') - localDay) / 86400000);
}

/** Keep keyboard users on the same control after a dashboard refresh. */
export function captureFocus(document) {
  const element = document.activeElement;
  if (!element) return () => {};
  const attributes = [
    'data-task',
    'data-budget',
    'data-field',
    'data-tab',
    'data-action',
    'data-event',
  ];
  const identity = attributes
    .filter((key) => element.hasAttribute(key))
    .map((key) => [key, element.getAttribute(key)]);
  return () => {
    if (!identity.length) return;
    const target = [
      ...document.querySelectorAll('button,input,select,textarea'),
    ].find((node) =>
      identity.every(([key, value]) => node.getAttribute(key) === value),
    );
    target?.focus({ preventScroll: true });
  };
}

export const sections = [
  'Overview',
  'Budget',
  'Timeline',
  'Vendors',
  'Guests',
  'Ideas',
  'Assistant',
];
export function eventPath(id, section = 'Overview') {
  return `/events/${encodeURIComponent(id)}/${section.toLowerCase()}`;
}
export function resolveRoute(path) {
  if (path === '/' || path === '/events')
    return { view: 'library', archived: false };
  if (path === '/events/archive') return { view: 'library', archived: true };
  if (path === '/events/new') return { view: 'new' };
  const match = path.match(
    /^\/events\/([^/]+)\/(overview|budget|timeline|vendors|guests|ideas|assistant)$/,
  );
  if (!match) return { view: 'not-found' };
  try {
    return {
      view: 'event',
      id: decodeURIComponent(match[1]),
      section: sections.find((s) => s.toLowerCase() === match[2]),
    };
  } catch {
    return { view: 'not-found' };
  }
}

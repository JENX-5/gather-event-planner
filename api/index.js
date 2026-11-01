import { server } from '../server.js';

/** Forward Vercel's request/response pair through the shared, tested HTTP app. */
export default function handler(request, response) {
  server.emit('request', request, response);
}

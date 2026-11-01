import { copyFile } from 'node:fs/promises';

// planner.js is shared with the server and also imported by browser modules.
// Publish the same source file as a static browser module during Vercel builds.
await copyFile(
  new URL('../planner.js', import.meta.url),
  new URL('../public/planner.js', import.meta.url),
);
console.log('Prepared the planner module for the browser build.');

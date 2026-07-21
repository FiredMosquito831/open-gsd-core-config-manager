/**
 * Native OS picker REST routes (Symptom D — "anything leveraging a path
 * should have a path picker with file explorer window opening").
 *
 * Browsers cannot hand an HTTP-served SPA a real absolute file path, so the
 * picker is surfaced server-side (see `../picker.ts`): the SPA POSTs here, the
 * helper spawns the platform's native dialog process, and returns the chosen
 * absolute path string for the browser to drop into the existing path inputs.
 *
 * Routes are registered inside the `/api` plugin scope in `app.ts`, so they
 * inherit the Origin and token guards (just like every other workspace route).
 * Each POST body is schema-validated; the picker itself is awaited so the
 * Fastify event loop yields while the OS modal is open (unlike the previous
 * sync `scan()` brick, this is a single subprocess, not tens of thousands of
 * blocking fs ops).
 */
import type { FastifyPluginAsync } from 'fastify';

import { pickFile, pickDirectory, pickerBackendName } from '../picker.js';
import type { ApiErr } from '../api-types.js';

export interface PickerRoutesOptions {
  /** Surfaces a "pickers disabled" warning to the client when no OS backend is available. */
  warn?: (msg: string) => void;
}

function errBody(message: string): ApiErr {
  return { ok: false, errors: [{ message }] };
}

export const pickerRoutes: FastifyPluginAsync<PickerRoutesOptions> = async (app, opts) => {
  // Diagnostic: tells the SPA whether a native backend is available and which
  // one, so the "Browse…" button can be hidden gracefully on a headless box
  // instead of appearing alive and then no-op'ing.
  app.get('/picker/status', async () => {
    try {
      const backend = await pickerBackendName();
      const supported = backend !== 'none';
      if (!supported && opts.warn) {
        opts.warn('No native OS picker backend available (powershell/osascript/zenity/kdialog all missing)');
      }
      return { ok: true, supported, backend };
    } catch (err) {
      opts.warn?.(`picker/status failed: ${(err as Error).message}`);
      return { ok: true, supported: false, backend: 'none' };
    }
  });

  app.post('/picker/file', async (req, reply) => {
    try {
      const path = await pickFile();
      if (!path) return reply.code(404).send(errBody('No file picker available or selection cancelled'));
      return { ok: true, path };
    } catch (err) {
      opts.warn?.(`picker/file failed: ${(err as Error).message}`);
      return reply.code(500).send(errBody('File picker failed'));
    }
  });

  app.post('/picker/directory', async (req, reply) => {
    try {
      const path = await pickDirectory();
      if (!path) return reply.code(404).send(errBody('No folder picker available or selection cancelled'));
      return { ok: true, path };
    } catch (err) {
      opts.warn?.(`picker/directory failed: ${(err as Error).message}`);
      return reply.code(500).send(errBody('Folder picker failed'));
    }
  });
};

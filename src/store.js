// -----------------------------------------------------------------------------
// Small persistence under /data (the only writable path of the container), in
// /data/diagral-state.json, mode 0600:
//   - account: the e-mail and serial the API key below was created for;
//   - apiKey, secretKey: the API key the integration created on the Diagral
//     cloud (the method of pydiagral and Home Assistant). The secret signs
//     every request and never leaves the container;
//   - webhook: what the integration registered at Diagral for the Gladys Plus
//     webhook — a SHA-256 of the address (the address holds the Open API key
//     of Gladys Plus, it is not kept) and the transmitter id Diagral put in it.
// Nothing of this goes to the Gladys configuration, nor to the logs.
// (Adapted from guim31/gladys-simplisafe.)
// -----------------------------------------------------------------------------

import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'diagral-store' });
const FILE_NAME = 'diagral-state.json';

export class Store {
  constructor(directory = process.env.DIAGRAL_DATA_DIR || '/data') {
    this.directory = directory;
    this.path = join(directory, FILE_NAME);
    this.data = {};
    this.pending = null;
    this.writing = null;
  }

  async load() {
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'));
      this.data = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn(`Cannot read ${this.path}: ${err.message}`);
      }
      this.data = {};
    }
    return this.data;
  }

  get(key) {
    return this.data[key];
  }

  /** Set several keys at once (`undefined` removes one), then write. */
  update(values) {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null) {
        delete this.data[key];
      } else {
        this.data[key] = value;
      }
    }
    return this.save();
  }

  // Writes are coalesced and atomic (temporary file + rename): a crash never
  // leaves half a JSON file behind.
  save() {
    if (!this.pending) {
      // Chained after the write in progress, if any: one writer at a time.
      this.pending = (this.writing ?? Promise.resolve()).then(async () => {
        this.pending = null;
        const snapshot = JSON.stringify(this.data);
        try {
          await mkdir(this.directory, { recursive: true });
          const temporary = `${this.path}.tmp`;
          await writeFile(temporary, snapshot, { mode: 0o600 });
          await chmod(temporary, 0o600);
          await rename(temporary, this.path);
        } catch (err) {
          logger.warn(`Cannot write ${this.path}: ${err.message}`);
        }
      });
      this.writing = this.pending;
    }
    return this.pending;
  }

  /** Resolves once every write requested so far is on disk. */
  flush() {
    return this.writing ?? Promise.resolve();
  }
}

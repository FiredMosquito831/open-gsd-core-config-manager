import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { writeWithRetry } from '../../config-io/src/atomic-write.js';
import type { CanonicalSchemaMetadata } from '../../schema-data/src/source-types.js';
import type { SchemaEntry } from '../../config-io/src/types.js';
import { appDataRoot as defaultAppDataRoot } from './snapshot-store/paths.js';

export interface PersistedSchemaOverride {
  envelopeVersion: 1;
  schema: Record<string, SchemaEntry>;
  metadata: CanonicalSchemaMetadata;
  activatedAt: string;
}

export interface SchemaOverrideStoreOptions {
  appDataRoot?: string;
  write?: (path: string, content: string) => Promise<void>;
  remove?: (path: string) => Promise<void>;
}

/** One-document durable storage for the entire refreshed active generation. */
export class SchemaOverrideStore {
  readonly appDataRoot: string;
  readonly filePath: string;
  private readonly writeFile: (path: string, content: string) => Promise<void>;
  private readonly removeFile: (path: string) => Promise<void>;

  constructor(options: SchemaOverrideStoreOptions = {}) {
    this.appDataRoot = options.appDataRoot ?? defaultAppDataRoot();
    this.filePath = join(this.appDataRoot, 'schema', 'active-override.json');
    this.writeFile = options.write ?? writeWithRetry;
    this.removeFile = options.remove ?? (async (path) => {
      try {
        unlinkSync(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    });
  }

  read(): unknown | undefined {
    if (!existsSync(this.filePath)) return undefined;
    return JSON.parse(readFileSync(this.filePath, 'utf8'));
  }

  async write(envelope: PersistedSchemaOverride): Promise<void> {
    mkdirSync(dirname(this.filePath), { recursive: true });
    await this.writeFile(this.filePath, JSON.stringify(envelope, null, 2));
  }

  async remove(): Promise<void> {
    await this.removeFile(this.filePath);
  }

  /** Test-only seam for interrupted/corrupt persistence fixtures. */
  async writeRawForTest(content: string): Promise<void> {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.test-tmp`;
    writeFileSync(temp, content, 'utf8');
    renameSync(temp, this.filePath);
  }
}

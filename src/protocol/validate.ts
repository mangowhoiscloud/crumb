/**
 * Runtime validation of transcript messages against protocol/schemas/message.schema.json.
 * Lazy-loads ajv to keep CLI startup snappy.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import type { Message } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(here, '../../protocol/schemas/message.schema.json');

let cachedValidator: ((msg: unknown) => msg is Message) | null = null;

export class ValidationError extends Error {
  constructor(
    msg: string,
    public readonly errors: unknown,
  ) {
    super(msg);
    this.name = 'ValidationError';
  }
}

async function buildValidator(): Promise<(msg: unknown) => msg is Message> {
  // The schema declares draft 2020-12 — load Ajv's matching dialect entry point.
  const Ajv2020 = (await import('ajv/dist/2020.js')).default;
  const { default: addFormats } = await import('ajv-formats');
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const compiled = ajv.compile(schema);
  return ((msg: unknown): msg is Message => {
    const ok = compiled(msg);
    if (!ok) {
      throw new ValidationError('transcript message failed schema validation', compiled.errors);
    }
    return true;
  }) as (msg: unknown) => msg is Message;
}

/** Validate a single message. Throws ValidationError on failure. */
export async function validateMessage(msg: unknown): Promise<Message> {
  if (!cachedValidator) cachedValidator = await buildValidator();
  cachedValidator(msg);
  return msg as Message;
}

/** Synchronous variant — caller must have called `prepareValidator()` first. */
export function validateMessageSync(msg: unknown): Message {
  if (!cachedValidator) {
    throw new Error('validator not initialized; call prepareValidator() first');
  }
  cachedValidator(msg);
  return msg as Message;
}

export async function prepareValidator(): Promise<void> {
  if (!cachedValidator) cachedValidator = await buildValidator();
}

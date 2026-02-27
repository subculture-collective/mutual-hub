import { z } from 'zod';

export const DID_PATTERN = /^did:[a-z0-9]+:[a-z0-9._:%-]+$/i;

export const AT_URI_PATTERN = /^at:\/\/[^\s]+$/i;

export const AT_URI_RECORD_PATTERN = /^at:\/\/[\w:%.-]+\/[\w.-]+\/[\w.-]+$/i;

export const didSchema = z.string().regex(DID_PATTERN, 'Expected a valid DID');

export const atUriSchema = z
    .string()
    .regex(AT_URI_PATTERN, 'Expected a valid at:// URI');

export const atUriRecordSchema = z
    .string()
    .regex(AT_URI_RECORD_PATTERN, 'Expected a valid AT URI');

export const isoDateTimeSchema = z.string().datetime({ offset: true });

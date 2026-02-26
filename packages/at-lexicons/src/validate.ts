import { ZodError } from 'zod';

import { type AtCollectionName, atLexiconCollections } from './collections.js';
import { type AtRecordForCollection, recordSchemas } from './schemas.js';

export class AtRecordValidationError extends Error {
    constructor(
        message: string,
        readonly collection: AtCollectionName,
        readonly details: string[],
    ) {
        super(message);
        this.name = 'AtRecordValidationError';
    }
}

export function isKnownCollection(value: string): value is AtCollectionName {
    return Object.values(atLexiconCollections).includes(
        value as AtCollectionName,
    );
}

export function validateRecord<C extends AtCollectionName>(
    collection: C,
    value: unknown,
): AtRecordForCollection<C> {
    try {
        return recordSchemas[collection].parse(value);
    } catch (error) {
        if (error instanceof ZodError) {
            throw new AtRecordValidationError(
                `Record validation failed for collection ${collection}`,
                collection,
                error.issues.map(
                    issue => `${issue.path.join('.')}: ${issue.message}`,
                ),
            );
        }

        throw error;
    }
}

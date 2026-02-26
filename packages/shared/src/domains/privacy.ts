const didPattern = /did:[a-z0-9:._%-]+/gi;
const atUriPattern = /at:\/\/[^\s"']+/gi;

const defaultSensitiveKeys = [
    'did',
    'uri',
    'target',
    'reporter',
    'recipient',
    'requester',
    'details',
    'message',
    'text',
    'token',
    'secret',
    'password',
    'lat',
    'lng',
    'location',
] as const;

export interface RedactionPolicy {
    allowedKeys?: readonly string[];
    sensitiveKeys?: readonly string[];
    redactedPlaceholder?: string;
    maxStringLength?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shouldRedactKey(
    key: string,
    sensitiveKeys: readonly string[],
): boolean {
    const normalized = key.toLowerCase();
    return sensitiveKeys.some(candidate =>
        normalized.includes(candidate.toLowerCase()),
    );
}

function redactString(
    value: string,
    redactedPlaceholder: string,
    maxStringLength: number,
): string {
    const withPatternRedaction = value
        .replace(didPattern, redactedPlaceholder)
        .replace(atUriPattern, redactedPlaceholder);

    if (withPatternRedaction.length <= maxStringLength) {
        return withPatternRedaction;
    }

    return `${withPatternRedaction.slice(0, Math.max(0, maxStringLength - 1))}…`;
}

function redactValue(
    value: unknown,
    policy: Required<
        Pick<
            RedactionPolicy,
            'sensitiveKeys' | 'redactedPlaceholder' | 'maxStringLength'
        >
    >,
): unknown {
    if (typeof value === 'string') {
        return redactString(
            value,
            policy.redactedPlaceholder,
            policy.maxStringLength,
        );
    }

    if (Array.isArray(value)) {
        return value.map(entry => redactValue(entry, policy));
    }

    if (isPlainObject(value)) {
        const output: Record<string, unknown> = {};

        for (const [key, nested] of Object.entries(value)) {
            if (shouldRedactKey(key, policy.sensitiveKeys)) {
                output[key] = policy.redactedPlaceholder;
                continue;
            }

            output[key] = redactValue(nested, policy);
        }

        return output;
    }

    return value;
}

export function redactSensitiveFields<T>(
    value: T,
    policy: RedactionPolicy = {},
): T {
    const normalizedPolicy = {
        sensitiveKeys: policy.sensitiveKeys ?? [...defaultSensitiveKeys],
        redactedPlaceholder: policy.redactedPlaceholder ?? '[REDACTED]',
        maxStringLength: policy.maxStringLength ?? 200,
    };

    return redactValue(value, normalizedPolicy) as T;
}

export function createMinimalLogPayload(
    payload: object,
    policy: RedactionPolicy = {},
): Record<string, unknown> {
    const payloadRecord = payload as Record<string, unknown>;
    const selectedKeys = policy.allowedKeys ?? Object.keys(payloadRecord);
    const selectedPayload: Record<string, unknown> = {};

    for (const key of selectedKeys) {
        if (Object.prototype.hasOwnProperty.call(payloadRecord, key)) {
            selectedPayload[key] = payloadRecord[key];
        }
    }

    return redactSensitiveFields(selectedPayload, policy);
}

export interface MinimalLogEntry {
    event: string;
    at: string;
    payload: Record<string, unknown>;
}

export function createMinimalLogEntry(
    event: string,
    payload: object,
    policy: RedactionPolicy & { at?: string } = {},
): MinimalLogEntry {
    return {
        event,
        at: policy.at ?? new Date().toISOString(),
        payload: createMinimalLogPayload(payload, policy),
    };
}

const splitPattern = /[^a-z0-9]+/gi;

export function tokenize(value: string): string[] {
    return value
        .toLowerCase()
        .split(splitPattern)
        .map(token => token.trim())
        .filter(token => token.length >= 2);
}

function intersectSets(left: Set<string>, right: Set<string>): Set<string> {
    const [smaller, larger] =
        left.size <= right.size ? [left, right] : [right, left];
    const output = new Set<string>();

    for (const value of smaller) {
        if (larger.has(value)) {
            output.add(value);
        }
    }

    return output;
}

export class InvertedTextIndex {
    private readonly documentsByToken = new Map<string, Set<string>>();
    private readonly tokensByDocument = new Map<string, Set<string>>();

    indexDocument(documentId: string, textParts: readonly string[]): void {
        this.removeDocument(documentId);

        const tokens = new Set(textParts.flatMap(text => tokenize(text)));
        this.tokensByDocument.set(documentId, tokens);

        for (const token of tokens) {
            const existing =
                this.documentsByToken.get(token) ?? new Set<string>();
            existing.add(documentId);
            this.documentsByToken.set(token, existing);
        }
    }

    removeDocument(documentId: string): void {
        const tokens = this.tokensByDocument.get(documentId);
        if (!tokens) {
            return;
        }

        for (const token of tokens) {
            const docs = this.documentsByToken.get(token);
            if (!docs) {
                continue;
            }

            docs.delete(documentId);
            if (docs.size === 0) {
                this.documentsByToken.delete(token);
            }
        }

        this.tokensByDocument.delete(documentId);
    }

    search(query: string): Set<string> {
        const queryTokens = tokenize(query);
        if (queryTokens.length === 0) {
            return new Set(this.tokensByDocument.keys());
        }

        const candidateSets = queryTokens.map(
            token => this.documentsByToken.get(token) ?? new Set<string>(),
        );
        if (candidateSets.length === 0) {
            return new Set<string>();
        }

        return candidateSets.reduce((combined, next) =>
            intersectSets(combined, next),
        );
    }
}

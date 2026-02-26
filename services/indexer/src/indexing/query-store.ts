import {
    type AidPostLexiconRecord,
    atLexiconCollections,
} from '@mutual-hub/at-lexicons';
import type {
    AidCategory,
    AidPostSummary,
    AidStatus,
    DirectoryResource,
    DirectoryResourceType,
} from '@mutual-hub/shared';

import type { NormalizedFirehoseEvent } from '../firehose/consumer.js';
import { type RankedAid, rankAidCards } from '../ranking/rank-aid.js';
import {
    type SearchCenter,
    haversineDistanceMeters,
    isWithinRadius,
    normalizeIndexedLocation,
    toDistanceBand,
} from './geo-index.js';
import { InvertedTextIndex } from './text-index.js';

interface ResourceDirectoryLexiconRecord {
    id: string;
    name: string;
    type: DirectoryResourceType;
    location: DirectoryResource['location'];
    openHours?: string;
    eligibilityNotes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface IndexedAidPost extends AidPostSummary {
    indexedAt: string;
}

export interface IndexedDirectoryResource extends DirectoryResource {
    uri: string;
    indexedAt: string;
    createdAt: string;
    updatedAt: string;
}

export interface AidSearchFilters {
    center?: SearchCenter;
    radiusMeters?: number;
    category?: AidCategory;
    status?: AidStatus;
    minUrgency?: number;
    text?: string;
    since?: string;
    limit?: number;
    trustScoreByDid?: Record<string, number>;
    now?: number;
}

export interface AidSearchResult {
    items: RankedAid[];
    distanceMetersByPostId: Record<string, number>;
}

export interface DirectorySearchFilters {
    center?: SearchCenter;
    radiusMeters?: number;
    type?: DirectoryResourceType;
    text?: string;
    limit?: number;
}

export interface DirectorySearchResult {
    items: IndexedDirectoryResource[];
    distanceMetersByUri: Record<string, number>;
}

export interface IndexStoreSnapshot {
    aidPostCount: number;
    directoryResourceCount: number;
    tombstoneCount: number;
}

function addToSetMap<K extends string>(
    index: Map<K, Set<string>>,
    key: K,
    uri: string,
): void {
    const current = index.get(key) ?? new Set<string>();
    current.add(uri);
    index.set(key, current);
}

function removeFromSetMap<K extends string>(
    index: Map<K, Set<string>>,
    key: K,
    uri: string,
): void {
    const current = index.get(key);
    if (!current) {
        return;
    }

    current.delete(uri);
    if (current.size === 0) {
        index.delete(key);
    }
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

export class QueryIndexStore {
    private readonly aidByUri = new Map<string, IndexedAidPost>();
    private readonly directoryByUri = new Map<
        string,
        IndexedDirectoryResource
    >();
    private readonly tombstonesByUri = new Set<string>();
    private readonly aidByCategory = new Map<AidCategory, Set<string>>();
    private readonly aidByStatus = new Map<AidStatus, Set<string>>();
    private readonly directoryByType = new Map<
        DirectoryResourceType,
        Set<string>
    >();
    private readonly aidTextIndex = new InvertedTextIndex();
    private readonly directoryTextIndex = new InvertedTextIndex();

    constructor(private readonly minimumPrecisionMeters = 300) {}

    applyFirehoseEvent(event: NormalizedFirehoseEvent): void {
        switch (event.collection) {
            case atLexiconCollections.aidPost:
                if (event.deleted) {
                    this.removeAidPost(event.uri);
                    return;
                }

                this.upsertAidPost(
                    event.uri,
                    event.repoDid,
                    event.record as AidPostLexiconRecord,
                    event.indexedAt,
                );
                return;

            case atLexiconCollections.resourceDirectory:
                if (event.deleted) {
                    this.removeDirectoryResource(event.uri);
                    return;
                }

                this.upsertDirectoryResource(
                    event.uri,
                    event.record as ResourceDirectoryLexiconRecord,
                    event.indexedAt,
                );
                return;

            default:
                if (event.deleted) {
                    this.tombstonesByUri.add(event.uri);
                }
        }
    }

    private upsertAidPost(
        uri: string,
        authorDid: IndexedAidPost['authorDid'],
        record: AidPostLexiconRecord,
        indexedAt: string,
    ): void {
        const existing = this.aidByUri.get(uri);
        if (existing) {
            this.unindexAidPost(existing);
        }

        const normalizedLocation =
            record.location === undefined ?
                undefined
            :   normalizeIndexedLocation(
                    record.location,
                    this.minimumPrecisionMeters,
                );

        const indexedPost: IndexedAidPost = {
            uri,
            authorDid,
            id: record.id,
            title: record.title,
            description: record.description,
            category: record.category,
            urgency: record.urgency as IndexedAidPost['urgency'],
            status: record.status,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            location: normalizedLocation,
            accessibilityTags: record.accessibilityTags,
            indexedAt,
        };

        this.aidByUri.set(uri, indexedPost);
        this.tombstonesByUri.delete(uri);
        this.indexAidPost(indexedPost);
    }

    private indexAidPost(post: IndexedAidPost): void {
        addToSetMap(this.aidByCategory, post.category, post.uri);
        addToSetMap(this.aidByStatus, post.status, post.uri);
        this.aidTextIndex.indexDocument(post.uri, [
            post.title,
            post.description,
            post.accessibilityTags.join(' '),
            post.location?.areaLabel ?? '',
        ]);
    }

    private unindexAidPost(post: IndexedAidPost): void {
        removeFromSetMap(this.aidByCategory, post.category, post.uri);
        removeFromSetMap(this.aidByStatus, post.status, post.uri);
        this.aidTextIndex.removeDocument(post.uri);
    }

    private removeAidPost(uri: string): void {
        const existing = this.aidByUri.get(uri);
        if (existing) {
            this.unindexAidPost(existing);
            this.aidByUri.delete(uri);
        }

        this.tombstonesByUri.add(uri);
    }

    private upsertDirectoryResource(
        uri: string,
        record: ResourceDirectoryLexiconRecord,
        indexedAt: string,
    ): void {
        const existing = this.directoryByUri.get(uri);
        if (existing) {
            this.unindexDirectoryResource(existing);
        }

        const indexedResource: IndexedDirectoryResource = {
            uri,
            id: record.id,
            name: record.name,
            type: record.type,
            location: normalizeIndexedLocation(
                record.location,
                this.minimumPrecisionMeters,
            ),
            openHours: record.openHours,
            eligibilityNotes: record.eligibilityNotes,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            indexedAt,
        };

        this.directoryByUri.set(uri, indexedResource);
        this.tombstonesByUri.delete(uri);
        this.indexDirectoryResource(indexedResource);
    }

    private indexDirectoryResource(resource: IndexedDirectoryResource): void {
        addToSetMap(this.directoryByType, resource.type, resource.uri);
        this.directoryTextIndex.indexDocument(resource.uri, [
            resource.name,
            resource.openHours ?? '',
            resource.eligibilityNotes ?? '',
            resource.location.areaLabel ?? '',
        ]);
    }

    private unindexDirectoryResource(resource: IndexedDirectoryResource): void {
        removeFromSetMap(this.directoryByType, resource.type, resource.uri);
        this.directoryTextIndex.removeDocument(resource.uri);
    }

    private removeDirectoryResource(uri: string): void {
        const existing = this.directoryByUri.get(uri);
        if (existing) {
            this.unindexDirectoryResource(existing);
            this.directoryByUri.delete(uri);
        }

        this.tombstonesByUri.add(uri);
    }

    searchAidPosts(filters: AidSearchFilters = {}): AidSearchResult {
        let candidateUris = new Set(this.aidByUri.keys());

        if (filters.category) {
            candidateUris = intersectSets(
                candidateUris,
                this.aidByCategory.get(filters.category) ?? new Set(),
            );
        }

        if (filters.status) {
            candidateUris = intersectSets(
                candidateUris,
                this.aidByStatus.get(filters.status) ?? new Set(),
            );
        }

        if (filters.text && filters.text.trim().length > 0) {
            candidateUris = intersectSets(
                candidateUris,
                this.aidTextIndex.search(filters.text),
            );
        }

        const sinceMs = filters.since ? Date.parse(filters.since) : undefined;
        const distanceMetersByPostId: Record<string, number> = {};
        const distanceBandByPostId: Record<string, 'near' | 'mid' | 'far'> = {};

        const filtered = [...candidateUris]
            .map(uri => this.aidByUri.get(uri))
            .filter((post): post is IndexedAidPost => post !== undefined)
            .filter(post => {
                if (filters.minUrgency && post.urgency < filters.minUrgency) {
                    return false;
                }

                if (sinceMs !== undefined && !Number.isNaN(sinceMs)) {
                    const updatedAtMs = Date.parse(post.updatedAt);
                    if (Number.isNaN(updatedAtMs) || updatedAtMs < sinceMs) {
                        return false;
                    }
                }

                const distanceMeters =
                    filters.center && post.location ?
                        haversineDistanceMeters(filters.center, post.location)
                    :   undefined;

                if (!isWithinRadius(distanceMeters, filters.radiusMeters)) {
                    return false;
                }

                if (distanceMeters !== undefined) {
                    distanceMetersByPostId[post.id] = distanceMeters;
                }
                distanceBandByPostId[post.id] = toDistanceBand(distanceMeters);

                return true;
            });

        const ranked = rankAidCards(filtered, {
            now: filters.now,
            trustScoreByDid: filters.trustScoreByDid,
            distanceBandByPostId,
        });

        const limited = filters.limit ? ranked.slice(0, filters.limit) : ranked;
        const limitedDistanceMap: Record<string, number> = {};
        for (const post of limited) {
            const distance = distanceMetersByPostId[post.id];
            if (distance !== undefined) {
                limitedDistanceMap[post.id] = distance;
            }
        }

        return {
            items: limited,
            distanceMetersByPostId: limitedDistanceMap,
        };
    }

    searchDirectoryResources(
        filters: DirectorySearchFilters = {},
    ): DirectorySearchResult {
        let candidateUris = new Set(this.directoryByUri.keys());

        if (filters.type) {
            candidateUris = intersectSets(
                candidateUris,
                this.directoryByType.get(filters.type) ?? new Set(),
            );
        }

        if (filters.text && filters.text.trim().length > 0) {
            candidateUris = intersectSets(
                candidateUris,
                this.directoryTextIndex.search(filters.text),
            );
        }

        const distanceMetersByUri: Record<string, number> = {};
        const filtered = [...candidateUris]
            .map(uri => this.directoryByUri.get(uri))
            .filter(
                (resource): resource is IndexedDirectoryResource =>
                    resource !== undefined,
            )
            .filter(resource => {
                const distanceMeters =
                    filters.center ?
                        haversineDistanceMeters(
                            filters.center,
                            resource.location,
                        )
                    :   undefined;

                if (!isWithinRadius(distanceMeters, filters.radiusMeters)) {
                    return false;
                }

                if (distanceMeters !== undefined) {
                    distanceMetersByUri[resource.uri] = distanceMeters;
                }

                return true;
            })
            .sort((left, right) => {
                const leftDistance = distanceMetersByUri[left.uri];
                const rightDistance = distanceMetersByUri[right.uri];

                if (leftDistance !== undefined && rightDistance !== undefined) {
                    return leftDistance - rightDistance;
                }

                if (leftDistance !== undefined) {
                    return -1;
                }

                if (rightDistance !== undefined) {
                    return 1;
                }

                return left.name.localeCompare(right.name);
            });

        const limited =
            filters.limit ? filtered.slice(0, filters.limit) : filtered;
        const limitedDistanceMap: Record<string, number> = {};
        for (const resource of limited) {
            const distance = distanceMetersByUri[resource.uri];
            if (distance !== undefined) {
                limitedDistanceMap[resource.uri] = distance;
            }
        }

        return {
            items: limited,
            distanceMetersByUri: limitedDistanceMap,
        };
    }

    getSnapshot(): IndexStoreSnapshot {
        return {
            aidPostCount: this.aidByUri.size,
            directoryResourceCount: this.directoryByUri.size,
            tombstoneCount: this.tombstonesByUri.size,
        };
    }
}

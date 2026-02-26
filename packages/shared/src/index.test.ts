import assert from 'node:assert/strict';
import test from 'node:test';

import {
    computeFeedScore,
    enforceMinimumPublicPrecision,
    toPublicApproximateLocation,
} from './index.js';

test('enforceMinimumPublicPrecision coarsens precise locations', () => {
    const result = enforceMinimumPublicPrecision(
        { lat: 1, lng: 2, precisionMeters: 50 },
        300,
    );

    assert.equal(result.precisionMeters, 300);
});

test('toPublicApproximateLocation snaps coordinates to privacy grid', () => {
    const result = toPublicApproximateLocation(
        {
            lat: 1.300123,
            lng: 103.800456,
            precisionMeters: 120,
            areaLabel: 'Central',
        },
        300,
    );

    assert.equal(result.precisionMeters, 300);
    assert.notEqual(result.lat, 1.300123);
    assert.notEqual(result.lng, 103.800456);
    assert.equal(result.areaLabel, 'Central');
});

test('computeFeedScore favors higher urgency', () => {
    const now = Date.now();
    const high = computeFeedScore(
        {
            urgency: 5,
            trustScore: 0.8,
            distanceBand: 'near',
            createdAt: new Date(now).toISOString(),
        },
        now,
    );
    const low = computeFeedScore(
        {
            urgency: 1,
            trustScore: 0.8,
            distanceBand: 'near',
            createdAt: new Date(now).toISOString(),
        },
        now,
    );

    assert.ok(high > low);
});

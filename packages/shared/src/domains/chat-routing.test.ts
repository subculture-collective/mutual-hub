import assert from 'node:assert/strict';
import test from 'node:test';

import { routingFixtures } from './chat-routing.fixtures.js';
import type { RoutingDecisionInput } from './chat-routing.js';
import { decideChatRoute } from './chat-routing.js';

test('routing engine matches fixture expectations across representative scenarios', () => {
    for (const fixture of routingFixtures) {
        const decision = decideChatRoute(fixture.input);

        assert.equal(
            decision.destinationType,
            fixture.expectedDestination,
            `${fixture.name}: destination mismatch`,
        );
        assert.equal(
            decision.machineRationale.selectedRule,
            fixture.expectedRule,
            `${fixture.name}: rule mismatch`,
        );
        assert.ok(
            decision.machineRationale.traces.length >= 1,
            `${fixture.name}: expected non-empty trace`,
        );
        assert.ok(
            decision.humanRationale.length > 20,
            `${fixture.name}: human rationale should be informative`,
        );
    }
});

test('volunteer tie-break ordering is deterministic', () => {
    const input: RoutingDecisionInput = {
        requesterDid: 'did:plc:req',
        postAuthorDid: 'did:plc:author',
        postUri: 'at://did:plc:author/com.mutualaid.hub.aidPost/post-1',
        postCategory: 'food' as const,
        postAuthorReachable: false,
        volunteerCandidates: [
            {
                did: 'did:plc:vol-b',
                verified: true,
                acceptsChats: true,
                supportedCategories: ['food'] as const,
                distanceMeters: 500,
            },
            {
                did: 'did:plc:vol-a',
                verified: true,
                acceptsChats: true,
                supportedCategories: ['food'] as const,
                distanceMeters: 500,
            },
        ],
    };

    const first = decideChatRoute(input);
    const second = decideChatRoute(input);

    assert.equal(first.destinationType, 'volunteer_pool');
    assert.equal(second.destinationType, 'volunteer_pool');
    assert.equal(first.destinationId, 'did:plc:vol-a');
    assert.equal(first.destinationId, second.destinationId);
});

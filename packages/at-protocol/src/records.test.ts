import assert from "node:assert/strict";
import test from "node:test";

import { atLexiconCollections } from "@mutual-hub/at-lexicons";

import { AtRecordRepository, createRecordUri, isRecordValidationError } from "./records.js";

const nowIso = new Date().toISOString();

function createAidPostRecord() {
  return {
    id: "aid-1",
    title: "Need warm meals",
    description: "Family of two needs meals tonight.",
    category: "food",
    urgency: 4,
    status: "open",
    createdAt: nowIso,
    updatedAt: nowIso,
    accessibilityTags: ["low-sodium"],
  };
}

test("record repository validates and stores create/update flow", () => {
  const repository = new AtRecordRepository();
  const created = repository.createRecord({
    repoDid: "did:plc:author123",
    collection: atLexiconCollections.aidPost,
    rkey: "r1",
    record: createAidPostRecord(),
  });

  assert.equal(created.version, 1);

  const updated = repository.updateRecord({
    uri: created.uri,
    record: {
      ...createAidPostRecord(),
      title: "Need warm meals and drinking water",
    },
  });

  assert.equal(updated.version, 2);
  assert.equal("title" in updated.value, true);
  if (!("title" in updated.value)) {
    throw new Error("Expected updated record to include title");
  }
  assert.equal(updated.value.title, "Need warm meals and drinking water");
});

test("record repository creates tombstones and hides deleted records", () => {
  const repository = new AtRecordRepository();
  const uri = createRecordUri("did:plc:author456", atLexiconCollections.aidPost, "r2");

  repository.createRecord({
    repoDid: "did:plc:author456",
    collection: atLexiconCollections.aidPost,
    rkey: "r2",
    record: createAidPostRecord(),
  });

  const tombstone = repository.deleteRecord({
    uri,
    reason: "request closed",
  });

  assert.equal(tombstone.reason, "request closed");
  assert.equal(repository.getRecord(uri), undefined);
  assert.equal(repository.listTombstones().length, 1);
});

test("invalid records fail with validation error", () => {
  const repository = new AtRecordRepository();

  assert.throws(
    () => {
      repository.createRecord({
        repoDid: "did:plc:author789",
        collection: atLexiconCollections.aidPost,
        rkey: "r3",
        record: {
          id: "bad-post",
          title: "Bad",
          description: "Missing required fields",
        },
      });
    },
    (error: unknown) => isRecordValidationError(error),
  );
});

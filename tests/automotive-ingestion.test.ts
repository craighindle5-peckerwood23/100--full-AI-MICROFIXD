import assert from "node:assert/strict";
import test from "node:test";
import { buildNhtsaUrl, fetchNhtsa, type IngestionRecord } from "../server/automotive/nhtsa-ingestion.js";

test("URL encoding and input validation", () => {
  const url = buildNhtsaUrl("recalls", { make: "Land Rover", model: "Range Rover", modelYear: 2018 });
  assert.equal(new URL(url).searchParams.get("make"), "Land Rover");
  assert.throws(() => buildNhtsaUrl("recalls", { make: "x", model: "x", modelYear: 0 }));
  assert.throws(() => buildNhtsaUrl("recalls", { make: "https://evil.test", model: "x", modelYear: 2020 }));
});
test("ingestion stores deduplicable provenance and digest", async () => {
  const records: IngestionRecord[] = [];
  const mock = async () => new Response(JSON.stringify({ results: [
    { NHTSACampaignNumber: "24V123000", Component: "ELECTRICAL SYSTEM" }
  ] }), { status: 200 });
  const result = await fetchNhtsa("recalls", { make: "BMW", model: "335i", modelYear: 2010 },
    { upsert: async (r) => { records.push(r); } }, mock as typeof fetch);
  assert.equal(result.stored, 1);
  assert.equal(records[0].sourceKey, "24V123000");
  assert.match(records[0].contentSha256, /^[a-f0-9]{64}$/);
});
test("rejects malformed API payload", async () => {
  await assert.rejects(fetchNhtsa("complaints", { make: "BMW", model: "335i", modelYear: 2010 },
    { upsert: async () => {} }, (async () => new Response(JSON.stringify({ error: true }))) as typeof fetch));
});

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolveTypedObject, resolveExecutableOrgans, serializeTypedObject } from "../server/classification/typedObjects.ts";

const topology = JSON.parse(readFileSync("microfixd/topology.json", "utf8"));
const wiring = JSON.parse(readFileSync("microfixd/wiring.json", "utf8"));
const executorSource = readFileSync("server/organs/executors.ts", "utf8");
const executorIds = new Set([...executorSource.matchAll(/^  ([a-z_]+): execute\w+Organ,/gm)].map(match => match[1]));
assert.deepEqual(topology.objectTypes, ["agent", "organ", "node", "runtime", "server"]);
assert.equal(new Set(topology.objects.map(item => `${item.kind}:${item.id}`)).size, topology.objects.length);

for (const entry of topology.objects) {
  assert.ok(existsSync(entry.source), `Missing source: ${entry.source}`);
  const output = JSON.parse(serializeTypedObject({ type: entry.kind, id: entry.id }));
  assert.equal(output.type, entry.kind);
  assert.equal(output.id, entry.id);
  assert.equal(output.source, entry.source);
}
for (const entry of topology.organs) {
  assert.ok(existsSync(entry.node), `Missing node: ${entry.node}`);
  assert.equal(wiring.classificationRoutes[entry.id], entry.source);
  assert.ok(wiring.connections.some(edge => edge.source === "classifier" && edge.target === entry.id && edge.node === entry.node));
  if (entry.layer === "server") assert.equal(entry.executable, executorIds.has(entry.id));
  if (entry.executable) assert.deepEqual(resolveExecutableOrgans([entry.id]), [entry.id]);
}
for (const input of [{ id: "brain" }, { type: "blob", id: "brain" }, { type: "organ", id: "missing" }]) {
  assert.throws(() => resolveTypedObject(input));
}
assert.equal(resolveTypedObject({ type: "microfixed.organ", id: "brain" }).type, "organ");
console.log(`Validated ${topology.objects.length} typed objects and ${topology.organs.length} organ routes`);

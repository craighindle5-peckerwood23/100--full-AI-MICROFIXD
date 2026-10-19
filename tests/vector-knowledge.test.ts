import test from "node:test";
import assert from "node:assert/strict";
import { rankByObservedFrequency, validateReference, assessToolEnvelope } from "../server/automotive/vector-knowledge";

test("never invents probability from a tiny sample", () => {
 const x = rankByObservedFrequency([{hypothesisId:"coil",confirmedCases:2,sampleSize:3,
 population:"shop repairs",methodology:"verified repair",sourceId:"s"}]);
 assert.equal(x[0].observedFrequency,null);
});
test("qualified counts are labeled frequencies, not predictions", () => {
 const x = rankByObservedFrequency([{hypothesisId:"coil",confirmedCases:30,sampleSize:100,
 population:"shop repairs",methodology:"verified repair",sourceId:"s"}]);
 assert.equal(x[0].observedFrequency,0.3);
 assert.equal(x[0].classification,"observed_frequency_only");
});
test("rejects unlicensed full text", () => {
 assert.throws(() => validateReference({publisher:"X",title:"Manual",url:"https://example.com",
 rightsStatus:"metadata_only",fullText:"copyrighted"}));
});
test("geometry fit is conservative without measurements", () => {
 const result = assessToolEnvelope({widthMm:50,heightMm:30,depthMm:100,
 clearanceMm:5,measurementVerified:false},{widthMm:10,heightMm:10,depthMm:10});
 assert.equal(result.fit,"unverified");
});

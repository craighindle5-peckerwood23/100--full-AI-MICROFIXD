/** Read-only automotive knowledge algorithms; no vehicle write commands. */
export type VehicleApplication = {
  make: string; model: string; year: number; trim?: string; engineCode?: string;
  transmissionCode?: string; drivetrain?: string; market?: string;
};
export type RepairEvidence = {
  hypothesisId: string; confirmedCases: number; sampleSize: number;
  population: string; methodology: string; sourceId: string;
};
export type RankedHypothesis = {
  hypothesisId: string; observedFrequency: number | null; sampleSize: number;
  classification: "insufficient_evidence" | "observed_frequency_only";
  explanation: string;
};
/** These frequencies are not calibrated probabilities of a repair succeeding. */
export function rankByObservedFrequency(evidence: RepairEvidence[], minimumSample = 30): RankedHypothesis[] {
  return evidence.map((e): RankedHypothesis => {
    if (!Number.isInteger(e.sampleSize) || !Number.isInteger(e.confirmedCases) ||
        e.sampleSize <= 0 || e.confirmedCases < 0 || e.confirmedCases > e.sampleSize)
      throw new Error("Invalid evidence counts");
    const eligible = e.sampleSize >= minimumSample && Boolean(e.population && e.methodology && e.sourceId);
    return {
      hypothesisId: e.hypothesisId, sampleSize: e.sampleSize,
      observedFrequency: eligible ? e.confirmedCases / e.sampleSize : null,
      classification: eligible ? "observed_frequency_only" : "insufficient_evidence",
      explanation: eligible
        ? "Observed frequency in the cited population; not a vehicle-specific diagnosis or calibrated repair prediction"
        : "Insufficient documented sample or provenance to display a percentage",
    };
  }).sort((a,b) => (b.observedFrequency ?? -1) - (a.observedFrequency ?? -1));
}
export type ReferenceCandidate = {
  publisher: string; title: string; url: string; rightsStatus:
    "metadata_only" | "licensed" | "public_domain" | "permission_granted";
  fullText?: string;
};
export function validateReference(candidate: ReferenceCandidate) {
  const url = new URL(candidate.url);
  if (url.protocol !== "https:") throw new Error("HTTPS reference required");
  if (!candidate.publisher.trim() || !candidate.title.trim()) throw new Error("Missing provenance");
  if (candidate.rightsStatus === "metadata_only" && candidate.fullText)
    throw new Error("Cannot ingest full text without rights");
  return { publisher: candidate.publisher, title: candidate.title, url: url.toString(),
    rightsStatus: candidate.rightsStatus, fullText: candidate.fullText ?? null };
}
export type GeometryEnvelope = {
  widthMm: number; heightMm: number; depthMm: number;
  clearanceMm: number; measurementVerified: boolean;
};
export function assessToolEnvelope(space: GeometryEnvelope, tool: Pick<GeometryEnvelope,"widthMm"|"heightMm"|"depthMm">) {
  const dims = [space.widthMm,space.heightMm,space.depthMm,space.clearanceMm,
    tool.widthMm,tool.heightMm,tool.depthMm];
  if (dims.some(x => !Number.isFinite(x) || x < 0)) throw new Error("Invalid dimensions");
  if (!space.measurementVerified) return { fit: "unverified" as const, reason: "Geometry requires measured verification" };
  const fits = tool.widthMm + space.clearanceMm <= space.widthMm &&
    tool.heightMm + space.clearanceMm <= space.heightMm &&
    tool.depthMm + space.clearanceMm <= space.depthMm;
  return { fit: fits ? "candidate" as const : "no_fit" as const,
    reason: fits ? "Bounding-box fit only; access path, loads and safety require engineering review" :
      "Tool bounding box exceeds measured clearance" };
}

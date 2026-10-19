import { z } from 'zod';
const text = z.string().trim().min(1).max(4000);
export const vehicleSchema = z.object({
  vin: z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/).optional(),
  year: z.number().int().min(1981).max(new Date().getFullYear()+2),
  make: text.max(80), model: text.max(80), engine: text.max(120),
}).strict();
export const testSchema = z.object({id:text.max(80),title:text.max(200),procedure:text,
  expected:text,verification:text, risk:z.enum(['routine','specialist']), minutes:z.number().int().min(1).max(1440)}).strict();
export const knowledgeSchema = z.object({
  source:z.string().url().max(2000).refine(s=>s.startsWith('https://'),'HTTPS source required'),
  title:text.max(300), excerpt:text, make:text.max(80), model:text.max(80), engine:text.max(120),
  yearFrom:z.number().int().min(1981),yearTo:z.number().int().max(2100),
  dtcs:z.array(z.string().regex(/^[PBCU][0-3][0-9A-F]{3}$/)).max(30),
  symptoms:z.array(text.max(100)).max(20),cause:text.max(300),repair:text,
  test:testSchema,
}).strict().refine(k=>k.yearFrom<=k.yearTo,'Invalid year range');
export const createCaseSchema = z.object({vehicleId:z.string().uuid(),complaint:text,
  dtcs:z.array(z.string().trim().toUpperCase().regex(/^[PBCU][0-3][0-9A-F]{3}$/)).max(30),
  hazards:z.array(z.enum(['brakes','steering','fuel_leak','overheating','high_voltage','airbag'])).max(6).default([]),
}).strict();
export const actionSchema = z.discriminatedUnion('type',[
  z.object({type:z.literal('observe'),revision:z.number().int().min(0),hypothesisId:z.string().uuid(),testId:text.max(80),finding:text,assessment:z.enum(['supports','refutes','inconclusive']),specialistConfirmed:z.boolean().default(false)}).strict(),
  z.object({type:z.literal('repair'),revision:z.number().int().min(0),hypothesisId:z.string().uuid(),workPerformed:text,technicianConfirmed:z.literal(true)}).strict(),
  z.object({type:z.literal('verify'),revision:z.number().int().min(0),finding:text,complaintResolved:z.boolean(),dtcsAbsent:z.boolean(),testPassed:z.boolean(),technicianConfirmed:z.literal(true)}).strict(),
]);
export type Vehicle = z.infer<typeof vehicleSchema> & {id:string};
export type Knowledge = z.infer<typeof knowledgeSchema> & {id:string};
export type Hypothesis = {id:string; evidence:Knowledge; status:'untested'|'supported'|'refuted'|'inconclusive'; observations:{testId:string;finding:string;assessment:string;actor:string;at:string}[]};
export type DiagnosticCase = {id:string;vehicle:Vehicle;complaint:string;dtcs:string[];hazards:string[];state:'needs_evidence'|'testing'|'repair_recorded'|'verified';revision:number;hypotheses:Hypothesis[];alerts:string[];repair?:{hypothesisId:string;workPerformed:string;actor:string;at:string};events:{type:string;actor:string;at:string;detail:unknown}[]};

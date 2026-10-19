import {randomUUID} from 'node:crypto';
import type {Knowledge,Hypothesis} from '../schemas';
export function generateHypotheses(evidence:Knowledge[]):Hypothesis[] {
  return evidence.slice(0,20).map(k=>({id:randomUUID(),evidence:k,status:'untested',observations:[]}));
}

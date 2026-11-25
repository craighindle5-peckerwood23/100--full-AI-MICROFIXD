import { Router } from 'express';
import { getLiveBridgeStatus } from './liveVisionVoiceBridge';
import { shapeIntelligentSpeech } from '../../src/voice/speechFeedbackCoordinator';

export const realtimeRouter = Router();

realtimeRouter.get('/live/status', (_req, res) => {
  res.json(getLiveBridgeStatus());
});

realtimeRouter.post('/speech/shape', (req, res) => {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 32000) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_SPEECH_INPUT',
      error: 'text (1-32000 chars) required',
    });
  }

  const urgency = body.urgency === 'critical' || body.urgency === 'high' ? body.urgency : 'normal';
  const result = shapeIntelligentSpeech({
    text,
    source: typeof body.source === 'string' ? body.source : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
    urgency,
    maxSummaryChars: typeof body.maxSummaryChars === 'number' ? body.maxSummaryChars : undefined,
  });

  return res.json({ success: true, ...result });
});

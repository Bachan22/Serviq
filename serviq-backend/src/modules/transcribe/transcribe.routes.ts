import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface TranscribeBody {
  audioBase64?: string;
  mimeType?: string;
  lang?: string;
  durationSec?: number;
}

export async function transcribeRoutes(fastify: FastifyInstance) {
  // Rate limit: 10 requests per minute per user/IP
  fastify.post(
    '/api/transcribe',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest<{ Body: TranscribeBody }>, reply: FastifyReply) => {
      const apiKey = process.env.TRANSCRIBE_API_KEY;
      if (!apiKey) {
        return reply.status(503).send({
          success: false,
          error: {
            code: 'NOT_CONFIGURED',
            message: 'Server transcription provider not configured',
          },
        });
      }

      const { audioBase64, mimeType = 'audio/webm', lang = 'hi', durationSec } = request.body || {};

      if (!audioBase64 || typeof audioBase64 !== 'string') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Missing audioBase64 payload',
          },
        });
      }

      // Duration validation: max 15 seconds
      if (durationSec != null && durationSec > 15) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Audio clip duration exceeds 15 seconds limit',
          },
        });
      }

      // Size validation: max 2 MB
      const buffer = Buffer.from(audioBase64, 'base64');
      if (buffer.length > 2 * 1024 * 1024) {
        return reply.status(413).send({
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Audio file size exceeds 2 MB limit',
          },
        });
      }

      try {
        const endpoint = process.env.TRANSCRIBE_ENDPOINT || 'https://api.openai.com/v1/audio/transcriptions';
        const model = process.env.TRANSCRIBE_MODEL || 'whisper-1';

        const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('wav') ? 'wav' : 'webm';
        const formData = new FormData();
        const blob = new Blob([buffer], { type: mimeType });
        formData.append('file', blob, `audio.${ext}`);
        formData.append('model', model);
        formData.append('language', lang.startsWith('en') ? 'en' : 'hi');

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errText = await response.text();
          return reply.status(502).send({
            success: false,
            error: {
              code: 'TRANSCRIPTION_FAILED',
              message: `Provider error: ${errText.slice(0, 200)}`,
            },
          });
        }

        const data: any = await response.json();
        return reply.send({
          success: true,
          data: {
            transcript: data.text || '',
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: err?.message || 'Failed to process audio transcription',
          },
        });
      }
    }
  );
}

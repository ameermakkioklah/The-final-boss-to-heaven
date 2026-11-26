import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Lazy-initialized shared Gemini client following @google/genai server guidelines
let cachedAi: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  if (!cachedAi) {
    cachedAi = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAi;
}

interface VoicePromptSpec {
  voiceName: 'Charon' | 'Fenrir';
  scriptedText: string;
  style: string;
}

const WARRIOR_BASE_STYLE =
  'Gritty, raspy, low-pitched masculine voice of a battle-worn warrior who is severely exhausted, bleeding, and pushed to his physical limit. Raw close-mic performance with natural breath sounds, subtle vocal fry, and minimal room reverb.';

const DRAGON_BASE_STYLE =
  'Monstrous, cavernous, deeply resonant bass voice of an ancient terrifying dragon—arrogant, narcissistic, sadistic, dripping with cold superiority. Heavy low-end chest warmth, slow deliberate emphasis, and clean intelligible English articulation.';

function buildVoicePrompt(params: {
  cueId: string;
  speaker: 'warrior' | 'dragon';
  text: string;
  delivery: string;
  isBanter?: boolean;
}): VoicePromptSpec {
  const { cueId, speaker, text, isBanter } = params;

  if (speaker === 'warrior') {
    if (cueId === 'intro_stammer') {
      return {
        voiceName: 'Charon',
        scriptedText: '<breath> I... <gasp> I c-can do this... <breath>',
        style: `${WARRIOR_BASE_STYLE} Exhausted and stammering: slow, breathless, hesitant breaks between syllables, strained vocal cords, slight tremor, heavy ragged exhale.`,
      };
    }
    if (cueId === 'intro_resolve') {
      return {
        voiceName: 'Charon',
        scriptedText:
          'Only one left... <breath> and I can finally break free from this reality. I will end him.',
        style: `${WARRIOR_BASE_STYLE} Grim resolve: strained and low, pushing through pain, labored breathing carrying a quiet spark of stubbornness and defiance.`,
      };
    }
    if (cueId === 'warrior_recover') {
      return {
        voiceName: 'Charon',
        scriptedText: '<laugh> <breath> Do you think I give up that easily?',
        style: `${WARRIOR_BASE_STYLE} Defiant recovery: a tired, raspy, bruised chuckle turning into gritty low-pitched determination.`,
      };
    }
    if (cueId === 'victory_whisper') {
      return {
        voiceName: 'Charon',
        scriptedText: 'I... <breath> won...',
        style: `${WARRIOR_BASE_STYLE} Faint victory: very quiet, trembling, wounded, barely above a ragged exhausted whisper.`,
      };
    }
    return {
      voiceName: 'Charon',
      scriptedText: text,
      style: WARRIOR_BASE_STYLE,
    };
  }

  // Dragon speaker
  if (cueId === 'dragon_pity') {
    return {
      voiceName: 'Fenrir',
      scriptedText: '<laugh> How pathetic... I pity you. All this... for what?',
      style: `${DRAGON_BASE_STYLE} Opens with a deep, booming, menacing laugh echoing with dark amusement and cruelty, then slow, condescending, mocking pity treating the warrior like an insignificant insect.`,
    };
  }
  if (cueId === 'dragon_die') {
    return {
      voiceName: 'Fenrir',
      scriptedText: 'Die!',
      style: `${DRAGON_BASE_STYLE} Sudden lethal strike: fast, sharp, explosive, vicious snarl with brutal aggressive bite.`,
    };
  }
  if (cueId === 'defeat_mockery') {
    return {
      voiceName: 'Fenrir',
      scriptedText: '<laugh> How utterly pathetic.',
      style: `${DRAGON_BASE_STYLE} Victory over the warrior after devouring him: loud cruel laugh followed by haughty, cold, supreme narcissistic arrogance.`,
    };
  }

  return {
    voiceName: 'Fenrir',
    scriptedText: text,
    style: isBanter
      ? `${DRAGON_BASE_STYLE} Mid-fight arrogant banter: cold, narcissistic, boastful, belittling—speaking like an untouchable apex predator.`
      : DRAGON_BASE_STYLE,
  };
}

// Bounded server-side WAV cache & in-flight deduplication
const MAX_VOICE_CACHE = 64;
const voiceWavCache = new Map<string, string>();
const inFlightVoiceRequests = new Map<string, Promise<string>>();

async function synthesizeCueWavBase64(params: {
  cueId: string;
  speaker: 'warrior' | 'dragon';
  text: string;
  delivery: string;
  isBanter?: boolean;
}): Promise<string> {
  const cacheKey = `${params.speaker}:${params.cueId}:${params.text}`;
  const cached = voiceWavCache.get(cacheKey);
  if (cached) return cached;

  const existingPromise = inFlightVoiceRequests.get(cacheKey);
  if (existingPromise) return existingPromise;

  const task = (async () => {
    const ai = getGeminiClient();
    const spec = buildVoicePrompt(params);

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: spec.scriptedText,
              speechMetadata: {
                style: spec.style,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: spec.voiceName,
            },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find((p) => p.inlineData?.data);
    const base64Audio = audioPart?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('Voice synthesis returned no audio payload.');
    }

    if (voiceWavCache.size >= MAX_VOICE_CACHE) {
      const oldestKey = voiceWavCache.keys().next().value;
      if (oldestKey) voiceWavCache.delete(oldestKey);
    }
    voiceWavCache.set(cacheKey, base64Audio);
    return base64Audio;
  })();

  inFlightVoiceRequests.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlightVoiceRequests.delete(cacheKey);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, voiceEnabled: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.post('/api/voice', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown> | null;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Invalid JSON request body.' });
        return;
      }

      const rawSpeaker = body.speaker;
      const rawCueId = body.cueId;
      const rawText = body.text;
      const rawDelivery = body.delivery;
      const rawBanter = body.isBanter;

      if (rawSpeaker !== 'warrior' && rawSpeaker !== 'dragon') {
        res.status(400).json({ error: 'speaker must be "warrior" or "dragon".' });
        return;
      }
      if (typeof rawText !== 'string' || rawText.trim().length === 0 || rawText.length > 220) {
        res.status(400).json({ error: 'text must be a non-empty string up to 220 characters.' });
        return;
      }
      const cueId = typeof rawCueId === 'string' ? rawCueId.slice(0, 64) : 'custom';
      const delivery = typeof rawDelivery === 'string' ? rawDelivery.slice(0, 32) : 'normal';
      const isBanter = Boolean(rawBanter);

      const audioBase64 = await synthesizeCueWavBase64({
        cueId,
        speaker: rawSpeaker,
        text: rawText.trim(),
        delivery,
        isBanter,
      });

      res.json({
        audioBase64,
        mimeType: 'audio/wav',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Voice generation failed.';
      const status =
        message.includes('not configured')
          ? 503
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : 500;
      res.status(status).json({ error: message });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();

import { GoogleGenAI } from '@google/genai';

const WARRIOR_BASE_STYLE =
  'Gritty, raspy, low-pitched masculine voice of a battle-worn warrior who is severely exhausted, bleeding, and pushed to his physical limit. Raw close-mic performance with natural breath sounds, subtle vocal fry, and minimal room reverb.';

const DRAGON_BASE_STYLE =
  'Monstrous, cavernous, deeply resonant bass voice of an ancient terrifying dragon—arrogant, narcissistic, sadistic, dripping with cold superiority. Heavy low-end chest warmth, slow deliberate emphasis, and clean intelligible English articulation.';

function buildPrompt(params: {
  cueId: string;
  speaker: 'warrior' | 'dragon';
  text: string;
  isBanter: boolean;
}) {
  const { cueId, speaker, text, isBanter } = params;
  if (speaker === 'warrior') {
    if (cueId === 'intro_stammer') {
      return {
        voiceName: 'Charon' as const,
        scriptedText: '<breath> I... <gasp> I c-can do this... <breath>',
        plainText: 'I... I c-can do this...',
        style: `${WARRIOR_BASE_STYLE} Exhausted and stammering: slow, breathless, hesitant breaks between syllables, strained vocal cords, slight tremor, heavy ragged exhale.`,
      };
    }
    if (cueId === 'intro_resolve') {
      return {
        voiceName: 'Charon' as const,
        scriptedText:
          'Only one left... <breath> and I can finally break free from this reality. I will end him.',
        plainText:
          'Only one left... and I can finally break free from this reality. I will end him.',
        style: `${WARRIOR_BASE_STYLE} Grim resolve: strained and low, pushing through pain, labored breathing carrying a quiet spark of stubbornness and defiance.`,
      };
    }
    if (cueId === 'warrior_recover') {
      return {
        voiceName: 'Charon' as const,
        scriptedText: '<laugh> <breath> Do you think I give up that easily?',
        plainText: 'Heh... Do you think I give up that easily?',
        style: `${WARRIOR_BASE_STYLE} Defiant recovery: a tired, raspy, bruised chuckle turning into gritty low-pitched determination.`,
      };
    }
    if (cueId === 'victory_whisper') {
      return {
        voiceName: 'Charon' as const,
        scriptedText: 'I... <breath> won...',
        plainText: 'I... won...',
        style: `${WARRIOR_BASE_STYLE} Faint victory: very quiet, trembling, wounded, barely above a ragged exhausted whisper.`,
      };
    }
    return {
      voiceName: 'Charon' as const,
      scriptedText: text,
      plainText: text,
      style: WARRIOR_BASE_STYLE,
    };
  }

  if (cueId === 'dragon_pity') {
    return {
      voiceName: 'Fenrir' as const,
      scriptedText: '<laugh> How pathetic... I pity you. All this... for what?',
      plainText: 'How pathetic... I pity you. All this... for what?',
      style: `${DRAGON_BASE_STYLE} Opens with a deep, booming, menacing laugh echoing with dark amusement and cruelty, then slow, condescending, mocking pity treating the warrior like an insignificant insect.`,
    };
  }
  if (cueId === 'dragon_die') {
    return {
      voiceName: 'Fenrir' as const,
      scriptedText: 'Die!',
      plainText: 'Die!',
      style: `${DRAGON_BASE_STYLE} Sudden lethal strike: fast, sharp, explosive, vicious snarl with brutal aggressive bite.`,
    };
  }
  if (cueId === 'defeat_mockery') {
    return {
      voiceName: 'Fenrir' as const,
      scriptedText: '<laugh> How utterly pathetic.',
      plainText: 'How utterly pathetic.',
      style: `${DRAGON_BASE_STYLE} Victory over the warrior after devouring him: loud cruel laugh followed by haughty, cold, supreme narcissistic arrogance.`,
    };
  }

  return {
    voiceName: 'Fenrir' as const,
    scriptedText: text,
    plainText: text,
    style: isBanter
      ? `${DRAGON_BASE_STYLE} Mid-fight arrogant banter: cold, narcissistic, boastful, belittling—speaking like an untouchable apex predator.`
      : DRAGON_BASE_STYLE,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'GEMINI_API_KEY is not configured on this server.' },
        { status: 503 },
      );
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const speaker = body.speaker;
    const text = body.text;
    if (speaker !== 'warrior' && speaker !== 'dragon') {
      return Response.json({ error: 'speaker must be "warrior" or "dragon".' }, { status: 400 });
    }
    if (typeof text !== 'string' || text.trim().length === 0 || text.length > 220) {
      return Response.json(
        { error: 'text must be a non-empty string up to 220 characters.' },
        { status: 400 },
      );
    }

    const cueId = typeof body.cueId === 'string' ? body.cueId.slice(0, 64) : 'custom';
    const isBanter = Boolean(body.isBanter);
    const spec = buildPrompt({ cueId, speaker, text: text.trim(), isBanter });

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const synthesize = async (model: 'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts') => {
      const resp = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: model === 'gemini-3.8-flash-tts' ? spec.scriptedText : spec.plainText,
                speechMetadata: { style: spec.style },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: spec.voiceName } },
          },
        },
      });
      const audio = resp.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
      if (!audio) throw new Error(`${model} returned no audio payload.`);
      return audio;
    };

    let audioBase64: string;
    try {
      audioBase64 = await synthesize('gemini-3.8-flash-tts');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        audioBase64 = await synthesize('gemini-3.8-flash-lite-tts');
      } else {
        throw err;
      }
    }

    return Response.json({ audioBase64, mimeType: 'audio/wav' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Voice generation failed.';
    const status = message.includes('429') || message.includes('RESOURCE_EXHAUSTED') ? 429 : 500;
    return Response.json({ error: message }, { status });
  }
}

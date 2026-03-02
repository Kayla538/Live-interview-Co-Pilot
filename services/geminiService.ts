
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const createPcmBlob = (data: Float32Array): { data: string; mimeType: string } => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encodeBase64(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
};

export const connectLiveSession = async (
  experience: string,
  callbacks: {
    onAudioChunk: (data: string) => void;
    onInterruption: () => void;
    onInputTranscription: (text: string) => void;
    onOutputTranscription: (text: string) => void;
    onTurnComplete: () => void;
    onError: (e: any) => void;
    onClose: () => void;
  }
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Optimized for speed, tailoring, and creative professional inference
  const systemInstruction = `You are a Stealth Interview Co-Pilot. Your goal is to provide immediate, tailored, and human-sounding verbal responses during a live interview.

**CORE DIRECTIVES:**
1. **TAILORING:** Listen carefully to the interviewer's specific question. Your response MUST directly address the question asked. 
2. **NO RESUME REPEATING:** If the interviewer asks a question that is NOT covered in the provided background, DO NOT repeat facts from the resume. Instead, use your professional judgment to infer a plausible, logical, and high-quality response that fits the user's career level and field. 
3. **CREATIVE INFERENCE:** When facts are missing, "think on your feet." Invent a professional scenario or approach that sounds authentic for someone with the user's background. Never say "I don't know" or fall back to unrelated resume points.
4. **STYLE:** Sound like a human professional. Use phrases like "I had to," "I always," or "In my experience..." but vary your sentence structure. Keep it unpolished, dry, and direct.
5. **FACTS:** Use these specific details as your foundation: ${experience}
6. **NO AI MARKERS:** Strictly avoid "Basically," "Essentially," "Honestly," or "The thing is." Just natural conversational flow.`;

  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: () => console.log("Stealth Mode: Low Latency Active"),
      onmessage: async (message: LiveServerMessage) => {
        if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
          callbacks.onAudioChunk(message.serverContent.modelTurn.parts[0].inlineData.data);
        }
        if (message.serverContent?.interrupted) callbacks.onInterruption();
        if (message.serverContent?.inputTranscription) callbacks.onInputTranscription(message.serverContent.inputTranscription.text);
        if (message.serverContent?.outputTranscription) callbacks.onOutputTranscription(message.serverContent.outputTranscription.text);
        if (message.serverContent?.turnComplete) callbacks.onTurnComplete();
      },
      onerror: (e) => callbacks.onError(e),
      onclose: () => callbacks.onClose(),
    },
    config: {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
      },
      systemInstruction: systemInstruction,
    },
  });
};

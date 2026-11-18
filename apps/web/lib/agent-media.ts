export const maxAgentAudioBytes = 4 * 1024 * 1024;
export const maxAgentSpeechChars = 4000;
export type AgentCitation = { end: number; url: string; title: string };

export const agentAudioExtensions: Readonly<Record<string, string>> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/x-m4a": "m4a",
};

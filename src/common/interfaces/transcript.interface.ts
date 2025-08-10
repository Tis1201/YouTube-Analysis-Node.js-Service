// ElevenLabs API response interfaces

export interface ElevenLabsWord {
  word: string;
  start_time: number;
  end_time: number;
  speaker?: string;
}

export interface ElevenLabsSegment {
  text: string;
  start: number;
  end: number;
  speaker?: string;
  words?: ElevenLabsWord[];
}

export interface ElevenLabsTranscript {
  data?: {
    words?: ElevenLabsWord[];
    segments?: ElevenLabsSegment[];
  };
  words?: ElevenLabsWord[];
  segments?: ElevenLabsSegment[];
  text?: string;
  duration?: number;
}

// Alternative interfaces for different API response formats
export interface ElevenLabsTranscriptResponse {
  transcript: ElevenLabsTranscript;
  metadata?: {
    duration: number;
    language?: string;
    model?: string;
  };
}

export interface TranscriptWord {
  word: string;
  start_time: number;
  end_time: number;
  speaker?: string | null;
}

export interface TranscriptData {
  words: TranscriptWord[];
  segments?: any[];
}
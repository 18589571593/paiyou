export enum AudioSourceType {
  FILE = 'FILE',
  MICROPHONE = 'MICROPHONE',
  SYSTEM = 'SYSTEM'
}

export interface TranscriptionState {
  text: string;
  isProcessing: boolean;
  error: string | null;
}

export interface TextProcessState {
  text: string | null;
  isProcessing: boolean;
  error: string | null;
}

export interface MediaFile {
  file: File | null;
  previewUrl: string | null;
  type: 'audio' | 'video' | null;
}

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing';
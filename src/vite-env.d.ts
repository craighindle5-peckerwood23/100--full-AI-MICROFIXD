/// <reference types="vite/client" />

declare interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

declare interface SpeechRecognitionErrorEvent extends Event { error: string; }
declare interface SpeechRecognitionResultList { readonly length: number; [index: number]: SpeechRecognitionResult; }
declare interface SpeechRecognitionResult { readonly isFinal: boolean; readonly length: number; [index: number]: SpeechRecognitionAlternative; }
declare interface SpeechRecognitionAlternative { readonly transcript: string; readonly confidence: number; }
declare interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
declare const SpeechRecognition: { new (): SpeechRecognition };

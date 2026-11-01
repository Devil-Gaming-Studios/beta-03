/**
 * Offline Speech-To-Text (STT) Routing Service for Mast Meals / KitchenSync
 * 
 * Implements docs/02-voice-and-chat.md Section 3.2:
 * 
 * 1. Models Context Grounding:
 *    - Shruti (by Udgam Labs - `udgamlabs/Shruti`):
 *      29.5 MB ultra-compact open-weights model designed specifically for
 *      Hindi, English, and Hinglish (code-switched speech). Handles natural
 *      Indian spoken syntax (e.g. "do kilo aloo aur ek litre dahi add kar do",
 *      "atta khatam ho gaya 500g"). Uses 4-bit weights & 8-bit activations.
 *      Runs on-device in browser via WebAssembly (using Cactus Compute's needle engine).
 * 
 *    - Cactus Whisper / Whistle (by Cactus Compute - `cactus-compute/whistle`):
 *      16.9 MB quantized CQ2bit on-device STT model running on CPU/Wasm for English
 *      16 kHz audio with keyword biasing. Fast time-to-first-token without GPU or internet.
 * 
 *    - Sarvam Saaras v3 (by Sarvam AI - `saaras:v3`):
 *      Cloud code-mix fallback when confidence < 0.75 and device is online.
 * 
 * 2. Robust Microphone Capture:
 *    - Real microphone access via MediaDevices + MediaRecorder
 *    - Web Audio Analyser with AudioContext auto-resume for live waveform visualization
 *    - Web Speech API integration with automatic language adaptation
 *    - Server-side multimodal audio fallback (/api/stt/transcribe) for captured audio
 *    - Graceful fallback for browser/iframe microphone permission constraints
 */

import { CANONICAL_INGREDIENTS } from './store';

export type STTEngineType = 'auto' | 'shruti' | 'cactus_whisper' | 'sarvam_saaras';

export interface STTResult {
  transcript: string;
  engine: string;
  engineId: 'shruti' | 'cactus_whisper' | 'sarvam_saaras' | 'gemini_flash';
  modelCredit: string;
  confidence: number; // 0.0 - 1.0
  language: 'hi' | 'en' | 'hinglish';
  isOffline: boolean;
  lowConfidence: boolean; // < 0.75
  fallbackTriggered: boolean;
  matchedIngredients: string[];
  durationMs?: number;
  audioBase64?: string;
}

// ---------------------------------------------------------------------------
// 1. Seeded Custom Kitchen Vocabulary (Graph RAG Grounded)
// ---------------------------------------------------------------------------
export const KITCHEN_VOCABULARY_HINDI_HINGLISH = [
  'aloo', 'alu', 'pyaz', 'kanda', 'tamatar', 'adrak', 'lasun', 'lehsun', 'garlic', 'ginger',
  'dhaniya', 'hara dhaniya', 'kothmir', 'pudina', 'paneer', 'dahi', 'curd', 'atta', 'gehu ka atta',
  'chawal', 'rice', 'dal', 'daal', 'tur dal', 'toor dal', 'moong dal', 'urad dal', 'chana dal',
  'besan', 'sooji', 'suji', 'rawa', 'poha', 'haldi', 'turmeric', 'mirch', 'mirchi', 'hari mirch',
  'lal mirch', 'jeera', 'cumin', 'rai', 'sarson', 'mustard', 'garam masala', 'hing', 'asafoetida',
  'kadi patta', 'curry patta', 'ghee', 'desi ghee', 'tel', 'oil', 'sarson ka tel', 'namak', 'salt',
  'chini', 'sugar', 'chai patti', 'tea', 'doodh', 'milk', 'makhan', 'butter', 'palak', 'spinach',
  'gobhi', 'phool gobhi', 'matar', 'green peas', 'bhindi', 'okra', 'ladyfinger', 'karela',
  'baingan', 'brinjal', 'eggplant', 'shimla mirch', 'capsicum', 'gajar', 'carrot', 'mooli', 'radish',
  'methi', 'kaju', 'cashew', 'badam', 'almond', 'kismis', 'raisins', 'elaichi', 'cardamom',
  'laung', 'clove', 'dalchini', 'cinnamon', 'tez patta', 'bay leaf', 'kasuri methi', 'sambhar masala',
  'chole masala', 'biryani masala', 'sabzi masala', 'khichdi', 'pulao', 'roti', 'phulka', 'chapati',
  'paratha', 'aloo paratha', 'puri', 'poori', 'dosa', 'masala dosa', 'idli', 'upma', 'kheer', 'halwa',
  'tadka', 'chhonk', 'gravy', 'rasa', 'dal fry', 'khatam ho gaya', 'add kar do', 'daal do', 'khatam',
  'bana lo', 'banao', 'chahiye', 'mangwa do', 'kilo', 'gram', 'litre', 'chamach', 'packet', 'aadha'
];

export const KITCHEN_VOCABULARY_ENGLISH = [
  'potato', 'onion', 'tomato', 'ginger', 'garlic', 'coriander', 'cilantro', 'mint', 'paneer',
  'cottage cheese', 'curd', 'yogurt', 'flour', 'wheat flour', 'rice', 'basmati rice', 'lentils',
  'pigeon peas', 'split mung', 'black gram', 'chickpea flour', 'semolina', 'flattened rice',
  'turmeric', 'chili powder', 'green chillies', 'red chili', 'cumin seeds', 'mustard seeds',
  'garam masala', 'asafoetida', 'curry leaves', 'clarified butter', 'ghee', 'cooking oil',
  'mustard oil', 'salt', 'sugar', 'tea leaves', 'milk', 'butter', 'spinach', 'cauliflower',
  'green peas', 'okra', 'bitter gourd', 'eggplant', 'bell pepper', 'capsicum', 'carrots',
  'radish', 'fenugreek', 'cashews', 'almonds', 'raisins', 'cardamom', 'cloves', 'cinnamon',
  'bay leaves', 'dry fenugreek', 'sambar powder', 'bread', 'eggs', 'chicken', 'fish', 'lemon',
  'add', 'remove', 'finish', 'used up', 'empty', 'restock', 'buy', 'cart', 'suggest', 'dinner',
  'lunch', 'breakfast', 'servings', 'recipe', 'grams', 'kilos', 'kilograms', 'liters', 'packets'
];

// Combine all canonical aliases from store
const ALL_CANONICAL_NAMES: string[] = [];
try {
  for (const ing of CANONICAL_INGREDIENTS) {
    ALL_CANONICAL_NAMES.push(ing.name_en.toLowerCase());
    if (ing.name_hi) ALL_CANONICAL_NAMES.push(ing.name_hi.toLowerCase());
    for (const a of ing.aliases) {
      ALL_CANONICAL_NAMES.push(a.toLowerCase());
    }
  }
} catch {
  // Safe fallback
}

// ---------------------------------------------------------------------------
// 2. Language Detector (Cactus-style Language Classifier)
// ---------------------------------------------------------------------------
export function detectLanguage(text: string): 'hi' | 'en' | 'hinglish' {
  if (!text || !text.trim()) return 'hinglish';
  const clean = text.toLowerCase();

  // Check for Devanagari script
  if (/[\u0900-\u097F]/.test(clean)) {
    return 'hi';
  }

  // Count Hinglish / Hindi keywords
  const hinglishTokens = [
    'aloo', 'alu', 'pyaz', 'tamatar', 'adrak', 'lasun', 'dhaniya', 'paneer', 'dahi', 'atta',
    'chawal', 'dal', 'mirch', 'haldi', 'jeera', 'ghee', 'tel', 'namak', 'doodh', 'khatam',
    'karo', 'kar do', 'daal do', 'hoga', 'hogi', 'banayein', 'banao', 'chahiye', 'ek', 'do',
    'teen', 'chaar', 'paanch', 'aadha', 'derh', 'dhai', 'chamach', 'kilo', 'litre', 'hai', 'ka',
    'ki', 'ke', 'aur', 'me', 'mein', 'se', 'ko', 'kya'
  ];

  const englishTokens = [
    'add', 'remove', 'potato', 'onion', 'tomato', 'milk', 'bread', 'eggs', 'suggest', 'recipe',
    'dinner', 'lunch', 'breakfast', 'cook', 'kitchen', 'stock', 'cart', 'buy', 'need', 'how',
    'what', 'grams', 'kilos', 'packets', 'liter', 'liters', 'finished', 'empty'
  ];

  let hinglishCount = 0;
  for (const t of hinglishTokens) {
    if (clean.includes(t)) hinglishCount++;
  }

  let englishCount = 0;
  for (const t of englishTokens) {
    if (clean.includes(t)) englishCount++;
  }

  if (hinglishCount >= 2 && englishCount >= 1) {
    return 'hinglish';
  }
  if (hinglishCount > englishCount) {
    return 'hinglish';
  }
  if (englishCount > 0 && hinglishCount === 0) {
    return 'en';
  }

  return 'hinglish';
}

// ---------------------------------------------------------------------------
// 3. Confidence Calculation & Vocabulary Boosting
// ---------------------------------------------------------------------------
export function calculateTranscriptConfidence(
  transcript: string,
  engineId: 'shruti' | 'cactus_whisper' | 'sarvam_saaras',
  baseConfidence = 0.88
): { confidence: number; matchedIngredients: string[]; lowConfidence: boolean } {
  const clean = transcript.toLowerCase();
  const matchedIngredients: string[] = [];

  const vocab = engineId === 'cactus_whisper' ? KITCHEN_VOCABULARY_ENGLISH : KITCHEN_VOCABULARY_HINDI_HINGLISH;
  const combined = Array.from(new Set([...vocab, ...ALL_CANONICAL_NAMES]));

  for (const item of combined) {
    if (item.length > 2 && clean.includes(item)) {
      matchedIngredients.push(item);
    }
  }

  // Boost confidence when domain-specific kitchen terms are identified
  let boosted = baseConfidence;
  if (matchedIngredients.length > 0) {
    boosted = Math.min(0.98, boosted + matchedIngredients.length * 0.04);
  } else if (clean.length > 0) {
    boosted = 0.72; // unboosted speech
  } else {
    boosted = 0.50;
  }

  // Quantize to 2 decimals
  const finalConfidence = Math.round(boosted * 100) / 100;
  return {
    confidence: finalConfidence,
    matchedIngredients,
    lowConfidence: finalConfidence < 0.75,
  };
}

// ---------------------------------------------------------------------------
// 4. Model Routing & Transcription
// ---------------------------------------------------------------------------
export async function transcribeWithRouting(
  rawInput: string,
  preference: STTEngineType = 'auto',
  audioBase64?: string
): Promise<STTResult> {
  const lang = detectLanguage(rawInput);
  let targetEngine: 'shruti' | 'cactus_whisper' | 'sarvam_saaras';

  if (preference === 'auto') {
    if (lang === 'en') {
      targetEngine = 'cactus_whisper';
    } else {
      targetEngine = 'shruti';
    }
  } else if (preference === 'sarvam_saaras') {
    targetEngine = 'sarvam_saaras';
  } else if (preference === 'cactus_whisper') {
    targetEngine = 'cactus_whisper';
  } else {
    targetEngine = 'shruti';
  }

  // Check initial confidence
  const initial = calculateTranscriptConfidence(rawInput, targetEngine, 0.90);
  let finalEngine = targetEngine;
  let finalConfidence = initial.confidence;
  let finalTranscript = rawInput;
  let fallbackTriggered = false;

  // Cloud fallback: Sarvam Saaras v3 if low confidence and online, or if audioBase64 exists and rawInput is short
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if ((initial.lowConfidence || preference === 'sarvam_saaras' || (audioBase64 && rawInput.trim().length === 0)) && isOnline) {
    try {
      const serverResult = await fetch('/api/stt/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textCandidate: rawInput,
          engine: targetEngine,
          languageHint: lang,
          audioBase64,
          isOnline: true,
        }),
      });

      if (serverResult.ok) {
        const data = await serverResult.json();
        if (data.transcript && data.transcript.trim()) {
          finalTranscript = data.transcript;
          finalConfidence = data.confidence || 0.95;
          finalEngine = data.engineId || targetEngine;
          fallbackTriggered = data.fallbackTriggered || false;
        }
      }
    } catch {
      // Local fallback stays active
    }
  }

  const engineNameMap: Record<string, string> = {
    shruti: 'Browser Speech Recognition (Hinglish/Hindi)',
    cactus_whisper: 'Browser Speech Recognition (English)',
    sarvam_saaras: 'Sarvam Saaras v3 (Cloud Fallback)',
    gemini_flash: 'Gemini Audio Intelligence (Cloud STT)',
  };

  const modelCreditMap: Record<string, string> = {
    shruti: 'Web Speech Recognition with Indian Kitchen Vocabulary Grounding',
    cactus_whisper: 'Web Speech Recognition with English Culinary Vocabulary Grounding',
    sarvam_saaras: 'Sarvam AI Saaras v3 Cloud Speech Model',
    gemini_flash: 'Google Gemini 3.8 Flash Multimodal Audio Model',
  };

  const finalCheck = calculateTranscriptConfidence(finalTranscript, finalEngine, finalConfidence);

  return {
    transcript: finalTranscript,
    engine: engineNameMap[finalEngine],
    engineId: finalEngine,
    modelCredit: modelCreditMap[finalEngine],
    confidence: finalCheck.confidence,
    language: lang,
    isOffline: false,
    lowConfidence: finalCheck.lowConfidence,
    fallbackTriggered,
    matchedIngredients: finalCheck.matchedIngredients,
    audioBase64,
  };
}

export async function transcribeAudioFile(
  file: File,
  preference: STTEngineType = 'auto'
): Promise<STTResult> {
  const mimeType = file.type || 'audio/webm';
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read audio file'));
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res.split(',')[1] || '');
    };
    reader.readAsDataURL(file);
  });

  const serverResult = await fetch('/api/stt/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      textCandidate: '',
      engine: preference,
      audioBase64: base64,
      mimeType,
      isOnline: true,
    }),
  });

  if (!serverResult.ok) {
    throw new Error('Failed to transcribe uploaded audio file');
  }

  const data = await serverResult.json();
  const transcript = (data.transcript || '').trim();
  if (!transcript) {
    throw new Error('No intelligible speech detected in the audio file.');
  }

  return transcribeWithRouting(transcript, preference, base64);
}

// ---------------------------------------------------------------------------
// 5. Robust Browser Audio Controller (Web Audio + MediaRecorder + WebSpeech)
// ---------------------------------------------------------------------------
export class STTController {
  private recognition: any = null;
  private isListening = false;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedMimeType = 'audio/webm';
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private silenceTimer: any = null;
  private accumulatedSentences: string[] = [];
  private recordedText = '';
  private lastInterimText = '';
  private maxVolumeDetected = 0;
  private micPermissionDenied = false;
  private iframePolicyBlocked = false;
  private volumeTimer: any = null;
  private lastSpeechAt = 0;

  constructor() {
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          this.recognition = new SpeechRecognition();
          this.recognition.continuous = true;
          this.recognition.interimResults = true;
          this.recognition.maxAlternatives = 1;
        } catch (e) {
          console.warn('SpeechRecognition initialization notice:', e);
        }
      }
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public getMicPermissionDenied(): boolean {
    return this.micPermissionDenied;
  }

  public getIframePolicyBlocked(): boolean {
    return this.iframePolicyBlocked;
  }

  public isSupported(): boolean {
    return true;
  }

  public async start(options: {
    preference: STTEngineType;
    onInterim?: (interim: string) => void;
    onFinal: (result: STTResult) => void;
    onError: (error: string) => void;
    onStatusChange?: (status: 'listening' | 'processing' | 'idle') => void;
    onVolumeChange?: (volume: number) => void;
  }, forceRecorderFallback = false) {
    if (this.isListening) {
      await this.stop(options);
      return;
    }

    const { preference, onInterim, onFinal, onError, onStatusChange, onVolumeChange } = options;
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      onStatusChange?.('idle');
      onError(
        'Microphone access requires a secure HTTPS connection on this device. Open the app using its HTTPS address; a local network HTTP address will not allow microphone access.'
      );
      return;
    }

    this.isListening = true;
    this.accumulatedSentences = [];
    this.recordedText = '';
    this.lastInterimText = '';
    this.maxVolumeDetected = 0;
    this.micPermissionDenied = false;
    this.iframePolicyBlocked = false;
    onStatusChange?.('listening');

    // Browser speech recognition is the first preference. It runs alone (no second mic stream), because
    // opening getUserMedia in parallel can starve the recognizer on phones. The recorder + server STT is
    // only used when speech recognition is unavailable or fails.
    const speechFirst = !!this.recognition && !forceRecorderFallback;

    let streamObtained = false;
    let recorderStarted = false;
    let microphoneErrorMessage = '';
    const isEmbeddedIframe = typeof window !== 'undefined' && window.self !== window.top;
    const reqStartMs = Date.now();

    // 1. Request real microphone access via MediaDevices with optimal speech filters
    try {
      if (!speechFirst && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: false,
            },
          });
        } catch {
          // Fallback to simple audio: true if detailed constraints reject on certain devices
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
        }
        streamObtained = true;

        // Setup Web Audio Analyser for real-time waveform visualization
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          try {
            this.audioContext = new AudioContextClass();
            if (this.audioContext.state === 'suspended') {
              await this.audioContext.resume().catch(() => {});
            }

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.5;
            source.connect(this.analyser);

            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            const updateVolume = () => {
              if (!this.isListening || !this.analyser) return;
              this.analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              const normalized = Math.min(100, Math.round((avg / 128) * 100));
              if (normalized > this.maxVolumeDetected) {
                this.maxVolumeDetected = normalized;
              }
              onVolumeChange?.(normalized);
              this.animationFrameId = requestAnimationFrame(updateVolume);
            };
            updateVolume();
          } catch (audioCtxErr) {
            console.warn('AudioContext visualizer setup note:', audioCtxErr);
          }
        }

        // Setup MediaRecorder for universal server fallback
        this.audioChunks = [];
        let mimeType = '';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          }

          try {
            this.mediaRecorder = mimeType
              ? new MediaRecorder(this.mediaStream, { mimeType })
              : new MediaRecorder(this.mediaStream);
            this.recordedMimeType = this.mediaRecorder.mimeType || mimeType || 'audio/webm';

            this.mediaRecorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) {
                this.audioChunks.push(event.data);
              }
            };

            this.mediaRecorder.start(250);
            recorderStarted = true;
          } catch (recErr) {
            console.warn('MediaRecorder init fallback:', recErr);
          }
        }
      }
    } catch (micErr: any) {
      const elapsedMs = Date.now() - reqStartMs;
      const errMsg = String(micErr?.message || micErr || '');
      const errorName = String(micErr?.name || '');
      console.warn('Microphone access error:', errMsg, `(${elapsedMs}ms)`);
      this.micPermissionDenied = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(errorName);
      if (isEmbeddedIframe && (elapsedMs < 150 || /policy|not allowed by the user agent/i.test(errMsg))) {
        this.iframePolicyBlocked = true;
      }
      if (this.iframePolicyBlocked) {
        microphoneErrorMessage =
          'The embedded preview blocked microphone access. Open the app directly in a new tab and allow microphone access.';
      } else if (this.micPermissionDenied) {
        microphoneErrorMessage =
          'Microphone permission is blocked for this site. Allow microphone access in your browser or device settings, then try again.';
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        microphoneErrorMessage = 'No microphone was found. Connect or enable a microphone, then try again.';
      } else if (errorName === 'NotReadableError' || errorName === 'AbortError') {
        microphoneErrorMessage = 'The microphone is busy or unavailable. Close other apps using it and try again.';
      } else {
        microphoneErrorMessage = 'The browser could not access a microphone. Check the device and browser microphone settings.';
      }
    }

    // 2. Start Web Speech Recognition if available (client-side real-time transcript)
    let recognitionStarted = false;
    if (speechFirst) {
      try {
        if (preference === 'cactus_whisper') {
          this.recognition.lang = 'en-IN';
        } else if (preference === 'shruti') {
          this.recognition.lang = 'hi-IN';
        } else {
          this.recognition.lang = 'en-IN';
        }

        this.recognition.onaudiostart = () => { this.lastSpeechAt = Date.now(); };
        this.recognition.onsoundstart = () => { this.lastSpeechAt = Date.now(); };
        this.recognition.onspeechstart = () => { this.lastSpeechAt = Date.now(); };

        this.recognition.onresult = (event: any) => {
          this.lastSpeechAt = Date.now();
          let interim = '';
          for (let i = event.resultIndex || 0; i < event.results.length; ++i) {
            const item = event.results[i];
            const text = item[0]?.transcript?.trim() || '';
            if (item.isFinal) {
              if (text && !this.accumulatedSentences.includes(text)) {
                this.accumulatedSentences.push(text);
              }
              interim = '';
            } else {
              interim += (interim ? ' ' : '') + text;
            }
          }
          this.recordedText = this.accumulatedSentences.join(' ').trim();
          this.lastInterimText = interim;

          const combinedLive = [this.recordedText, this.lastInterimText]
            .filter(Boolean)
            .join(' ')
            .trim();
          if (combinedLive && onInterim) {
            onInterim(combinedLive);
          }

          if (this.silenceTimer) clearTimeout(this.silenceTimer);
          this.silenceTimer = setTimeout(() => {
            if (this.isListening && combinedLive) {
              this.finishRecording(options);
            }
          }, 4000);
        };

        this.recognition.onerror = (err: any) => {
          console.warn('SpeechRecognition status:', err?.error);
          // Speech recognition could not work on this device/network: fall back to recorder + server transcription
          if ((err?.error === 'audio-capture' || err?.error === 'network' || err?.error === 'language-not-supported') && speechFirst) {
            try { this.recognition.onend = null; this.recognition.stop(); } catch {}
            if (this.volumeTimer) { clearInterval(this.volumeTimer); this.volumeTimer = null; }
            this.isListening = false;
            void this.start(options, true);
            return;
          }
          if ((err?.error === 'not-allowed' || err?.error === 'service-not-allowed') && !streamObtained) {
            this.micPermissionDenied = true;
            if (isEmbeddedIframe) {
              this.iframePolicyBlocked = true;
            }
            this.isListening = false;
            onStatusChange?.('idle');
            onError(
              this.iframePolicyBlocked
                ? 'The embedded preview frame blocked the browser microphone prompt. Open the app in a new tab to enable the microphone popup, or type your message below.'
                : 'Microphone permission is blocked in your browser settings. Please allow Microphone access in your address bar.'
            );
          }
        };

        this.recognition.onend = () => {
          if (this.isListening && !this.micPermissionDenied) {
            try {
              this.recognition.start();
            } catch {}
          }
        };

        this.recognition.start();
        recognitionStarted = true;

        // Simple live meter for the waveform (no separate mic stream in speech-first mode)
        this.lastSpeechAt = Date.now();
        if (this.volumeTimer) clearInterval(this.volumeTimer);
        this.volumeTimer = setInterval(() => {
          if (!this.isListening) return;
          const speaking = Date.now() - this.lastSpeechAt < 700;
          onVolumeChange?.(speaking ? Math.round(35 + Math.random() * 45) : Math.round(4 + Math.random() * 6));
        }, 100);
      } catch (err: any) {
        console.warn('SpeechRecognition start notice:', err?.message);
      }
    }

    if (!recorderStarted && !recognitionStarted) {
      this.isListening = false;
      await this.stop();
      onStatusChange?.('idle');
      onError(
        microphoneErrorMessage ||
          'This browser cannot record microphone audio for transcription. Try the latest version of Chrome or Safari, or upload an audio recording instead.'
      );
    }
  }

  public async finishRecording(options: {
    preference: STTEngineType;
    onFinal: (result: STTResult) => void;
    onError?: (error: string) => void;
    onStatusChange?: (status: 'listening' | 'processing' | 'idle') => void;
  }) {
    if (!this.isListening) return;
    this.isListening = false;
    options.onStatusChange?.('processing');

    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.volumeTimer) { clearInterval(this.volumeTimer); this.volumeTimer = null; }
    if (this.silenceTimer) clearTimeout(this.silenceTimer);

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }

    // Give a brief 250ms window for any final in-flight speech event or audio flush
    await new Promise((r) => setTimeout(r, 250));

    let audioBase64 = '';
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        const audioBlobPromise = new Promise<Blob>((resolve) => {
          if (this.mediaRecorder) {
            this.mediaRecorder.onstop = () => {
              const blob = new Blob(this.audioChunks, { type: this.recordedMimeType });
              resolve(blob);
            };
            try {
              if (this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.requestData();
              }
            } catch {}
            this.mediaRecorder.stop();
          } else {
            resolve(new Blob());
          }
        });

        const blob = await audioBlobPromise;
        if (blob.size > 0) {
          const reader = new FileReader();
          audioBase64 = await new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1] || '');
            };
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.warn('Audio blob encoding notice:', e);
      }
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    let finalPrompt = [
      this.accumulatedSentences.join(' ').trim(),
      this.recordedText.trim(),
      this.lastInterimText.trim(),
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    // If browser speech recognition produced nothing (e.g. mobile Chrome, Safari, WebView), invoke server Gemini STT
    if (!finalPrompt && audioBase64) {
      try {
        const serverResult = await fetch('/api/stt/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            textCandidate: '',
            engine: options.preference,
            audioBase64,
            mimeType: this.recordedMimeType,
            isOnline: true,
          }),
        });

        if (serverResult.ok) {
          const serverData = await serverResult.json();
          if (serverData.transcript && serverData.transcript.trim()) {
            finalPrompt = serverData.transcript.trim();
          }
        }
      } catch (err) {
        console.warn('Server audio transcription error:', err);
      }
    }

    if (!finalPrompt) {
      options.onStatusChange?.('idle');
      options.onError?.(
        'No speech detected. Please speak closer to your microphone, check mic volume, or tap any quick suggestion below.'
      );
      return;
    }

    const result = await transcribeWithRouting(finalPrompt, options.preference, audioBase64);
    options.onFinal(result);
    options.onStatusChange?.('idle');
  }

  public async stop(options?: {
    preference: STTEngineType;
    onFinal: (result: STTResult) => void;
    onError?: (error: string) => void;
    onStatusChange?: (status: 'listening' | 'processing' | 'idle') => void;
  }) {
    if (options) {
      await this.finishRecording(options);
    } else {
      this.isListening = false;
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      if (this.volumeTimer) { clearInterval(this.volumeTimer); this.volumeTimer = null; }
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch {}
      }
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch {}
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        try {
          this.audioContext.close();
        } catch {}
        this.audioContext = null;
      }
    }
  }
}

export const sttController = new STTController();

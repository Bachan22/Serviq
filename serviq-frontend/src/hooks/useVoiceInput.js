import { useState, useEffect, useRef, useCallback } from 'react';
import { createSpeechAdapter } from '../services/speechRecognitionAdapter.js';
import { parseSpokenAmount } from '../utils/parseSpokenAmount.js';
import { matchServiceFromVoiceText } from '../config/voiceServiceKeywords.js';

const STORAGE_LANG_KEY = 'serviq_voice_lang';

export function useVoiceInput({
  lang: defaultLang = 'hi-IN',
  mode = 'text', // 'text' | 'number'
  onResult,
  silenceTimeout = 2500,
  maxDuration = 12000,
} = {}) {
  // Check feature flag: default true unless explicitly set to 'false'
  const isVoiceEnabled = import.meta.env.VITE_ENABLE_VOICE !== 'false';

  // Language preference with localStorage persistence
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_LANG_KEY) || defaultLang;
    } catch {
      return defaultLang;
    }
  });

  const setLang = useCallback((newLang) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_LANG_KEY, newLang);
    } catch {
      // Ignore
    }
  }, []);

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState(null);
  const [parsedPrice, setParsedPrice] = useState(null);

  const adapterRef = useRef(null);

  const isSupported = isVoiceEnabled && typeof window !== 'undefined' && Boolean(
    window.SpeechRecognition || window.webkitSpeechRecognition || navigator.mediaDevices?.getUserMedia
  );

  const stopListening = useCallback(() => {
    if (adapterRef.current) {
      adapterRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const cancelListening = useCallback(() => {
    if (adapterRef.current) {
      adapterRef.current.cancel();
    }
    setIsListening(false);
    setInterimTranscript('');
    setError(null);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError({
        code: 'UNSUPPORTED',
        message: 'Voice works best in Chrome or Edge. You can type instead',
      });
      return;
    }

    setError(null);
    setInterimTranscript('');
    setParsedPrice(null);

    const adapter = createSpeechAdapter();
    adapterRef.current = adapter;

    setIsListening(true);

    adapter.start({
      lang,
      silenceTimeout,
      maxDuration,
      onInterim: (text) => {
        setInterimTranscript(text);
      },
      onFinal: (finalText) => {
        setInterimTranscript('');
        setFinalTranscript(finalText);

        if (mode === 'number') {
          const parsed = parseSpokenAmount(finalText);
          setParsedPrice(parsed);

          if (parsed.valid) {
            onResult?.({
              transcript: finalText,
              parsedAmount: parsed.value,
              formatted: parsed.formatted,
              valid: true,
            });
          } else {
            setError({
              code: parsed.reason || 'PARSE_FAILED',
              message: parsed.message || 'Please say the price again, for example: teen sau saath',
            });
            onResult?.({
              transcript: finalText,
              parsedAmount: null,
              valid: false,
              message: parsed.message,
            });
          }
        } else {
          // 'text' mode: check for service keyword match
          const matchedService = matchServiceFromVoiceText(finalText);
          onResult?.({
            transcript: finalText,
            matchedService,
            valid: true,
          });
        }
      },
      onError: (err) => {
        setIsListening(false);
        setError(err);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
  }, [isSupported, lang, mode, onResult, silenceTimeout, maxDuration]);

  // Handle Escape key to cancel
  useEffect(() => {
    if (!isListening) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        cancelListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isListening, cancelListening]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (adapterRef.current) {
        adapterRef.current.cancel();
      }
    };
  }, []);

  return {
    isSupported,
    isVoiceEnabled,
    isListening,
    interimTranscript,
    finalTranscript,
    error,
    parsedPrice,
    lang,
    setLang,
    startListening,
    stopListening,
    cancelListening,
    reset: () => {
      setError(null);
      setInterimTranscript('');
      setFinalTranscript('');
      setParsedPrice(null);
    },
  };
}

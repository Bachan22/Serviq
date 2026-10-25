/**
 * Speech Recognition Provider Adapter Layer
 * Provides an extensible interface for speech-to-text with browser Web Speech API as primary engine
 * and optional serverless /api/transcribe as fallback.
 */

let activeGlobalSession = null;

export const SpeechProvider = {
  BROWSER: 'browser',
  SERVER: 'server',
};

class BrowserSpeechAdapter {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.silenceTimer = null;
    this.maxDurationTimer = null;
  }

  isSupported() {
    return typeof window !== 'undefined' && Boolean(
      window.SpeechRecognition || window.webkitSpeechRecognition
    );
  }

  start({ lang = 'hi-IN', onInterim, onFinal, onError, onEnd, silenceTimeout = 2500, maxDuration = 12000 }) {
    if (!this.isSupported()) {
      onError?.({ code: 'UNSUPPORTED', message: 'Voice works best in Chrome or Edge. You can type instead' });
      return;
    }

    // Cancel any previous global session
    if (activeGlobalSession && activeGlobalSession !== this) {
      activeGlobalSession.cancel();
    }
    activeGlobalSession = this;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = lang;
    this.isListening = true;

    let finalTranscriptAccumulated = '';
    let hasHeardSpeech = false;

    const resetSilenceTimer = () => {
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      this.silenceTimer = setTimeout(() => {
        if (this.isListening) {
          this.stop();
        }
      }, silenceTimeout);
    };

    // Max total listening timeout
    this.maxDurationTimer = setTimeout(() => {
      if (this.isListening) {
        this.stop();
      }
    }, maxDuration);

    this.recognition.onstart = () => {
      this.isListening = true;
      resetSilenceTimer();
    };

    this.recognition.onresult = (event) => {
      resetSilenceTimer();
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) {
          finalTranscriptAccumulated += (finalTranscriptAccumulated ? ' ' : '') + text.trim();
          hasHeardSpeech = true;
        } else {
          interim += text;
          if (text.trim()) hasHeardSpeech = true;
        }
      }

      if (interim) {
        onInterim?.(interim);
      }
    };

    this.recognition.onerror = (event) => {
      this.cleanup();
      let friendlyMessage = 'We could not hear you, try again';
      let code = event.error;

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        friendlyMessage = 'Allow the microphone in your browser settings';
      } else if (event.error === 'no-speech') {
        friendlyMessage = 'We could not hear you, try again';
      } else if (event.error === 'network') {
        friendlyMessage = 'Network error during voice recognition. Try typing or retry';
      }

      onError?.({ code, message: friendlyMessage, raw: event.error });
    };

    this.recognition.onend = () => {
      this.cleanup();
      if (!hasHeardSpeech && !finalTranscriptAccumulated) {
        onError?.({ code: 'no-speech', message: 'We could not hear you, try again' });
      } else if (finalTranscriptAccumulated) {
        onFinal?.(finalTranscriptAccumulated.trim());
      }
      onEnd?.();
    };

    try {
      this.recognition.start();
    } catch (err) {
      this.cleanup();
      onError?.({ code: 'START_FAILED', message: err?.message || 'Could not start microphone' });
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }
    this.cleanup();
  }

  cancel() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore
      }
    }
    this.cleanup();
  }

  cleanup() {
    this.isListening = false;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.maxDurationTimer) clearTimeout(this.maxDurationTimer);
    if (activeGlobalSession === this) {
      activeGlobalSession = null;
    }
  }
}

class ServerMediaRecorderAdapter {
  constructor() {
    this.mediaRecorder = null;
    this.stream = null;
    this.chunks = [];
    this.isListening = false;
    this.maxDurationTimer = null;
  }

  isSupported() {
    return typeof window !== 'undefined' && Boolean(
      navigator.mediaDevices?.getUserMedia && window.MediaRecorder
    );
  }

  async start({ lang = 'hi', onInterim, onFinal, onError, onEnd, maxDuration = 12000 }) {
    if (!this.isSupported()) {
      onError?.({ code: 'UNSUPPORTED', message: 'Voice recording not supported in this browser' });
      return;
    }

    if (activeGlobalSession && activeGlobalSession !== this) {
      activeGlobalSession.cancel();
    }
    activeGlobalSession = this;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.chunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.isListening = true;

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        this.cleanup();
        const blob = new Blob(this.chunks, { type: mimeType });
        if (blob.size < 500) {
          onError?.({ code: 'no-speech', message: 'We could not hear you, try again' });
          onEnd?.();
          return;
        }

        try {
          onInterim?.('Converting voice...');
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result || '').toString().split(',')[1];
            if (!base64Audio) {
              onError?.({ code: 'ENCODING_ERROR', message: 'Failed to process audio' });
              onEnd?.();
              return;
            }

            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64Audio,
                mimeType,
                lang: lang.split('-')[0],
              }),
            });

            if (!res.ok) {
              const errJson = await res.json().catch(() => ({}));
              onError?.({
                code: errJson?.error?.code || 'SERVER_ERROR',
                message: errJson?.error?.message || 'Voice transcription failed. You can type instead.',
              });
              onEnd?.();
              return;
            }

            const data = await res.json();
            const transcript = data?.data?.transcript || '';
            if (!transcript.trim()) {
              onError?.({ code: 'no-speech', message: 'We could not hear you, try again' });
            } else {
              onFinal?.(transcript.trim());
            }
            onEnd?.();
          };
        } catch (err) {
          onError?.({ code: 'TRANSCRIPTION_FAILED', message: 'Transcription error. You can type instead.' });
          onEnd?.();
        }
      };

      this.mediaRecorder.start(250);

      this.maxDurationTimer = setTimeout(() => {
        if (this.isListening) {
          this.stop();
        }
      }, Math.min(maxDuration, 15000));
    } catch (err) {
      this.cleanup();
      const code = err.name === 'NotAllowedError' ? 'not-allowed' : 'START_FAILED';
      const message = code === 'not-allowed'
        ? 'Allow the microphone in your browser settings'
        : 'Could not access microphone';
      onError?.({ code, message });
    }
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore
      }
    }
    this.cleanupStream();
  }

  cancel() {
    this.cleanup();
  }

  cleanupStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  cleanup() {
    this.isListening = false;
    this.cleanupStream();
    if (this.maxDurationTimer) clearTimeout(this.maxDurationTimer);
    if (activeGlobalSession === this) {
      activeGlobalSession = null;
    }
  }
}

export function createSpeechAdapter() {
  const browserAdapter = new BrowserSpeechAdapter();
  if (browserAdapter.isSupported()) {
    return browserAdapter;
  }
  return new ServerMediaRecorderAdapter();
}

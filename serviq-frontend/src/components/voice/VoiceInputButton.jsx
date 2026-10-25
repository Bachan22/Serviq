import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Square, AlertCircle, X, Sparkles } from 'lucide-react';
import { useVoiceInput } from '../../hooks/useVoiceInput.js';
import './VoiceInputButton.css';

/**
 * Reusable Error Boundary for Voice Component
 */
class VoiceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[VoiceErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null; // Silently fallback so parent forms never crash
    }
    return this.props.children;
  }
}

function VoiceInputButtonInternal({
  mode = 'text', // 'text' | 'number'
  onResult,
  disabled = false,
  className = '',
  placeholder = '',
  size = 'md', // 'sm' | 'md'
}) {
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message, heard }

  const {
    isSupported,
    isVoiceEnabled,
    isListening,
    interimTranscript,
    error,
    parsedPrice,
    lang,
    setLang,
    startListening,
    stopListening,
    cancelListening,
  } = useVoiceInput({
    mode,
    onResult: (res) => {
      if (mode === 'number') {
        if (res.valid) {
          setFeedback({
            type: 'success',
            heard: res.transcript,
            amount: res.formatted,
          });
          onResult?.(res.parsedAmount, res.transcript);
        } else {
          setFeedback({
            type: 'error',
            message: res.message || 'Please say the price again, for example: teen sau saath',
            heard: res.transcript,
          });
        }
      } else {
        setFeedback({
          type: 'success',
          heard: res.transcript,
          matchedService: res.matchedService,
        });
        onResult?.(res.transcript, res.matchedService);
      }
    },
  });

  // Automatically dismiss feedback after 5 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // When disabled or feature is turned off, do not render mic
  if (!isVoiceEnabled || !isSupported || disabled) {
    return null;
  }

  const toggleLanguage = () => {
    const nextLang = lang === 'hi-IN' ? 'en-IN' : 'hi-IN';
    setLang(nextLang);
  };

  const isHindi = lang === 'hi-IN';

  return (
    <div className={`serviq-voice-wrapper ${className} size-${size}`}>
      {/* Language toggle pill */}
      <button
        type="button"
        className="serviq-voice-lang-toggle"
        onClick={toggleLanguage}
        title={`Current: ${isHindi ? 'Hindi / Hinglish' : 'English'}. Click to switch.`}
        aria-label={`Switch voice language. Currently ${isHindi ? 'Hindi' : 'English'}`}
      >
        {isHindi ? 'हिं' : 'EN'}
      </button>

      {/* Main Mic Button */}
      {!isListening ? (
        <button
          type="button"
          className="serviq-voice-btn idle"
          onClick={startListening}
          aria-label="Speak instead of typing"
          title={`Speak in ${isHindi ? 'Hindi/Hinglish' : 'English'}`}
        >
          <Mic size={18} className="serviq-voice-icon" />
        </button>
      ) : (
        <div className="serviq-voice-listening-wrap">
          <button
            type="button"
            className="serviq-voice-btn listening"
            onClick={stopListening}
            aria-label="Stop listening"
            title="Stop listening"
          >
            <Square size={14} fill="currentColor" />
          </button>
        </div>
      )}

      {/* Live Active Listening Banner / Popover */}
      {isListening && (
        <div className="serviq-voice-popover listening-popover" role="dialog" aria-live="polite">
          <div className="serviq-voice-popover-header">
            <div className="serviq-voice-pulse-dot" />
            <span className="serviq-voice-listening-label">
              {isHindi ? 'Listening... बोलिए' : 'Listening... Speak now'}
            </span>
            <button
              type="button"
              className="serviq-voice-close-btn"
              onClick={cancelListening}
              title="Cancel (Esc)"
              aria-label="Cancel voice input"
            >
              <X size={14} />
            </button>
          </div>

          <div className="serviq-voice-transcript-box">
            {interimTranscript ? (
              <span className="serviq-voice-interim">{interimTranscript}</span>
            ) : (
              <span className="serviq-voice-hint">
                {mode === 'number'
                  ? isHindi ? 'जैसे: "तीन सौ साठ" या "₹350"' : 'e.g. "three hundred fifty" or "₹400"'
                  : isHindi ? 'जैसे: "AC theek karwana hai"' : 'e.g. "Tap repair or electrician"'}
              </span>
            )}
          </div>

          <div className="serviq-voice-footer">
            <span className="serviq-voice-privacy">Your voice is converted to text and not saved.</span>
            <button
              type="button"
              className="serviq-voice-stop-btn"
              onClick={stopListening}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Feedback Popover for parsed results or error */}
      {!isListening && feedback && (
        <div
          className={`serviq-voice-popover feedback-popover ${feedback.type}`}
          role="status"
          aria-live="polite"
        >
          <div className="serviq-voice-feedback-content">
            {feedback.type === 'success' ? (
              <div>
                <div className="serviq-voice-heard-line">
                  <Sparkles size={13} color="#FF9500" />
                  <strong>Heard:</strong> <em>"{feedback.heard}"</em>
                </div>
                {feedback.amount && (
                  <div className="serviq-voice-parsed-amount">
                    Filled: <strong>{feedback.amount}</strong>
                  </div>
                )}
                {feedback.matchedService && (
                  <div className="serviq-voice-matched-chip">
                    Matched: <strong>{feedback.matchedService}</strong>
                  </div>
                )}
              </div>
            ) : (
              <div className="serviq-voice-error-row">
                <AlertCircle size={15} color="#EF4444" style={{ flexShrink: 0 }} />
                <span>{feedback.message}</span>
              </div>
            )}
            <button
              type="button"
              className="serviq-voice-close-btn"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss message"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Error notification if engine encountered an error */}
      {!isListening && error && (
        <div className="serviq-voice-popover feedback-popover error" role="alert" aria-live="assertive">
          <div className="serviq-voice-feedback-content">
            <div className="serviq-voice-error-row">
              <AlertCircle size={15} color="#EF4444" style={{ flexShrink: 0 }} />
              <span>{error.message || 'We could not hear you, try again'}</span>
            </div>
            <button
              type="button"
              className="serviq-voice-close-btn"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss error"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VoiceInputButton(props) {
  return (
    <VoiceErrorBoundary>
      <VoiceInputButtonInternal {...props} />
    </VoiceErrorBoundary>
  );
}

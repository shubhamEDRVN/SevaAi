/**
 * Realtime continuous speech recognition wrapper.
 */

export class VoiceRecognizer {
  constructor() {
    this.recognition = null;
    this.isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    this.callbacks = {
      onInterim: null,
      onFinal: null,
      onError: null,
      onEnd: null
    };
    
    if (this.isSupported) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      
      this._setupListeners();
    }
  }

  _setupListeners() {
    this.recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      
      if (interim && this.callbacks.onInterim) this.callbacks.onInterim(interim);
      if (final && this.callbacks.onFinal) this.callbacks.onFinal(final);
    };

    this.recognition.onerror = (event) => {
      let message = "";
      if (event.error === 'network') {
         message = "__FALLBACK__"; // For unsupported browsers
      } else {
        const errorMap = {
          "not-allowed": "Microphone access denied. Please enable it in browser settings.",
          "no-speech": "No speech detected. Please try again.",
          "audio-capture": "No microphone found.",
        };
        message = errorMap[event.error] || `Speech recognition error: ${event.error}`;
      }
      
      if (event.error !== 'aborted' && this.callbacks.onError) {
        this.callbacks.onError(message);
      }
    };

    this.recognition.onend = () => {
      if (this.callbacks.onEnd) this.callbacks.onEnd();
    };
  }

  start(lang = "en-IN", callbacks = {}) {
    if (!this.isSupported) {
      if (callbacks.onError) callbacks.onError("Speech recognition not supported in this browser");
      return false;
    }

    this.callbacks = { ...this.callbacks, ...callbacks };
    this.recognition.lang = lang;
    
    try {
      this.recognition.start();
      return true;
    } catch (e) {
      // If already started, it throws an error. We can ignore it safely.
      return true;
    }
  }

  stop() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }

  abort() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {}
    }
  }
}

export const recognizer = new VoiceRecognizer();

/**
 * Optimized TTS manager. Uses backend google-tts-api for robust Hindi/English voices.
 */

export class VoiceSynthesizer {
  constructor() {
    this.audioElement = null;
    this.isPlaying = false;
    this.currentPlayPromise = null;
  }

  _detectLanguage(text) {
    if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
    if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN";
    if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN";
    return "en-IN";
  }

  async speak(text, options = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        this.stop(); // Stop any existing speech

        const lang =
          options.language && options.language !== "auto"
            ? options.language
            : this._detectLanguage(text);

        // Fetch audio chunks from backend
        const response = await fetch("/api/chat/text-to-speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language: lang }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch TTS from backend");
        }

        const data = await response.json();
        const chunks = data.audioChunks;

        if (!chunks || chunks.length === 0) {
          resolve();
          return;
        }

        this.isPlaying = true;

        // Play chunks sequentially
        for (let i = 0; i < chunks.length; i++) {
          if (!this.isPlaying) break; // Check if stopped manually

          const chunk = chunks[i];
          const audioSrc = `data:audio/mp3;base64,${chunk.base64}`;

          await new Promise((chunkResolve, chunkReject) => {
            this.audioElement = new Audio(audioSrc);
            
            this.audioElement.onended = () => {
              chunkResolve();
            };
            
            this.audioElement.onerror = (e) => {
              console.error("Audio playback error", e);
              chunkResolve(); // Ignore single chunk errors and continue
            };

            this.currentPlayPromise = this.audioElement.play().catch(e => {
               console.error("Play prevented", e);
               chunkResolve(); 
            });
          });
        }

        this.isPlaying = false;
        resolve();
      } catch (error) {
        console.error("VoiceSynthesis error:", error);
        this.isPlaying = false;
        reject(error);
      }
    });
  }

  stop() {
    this.isPlaying = false;
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
    }
  }
}

export const synthesizer = new VoiceSynthesizer();

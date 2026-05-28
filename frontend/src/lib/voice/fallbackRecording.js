export class FallbackRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recordingMimeType = "audio/webm";
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.audioChunks = [];
    const mimeType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";

    this.recordingMimeType = mimeType || "audio/webm";
    this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.audioChunks.push(event.data);
    };

    this.mediaRecorder.start(250);
    return stream;
  }

  async stopAndTranscribe() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No recording in progress"));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const actualMimeType = this.mediaRecorder.mimeType || this.recordingMimeType;
        const audioBlob = new Blob(this.audioChunks, { type: actualMimeType });

        // Release microphone
        this.mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        this.mediaRecorder = null;

        try {
          const formData = new FormData();
          const ext = actualMimeType.includes("webm") ? "webm"
            : actualMimeType.includes("ogg") ? "ogg"
            : actualMimeType.includes("mp4") ? "mp4"
            : "audio";
          formData.append("audio", audioBlob, `recording.${ext}`);
          formData.append("mimeType", actualMimeType);

          const response = await fetch("/api/chat/speech-to-text", {
            method: "POST",
            body: formData,
            credentials: "include",
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Server error ${response.status}`);
          }

          const data = await response.json();
          resolve(data.text || "");
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  stopWithoutTranscribing() {
    if (this.mediaRecorder) {
      this.mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
  }
}

export const fallbackRecorder = new FallbackRecorder();

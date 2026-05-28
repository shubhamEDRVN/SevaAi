import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceState } from './voiceStateMachine';
import { recognizer } from './recognition';
import { synthesizer } from './synthesis';
import { detectLocalIntent } from './intentEngine';
import { fallbackRecorder } from './fallbackRecording';

export function useVoiceAssistant({
  onMessageReceived,
  userLocation
} = {}) {
  const [state, setState] = useState(VoiceState.IDLE);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  
  const abortControllerRef = useRef(null);
  const useFallbackRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognizer.abort();
      synthesizer.stop();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleProcessTranscript = async (text) => {
    if (!text.trim()) {
      setState(VoiceState.IDLE);
      return;
    }

    setState(VoiceState.PROCESSING);
    
    // 1. Local Intent Engine Check
    const localAnalysis = detectLocalIntent(text);
    
    let botResponseText = "";
    
    if (localAnalysis && !localAnalysis.shouldUseGemini) {
      // Fast path: Local intent matched
      botResponseText = `I have classified this as a ${localAnalysis.department} issue. Let me help you with that.`;
      
      // Simulate network delay for the fast local response
      await new Promise(resolve => setTimeout(resolve, 500));
      
      finishProcessing(botResponseText);
      
      // We still might want to send it to the backend to register the ticket, 
      // but we handled the immediate conversational response locally.
      sendToBackendQuietly(text, userLocation);
    } else {
      // Slow path: Complex query -> Gemini Backend
      try {
        botResponseText = await processWithBackend(text, userLocation);
        finishProcessing(botResponseText);
      } catch (err) {
        if (err.name === 'AbortError') return; // Cancelled
        console.error('Backend processing error:', err);
        setError("I'm having trouble connecting right now.");
        finishProcessing("I'm having trouble connecting right now.");
      }
    }
  };

  const finishProcessing = (responseText) => {
    if (onMessageReceived) {
      onMessageReceived({
        text: responseText,
        sender: 'bot',
        timestamp: new Date()
      });
    }
    
    setState(VoiceState.SPEAKING);
    synthesizer.speak(responseText).then(() => {
      // After speaking finishes, go to idle
      setState(VoiceState.IDLE);
    }).catch(() => {
      setState(VoiceState.IDLE);
    });
  };

  const processWithBackend = async (text, location) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const requestBody = { rawText: text };
    if (location) {
      requestBody.lat = location.latitude;
      requestBody.lng = location.longitude;
    }

    const response = await fetch("/api/complaints/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(requestBody),
      signal: abortControllerRef.current.signal
    });

    if (!response.ok) throw new Error("Backend error");
    const data = await response.json();

    if (data.type === "faq") return data.answer || "Here's some information.";
    if (data.type === "statusQuery") return `Your complaint ${data.complaintId} is ${data.status}.`;
    if (data.type === "newComplaint") {
      if (data.ticketId) return `✅ Ticket created. ID: ${data.ticketId}. Status: ${data.status}.`;
      return `${data.message || 'Complaint processed.'}`;
    }
    
    return data.message || data.response || "Thank you for your message.";
  };

  const sendToBackendQuietly = async (text, location) => {
    // Fire and forget logic for registering complaint while local UI already responded
    try {
      const requestBody = { rawText: text };
      if (location) {
        requestBody.lat = location.latitude;
        requestBody.lng = location.longitude;
      }
      await fetch("/api/complaints/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody)
      });
    } catch (e) {
      console.error("Quiet backend sync failed", e);
    }
  };

  const startListening = useCallback(() => {
    setError(null);
    setInterimTranscript('');
    
    if (state === VoiceState.SPEAKING) {
      synthesizer.stop();
    }
    
    setState(VoiceState.LISTENING);
    useFallbackRef.current = false;
    
    const success = recognizer.start("en-IN", {
      onInterim: (text) => setInterimTranscript(text),
      onFinal: (text) => {
        setInterimTranscript('');
        if (onMessageReceived) {
           onMessageReceived({
             text: text,
             sender: 'user',
             timestamp: new Date()
           });
        }
        handleProcessTranscript(text);
      },
      onError: (errMsg) => {
        if (errMsg === '__FALLBACK__') {
           useFallbackRef.current = true;
           fallbackRecorder.start().catch((err) => {
             setError("Could not access microphone for fallback recording.");
             setState(VoiceState.IDLE);
             useFallbackRef.current = false;
           });
        } else {
           setError(errMsg);
           setState(VoiceState.IDLE);
        }
      },
      onEnd: () => {
        if (!useFallbackRef.current) {
          setState(prev => prev === VoiceState.LISTENING ? VoiceState.IDLE : prev);
        }
      }
    });

    if (!success) {
      useFallbackRef.current = true;
      fallbackRecorder.start().catch((err) => {
         setError("Speech recognition is not supported on this browser.");
         setState(VoiceState.IDLE);
         useFallbackRef.current = false;
      });
    }
  }, [state, onMessageReceived, userLocation]);

  const stopListening = useCallback(() => {
    if (useFallbackRef.current) {
      setState(VoiceState.PROCESSING);
      fallbackRecorder.stopAndTranscribe().then(text => {
         if (text) {
           setInterimTranscript('');
           if (onMessageReceived) {
              onMessageReceived({
                text: text,
                sender: 'user',
                timestamp: new Date()
              });
           }
           handleProcessTranscript(text);
         } else {
           setState(VoiceState.IDLE);
         }
      }).catch(err => {
         console.error(err);
         setError("Fallback transcription failed.");
         setState(VoiceState.IDLE);
      });
      useFallbackRef.current = false;
    } else {
      recognizer.stop();
    }
  }, [state, onMessageReceived]);

  const toggleListening = useCallback(() => {
    if (state === VoiceState.LISTENING) {
      stopListening();
    } else {
      startListening();
    }
  }, [state, startListening, stopListening]);

  return {
    state,
    interimTranscript,
    error,
    startListening,
    stopListening,
    toggleListening,
    processText: handleProcessTranscript,
    dismissError: () => setError(null)
  };
}

const express = require("express");
const router = express.Router();
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { analyze } = require("../services/geminiService");
const googleTTS = require("google-tts-api");

// Configure multer for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = [
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "application/octet-stream", // Some browsers send this for audio
    ];
    // Check by mimetype prefix or exact match
    const isAllowed =
      allowed.includes(file.mimetype) ||
      file.mimetype.startsWith("audio/");
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
  },
});

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// Chat endpoint for text-based conversation
router.post("/message", async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Use Gemini to generate intelligent responses
    const response = await generateChatResponse(message, conversationHistory);

    res.json({
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// Speech-to-text endpoint — using Gemini 1.5 Flash to bypass recent quotas 
router.post("/speech-to-text", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    if (!genAI) {
      return res.status(503).json({ error: "Gemini API key not configured." });
    }

    const mimeType = req.body.mimeType || req.file.mimetype || "audio/webm";
    const base64Audio = req.file.buffer.toString("base64");

    // Use gemini-flash-latest
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Audio,
          mimeType: mimeType.split(";")[0],
        },
      },
      {
        text: "Transcribe this audio file to text. The speaker may be speaking in English, Hindi, or a mix (Hinglish). Return ONLY the transcribed text with no additional commentary, labels, or formatting.",
      },
    ]);

    const transcription = result.response.text().trim();

    if (!transcription) {
      return res.status(422).json({
        error: "No speech detected in the audio. Please try again.",
      });
    }

    res.json({ text: transcription });
  } catch (error) {
    console.error("[STT Gemini Fallback] Error:", error.message);
    res.status(500).json({
      error: `STT Error: ${error.message}`,
    });
  }
});

// Text-to-speech endpoint — using google-tts-api for robust Hindi/English voices
router.post("/text-to-speech", async (req, res) => {
  try {
    const { text, language = "en" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    // Convert language code if needed (e.g., en-IN to en)
    const langCode = language.startsWith("hi") ? "hi" : "en";

    // Get an array of base64 audio chunks (handles long sentences safely)
    const results = await googleTTS.getAllAudioBase64(text, {
      lang: langCode,
      slow: false,
      host: "https://translate.google.com",
      splitPunct: ",.?",
    });

    res.json({ audioChunks: results });
  } catch (error) {
    console.error("[TTS Backend Error]:", error.message);
    res.status(500).json({ error: `TTS Error: ${error.message}` });
  }
});

// Function to generate intelligent chat responses
async function generateChatResponse(message, conversationHistory = []) {
  const lowerMessage = message.toLowerCase();

  // Check if this might be a complaint-related query
  if (
    lowerMessage.includes("complaint") ||
    lowerMessage.includes("problem") ||
    lowerMessage.includes("issue") ||
    lowerMessage.includes("report")
  ) {
    try {
      // Use the existing geminiService to analyze the message
      const analysis = await analyze(message);

      if (analysis.type === "newComplaint") {
        return `I understand you want to report: "${analysis.refinedText}". This appears to be a ${analysis.department} department issue with ${analysis.priority} priority. Would you like me to help you register this complaint? Please provide your location details if you'd like to proceed.`;
      } else if (analysis.type === "statusQuery") {
        return `I can help you check your complaint status. Please provide your complaint ID, or I can look up your most recent complaint if you're logged in.`;
      }
    } catch (error) {
      console.error("Analysis error:", error);
    }
  }

  // Use Gemini for general conversation if available
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

      const context =
        conversationHistory.length > 0
          ? `Previous conversation:\n${conversationHistory
            .map((msg) => `${msg.sender}: ${msg.text}`)
            .join("\n")}\n\n`
          : "";

      const prompt = `${context}You are a helpful municipal assistant chatbot. The user is interacting with a municipal complaints system. 
      
      Respond helpfully to their query: "${message}"
      
      Keep responses concise, friendly, and relevant to municipal services. If they ask about complaints, guide them to register or check status.
      
      Available services:
      - Complaint registration
      - Complaint status tracking  
      - Information about municipal services
      - Office hours and contact information
      
      Respond in a conversational tone.`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Gemini chat error:", error);
    }
  }

  // Fallback responses
  if (
    lowerMessage.includes("hello") ||
    lowerMessage.includes("hi") ||
    lowerMessage.includes("hey")
  ) {
    return "Hello! I'm your municipal assistant. I can help you register complaints, check complaint status, or provide information about our services. How can I assist you today?";
  }

  if (lowerMessage.includes("help")) {
    return "I can assist you with:\n• Registering new complaints\n• Checking complaint status\n• Information about municipal services\n• Office hours and contact details\n• Service procedures\n\nWhat would you like to know more about?";
  }

  if (
    lowerMessage.includes("office hours") ||
    lowerMessage.includes("timing")
  ) {
    return "Our office hours are:\nMonday-Friday: 9:00 AM - 6:00 PM\nSaturday: 9:00 AM - 2:00 PM\nClosed on Sundays and public holidays.";
  }

  if (lowerMessage.includes("contact") || lowerMessage.includes("phone")) {
    return "You can reach us at:\n📞 1800-123-4567\n✉️ complaints@municipality.gov\n📍 Municipal Corporation Office, 123 Civic Center";
  }

  return "I understand you need assistance. I can help you register complaints, check status, or provide information about municipal services. Could you please be more specific about what you need help with?";
}

module.exports = router;

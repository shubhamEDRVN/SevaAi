const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGeminiAudio() {
  try {
    console.log("Using API Key length:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    
    // Create a 1s empty audio webm (roughly valid base64) - actually, let's just use a text prompt to see if the model is working AT ALL
    const resultText = await model.generateContent("Say 'hello world'");
    console.log("Model working for text:", resultText.response.text());

    console.log("Now testing with audio requirement... (might fail if audio is fake, but we want to see the error message)");
    try {
      const resultAudio = await model.generateContent([
        {
          inlineData: {
            data: "UklGRiQAAABXRUJNZWF0IChub3QgcmVhbCBhdWRpbyBkYXRhKQ==",
            mimeType: "audio/webm",
          },
        },
        { text: "Transcribe this" }
      ]);
      console.log("Audio trans:", resultAudio.response.text());
    } catch (e) {
      console.log("Audio test error:", e.message);
    }
  } catch (err) {
    console.error("Fatal error:", err);
  }
}

testGeminiAudio();

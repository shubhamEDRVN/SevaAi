const fs = require('fs');

async function test() {
  try {
    const formData = new FormData();
    const blob = new Blob(['dummy audio content'], { type: 'audio/webm' });
    formData.append('audio', blob, 'test.webm');
    
    console.log("Sending request to backend...");
    const res = await fetch('http://localhost:3001/api/chat/speech-to-text', { 
      method: 'POST', 
      body: formData 
    });
    
    console.log("STATUS:", res.status);
    const json = await res.json();
    console.log("BODY:", json);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();

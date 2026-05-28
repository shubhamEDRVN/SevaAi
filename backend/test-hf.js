const fs = require('fs');
async function run() {
  try {
    const audio = new Uint8Array(100); 
    const res = await fetch('https://api-inference.huggingface.co/models/openai/whisper-tiny.en', { 
      method: 'POST', 
      body: audio 
    }); 
    const txt = res.status + " " + await res.text();
    fs.writeFileSync('test-hf-out.txt', txt);
  } catch(e) {
    fs.writeFileSync('test-hf-out.txt', 'Fetch error: ' + e.toString());
  }
}
run();

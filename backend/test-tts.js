const googleTTS = require('google-tts-api');

async function test() {
  try {
    const results = await googleTTS.getAllAudioBase64('Hello world, how are you? I am fine.', {
      lang: 'en',
      slow: false,
      host: 'https://translate.google.com',
      splitPunct: ',.?',
    });
    console.log("Length of results:", results.length);
    console.log("Keys in result[0]:", Object.keys(results[0]));
    console.log("Base64 string preview:", results[0].base64.substring(0, 50));
  } catch (err) {
    console.error(err);
  }
}

test();

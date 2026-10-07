const VoiceManager = {
  currentLanguage: 'pa',
  isSpeaking: false,
  isListening: false,
  recognition: null,

  init(lang = 'pa') {
    this.currentLanguage = lang;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRec();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.updateLang(lang);

      this.recognition.onstart = () => {
        this.isListening = true;
        const mic = document.getElementById('omniMicBtn');
        if (mic) mic.classList.add('listening');
      };

      this.recognition.onend = () => {
        this.isListening = false;
        const mic = document.getElementById('omniMicBtn');
        if (mic) mic.classList.remove('listening');
      };

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("Voice transcript:", transcript);
        if (window.handleVoiceQuery) {
          window.handleVoiceQuery(transcript);
        }
      };

      this.recognition.onerror = (err) => {
        console.warn("Speech recognition error:", err);
        this.isListening = false;
        const mic = document.getElementById('omniMicBtn');
        if (mic) mic.classList.remove('listening');
      };
    }
  },

  updateLang(lang) {
    this.currentLanguage = lang;
    if (this.recognition) {
      if (lang === 'pa') this.recognition.lang = 'pa-IN';
      else if (lang === 'hi') this.recognition.lang = 'hi-IN';
      else this.recognition.lang = 'en-IN';
    }
  },

  speak(text, onEndCallback) {
    if (!('speechSynthesis' in window)) {
      console.warn("Text-to-Speech not supported in browser.");
      if (onEndCallback) onEndCallback();
      return;
    }

    window.speechSynthesis.cancel(); // Stop any active speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // slightly slower for rural clarity
    utterance.pitch = 1.0;

    if (this.currentLanguage === 'pa') utterance.lang = 'pa-IN';
    else if (this.currentLanguage === 'hi') utterance.lang = 'hi-IN';
    else utterance.lang = 'en-IN';

    // Try finding matching voice
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang.startsWith(this.currentLanguage) || v.lang.includes(this.currentLanguage));
    if (match) utterance.voice = match;

    this.isSpeaking = true;
    utterance.onend = () => {
      this.isSpeaking = false;
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      if (onEndCallback) onEndCallback();
    };

    window.speechSynthesis.speak(utterance);
  },

  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  },

  toggleListening() {
    if (this.isListening) {
      if (this.recognition) this.recognition.stop();
    } else {
      if (this.recognition) {
        try {
          this.recognition.start();
        } catch (e) {
          console.warn("Recognition start error:", e);
        }
      } else {
        // Fallback prompt dialog for browsers without Web Speech recognition
        const promptText = prompt(
          this.currentLanguage === 'pa' ? 'ਬੋਲੋ ਜਾਂ ਲਿਖੋ (ਜਿਵੇਂ: ਕਿੰਨੂ ਦਾ ਕੇਰਾ, ਅੱਜ ਦਾ ਮੰਡੀ ਭਾਅ, ਸਪਰੇਅ ਦੀ ਮਾਤਰਾ):' :
          this.currentLanguage === 'hi' ? 'बोलें या लिखें (जैसे: किन्नू फल झड़न, आज का भाव, दवा की मात्रा):' :
          'Speak or type your question (e.g. Kinnow fruit drop, mandi price, spray dose):'
        );
        if (promptText && window.handleVoiceQuery) {
          window.handleVoiceQuery(promptText);
        }
      }
    }
  }
};

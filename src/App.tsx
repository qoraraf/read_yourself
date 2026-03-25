import { useState, useRef } from 'react';
import { Mic, Square, RefreshCw, Volume2, Star, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeReading, ReadingFeedback } from './services/ai';

const STORIES = [
  "جَلَسَ الْقِطُّ الصَّغِيرُ عَلَى السَّجَّادَةِ. كَانَ قِطًّا سَعِيدًا جِدًّا.",
  "فِي يَوْمٍ مِنَ الْأَيَّامِ، ذَهَبَ كَلْبٌ شُجَاعٌ اسْمُهُ مَاكْس فِي مُغَامَرَةٍ لِلْبَحْثِ عَنْ أَكْبَرِ عَظْمَةٍ فِي الْعَالَمِ.",
  "فِي غَابَةٍ سِحْرِيَّةٍ، تَعَلَّمَتْ بَوْمَةٌ صَغِيرَةٌ كَيْفَ تَطِيرُ تَحْتَ ضَوْءِ الْقَمَرِ السَّاطِعِ."
];

type AppState = 'IDLE' | 'RECORDING' | 'ANALYZING' | 'FEEDBACK';

export default function App() {
  const [storyIndex, setStoryIndex] = useState(0);
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [feedback, setFeedback] = useState<ReadingFeedback[]>([]);
  const [selectedWord, setSelectedWord] = useState<ReadingFeedback | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const currentStory = STORIES[storyIndex];

  const nextStory = () => {
    setStoryIndex((prev) => (prev + 1) % STORIES.length);
    setAppState('IDLE');
    setFeedback([]);
    setSelectedWord(null);
    setErrorMsg(null);
  };

  const startRecording = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setAppState('RECORDING');
      setSelectedWord(null);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setErrorMsg("Please allow microphone access in your browser to read the story.");
      setAppState('IDLE');
    }
  };

  const stopRecordingAndAnalyze = async () => {
    if (!mediaRecorderRef.current) return;

    setAppState('ANALYZING');
    setErrorMsg(null);

    const audioBlob = await new Promise<Blob>((resolve) => {
      mediaRecorderRef.current!.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
        resolve(blob);
      };
      mediaRecorderRef.current!.stop();
      mediaRecorderRef.current!.stream.getTracks().forEach(track => track.stop());
    });

    try {
      const base64Audio = await blobToBase64(audioBlob);
      const result = await analyzeReading(currentStory, base64Audio, audioBlob.type);
      setFeedback(result);
      setAppState('FEEDBACK');
    } catch (error) {
      console.error("Analysis failed:", error);
      setErrorMsg("Oops! Something went wrong while analyzing. Let's try again.");
      setAppState('IDLE');
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Failed to convert blob'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const playPronunciation = (word: string) => {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.8; // Slower for kids
    utterance.pitch = 1.2; // Slightly higher pitch
    window.speechSynthesis.speak(utterance);
  };

  // Split story into words and punctuation for rendering
  const renderStory = () => {
    // \p{L} matches letters from any language, \p{M} matches marks (diacritics), \p{N} matches numbers
    const tokens = currentStory.split(/([\p{L}\p{M}\p{N}]+)/gu);
    
    return tokens.map((token, index) => {
      // Check if this token is a word
      if (!/[\p{L}\p{N}]/u.test(token)) {
        return <span key={index}>{token}</span>;
      }

      // Normalize for comparison (remove Arabic diacritics if any)
      const normalize = (str: string) => str.replace(/[\u064B-\u065F\u0670]/g, '').toLowerCase();
      
      const wordFeedback = feedback.find(f => normalize(f.word) === normalize(token));
      const isHighlighted = !!wordFeedback;
      const isSelected = selectedWord && normalize(selectedWord.word) === normalize(token);

      if (isHighlighted) {
        return (
          <motion.button
            key={index}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedWord(wordFeedback)}
            className={`relative font-bold transition-colors rounded-md px-1 mx-0.5 ${
              isSelected 
                ? 'bg-orange-400 text-white shadow-md' 
                : 'bg-orange-200 text-orange-800 hover:bg-orange-300'
            }`}
          >
            {token}
          </motion.button>
        );
      }

      return <span key={index} className="px-1">{token}</span>;
    });
  };

  return (
    <div className="min-h-screen bg-sky-50 text-slate-800 font-sans selection:bg-sky-200 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="bg-sky-500 p-3 rounded-2xl shadow-sm shadow-sky-200">
              <Star className="w-8 h-8 text-white fill-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-sky-900">
              Reading Buddy
            </h1>
          </div>
          <button 
            onClick={nextStory}
            disabled={appState === 'RECORDING' || appState === 'ANALYZING'}
            className="flex items-center gap-2 px-4 py-2 bg-white text-sky-600 font-semibold rounded-full shadow-sm hover:shadow-md transition-all disabled:opacity-50"
          >
            Next Story <ArrowRight className="w-4 h-4" />
          </button>
        </header>

        {/* Main Story Card */}
        <main className="bg-white rounded-3xl shadow-xl shadow-sky-100/50 p-8 md:p-12 border border-sky-100">
          <div className="text-4xl md:text-5xl leading-relaxed md:leading-relaxed font-medium text-slate-700 mb-12 text-center" dir="rtl" style={{ lineHeight: '1.8' }}>
            {renderStory()}
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center justify-center gap-6">
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-100 text-rose-700 px-6 py-4 rounded-2xl flex items-center justify-between w-full max-w-md border border-rose-200"
              >
                <span className="font-medium">{errorMsg}</span>
                <button 
                  onClick={() => setErrorMsg(null)} 
                  className="text-rose-500 hover:text-rose-800 font-bold ml-4 p-1"
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </motion.div>
            )}

            {appState === 'IDLE' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startRecording}
                className="flex items-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-full text-xl font-bold shadow-lg shadow-emerald-200 transition-colors"
              >
                <Mic className="w-7 h-7" />
                Start Reading
              </motion.button>
            )}

            {appState === 'RECORDING' && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-rose-500 font-semibold animate-pulse">
                  <div className="w-3 h-3 bg-rose-500 rounded-full" />
                  Recording...
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={stopRecordingAndAnalyze}
                  className="flex items-center gap-3 bg-rose-500 hover:bg-rose-600 text-white px-8 py-4 rounded-full text-xl font-bold shadow-lg shadow-rose-200 transition-colors"
                >
                  <Square className="w-7 h-7 fill-white" />
                  I'm Done!
                </motion.button>
              </div>
            )}

            {appState === 'ANALYZING' && (
              <div className="flex flex-col items-center gap-4 text-sky-600">
                <RefreshCw className="w-10 h-10 animate-spin" />
                <p className="text-lg font-semibold">Listening carefully...</p>
              </div>
            )}

            {appState === 'FEEDBACK' && (
              <div className="flex flex-col items-center gap-6 w-full">
                {feedback.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 text-emerald-600 bg-emerald-50 px-6 py-4 rounded-2xl"
                  >
                    <Sparkles className="w-8 h-8" />
                    <span className="text-xl font-bold">Perfect reading! Great job!</span>
                  </motion.div>
                ) : (
                  <div className="text-center text-orange-600 font-medium">
                    Tap the highlighted words to practice them!
                  </div>
                )}

                <button
                  onClick={() => {
                    setAppState('IDLE');
                    setFeedback([]);
                    setSelectedWord(null);
                  }}
                  className="text-sky-500 font-semibold hover:text-sky-600 transition-colors"
                >
                  Try reading again
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Feedback Tooltip */}
        <AnimatePresence>
          {selectedWord && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-8 bg-white rounded-3xl shadow-xl shadow-orange-100/50 p-6 border-2 border-orange-200 flex flex-col md:flex-row items-center gap-6"
            >
              <div className="flex-1 text-center md:text-right" dir="rtl">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  {selectedWord.word}
                </h3>
                <p className="text-lg text-slate-600 mb-1">
                  تُنطق: <span className="font-mono font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded">{selectedWord.phonetic}</span>
                </p>
                <p className="text-slate-500">
                  {selectedWord.feedback}
                </p>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => playPronunciation(selectedWord.word)}
                className="shrink-0 bg-sky-100 hover:bg-sky-200 text-sky-600 p-5 rounded-full transition-colors"
                aria-label="Listen to pronunciation"
              >
                <Volume2 className="w-8 h-8" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Languages, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Stethoscope,
  RefreshCcw
} from 'lucide-react';
import { ChatMessage, Language, RiskLevel, TriageReport } from './types';
import { geminiService } from './services/geminiService';

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Questionnaire state
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<string[]>([]);
  const [collected, setCollected] = useState<Record<string, string>>({});
  // Fixed field keys matching questionnaire order
  const fieldKeys = ['name','age','gender','symptoms','duration','severity'];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize questionnaire when language changes
  useEffect(() => {
    const q = [
      language === 'en' ? "What is the patient's name?" : "मरीज का नाम क्या है?",
      language === 'en' ? "What is the patient's age?" : "मरीज की उम्र क्या है?",
      language === 'en' ? "What is the patient's gender?" : "मरीज का लिंग क्या है?",
      language === 'en' ? "List the patient's symptoms." : "मरीज के लक्षण लिखें।",
      language === 'en' ? "How long have the symptoms lasted?" : "लक्षण कितने समय से हैं?",
      language === 'en' ? "How severe are the symptoms?" : "लक्षण कितने गंभीर हैं?",
    ];
    setQuestions(q);
    setQuestionIndex(0);
    setCollected({});
    setMessages([{ role: 'model', text: q[0] }]);
  }, [language]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    if (questionIndex < questions.length) {
      // Store answer using fixed field key
      const key = fieldKeys[questionIndex] || `field${questionIndex}`;
      const updatedCollected = { ...collected, [key]: input.trim() };
      setCollected(updatedCollected);

      const nextIdx = questionIndex + 1;
      if (nextIdx < questions.length) {
        // Ask next question
        setQuestionIndex(nextIdx);
        setMessages(prev => [...prev, { role: 'model', text: questions[nextIdx] }]);
        setIsLoading(false);
      } else {
        // All questions answered – build prompt and call Gemini
        const fullPrompt = Object.entries(updatedCollected)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
        try {
          const response = await geminiService.getNextResponse([{ role: 'user', text: fullPrompt }], language);
          setMessages(prev => [...prev, response]);
        } catch (error) {
          console.error(error);
          setMessages(prev => [...prev, {
            role: 'model',
            text: language === 'en' ? "Sorry, I'm having trouble connecting. Please try again." : "क्षमा करें, मुझे जुड़ने में समस्या हो रही है। कृपया पुनः प्रयास करें।"
          }]);
        } finally {
          setIsLoading(false);
          // Reset questionnaire for next patient and start over
          setQuestionIndex(0);
          setCollected({});
          // Keep the questions list; start with the first question again
          setMessages(prev => [...prev, { role: 'model', text: questions[0] }]);
        }
      }
    } else {
      // Continue with normal chat after questionnaire
      try {
        const response = await geminiService.getNextResponse(newMessages, language);
        setMessages(prev => [...prev, response]);
      } catch (error) {
        console.error(error);
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: language === 'en' ? "Sorry, I'm having trouble connecting. Please try again." : "क्षमा करें, मुझे जुड़ने में समस्या हो रही है। कृपया पुनः प्रयास करें।" 
        }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const resetChat = () => {
    setMessages([]);
    setInput('');
    // Reset questionnaire state as well
    setQuestionIndex(0);
    setCollected({});
    if (questions.length > 0) {
      setMessages([{ role: 'model', text: questions[0] }]);
    }
  };

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'hi' : 'en';
    setLanguage(newLang);
    resetChat();
  };

  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case 'GREEN': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'YELLOW': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'RED': return 'text-rose-600 bg-rose-50 border-rose-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getRiskIcon = (level: RiskLevel) => {
    switch (level) {
      case 'GREEN': return <CheckCircle2 className="w-6 h-6" />;
      case 'YELLOW': return <AlertTriangle className="w-6 h-6" />;
      case 'RED': return <AlertCircle className="w-6 h-6" />;
      default: return null;
    }
  };

  return (
    <div className="chat-container glass">
      {/* Header */}
      <header className="glass-header border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Stethoscope className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-none">ASHA Sathi</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Triage Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            <Languages className="w-4 h-4" />
            {language === 'en' ? 'हिंदी' : 'English'}
          </button>
          <button 
            onClick={resetChat}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Reset Chat"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="glass-main flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`message-bubble ${
                msg.role === 'user' ? 'message-user' : 'message-model'
              } ${msg.isRedFlag ? 'red-flag shadow-lg shadow-red-100' : ''}`}>
                {msg.text}
              </div>

              {msg.triageReport && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`triage-card w-full bg-white border ${getRiskColor(msg.triageReport.riskLevel)}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    {getRiskIcon(msg.triageReport.riskLevel)}
                    <h3 className="text-xl font-bold uppercase tracking-tight">
                      {msg.triageReport.riskLevel} RISK
                    </h3>
                  </div>

                  <div className="space-y-4 text-slate-800">
                    <section>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Patient Summary</h4>
                      <p className="font-medium">{msg.triageReport.patientSummary}</p>
                    </section>

                    <section>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Symptoms</h4>
                      <p className="text-sm">{msg.triageReport.symptomsReported}</p>
                    </section>

                    <div className="h-px bg-slate-200/50 my-2" />

                    <section>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Reason</h4>
                      <p className="text-sm italic">{msg.triageReport.reason}</p>
                    </section>

                    <section className="bg-white/50 p-3 rounded-xl border border-current/10">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Recommendation</h4>
                      <p className="font-bold text-slate-900">{msg.triageReport.recommendation}</p>
                    </section>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm italic ml-2">
            <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
            <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="glass-footer p-4 border-t border-slate-200">
        <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-1 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={language === 'en' ? "Type patient details..." : "मरीज का विवरण लिखें..."}
            className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-3 text-slate-900 placeholder:text-slate-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`p-3 rounded-xl transition-all ${
              !input.trim() || isLoading 
                ? 'bg-slate-200 text-slate-400' 
                : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 active:scale-95'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-400 mt-3 font-medium">
          {language === 'en' 
            ? "ASHA Sathi is an assistant. Always follow local health protocols." 
            : "आशा साथी एक सहायक है। हमेशा स्थानीय स्वास्थ्य प्रोटोकॉल का पालन करें।"}
        </p>
      </footer>
    </div>
  );
}

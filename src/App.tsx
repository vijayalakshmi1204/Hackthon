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
  RefreshCcw,
  Sparkles
} from 'lucide-react';
import { ChatMessage, Language, RiskLevel } from './types';
import { geminiService } from './services/geminiService';

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<string[]>([]);
  const [collected, setCollected] = useState<Record<string, string>>({});
  
  const fieldKeys = ['name', 'age', 'gender', 'symptoms', 'duration', 'severity'];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    setMessages([{ id: 'init', role: 'model', text: q[0] }]);
  }, [language]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    if (questionIndex < questions.length) {
      const key = fieldKeys[questionIndex] || `field${questionIndex}`;
      const updatedCollected = { ...collected, [key]: input.trim() };
      setCollected(updatedCollected);

      const nextIdx = questionIndex + 1;
      if (nextIdx < questions.length) {
        setQuestionIndex(nextIdx);
        const nextMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: questions[nextIdx] };
        setMessages(prev => [...prev, nextMsg]);
        setIsLoading(false);
      } else {
        const fullPrompt = `Below is the data for a patient assessment. Please analyze it and provide a triage report.\n\n` +
          Object.entries(updatedCollected)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
        try {
          const response = await geminiService.getNextResponse([{ id: 'triage-submission', role: 'user', text: fullPrompt }], language);
          setMessages(prev => [...prev, response]);
          setQuestionIndex(questions.length); 
        } catch (error) {
          console.error(error);
          setMessages(prev => [...prev, {
            id: `error-${Date.now()}`,
            role: 'model',
            text: language === 'en' ? "Sorry, I'm having trouble connecting. Please try again." : "क्षमा करें, मुझे जुड़ने में समस्या हो रही है। कृपया पुनः प्रयास करें।"
          }]);
        } finally {
          setIsLoading(false);
        }
      }
    } else {
      try {
        // Add a hidden system-like instruction to remind AI that triage is done
        const contextMessages = [...newMessages];
        contextMessages.push({ 
          id: 'system-hint',
          role: 'user', 
          text: "[System Instruction: Triage is complete. Do not output another JSON block. Just respond naturally as a helpful medical assistant.]" 
        });
        
        const response = await geminiService.getNextResponse(contextMessages, language);
        setMessages(prev => [...prev, response]);
      } catch (error) {
        console.error(error);
        setMessages(prev => [...prev, { 
          id: `error-${Date.now()}`,
          role: 'model', 
          text: language === 'en' ? "Sorry, I'm having trouble connecting. Please try again." : "क्षमा करें, मुझे जुड़ने में समस्या हो रही है। कृपया पुनः प्रयास करें।" 
        }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const resetChat = () => {
    setInput('');
    setQuestionIndex(0);
    setCollected({});
    // Reset messages with a fresh array and ensure it's not batched in a way that preserves the old ones
    if (questions.length > 0) {
      setMessages([{ id: `reset-${Date.now()}`, role: 'model', text: questions[0] }]);
    } else {
      setMessages([]);
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'hi' : 'en');
  };

  const getRiskStyles = (level: RiskLevel) => {
    switch (level) {
      case 'GREEN': return { color: '#00c078', bg: '#f0fcf8', icon: <CheckCircle2 className="w-5 h-5 text-[#00c078]" /> };
      case 'YELLOW': return { color: '#ffb020', bg: '#fffaf0', icon: <AlertTriangle className="w-5 h-5 text-[#ffb020]" /> };
      case 'RED': return { color: '#ff4d4d', bg: '#fff5f5', icon: <AlertCircle className="w-5 h-5 text-[#ff4d4d]" /> };
      default: return { color: '#64748b', bg: '#f8fafc', icon: null };
    }
  };

  return (
    <div className="proper-container">
      {/* Premium Header */}
      <header className="premium-header px-6 py-4 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="bg-medical-blue/10 p-2.5 rounded-xl">
            <Stethoscope className="text-medical-blue w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-medical-dark font-heading">ASHA Sathi</h1>
            <div className="flex items-center gap-1.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Smart Triage System</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 border border-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-all active:scale-95"
          >
            <Languages className="w-3.5 h-3.5" />
            {language === 'en' ? 'हिन्दी' : 'English'}
          </button>
          
          <button 
            onClick={resetChat}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition-all active:scale-95"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            {language === 'en' ? 'New Patient' : 'नया मरीज'}
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`max-w-[85%] px-5 py-3.5 text-[0.95rem] leading-relaxed relative ${
                msg.role === 'user' ? 'bubble-user' : 'bubble-system'
              }`}>
                <div className="flex items-center gap-2 mb-1.5 opacity-60">
                  {msg.role === 'model' ? (
                    <Sparkles className="w-3.5 h-3.5 text-medical-blue mt-0.5" />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-white/40" />
                  )}
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    {msg.role === 'user' ? 'Asha Member' : 'System Assistant'}
                  </span>
                </div>
                <p className="whitespace-pre-wrap font-medium">{msg.text}</p>
              </div>

              {msg.triageReport && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="triage-card-premium w-full max-w-2xl mt-6"
                >
                  <div className="p-6 flex items-center gap-4" style={{ backgroundColor: getRiskStyles(msg.triageReport.riskLevel).bg }}>
                    <div className="bg-white p-2.5 rounded-xl shadow-sm">
                      {getRiskStyles(msg.triageReport.riskLevel).icon}
                    </div>
                    <div>
                      <h3 className="font-black text-xs uppercase tracking-[0.2em]" style={{ color: getRiskStyles(msg.triageReport.riskLevel).color }}>
                        {msg.triageReport.riskLevel} PRIORITY
                      </h3>
                      <p className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Automated Clinical Analysis</p>
                    </div>
                  </div>

                  <div className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <span className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2.5">Patient Details</span>
                        <p className="text-medical-dark font-bold leading-tight">{msg.triageReport.patientSummary}</p>
                      </div>
                      <div>
                        <span className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2.5">Symptoms</span>
                        <p className="text-slate-600 font-medium leading-relaxed">{msg.triageReport.symptomsReported}</p>
                      </div>
                    </div>

                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2.5">Assessment Detail</span>
                      <p className="text-slate-600 italic font-medium leading-relaxed">"{msg.triageReport.reason}"</p>
                    </div>

                    <div className="pt-2">
                       <span className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Recommended Action</span>
                       <div className="flex items-center gap-5 p-6 rounded-3xl bg-medical-dark text-white ring-8 ring-slate-50 transition-transform hover:scale-[1.01]">
                          <div className="bg-medical-blue p-3 rounded-full shrink-0">
                             <Stethoscope className="w-5 h-5 text-white" />
                          </div>
                          <p className="text-xl font-bold leading-tight tracking-tight">
                            {msg.triageReport.recommendation}
                          </p>
                       </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 text-slate-400 px-4 py-2"
          >
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 bg-medical-blue rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-medical-blue rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-medical-blue rounded-full animate-bounce" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Processing</span>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Section */}
      <footer className="p-6">
        <div className="input-pill flex items-center gap-2 p-2 relative pr-16">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={language === 'en' ? "Describe clinical findings..." : "लक्षणों का वर्णन करें..."}
            className="flex-1 bg-transparent border-none focus:ring-0 px-5 py-3 text-medical-dark placeholder:text-slate-400 font-medium text-[0.95rem]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`send-button-premium absolute right-2 p-3.5 text-white ${
              !input.trim() || isLoading ? 'opacity-30 grayscale pointer-events-none' : ''
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        <div className="text-center mt-5 opacity-30 select-none">
           <p className="text-[9px] font-black uppercase tracking-[0.3em]">AI-Powered Clinical Decision Support</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  BookOpen, 
  Calendar, 
  Info, 
  Layout, 
  Search, 
  ChevronRight, 
  CheckCircle2, 
  BookMarked,
  Clock,
  UserCheck,
  Lightbulb,
  ArrowLeft,
  Printer,
  Play,
  Pause,
  Volume2,
  BookText,
  Mic,
  MicOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LESSONS, TEACHING_GUIDELINES, TAJWEED_RULES, Lesson } from './data';

type Tab = 'home' | 'lessons' | 'schedule' | 'guide' | 'planner' | 'chat';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSurah, setFilterSurah] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'id' | 'title'>('id');
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio] = useState(new Audio());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<{ [key: string]: string }>({});
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Audio completion listener
  React.useEffect(() => {
    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [audio]);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const context = LESSONS.map(l => `درس ${l.id}: ${l.title} (صفحه ${l.page}) - ${l.arabicText || ''} - ${l.tajweedRule || ''}`).join('\n\n');
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: `شما یک دستیار هوشمند برای کتاب آموزش قرآن کریم صنف پنجم هستید. بر اساس محتوای زیر به سوالات شاگردان و معلمان پاسخ دهید. پاسخ‌ها باید به زبان دری افغانستانی، محترمانه و تشویق‌کننده باشد.\n\nمحتوای کتاب:\n${context}\n\nسوال کاربر: ${userMsg}` }] }
        ],
      });

      setChatMessages(prev => [...prev, { role: 'model', text: response.text || 'متاسفم، نتوانستم پاسخی پیدا کنم.' }]);
    } catch (error) {
      console.error("Chat Error:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: 'خطایی رخ داد. لطفا دوباره تلاش کنید.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const generateAiExplanation = async (ruleName: string, ruleDesc: string) => {
    setIsGenerating(ruleName);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `به عنوان یک استاد تجوید، قاعده "${ruleName}" را که به این صورت تعریف شده است: "${ruleDesc}"، به صورت مفصل و با مثال‌های قرآنی بیشتر و راهنمای تلفظ برای شاگردان صنف پنجم توضیح دهید. لطفا پاسخ را به زبان دری افغانستانی و با لحنی تشویق‌کننده ارائه دهید.`,
      });
      setAiExplanation(prev => ({ ...prev, [ruleName]: response.text || '' }));
    } catch (error) {
      console.error("AI Generation Error:", error);
      setAiExplanation(prev => ({ ...prev, [ruleName]: "متأسفانه در حال حاضر امکان دریافت توضیح هوش مصنوعی وجود ندارد. لطفا بعداً تلاش کنید." }));
    } finally {
      setIsGenerating(null);
    }
  };

  const speakText = (text: string, rate: number = 0.85) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fa-IR';
      utterance.rate = rate;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };
  
  // Hifz Progress State
  const [memorizedLessons, setMemorizedLessons] = useState<number[]>(() => {
    const saved = localStorage.getItem('memorizedLessons');
    return saved ? JSON.parse(saved) : [];
  });

  const toggleMemorized = (id: number) => {
    const newMemorized = memorizedLessons.includes(id)
      ? memorizedLessons.filter(m => m !== id)
      : [...memorizedLessons, id];
    setMemorizedLessons(newMemorized);
    localStorage.setItem('memorizedLessons', JSON.stringify(newMemorized));
  };

  const surahs = useMemo(() => {
    const s = new Set<string>();
    LESSONS.forEach(l => { if (l.surah) s.add(l.surah); });
    return Array.from(s);
  }, []);

  const filteredLessons = useMemo(() => {
    let result = LESSONS.filter(l => 
      (l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
       l.surah?.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (filterType === 'all' || l.type === filterType) &&
      (filterSurah === 'all' || l.surah === filterSurah)
    );

    result.sort((a, b) => {
      if (sortBy === 'id') return a.id - b.id;
      return a.title.localeCompare(b.title, 'fa');
    });

    return result;
  }, [searchQuery, filterType, filterSurah, sortBy]);

  const toggleAudio = (url: string) => {
    if (audio.src !== url) {
      audio.src = url;
      audio.play();
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play();
        setIsPlaying(true);
      }
    }
  };

  const renderHome = () => (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="relative h-48 rounded-3xl overflow-hidden shadow-xl mb-8">
        <img 
          src="https://picsum.photos/seed/quran/800/400" 
          alt="Quran Education" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/90 to-transparent flex flex-col justify-end p-6">
          <h2 className="text-2xl font-bold text-white mb-1">خوش آمدید به اپلیکیشن آموزش قرآن</h2>
          <p className="text-emerald-100 text-sm">صنف پنجم • وزارت معارف افغانستان</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 text-emerald-600 mb-2">
          <BookOpen className="w-6 h-6" />
          <h3 className="text-xl font-bold">معرفی کامل کتاب صنف پنجم</h3>
        </div>
        
        <div className="space-y-4">
          <p className="text-gray-600 text-sm leading-relaxed">
            کتاب آموزش قرآن کریم صنف پنجم، یکی از مهم‌ترین منابع آموزشی برای شاگردان در این مقطع تحصیلی است که توسط وزارت معارف افغانستان تدوین شده است. این کتاب با هدف آشنایی عمیق‌تر با کلام الهی و بهبود مهارت‌های تلاوت و حفظ طراحی گردیده است.
          </p>

          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <h4 className="font-bold text-gray-800 text-sm mb-3">فهرست موضوعات اصلی:</h4>
            <ul className="grid grid-cols-1 gap-2">
              <li className="flex items-start gap-2 text-xs text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>معلومات عمومی:</strong> آشنایی با قرآن کریم، تاریخچه نزول، اولین وحی در غار حرا و اهمیت عمل به قرآن.</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>بخش تلاوت (روخوانی):</strong> تلاوت آیات ۱۷۸ الی ۲۸۶ سوره مبارکه بقره (بیش از ۱۰۰ آیت).</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>بخش حفظ (سوره‌های منتخب):</strong> حفظ کامل سوره‌های قدر، زلزال، عادیات و بینه با رعایت تجوید.</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>قواعد تجوید:</strong> یادگیری عملی قواعد نون ساکن و تنوین (اظهار، ادغام، اقلاب، اخفاء) و قواعد میم ساکن.</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <h4 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
              <Play className="w-4 h-4" /> بخش تلاوت
            </h4>
            <p className="text-[11px] text-emerald-700 leading-relaxed">
              تلاوت آیات ۱۷۸ الی ۲۸۶ سوره بقره با تمرکز بر روخوانی صحیح و رعایت قواعد تجوید.
            </p>
          </div>
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
              <BookMarked className="w-4 h-4" /> بخش حفظ
            </h4>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              حفظ سوره‌های قدر، زلزال، عادیات و بینه به همراه یادگیری ترجمه و مفاهیم کلی آن‌ها.
            </p>
          </div>
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" /> قواعد تجوید
            </h4>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              آموزش قواعد اقلاب، اظهار، اخفاء، ادغام، قلقله و تفخیم و ترقیق حروف.
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
            <h4 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" /> معلومات عمومی
            </h4>
            <p className="text-[11px] text-purple-700 leading-relaxed">
              آشنایی با تاریخچه نزول قرآن، اولین وحی و اهمیت عمل به دستورات الهی.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100">
          <h4 className="font-bold text-gray-800 mb-4">ساختار درسی سالانه:</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span>۷۸ ساعت درسی در طول سال تعلیمی</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span>تقسیم‌بندی به دو سمستر (قبل و بعد از امتحان ۴.۵ ماهه)</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span>استفاده از تکنولوژی و فایل‌های صوتی برای یادگیری بهتر</span>
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={() => setActiveTab('lessons')}
        className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
      >
        شروع یادگیری دروس <ChevronRight className="w-5 h-5 rotate-180" />
      </button>
    </div>
  );

  const renderChat = () => (
    <div className="flex flex-col h-[calc(100vh-180px)]" dir="rtl">
      <div className="bg-emerald-600 p-4 rounded-t-3xl text-white flex items-center gap-3 shadow-lg">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <UserCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold">دستیار هوشمند قرآن</h3>
          <p className="text-[10px] text-emerald-100">هر سوالی درباره کتاب دارید بپرسید</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white border-x border-gray-100">
        {chatMessages.length === 0 && (
          <div className="text-center py-10 space-y-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Mic className="w-8 h-8" />
            </div>
            <p className="text-gray-500 text-sm px-10 leading-relaxed">
              سلام! من دستیار هوشمند شما هستم. می‌توانید درباره هر موضوعی از کتاب صنف پنجم از من سوال کنید.
            </p>
            <div className="flex flex-wrap justify-center gap-2 px-4">
              {['درباره سوره بقره بگو', 'قاعده اقلاب چیست؟', 'اولین وحی کجا نازل شد؟'].map(q => (
                <button 
                  key={q}
                  onClick={() => setChatInput(q)}
                  className="text-[10px] bg-gray-100 text-gray-600 px-3 py-2 rounded-full hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {chatMessages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
              msg.role === 'user' 
                ? 'bg-emerald-600 text-white rounded-tr-none' 
                : 'bg-gray-100 text-gray-800 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isChatLoading && (
          <div className="flex justify-end">
            <div className="bg-gray-100 p-3 rounded-2xl rounded-tl-none flex gap-1">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white rounded-b-3xl border-x border-b border-gray-100 shadow-lg">
        <div className="flex gap-2">
          <input 
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="سوال خود را اینجا بنویسید..."
            className="flex-1 bg-gray-100 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500"
          />
          <button 
            onClick={handleSendMessage}
            disabled={isChatLoading || !chatInput.trim()}
            className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 disabled:opacity-50"
          >
            <Play className="w-5 h-5 rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderLessons = () => (
    <div className="space-y-4 pb-20" dir="rtl">
      <div className="sticky top-0 bg-white/80 backdrop-blur-md pt-4 pb-2 z-10 space-y-3">
        {filterType === 'hifz' && (
          <div className="bg-emerald-600 p-4 rounded-2xl text-white shadow-lg mb-2">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-bold">پیشرفت حفظ سوره‌ها</h4>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
                {memorizedLessons.length} از {LESSONS.filter(l => l.type === 'hifz').length} درس
              </span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${(memorizedLessons.length / LESSONS.filter(l => l.type === 'hifz').length) * 100}%` }}
              />
            </div>
          </div>
        )}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="جستجوی درس یا سوره..."
            className="w-full pr-10 pl-4 py-3 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 text-right font-sans"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 no-scrollbar">
          <select 
            className="bg-gray-100 text-xs font-bold px-3 py-2 rounded-xl border-none focus:ring-2 focus:ring-emerald-500"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">همه انواع</option>
            <option value="knowledge">معلومات</option>
            <option value="tilawat">تلاوت</option>
            <option value="hifz">حفظ</option>
          </select>

          <select 
            className="bg-gray-100 text-xs font-bold px-3 py-2 rounded-xl border-none focus:ring-2 focus:ring-emerald-500"
            value={filterSurah}
            onChange={(e) => setFilterSurah(e.target.value)}
          >
            <option value="all">همه سوره‌ها</option>
            {surahs.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select 
            className="bg-gray-100 text-xs font-bold px-3 py-2 rounded-xl border-none focus:ring-2 focus:ring-emerald-500"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'id' | 'title')}
          >
            <option value="id">ترتیب بر اساس شماره</option>
            <option value="title">ترتیب بر اساس الفبا</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3">
        {filteredLessons.map((lesson) => (
          <motion.button
            key={lesson.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => {
              setSelectedLesson(lesson);
              setActiveTab('planner');
            }}
            className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group text-right relative overflow-hidden"
          >
            {lesson.type === 'hifz' && memorizedLessons.includes(lesson.id) && (
              <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500" />
            )}
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                lesson.type === 'tilawat' ? 'bg-emerald-100 text-emerald-600' : 
                lesson.type === 'hifz' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
              }`}>
                <span className="font-bold text-lg">{lesson.id}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-800 text-sm sm:text-base">{lesson.title}</h3>
                  {lesson.type === 'hifz' && memorizedLessons.includes(lesson.id) && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500">صفحه {lesson.page} • {
                  lesson.type === 'tilawat' ? 'تلاوت' : 
                  lesson.type === 'hifz' ? 'حفظ' : 'معلومات عمومی'
                }</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 rotate-180 shrink-0" />
          </motion.button>
        ))}
      </div>
    </div>
  );

  const renderSchedule = () => (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-lg shadow-emerald-200">
        <h2 className="text-2xl font-bold mb-2">تقسیم اوقات سالانه</h2>
        <p className="text-emerald-100 text-sm">۷۸ ساعت درسی برای یک سال تعلیمی</p>
      </div>

      <div className="space-y-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg">سمستر اول (قبل از امتحان ۴.۵ ماهه)</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-sm text-gray-600">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>درس ۱ الی ۳۵ (تلاوت سوره بقره)</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-gray-600">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>حفظ سوره‌های قدر و زلزال</span>
            </li>
          </ul>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg">سمستر دوم (بعد از امتحان ۴.۵ ماهه)</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-sm text-gray-600">
              <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
              <span>درس ۳۶ الی ۶۹ (ادامه تلاوت سوره بقره)</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-gray-600">
              <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
              <span>حفظ سوره‌های عادیات و بینه</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderGuide = () => (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="bg-amber-500 text-white p-6 rounded-3xl shadow-lg shadow-amber-200">
        <h2 className="text-2xl font-bold mb-2">طرز العمل تدریسی</h2>
        <p className="text-amber-100 text-sm">رهنمودهای اساسی برای معلمان گرامی</p>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-gray-800 text-lg px-2">نکات کلیدی تدریس</h3>
        {TEACHING_GUIDELINES.map((guide, idx) => (
          <div key={idx} className="flex gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 font-bold">
              {idx + 1}
            </div>
            <p className="text-gray-700 leading-relaxed text-sm">{guide}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4 mt-8">
        <h3 className="font-bold text-gray-800 text-lg px-2">قواعد تجوید مطرح شده</h3>
        <div className="grid gap-4">
          {TAJWEED_RULES.map((rule, idx) => (
            <div key={idx} className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-emerald-800">{rule.name}</h4>
                <button 
                  onClick={() => generateAiExplanation(rule.name, rule.description)}
                  disabled={isGenerating === rule.name}
                  className="text-[10px] bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold disabled:opacity-50 flex items-center gap-1"
                >
                  {isGenerating === rule.name ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : <Lightbulb className="w-3 h-3" />}
                  توضیح هوشمند (AI)
                </button>
              </div>
              <p className="text-emerald-700 text-xs leading-relaxed">{rule.description}</p>
              
              {aiExplanation[rule.name] && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 p-4 bg-white rounded-xl border border-emerald-200 text-xs text-emerald-900 leading-loose whitespace-pre-wrap"
                >
                  <div className="flex items-center gap-2 mb-2 text-emerald-600 font-bold">
                    <UserCheck className="w-4 h-4" />
                    توضیح استاد هوشمند:
                  </div>
                  {aiExplanation[rule.name]}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPlanner = () => {
    if (!selectedLesson) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8" dir="rtl">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4">
            <BookMarked className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">پلان تدریسی و محتوای درس</h3>
          <p className="text-gray-500 text-sm mb-6">لطفاً یک درس را از لیست دروس انتخاب کنید تا محتوا و پلان تدریسی آن ایجاد شود.</p>
          <button 
            onClick={() => setActiveTab('lessons')}
            className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200"
          >
            مشاهده لیست دروس
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6 pb-20" dir="rtl">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => {
              setSelectedLesson(null);
              setActiveTab('lessons');
            }}
            className="p-2 bg-gray-100 rounded-xl text-gray-600 flex items-center gap-1"
          >
            <ArrowLeft className="w-5 h-5 rotate-180" />
            <span className="text-xs font-bold">برگشت</span>
          </button>
          <h2 className="font-bold text-gray-800">جزئیات درس: {selectedLesson.title}</h2>
          <button className="p-2 bg-gray-100 rounded-xl text-gray-600">
            <Printer className="w-5 h-5" />
          </button>
        </div>

        {/* Content Section */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          <div className="bg-emerald-600 p-6 text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-bold">{selectedLesson.title}</h3>
                <p className="text-emerald-100 text-sm">مضمون: آموزش قرآن کریم • صنف پنجم</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="bg-white/20 px-3 py-1 rounded-full text-xs backdrop-blur-sm">
                  صفحه {selectedLesson.page}
                </div>
                {selectedLesson.type === 'hifz' && (
                  <button 
                    onClick={() => toggleMemorized(selectedLesson.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                      memorizedLessons.includes(selectedLesson.id) 
                        ? 'bg-emerald-400 text-white' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {memorizedLessons.includes(selectedLesson.id) ? 'حفظ شده' : 'علامت‌گذاری به عنوان حفظ شده'}
                  </button>
                )}
              </div>
            </div>
            
            {selectedLesson.audioUrl && (
              <div className="mt-6 flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                <button 
                  onClick={() => toggleAudio(selectedLesson.audioUrl!)}
                  className="w-12 h-12 bg-white text-emerald-600 rounded-full flex items-center justify-center shadow-lg"
                >
                  {isPlaying && audio.src === selectedLesson.audioUrl ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </button>
                <div className="flex-1">
                  <p className="text-xs text-emerald-200 mb-1">پخش صوتی آیات</p>
                  <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-white"
                      animate={{ width: isPlaying && audio.src === selectedLesson.audioUrl ? '100%' : '0%' }}
                      transition={{ duration: 30, ease: "linear" }}
                    />
                  </div>
                </div>
                <Volume2 className="w-5 h-5 text-emerald-200" />
              </div>
            )}
          </div>

          <div className="p-6 space-y-8">
            {/* Arabic Text */}
            {selectedLesson.arabicText && (
              <section className="text-center">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <BookText className="w-5 h-5" />
                    <h4 className="font-bold">متن آیات</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => isSpeaking ? stopSpeaking() : speakText(selectedLesson.arabicText!, 0.6)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                        isSpeaking ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                      راهنمای تلفظ
                    </button>
                    <button 
                      onClick={() => isSpeaking ? stopSpeaking() : speakText(selectedLesson.arabicText!)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                        isSpeaking ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isSpeaking ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      {isSpeaking ? 'توقف گفتار' : 'شنیدن متن (دری)'}
                    </button>
                  </div>
                </div>
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <p 
                    className={`text-3xl leading-[1.8] font-serif transition-colors duration-300 ${isPlaying ? 'text-red-600' : 'text-gray-800'}`} 
                    style={{ direction: 'rtl', fontFamily: 'serif' }}
                  >
                    {selectedLesson.arabicText}
                  </p>
                </div>
                {selectedLesson.translation && (
                  <div className="mt-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                    <p className="text-sm text-gray-600 leading-relaxed italic">
                      {selectedLesson.translation}
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* Tajweed Rule */}
            {selectedLesson.tajweedRule && (
              <section className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-2 mb-3 text-emerald-700">
                  <Info className="w-5 h-5" />
                  <h4 className="font-bold text-sm">شیوه تجوید (قاعده درس)</h4>
                </div>
                <p className="text-sm text-emerald-800 leading-relaxed">
                  {selectedLesson.tajweedRule}
                </p>
              </section>
            )}

            {/* Teaching Plan */}
            <section className="pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-4 text-gray-800">
                <Layout className="w-5 h-5" />
                <h4 className="font-bold">پلان تدریسی (طرز العمل)</h4>
              </div>
              <div className="space-y-4">
                <div className="relative pr-6 border-r-2 border-emerald-100">
                  <div className="absolute right-[-9px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm"></div>
                  <h5 className="font-bold text-sm text-gray-800 mb-1">مرحله اول: آمادگی و مقدمه (۵ دقیقه)</h5>
                  <p className="text-xs text-gray-600 leading-relaxed">آغاز با نام خدا، حضور و غیاب، و مرور کوتاه بر درس گذشته برای ایجاد انگیزه در شاگردان.</p>
                </div>
                <div className="relative pr-6 border-r-2 border-emerald-100">
                  <div className="absolute right-[-9px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm"></div>
                  <h5 className="font-bold text-sm text-gray-800 mb-1">مرحله دوم: ارائه درس جدید (۲۵ دقیقه)</h5>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {selectedLesson.type === 'tilawat' ? 
                      `تلاوت آیات ${selectedLesson.verses} توسط معلم با رعایت قواعد تجوید. سپس تلاوت گروهی و انفرادی شاگردان.` :
                      `شرح محتوای درس و قرائت متن صفحه ${selectedLesson.page} برای شاگردان.`
                    }
                  </p>
                </div>
                <div className="relative pr-6 border-r-2 border-emerald-100">
                  <div className="absolute right-[-9px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm"></div>
                  <h5 className="font-bold text-sm text-gray-800 mb-1">مرحله سوم: تمرین قواعد و کلمات (۱۰ دقیقه)</h5>
                  <p className="text-xs text-gray-600 leading-relaxed">تمرین کلمات مشکل درس و شناسایی قواعد تجوید که در این درس ذکر شده است.</p>
                </div>
                <div className="relative pr-6 border-r-2 border-emerald-100">
                  <div className="absolute right-[-9px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm"></div>
                  <h5 className="font-bold text-sm text-gray-800 mb-1">مرحله چهارم: ارزیابی و اختتام (۵ دقیقه)</h5>
                  <p className="text-xs text-gray-600 leading-relaxed">پرسش از شاگردان در مورد درس جدید و تعیین وظیفه خانگی.</p>
                </div>
              </div>
            </section>

            <section className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
              <div className="flex items-center gap-2 mb-2 text-amber-600">
                <Lightbulb className="w-5 h-5" />
                <h4 className="font-bold text-sm">پیشنهاد آموزشی</h4>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                در این درس سعی کنید شاگردان را تشویق کنید تا با صدای بلند و شمرده تلاوت کنند. از تخته برای نوشتن کلمات دارای قواعد تجوید استفاده نمایید.
              </p>
            </section>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-emerald-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-20" dir="rtl">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <BookOpen className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">آموزش قرآن کریم</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">صنف پنجم • وزارت معارف</p>
            </div>
          </div>
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 pt-6 min-h-[calc(100vh-160px)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + (selectedLesson?.id || '')}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'home' && renderHome()}
            {activeTab === 'lessons' && renderLessons()}
            {activeTab === 'schedule' && renderSchedule()}
            {activeTab === 'guide' && renderGuide()}
            {activeTab === 'planner' && renderPlanner()}
            {activeTab === 'chat' && renderChat()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 px-6 py-3 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-around">
          <NavButton 
            active={activeTab === 'home'} 
            onClick={() => { setActiveTab('home'); setSelectedLesson(null); }} 
            icon={<BookOpen />} 
            label="خانه" 
          />
          <NavButton 
            active={activeTab === 'lessons'} 
            onClick={() => { setActiveTab('lessons'); setSelectedLesson(null); }} 
            icon={<Layout />} 
            label="دروس" 
          />
          <NavButton 
            active={activeTab === 'chat'} 
            onClick={() => setActiveTab('chat')} 
            icon={<Mic />} 
            label="دستیار" 
          />
          <NavButton 
            active={activeTab === 'planner'} 
            onClick={() => setActiveTab('planner')} 
            icon={<BookMarked />} 
            label="پلان" 
          />
          <NavButton 
            active={activeTab === 'guide'} 
            onClick={() => setActiveTab('guide')} 
            icon={<Info />} 
            label="رهنمود" 
          />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-emerald-600' : 'text-gray-400'}`}
    >
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-emerald-50' : ''}`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
      </div>
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

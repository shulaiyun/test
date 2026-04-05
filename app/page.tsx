'use client';

import { useState, useEffect, useRef } from 'react';
import { auth, signInWithGoogle, logOut, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { generateDreamStory, generateDreamImage, generateDreamVoice } from '@/lib/ai';
import { saveMedia, getMedia } from '@/lib/db';
import { Sparkles, Image as ImageIcon, Music, Mic, LogOut, Loader2, Play, Globe } from 'lucide-react';
import Image from 'next/image';

interface Dream {
  id: string;
  userId: string;
  prompt: string;
  story: string;
  createdAt: Timestamp;
}

const t = {
  en: {
    title: "AI Dream Weaver",
    subtitle: "Turn your fleeting dreams into vivid stories, surreal images, and ethereal soundtracks.",
    signIn: "Sign in with Google",
    dreams: "Your Dreams",
    noDreams: "No dreams woven yet.",
    placeholder: "Describe your dream...",
    weave: "Weave",
    animating: "Animating Dream...",
    animate: "Animate Dream",
    theDream: "The Dream",
    theStory: "The Story",
    voiceover: "Voiceover",
    soundtrack: "Soundtrack",
    selectDream: "Select a dream from the sidebar or weave a new one.",
    stepStory: "Weaving your story...",
    stepImage: "Visualizing the dreamscape...",
    stepVoice: "Recording the dream voice...",
    stepMusic: "Composing the soundtrack...",
    errorCreate: "Failed to weave dream. Please try again.",
    errorAnimate: "Failed to animate dream."
  },
  zh: {
    title: "AI 梦境编织者",
    subtitle: "将您转瞬即逝的梦境转化为生动的故事、超现实的图像和空灵的配乐。",
    signIn: "使用 Google 登录",
    dreams: "你的梦境",
    noDreams: "还没有编织任何梦境。",
    placeholder: "描述你的梦境...",
    weave: "编织梦境",
    animating: "正在生成梦境视频...",
    animate: "生成动态梦境",
    theDream: "梦境",
    theStory: "故事",
    voiceover: "梦境旁白",
    soundtrack: "梦境配乐",
    selectDream: "从侧边栏选择一个梦境，或编织一个新的梦境。",
    stepStory: "正在编织你的故事...",
    stepImage: "正在具象化梦境场景...",
    stepVoice: "正在录制梦境旁白...",
    stepMusic: "正在创作梦境配乐...",
    errorCreate: "编织梦境失败，请重试。",
    errorAnimate: "生成动态梦境失败。"
  }
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  
  const [isCreating, setIsCreating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loadingStep, setLoadingStep] = useState<string>('');
  
  const [activeDream, setActiveDream] = useState<Dream | null>(null);
  const [activeMedia, setActiveMedia] = useState<{ image?: string, audio?: string }>({});
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) return;
    
    const q = query(
      collection(db, 'dreams'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const d: Dream[] = [];
      snapshot.forEach((doc) => {
        d.push({ id: doc.id, ...doc.data() } as Dream);
      });
      setDreams(d);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'dreams');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleCreateDream = async () => {
    if (!prompt.trim() || !user) return;
    
    try {
      setIsCreating(true);

      setLoadingStep(t[lang].stepStory);
      const story = await generateDreamStory(prompt, lang);
      
      const docRef = await addDoc(collection(db, 'dreams'), {
        userId: user.uid,
        prompt,
        story,
        createdAt: serverTimestamp()
      });
      const dreamId = docRef.id;

      setLoadingStep(t[lang].stepImage);
      const imageRes = await generateDreamImage(story);
      if (imageRes) {
        await saveMedia(dreamId, 'image', imageRes.data, imageRes.mimeType);
      }

      setLoadingStep(t[lang].stepVoice);
      const voiceRes = await generateDreamVoice(story, lang);
      if (voiceRes) {
        await saveMedia(dreamId, 'audio', voiceRes.data, voiceRes.mimeType);
      }

      setPrompt('');
      setIsCreating(false);
      setLoadingStep('');
      
      loadDreamMedia({ id: dreamId, userId: user.uid, prompt, story, createdAt: Timestamp.now() });

    } catch (error) {
      console.error("Error creating dream:", error);
      alert(t[lang].errorCreate);
      setIsCreating(false);
      setLoadingStep('');
    }
  };

  const loadDreamMedia = async (dream: Dream) => {
    setActiveDream(dream);
    setActiveMedia({});
    
    const image = await getMedia(dream.id, 'image');
    const audio = await getMedia(dream.id, 'audio');
    
    setActiveMedia({
      image: image ? `data:${image.mimeType};base64,${image.data}` : undefined,
      audio: audio ? `data:${audio.mimeType};base64,${audio.data}` : undefined,
    });
  };

  // Removed handleAnimateDream to keep the app free and without API key requirements.

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50"><Loader2 className="animate-spin w-8 h-8" /></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-50 p-4">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-slate-400" />
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value as 'en' | 'zh')}
            className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-sm text-slate-300 focus:outline-none"
          >
            <option value="en">English</option>
            <option value="zh">简体中文</option>
          </select>
        </div>
        <div className="max-w-md text-center space-y-6">
          <Sparkles className="w-16 h-16 mx-auto text-indigo-400" />
          <h1 className="text-4xl font-bold tracking-tight">{t[lang].title}</h1>
          <p className="text-slate-400 text-lg">{t[lang].subtitle}</p>
          <button 
            onClick={signInWithGoogle}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-full font-medium transition-colors"
          >
            {t[lang].signIn}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-screen overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            {t[lang].title}
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={lang} 
              onChange={(e) => setLang(e.target.value as 'en' | 'zh')}
              className="bg-slate-800 border-none rounded-md px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="en">EN</option>
              <option value="zh">中文</option>
            </select>
            <button onClick={logOut} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{t[lang].dreams}</h2>
          {dreams.map(dream => (
            <button
              key={dream.id}
              onClick={() => loadDreamMedia(dream)}
              className={`w-full text-left p-3 rounded-xl transition-colors ${activeDream?.id === dream.id ? 'bg-indigo-900/50 border border-indigo-500/30' : 'hover:bg-slate-800 border border-transparent'}`}
            >
              <div className="text-sm font-medium line-clamp-1">{dream.prompt}</div>
              <div className="text-xs text-slate-500 mt-1">
                {dream.createdAt?.toDate().toLocaleDateString()}
              </div>
            </button>
          ))}
          {dreams.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-8">{t[lang].noDreams}</div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Create Area */}
        <div className="p-6 border-b border-slate-800 bg-slate-950 z-10 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t[lang].placeholder}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 pr-32 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-200 placeholder:text-slate-500"
                rows={3}
                disabled={isCreating}
              />
              <button
                onClick={handleCreateDream}
                disabled={!prompt.trim() || isCreating}
                className="absolute bottom-4 right-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {t[lang].weave}
              </button>
            </div>
            {isCreating && (
              <div className="mt-3 text-sm text-indigo-400 flex items-center gap-2 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                {loadingStep}
              </div>
            )}
          </div>
        </div>

        {/* View Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeDream ? (
            <div className="max-w-3xl mx-auto space-y-8 pb-12">
              {activeMedia.image ? (
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-800 shadow-2xl group">
                  <Image src={activeMedia.image} alt="Dreamscape" fill className="object-cover" referrerPolicy="no-referrer" />
                </div>
              ) : null}
              
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-slate-200">{t[lang].theDream}</h2>
                <p className="text-slate-400 italic border-l-2 border-indigo-500 pl-4">{activeDream.prompt}</p>
              </div>

              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-slate-200">{t[lang].theStory}</h2>
                <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed">
                  {activeDream.story}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-800">
                {activeMedia.audio && (
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-2 mb-3 text-sm font-medium text-slate-300">
                      <Mic className="w-4 h-4 text-indigo-400" />
                      {t[lang].voiceover}
                    </div>
                    <audio controls src={activeMedia.audio} className="w-full h-10" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              {t[lang].selectDream}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, Component } from 'react';
import { flushSync } from 'react-dom';
import { 
  Sparkles, Droplets, Sun, Moon, AlertCircle, 
  ChevronRight, ChevronLeft, CheckCircle2, Heart, 
  Flower2, MessageCircle, Search, Mic,
  Printer, CalendarDays, Star, Loader2, Wand2,
  User as UserIcon, LogOut, LayoutDashboard,
  Plus, Trash2, Check, X,
  History, ShoppingBag, Settings, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GOALS, PRODUCT_CATEGORIES, REACTIONS, SKIN_TYPES, 
  BUDGET_OPTS, COMMITMENT_OPTS, ROUTINE_OPTS, ROTATE_OPTS, 
  FRAGRANCE_OPTS, TIME_OPTS, SENSITIVITY_OPTS, DERM_OPTS 
} from './constants';
import { 
  generateSkincareRoutine, askSkincareAI, analyzeProductIngredients 
} from './lib/gemini';
import { auth, db, googleProvider } from './firebase';
import { 
  signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, addDoc, query, where, getDocs, 
  onSnapshot, setDoc, doc, getDoc, orderBy, 
  limit, Timestamp, deleteDoc, updateDoc
} from 'firebase/firestore';

// --- Types & Enums ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

// --- Components ---

class ErrorBoundary extends (Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse(this.state.error.message);
        if (parsedError.error) {
          errorMessage = `Firestore Error: ${parsedError.error} during ${parsedError.operationType} on ${parsedError.path}`;
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAFAF9] dark:bg-[#121212]">
          <div className="max-w-md w-full p-8 bg-white dark:bg-[#1E1E1E] rounded-3xl border border-[#E5E0DB] dark:border-[#333333] shadow-xl text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-serif text-[#1C1A17] dark:text-[#FAFAFA] mb-4">Application Error</h2>
            <p className="text-[#5C554F] dark:text-[#A3A3A3] mb-8 text-sm leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-[#1C1A17] dark:bg-[#FAFAFA] text-white dark:text-[#1C1A17] rounded-2xl font-medium tracking-wide transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Sub-components ---

const ThinkingAnimation = () => (
  <div className="relative flex items-center justify-center w-32 h-32 mb-2">
    <div className="absolute w-16 h-16 bg-[#D4E0D9] rounded-[40%_60%_70%_30%_/_40%_50%_60%_50%] opacity-80 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
    <div className="relative z-10 w-full h-full animate-[spin_3s_linear_infinite]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-[#1C1A17] dark:text-[#FAFAFA] stroke-current" fill="none" strokeWidth="1.5">
        <circle cx="50" cy="50" r="14" strokeDasharray="65 25" strokeLinecap="round" strokeDashoffset="20" />
        <circle cx="32" cy="64" r="1.5" />
        <path d="M68 32 Q68 38 74 38 Q68 38 68 44 Q68 38 62 38 Q68 38 68 32 Z" strokeLinejoin="round" strokeWidth="1.2" fill="none" />
      </svg>
    </div>
  </div>
);

const LineArtIcon = ({ Icon, bgColor, animate = false }: { Icon: any, bgColor: string, animate?: boolean }) => (
  <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20">
    <div className={`absolute w-12 h-12 sm:w-16 sm:h-16 ${bgColor} rounded-[40%_60%_70%_30%_/_40%_50%_60%_50%] opacity-80 top-1 right-2 sm:right-0 transition-transform duration-700 ${animate ? 'animate-pulse' : ''}`}></div>
    <Icon className="relative z-10 w-8 h-8 sm:w-10 sm:h-10 text-[#1C1A17] dark:text-[#FAFAFA] stroke-[1.2]" />
    <Sparkles className="absolute top-1 right-1 sm:right-0 w-3 h-3 sm:w-4 sm:h-4 text-[#1C1A17] dark:text-[#FAFAFA] stroke-[1.5]" />
    <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full border border-[#1C1A17] dark:border-[#FAFAFA]"></div>
  </div>
);

const StepIcon = ({ stepNumber, active }: { stepNumber: any, active: boolean }) => (
  <div className="relative flex flex-col items-center">
    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-serif text-lg z-10 transition-all duration-500
      ${active ? 'bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17]' : 'bg-white border border-[#E5E0DB] text-[#8C857B] dark:bg-[#1E1E1E] dark:border-[#333333] dark:text-[#888888]'}`}>
      {stepNumber}
    </div>
    <div className={`absolute w-8 h-8 rounded-[30%_70%_50%_50%_/_50%_40%_60%_50%] opacity-50 top-1 -right-2 transition-colors duration-500
      ${active ? 'bg-[#F4D5C9]' : 'bg-transparent'}`}></div>
  </div>
);

const OptionCard = ({ label, selected, onClick, icon: Icon }: { label: string, selected: boolean, onClick: () => void, icon?: any, key?: any }) => (
  <button
    key={label}
    onClick={onClick}
    className={`group relative flex items-center p-5 rounded-2xl border transition-all duration-300 w-full text-left overflow-hidden
      ${selected 
        ? 'bg-white border-[#1C1A17] text-[#1C1A17] shadow-[4px_4px_0px_0px_rgba(28,26,23,0.1)] dark:bg-[#2A2A2A] dark:border-[#FAFAFA] dark:text-[#FAFAFA] dark:shadow-none' 
        : 'bg-white border-[#E5E0DB] text-[#5C554F] hover:border-[#1C1A17] dark:bg-[#1E1E1E] dark:border-[#333333] dark:text-[#A3A3A3] dark:hover:border-[#FAFAFA]'
      }`}
  >
    <div className={`absolute -right-6 -top-6 w-20 h-20 rounded-full mix-blend-multiply dark:mix-blend-screen opacity-0 transition-all duration-500 group-hover:opacity-40
      ${selected ? 'bg-[#B6D3D9] opacity-40' : 'bg-[#D4E0D9]'}`}></div>
    
    {Icon && <Icon className={`relative z-10 w-5 h-5 mr-3 stroke-[1.5] ${selected ? 'text-[#1C1A17] dark:text-[#FAFAFA]' : 'text-[#8C857B] dark:text-[#666666] group-hover:text-[#1C1A17] dark:group-hover:text-[#FAFAFA]'}`} />}
    <span className={`relative z-10 font-medium ${selected ? 'text-[#1C1A17] dark:text-[#FAFAFA]' : 'text-[#5C554F] dark:text-[#A3A3A3] group-hover:text-[#1C1A17] dark:group-hover:text-[#FAFAFA]'}`}>{label}</span>
  </button>
);

const Pill = ({ label, selected, onClick }: { label: string, selected: boolean, onClick: () => void, key?: any }) => (
  <button
    key={label}
    onClick={onClick}
    className={`relative px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 overflow-hidden group border
      ${selected 
        ? 'border-[#1C1A17] text-[#1C1A17] bg-transparent dark:border-[#FAFAFA] dark:text-[#FAFAFA]' 
        : 'bg-white text-[#5C554F] border-[#E5E0DB] hover:border-[#1C1A17] hover:text-[#1C1A17] dark:bg-[#1E1E1E] dark:text-[#A3A3A3] dark:border-[#333333] dark:hover:border-[#FAFAFA] dark:hover:text-[#FAFAFA]'
      }`}
  >
    <div className={`absolute inset-0 opacity-0 transition-opacity duration-300 rounded-full
      ${selected ? 'bg-[#F4D5C9] opacity-40' : 'group-hover:bg-[#F4F1ED] dark:group-hover:bg-[#333333] group-hover:opacity-100'}`}></div>
    <span className="relative z-10">{label}</span>
  </button>
);

const SpeechToTextButton = ({ 
  isActive, 
  onClick, 
  className = "" 
}: { 
  isActive: boolean, 
  onClick: () => void, 
  className?: string 
}) => (
  <button
    type="button"
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }}
    className={`p-2 rounded-full transition-all ${isActive ? 'bg-[#F4D5C9] text-[#1C1A17] animate-pulse' : 'text-[#8C857B] hover:text-[#1C1A17]'} ${className}`}
  >
    <Mic className="w-5 h-5 stroke-[1.5]" />
  </button>
);

const ProductModal = ({ isOpen, onClose, onAdd, toggleListen, isListening, activeInput }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onAdd: (product: any) => void,
  toggleListen: any,
  isListening: boolean,
  activeInput: string | null
}) => {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Skincare');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name, brand, category });
    setName('');
    setBrand('');
    setCategory('Skincare');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#1E1E1E] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-6 flex items-center justify-between border-b border-[#E5E0DB] dark:border-[#333333]">
          <h3 className="text-xl font-serif">Add to Shelf</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#F4F1ED] dark:hover:bg-[#2A2A2A] transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="relative">
            <label className="block text-xs font-bold uppercase tracking-widest text-[#8C857B] mb-2">Product Name</label>
            <input 
              autoFocus
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CeraVe Hydrating Cleanser"
              className="w-full px-5 py-4 pr-14 rounded-2xl border border-[#E5E0DB] dark:border-[#333333] bg-transparent focus:border-[#1C1A17] dark:focus:border-[#FAFAFA] transition-all outline-none"
              required
            />
            <div className="absolute right-3 top-[38px]">
              <SpeechToTextButton 
                isActive={isListening && activeInput === 'productName'}
                onClick={() => toggleListen(setName, 'productName', name)}
              />
            </div>
          </div>
          <div className="relative">
            <label className="block text-xs font-bold uppercase tracking-widest text-[#8C857B] mb-2">Brand (Optional)</label>
            <input 
              type="text" 
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. CeraVe"
              className="w-full px-5 py-4 pr-14 rounded-2xl border border-[#E5E0DB] dark:border-[#333333] bg-transparent focus:border-[#1C1A17] dark:focus:border-[#FAFAFA] transition-all outline-none"
            />
            <div className="absolute right-3 top-[38px]">
              <SpeechToTextButton 
                isActive={isListening && activeInput === 'productBrand'}
                onClick={() => toggleListen(setBrand, 'productBrand', brand)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#8C857B] mb-2">Category</label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border border-[#E5E0DB] dark:border-[#333333] bg-transparent focus:border-[#1C1A17] dark:focus:border-[#FAFAFA] transition-all outline-none appearance-none"
            >
              {PRODUCT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <button 
            type="submit"
            className="w-full py-4 rounded-full bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17] font-medium shadow-lg active:scale-95 transition-all"
          >
            Add to Shelf
          </button>
        </form>
      </div>
    </div>
  );
};

const ReviewModal = ({ 
  isOpen, 
  onClose, 
  onAdd,
  isSubmitting
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onAdd: (data: { rating: number; comment: string }) => void;
  isSubmitting: boolean;
}) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    onAdd({ rating, comment });
    setComment('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#1E1E1E] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-6 flex items-center justify-between border-b border-[#E5E0DB] dark:border-[#333333]">
          <h3 className="text-xl font-serif">Share Your Experience</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#F4F1ED] dark:hover:bg-[#2A2A2A] transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#8C857B] mb-3">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star 
                    className={`w-8 h-8 ${star <= rating ? 'fill-[#1C1A17] dark:fill-[#FAFAFA] text-[#1C1A17] dark:text-[#FAFAFA]' : 'text-[#E5E0DB] dark:text-[#333333]'}`} 
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#8C857B] mb-2">Your Thoughts</label>
            <textarea 
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How has Aura helped your skin journey?"
              className="w-full px-5 py-4 rounded-2xl border border-[#E5E0DB] dark:border-[#333333] bg-transparent focus:border-[#1C1A17] dark:focus:border-[#FAFAFA] transition-all outline-none min-h-[120px]"
              required
            />
          </div>
          <button 
            type="submit"
            disabled={isSubmitting || !comment.trim()}
            className="w-full py-4 rounded-full bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17] font-medium shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Post Review'}
          </button>
        </form>
      </div>
    </div>
  );
};

const SkinDiaryModal = ({ isOpen, onClose, onAdd, toggleListen, isListening, activeInput }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onAdd: (entry: string) => void,
  toggleListen: any,
  isListening: boolean,
  activeInput: string | null
}) => {
  const [entry, setEntry] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry.trim()) return;
    onAdd(entry);
    setEntry('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#1E1E1E] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-6 flex items-center justify-between border-b border-[#E5E0DB] dark:border-[#333333]">
          <h3 className="text-xl font-serif">Daily Skin Diary</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#F4F1ED] dark:hover:bg-[#2A2A2A] transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="relative">
            <label className="block text-xs font-bold uppercase tracking-widest text-[#8C857B] mb-2">How does your skin feel today?</label>
            <textarea 
              autoFocus
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder="e.g., Skin felt a bit dry this morning, but glowing after the serum..."
              className="w-full px-5 py-4 pr-14 rounded-2xl border border-[#E5E0DB] dark:border-[#333333] bg-transparent focus:border-[#1C1A17] dark:focus:border-[#FAFAFA] transition-all outline-none min-h-[150px]"
              required
            />
            <div className="absolute right-3 bottom-3">
              <SpeechToTextButton 
                isActive={isListening && activeInput === 'skinDiary'}
                onClick={() => toggleListen(setEntry, 'skinDiary', entry)}
              />
            </div>
          </div>
          <button 
            type="submit"
            className="w-full py-4 rounded-full bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17] font-medium shadow-lg active:scale-95 transition-all"
          >
            Save Entry
          </button>
        </form>
      </div>
    </div>
  );
};

const SkincareTools = ({ 
  analyzeInput, 
  setAnalyzeInput, 
  handleAnalyzeProduct, 
  isAnalyzing, 
  analyzeResult,
  aiQuestion,
  setAiQuestion,
  handleAskAI,
  isAsking,
  aiAnswer,
  toggleListen,
  isListening,
  activeInput
}: any) => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Analyzer */}
    <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-8 border border-[#E5E0DB] dark:border-[#333333]">
      <div className="flex items-center mb-4">
        <Search className="w-6 h-6 text-[#1C1A17] dark:text-[#FAFAFA] mr-3 stroke-[1.5]" />
        <h3 className="text-2xl font-serif">Ingredient Analyzer</h3>
      </div>
      <div className="relative">
        <textarea
          value={analyzeInput}
          onChange={(e) => setAnalyzeInput(e.target.value)}
          placeholder="Paste ingredients here..."
          className="w-full px-5 py-4 pr-14 rounded-2xl border border-[#E5E0DB] dark:border-[#333333] min-h-[120px] bg-transparent"
        />
        <div className="absolute right-3 bottom-3">
          <SpeechToTextButton 
            isActive={isListening && activeInput === 'analyzer'}
            onClick={() => toggleListen(setAnalyzeInput, 'analyzer', analyzeInput)}
          />
        </div>
        <button onClick={handleAnalyzeProduct} disabled={isAnalyzing || !analyzeInput.trim()} className="mt-4 bg-[#1C1A17] text-white px-8 py-3 rounded-full font-medium ml-auto block">
          {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analyze ✨'}
        </button>
      </div>
      {analyzeResult && <div className="mt-6 p-6 bg-[#FAFAFA] dark:bg-[#121212] rounded-2xl text-sm font-light">{analyzeResult}</div>}
    </div>

    {/* Q&A */}
    <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-8 border border-[#E5E0DB] dark:border-[#333333]">
      <div className="flex items-center mb-4">
        <MessageCircle className="w-6 h-6 text-[#1C1A17] dark:text-[#FAFAFA] mr-3 stroke-[1.5]" />
        <h3 className="text-2xl font-serif">Ask AI</h3>
      </div>
      <div className="flex gap-4 relative">
        <input
          type="text"
          value={aiQuestion}
          onChange={(e) => setAiQuestion(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 px-5 py-4 pr-14 rounded-2xl border border-[#E5E0DB] dark:border-[#333333] bg-transparent"
        />
        <div className="absolute right-[140px] top-1/2 -translate-y-1/2">
          <SpeechToTextButton 
            isActive={isListening && activeInput === 'aiQuestion'}
            onClick={() => toggleListen(setAiQuestion, 'aiQuestion', aiQuestion)}
          />
        </div>
        <button onClick={handleAskAI} disabled={isAsking || !aiQuestion.trim()} className="bg-[#1C1A17] text-white px-8 py-4 rounded-full font-medium">
          {isAsking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ask ✨'}
        </button>
      </div>
      {aiAnswer && <div className="mt-6 p-6 bg-[#FAFAFA] dark:bg-[#121212] rounded-2xl text-sm font-light">{aiAnswer}</div>}
    </div>
  </div>
);

// --- Main App Component ---

export default function App() {
  const [step, setStep] = useState(1);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [view, setView] = useState<'landing' | 'generator' | 'dashboard' | 'shelf' | 'progress' | 'tools'>('landing');
  const [savedRoutines, setSavedRoutines] = useState<any[]>([]);
  const [progressEntries, setProgressEntries] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'routine' | 'tools'>('routine');

  const [answers, setAnswers] = useState({
    skinType: '',
    age: '',
    sensitivities: '',
    sensitiveTo: '',
    dermatologist: '',
    productType: '',
    goals: [] as string[],
    currentProducts: [] as string[],
    reactions: [] as string[],
    budget: '',
    commitment: '',
    amProducts: '3',
    pmProducts: '3',
    advanced: '',
    rotate: '',
    routineTime: '',
    fragranceFree: '',
    gentleOrActive: '',
  });

  // Sync dark mode state to html element
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      // If user logs in and is on landing, move to dashboard
      if (currentUser && view === 'landing') {
        setView('dashboard');
      }
    });
    return () => unsubscribe();
  }, [view]);

  useEffect(() => {
    if (!user) {
      setSavedRoutines([]);
      setProgressEntries([]);
      setInventory([]);
      return;
    }

    const uid = user.uid;

    // Listen for routines
    const routinesQuery = query(
      collection(db, 'routines'),
      where('uid', '==', uid)
    );
    const unsubRoutines = onSnapshot(routinesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory to avoid index requirement for now
      data.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setSavedRoutines(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'routines'));

    // Listen for progress
    const progressQuery = query(
      collection(db, 'progress'),
      where('uid', '==', uid)
    );
    const unsubProgress = onSnapshot(progressQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Progress data received:', data.length, 'entries');
      // Sort by date string descending
      data.sort((a: any, b: any) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });
      setProgressEntries(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'progress'));

    // Listen for inventory
    const inventoryQuery = query(
      collection(db, 'inventory'),
      where('uid', '==', uid)
    );
    const unsubInventory = onSnapshot(inventoryQuery, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'inventory'));

    // Listen for diary entries
    const diaryQuery = query(
      collection(db, 'diary'),
      where('uid', '==', uid)
    );
    const unsubDiary = onSnapshot(diaryQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setDiaryEntries(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'diary'));

    return () => {
      unsubRoutines();
      unsubProgress();
      unsubInventory();
      unsubDiary();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('generator');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const resetQuiz = () => {
    setStep(1);
    setAnswers({
      skinType: '',
      age: '',
      sensitivities: '',
      sensitiveTo: '',
      dermatologist: '',
      productType: '',
      goals: [] as string[],
      currentProducts: [] as string[],
      reactions: [] as string[],
      budget: '',
      commitment: '',
      amProducts: '3',
      pmProducts: '3',
      advanced: '',
      rotate: '',
      routineTime: '',
      fragranceFree: '',
      gentleOrActive: '',
    });
    setRoutine(null);
  };

  const saveCurrentRoutine = async (routineData: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'routines'), {
        uid: user.uid,
        ...routineData,
        createdAt: new Date().toISOString(),
        active: true
      });
      setView('dashboard');
    } catch (error) {
      console.error("Failed to save routine", error);
    }
  };

  const deleteRoutine = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'routines', id));
    } catch (error) {
      console.error("Failed to delete routine", error);
    }
  };

  const handleCheckIn = async (completedAM: boolean, completedPM: boolean) => {
    if (!user) return;
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const path = `progress/${user.uid}_${today}`;
    try {
      await setDoc(doc(db, 'progress', `${user.uid}_${today}`), {
        uid: user.uid,
        date: today,
        completedAM,
        completedPM,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const addToShelf = async (product: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'inventory'), {
        uid: user.uid,
        ...product,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Failed to add to shelf", error);
    }
  };

  const removeFromShelf = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inventory', id));
    } catch (error) {
      console.error("Failed to remove from shelf", error);
    }
  };

  const addToDiary = async (entry: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'diary'), {
        uid: user.uid,
        entry,
        createdAt: new Date().toISOString()
      });
      setIsDiaryModalOpen(false);
    } catch (error) {
      console.error("Failed to add to diary", error);
    }
  };

  useEffect(() => {
    if (view === 'landing') {
      const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(10));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'reviews');
      });
      return () => unsubscribe();
    }
  }, [view]);

  const addReview = async (reviewData: { rating: number; comment: string }) => {
    if (!user) return;
    setIsSubmittingReview(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        photoURL: user.photoURL || '',
        rating: reviewData.rating,
        comment: reviewData.comment,
        createdAt: new Date().toISOString()
      });
      setIsReviewModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reviews');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (user && progressEntries.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const todayEntry = progressEntries.find(e => e.date === today);
      const newNotifications = [];
      
      if (!todayEntry?.completedAM) {
        newNotifications.push({ id: 'am', title: 'Morning Routine', message: 'Time for your AM glow up!', icon: <Sun className="w-4 h-4" /> });
      }
      if (!todayEntry?.completedPM && new Date().getHours() >= 18) {
        newNotifications.push({ id: 'pm', title: 'Night Routine', message: 'Don\'t forget your PM repair!', icon: <Moon className="w-4 h-4" /> });
      }
      setNotifications(newNotifications);
    }
  }, [user, progressEntries]);

  const [routine, setRoutine] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  const loadingSteps = [
    "Analyzing your skin profile...",
    "Reviewing ingredient compatibilities...",
    "Formulating your morning routine...",
    "Selecting PM actives...",
    "Finalizing your Aura plan..."
  ];

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingStepIndex((prev) => (prev + 1) % loadingSteps.length);
      }, 1500);
    } else {
      setLoadingStepIndex(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);
  
  const [isAsking, setIsAsking] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isDiaryModalOpen, setIsDiaryModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<any[]>([]);

  const [analyzeInput, setAnalyzeInput] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const handleSelect = (field: string, value: string) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  const handleMultiSelect = (field: string, value: string) => {
    setAnswers(prev => {
      const current = (prev as any)[field];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter((item: string) => item !== value) };
      }
      return { ...prev, [field]: [...current, value] };
    });
  };

  const nextStep = () => {
    if (step < 6) setStep(step + 1);
    if (step === 5) generateRoutine();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateRoutine = async () => {
    setIsLoading(true);
    setActiveTab('routine');
    setAiQuestion('');
    setAiAnswer('');
    setAnalyzeInput('');
    setAnalyzeResult('');
    
    try {
      const routineData = await generateSkincareRoutine(answers);
      setRoutine(routineData);
    } catch (error) {
      console.error("AI Generation failed, using fallback", error);
      
      // Robust Fallback Logic
      const { skinType, goals, commitment, rotate, gentleOrActive, sensitivities } = answers;
      const isSensitive = skinType === 'Sensitive' || sensitivities === 'Yes' || gentleOrActive === 'Gentle';
      const isSimple = commitment === 'Very simple';
      
      let am = [];
      let pm = [];
      
      // AM
      am.push({ step: 1, name: (skinType === 'Dry' || isSensitive) ? 'Splash of Water' : 'Gentle Cleanser', desc: 'Start with a clean base.' });
      if (!isSimple) {
        if (goals.includes('Brightening')) am.push({ step: 2, name: 'Vitamin C Serum', desc: 'Brighten and protect.' });
        else if (goals.includes('Hydration')) am.push({ step: 2, name: 'Hyaluronic Acid', desc: 'Plump and hydrate.' });
      }
      am.push({ step: am.length + 1, name: 'Moisturizer', desc: 'Lock in hydration.' });
      am.push({ step: am.length + 1, name: 'SPF 30+', desc: 'Essential protection.' });

      // PM
      pm.push({ step: 1, name: 'Gentle Cleanser', desc: 'Remove the day\'s impurities.' });
      if (!isSimple) {
        if (goals.includes('Acne control')) pm.push({ step: 2, name: 'Salicylic Acid', desc: 'Clear pores.' });
        else if (goals.includes('Anti-aging')) pm.push({ step: 2, name: 'Retinol', desc: 'Renew skin.' });
      }
      pm.push({ step: pm.length + 1, name: 'Night Cream', desc: 'Repair overnight.' });

      setRoutine({
        am,
        pm,
        weeklySchedule: [
          { day: 'Monday', focus: 'Treatment', details: 'Apply your active serum.' },
          { day: 'Tuesday', focus: 'Recovery', details: 'Focus on hydration.' },
          { day: 'Wednesday', focus: 'Treatment', details: 'Apply your active serum.' },
          { day: 'Thursday', focus: 'Recovery', details: 'Focus on hydration.' },
          { day: 'Friday', focus: 'Treatment', details: 'Apply your active serum.' },
          { day: 'Saturday', focus: 'Recovery', details: 'Focus on hydration.' },
          { day: 'Sunday', focus: 'Recovery', details: 'Focus on hydration.' }
        ],
        notes: [
          "AI generation failed, providing a standard routine based on your profile.",
          isSensitive ? "Always patch test new products." : "Consistency is key."
        ]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('routine-print-area');
    if (!printContent) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Aura — Your Skincare Plan</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
    <style>
      @page { size: A4; margin: 14mm 16mm; }
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', sans-serif; font-size: 8pt; color: #1C1A17; background: #fff; line-height: 1.4; }
      .serif { font-family: 'Playfair Display', serif; }
      /* Header */
      .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 4mm; margin-bottom: 5mm; border-bottom: 1.5pt solid #1C1A17; }
      .header-brand { display: flex; flex-direction: column; gap: 1mm; }
      .header-title { font-family: 'Playfair Display', serif; font-size: 22pt; font-weight: 400; letter-spacing: -0.5pt; line-height: 1; }
      .header-sub { font-size: 6.5pt; text-transform: uppercase; letter-spacing: 2pt; color: #8C857B; font-weight: 500; }
      .header-meta { text-align: right; font-size: 7pt; color: #8C857B; line-height: 1.6; }
      .header-meta strong { color: #1C1A17; font-weight: 500; }
      /* Section labels */
      .section-label { font-size: 6pt; font-weight: 600; text-transform: uppercase; letter-spacing: 2.5pt; color: #8C857B; margin-bottom: 3mm; display: flex; align-items: center; gap: 2mm; }
      .section-label::after { content: ''; flex: 1; height: 0.5pt; background: #E5E0DB; }
      /* Two column grid */
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 4mm; }
      .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3mm; }
      .grid-7 { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2mm; margin-bottom: 4mm; }
      /* Cards */
      .card { border: 0.75pt solid #E5E0DB; border-radius: 5pt; padding: 4mm; break-inside: avoid; }
      .card-accent-am { border-top: 2pt solid #D4A574; }
      .card-accent-pm { border-top: 2pt solid #7BA7BC; }
      .card-accent-week { border-top: 2pt solid #1C1A17; }
      .card-dark { background: #1C1A17; color: #FAFAFA; border-color: #1C1A17; }
      /* Card headers */
      .card-header { font-family: 'Playfair Display', serif; font-size: 10pt; font-weight: 400; margin-bottom: 3mm; padding-bottom: 2mm; border-bottom: 0.5pt solid #E5E0DB; }
      .card-dark .card-header { border-bottom-color: #333; color: #FAFAFA; }
      /* Steps */
      .step { display: flex; gap: 2.5mm; margin-bottom: 2.5mm; align-items: flex-start; }
      .step:last-child { margin-bottom: 0; }
      .step-num { width: 5mm; height: 5mm; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 6pt; font-weight: 600; flex-shrink: 0; margin-top: 0.5mm; }
      .step-num-am { background: #FDF0E6; color: #C4854A; border: 0.5pt solid #E8C9A8; }
      .step-num-pm { background: #E8F0F5; color: #4A7A96; border: 0.5pt solid #A8C4D8; }
      .step-name { font-weight: 500; font-size: 7.5pt; color: #1C1A17; line-height: 1.3; }
      .step-desc { font-size: 6.5pt; color: #6B6560; margin-top: 0.5mm; line-height: 1.4; font-weight: 300; }
      /* Day cards */
      .day-card { border: 0.5pt solid #E5E0DB; border-radius: 4pt; padding: 2.5mm; text-align: center; break-inside: avoid; background: #FAFAF8; }
      .day-name { font-size: 5.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1pt; color: #8C857B; border-bottom: 0.5pt solid #E5E0DB; padding-bottom: 1.5mm; margin-bottom: 1.5mm; }
      .day-focus { font-family: 'Playfair Display', serif; font-size: 7pt; color: #1C1A17; margin-bottom: 1mm; line-height: 1.2; }
      .day-detail { font-size: 5.5pt; color: #8C857B; line-height: 1.3; font-weight: 300; }
      /* Analysis */
      .analysis-label { font-size: 6pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5pt; color: #8C857B; margin-bottom: 1.5mm; }
      .analysis-text { font-size: 7pt; color: #3D3A36; line-height: 1.5; font-weight: 300; }
      /* Reminders */
      .reminder { display: flex; gap: 2mm; margin-bottom: 2mm; align-items: flex-start; }
      .reminder:last-child { margin-bottom: 0; }
      .reminder-dot { width: 3pt; height: 3pt; border-radius: 50%; background: #1C1A17; flex-shrink: 0; margin-top: 2mm; }
      .reminder-text { font-size: 7pt; color: #3D3A36; line-height: 1.5; font-weight: 300; }
      /* Footer */
      .footer { margin-top: 5mm; padding-top: 3mm; border-top: 0.5pt solid #E5E0DB; display: flex; justify-content: space-between; align-items: center; }
      .footer-brand { font-family: 'Playfair Display', serif; font-size: 8pt; color: #8C857B; font-style: italic; }
      .footer-tagline { font-size: 6pt; color: #B0AAA4; text-transform: uppercase; letter-spacing: 1.5pt; }
    </style></head><body>${printContent.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const handleAskAI = async () => {
    if (!aiQuestion.trim()) return;
    setIsAsking(true);
    try {
      const response = await askSkincareAI(aiQuestion, answers, routine);
      setAiAnswer(response || "I couldn't find an answer for that.");
    } catch (e) {
      setAiAnswer("I'm sorry, I'm having trouble connecting right now.");
    } finally {
      setIsAsking(false);
    }
  };

  const handleAnalyzeProduct = async () => {
    if (!analyzeInput.trim()) return;
    setIsAnalyzing(true);
    try {
      const response = await analyzeProductIngredients(analyzeInput, answers);
      setAnalyzeResult(response || "Analysis failed.");
    } catch (e) {
      setAnalyzeResult("I'm sorry, I'm having trouble analyzing this right now.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleListen = (targetSetter: (val: string) => void, targetName: string, currentText: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition.");
      return;
    }

    if (isListening && activeInput === targetName) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setActiveInput(null);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    const baseText = currentText ? currentText + ' ' : '';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      targetSetter(baseText + finalTranscript + interimTranscript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setActiveInput(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      setActiveInput(null);
    };

    recognition.start();
    setIsListening(true);
    setActiveInput(targetName);
    recognitionRef.current = recognition;
  };

  return (
    <ErrorBoundary>
      {isAuthLoading ? (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9] dark:bg-[#121212]">
          <Loader2 className="w-10 h-10 animate-spin text-[#1C1A17] dark:text-[#FAFAFA]" />
        </div>
      ) : (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121212] font-sans text-[#1C1A17] dark:text-[#FAFAFA] selection:bg-[#B6D3D9] selection:text-[#1C1A17] print:bg-white relative print:overflow-visible transition-colors duration-500">
        
        {/* Decorative Background */}
        <div className="fixed top-20 left-10 opacity-20 pointer-events-none hidden md:block">
          <Sparkles className="w-8 h-8 stroke-[1] dark:text-[#FAFAFA]" />
        </div>
        <div className="fixed bottom-40 right-10 opacity-20 pointer-events-none hidden md:block">
          <Star className="w-6 h-6 stroke-[1] dark:text-[#FAFAFA]" />
        </div>

        {/* Navigation */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/80 dark:bg-[#1E1E1E]/80 backdrop-blur-xl border border-[#E5E0DB] dark:border-[#333333] rounded-full px-4 py-2 flex items-center gap-2 shadow-lg print:hidden">
          <button 
            onClick={() => setView('generator')}
            className={`p-3 rounded-full transition-all ${view === 'generator' ? 'bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17]' : 'text-[#5C554F] dark:text-[#A3A3A3] hover:bg-[#F4F1ED] dark:hover:bg-[#2A2A2A]'}`}
          >
            <Plus className="w-5 h-5" />
          </button>
          {user && (
            <>
              <button 
                onClick={() => setView('dashboard')}
                className={`p-3 rounded-full transition-all ${view === 'dashboard' ? 'bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17]' : 'text-[#5C554F] dark:text-[#A3A3A3] hover:bg-[#F4F1ED] dark:hover:bg-[#2A2A2A]'}`}
              >
                <LayoutDashboard className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setView('shelf')}
                className={`p-3 rounded-full transition-all ${view === 'shelf' ? 'bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17]' : 'text-[#5C554F] dark:text-[#A3A3A3] hover:bg-[#F4F1ED] dark:hover:bg-[#2A2A2A]'}`}
              >
                <ShoppingBag className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setView('progress')}
                className={`p-3 rounded-full transition-all ${view === 'progress' ? 'bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17]' : 'text-[#5C554F] dark:text-[#A3A3A3] hover:bg-[#F4F1ED] dark:hover:bg-[#2A2A2A]'}`}
              >
                <History className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setView('tools')}
                className={`p-3 rounded-full transition-all ${view === 'tools' ? 'bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17]' : 'text-[#5C554F] dark:text-[#A3A3A3] hover:bg-[#F4F1ED] dark:hover:bg-[#2A2A2A]'}`}
              >
                <Wand2 className="w-5 h-5" />
              </button>
            </>
          )}
          <div className="w-px h-6 bg-[#E5E0DB] dark:bg-[#333333] mx-1" />
          {user ? (
            <button 
              onClick={handleLogout}
              className="p-3 rounded-full text-[#5C554F] dark:text-[#A3A3A3] hover:bg-[#F4F1ED] dark:hover:bg-[#2A2A2A] transition-all"
            >
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={handleLogin}
              className="p-3 rounded-full text-[#5C554F] dark:text-[#A3A3A3] hover:bg-[#F4F1ED] dark:hover:bg-[#2A2A2A] transition-all"
            >
              <UserIcon className="w-5 h-5" />
            </button>
          )}
        </nav>

        {/* Header Actions */}
        <div className="absolute top-4 right-4 md:top-8 md:right-8 z-50 print:hidden flex items-center gap-3">
          {!user && !isAuthLoading && (
            <button 
              onClick={handleLogin}
              className="px-5 py-2.5 rounded-full bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17] text-sm font-medium shadow-sm hover:opacity-90 transition-all active:scale-95"
            >
              Sign In
            </button>
          )}
          {user && (
            <button 
              onClick={() => setView('dashboard')}
              className="flex items-center gap-2 p-1 pr-4 rounded-full border border-[#E5E0DB] dark:border-[#333333] bg-white dark:bg-[#1E1E1E] hover:border-[#1C1A17] dark:hover:border-[#FAFAFA] transition-all group"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden border border-[#E5E0DB] dark:border-[#333333]">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#F4D5C9] flex items-center justify-center text-[#1C1A17] text-xs font-bold">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
              <span className="text-xs font-medium text-[#1C1A17] dark:text-[#FAFAFA]">{user.displayName?.split(' ')[0]}</span>
            </button>
          )}
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-3 rounded-full border border-[#E5E0DB] dark:border-[#333333] text-[#5C554F] dark:text-[#A3A3A3] hover:text-[#1C1A17] dark:hover:text-[#FAFAFA] hover:bg-white dark:hover:bg-[#1E1E1E] transition-all bg-[#FAFAFA] dark:bg-[#121212] shadow-sm"
          >
            {isDarkMode ? <Sun className="w-5 h-5 stroke-[1.5]" /> : <Moon className="w-5 h-5 stroke-[1.5]" />}
          </button>
        </div>

        {/* Header */}
        <header className="pt-16 pb-12 px-6 text-center max-w-2xl mx-auto print:hidden relative z-10">
          <div className="flex justify-center gap-4 sm:gap-8 mb-8">
            <LineArtIcon Icon={Droplets} bgColor="bg-[#B6D3D9]" />
            <LineArtIcon Icon={Flower2} bgColor="bg-[#F4D5C9]" />
            <LineArtIcon Icon={Sun} bgColor="bg-[#D4E0D9]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#1C1A17] dark:text-[#FAFAFA] mb-4 tracking-tight">Aura</h1>
          <p className="text-[#5C554F] dark:text-[#A3A3A3] text-lg font-light tracking-wide">Radiate your natural glow.</p>
        </header>

        <main className="max-w-4xl mx-auto px-6 pb-32 relative z-10 print-container">
          {view === 'landing' && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 py-12">
              <div className="text-center mb-16">
                <h2 className="text-5xl md:text-7xl font-serif text-[#1C1A17] dark:text-[#FAFAFA] mb-6 tracking-tighter leading-tight">
                  Your Skin's <br /> <span className="italic text-[#8C857B]">Digital Twin.</span>
                </h2>
                <p className="text-xl text-[#5C554F] dark:text-[#A3A3A3] font-light max-w-xl mx-auto leading-relaxed mb-10">
                  Aura uses advanced AI to decode your skin's unique needs and craft a routine that evolves with you.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button 
                    onClick={() => setView('generator')}
                    className="w-full sm:w-auto px-10 py-5 bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17] rounded-full font-medium text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Start Your Quiz
                  </button>
                  {!user && (
                    <button 
                      onClick={handleLogin}
                      className="w-full sm:w-auto px-10 py-5 bg-white dark:bg-[#1E1E1E] text-[#1C1A17] dark:text-[#FAFAFA] border border-[#E5E0DB] dark:border-[#333333] rounded-full font-medium text-lg hover:border-[#1C1A17] dark:hover:border-[#FAFAFA] transition-all"
                    >
                      Sign In to Save
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
                {[
                  { icon: Sparkles, title: "AI Analysis", desc: "Scan your skin or analyze ingredients with Gemini 1.5 Pro.", color: "bg-[#F4D5C9]" },
                  { icon: CalendarDays, title: "Smart Tracking", desc: "Log your morning and night routines to see real progress.", color: "bg-[#D4E0D9]" },
                  { icon: ShoppingBag, title: "Digital Shelf", desc: "Keep track of your products and their expiration dates.", color: "bg-[#B6D3D9]" }
                ].map((feature, i) => (
                  <div key={i} className="p-8 bg-white dark:bg-[#1E1E1E] rounded-[2rem] border border-[#E5E0DB] dark:border-[#333333] shadow-sm hover:shadow-md transition-all group">
                    <div className={`w-12 h-12 ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                      <feature.icon className="w-6 h-6 text-[#1C1A17]" />
                    </div>
                    <h3 className="text-xl font-serif mb-3">{feature.title}</h3>
                    <p className="text-sm text-[#5C554F] dark:text-[#A3A3A3] leading-relaxed font-light">{feature.desc}</p>
                  </div>
                ))}
              </div>

              <div className="bg-[#1C1A17] dark:bg-[#FAFAFA] rounded-[3rem] p-10 md:p-16 text-center text-white dark:text-[#1C1A17] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                  <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white dark:bg-black rounded-full blur-[100px]"></div>
                  <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white dark:bg-black rounded-full blur-[100px]"></div>
                </div>
                <h3 className="text-3xl md:text-4xl font-serif mb-6 relative z-10">Ready to glow?</h3>
                <p className="text-lg opacity-80 mb-10 max-w-lg mx-auto font-light relative z-10">Join thousands of others who have simplified their skincare with Aura.</p>
                <button 
                  onClick={() => setView('generator')}
                  className="bg-white text-[#1C1A17] dark:bg-[#1C1A17] dark:text-white px-12 py-5 rounded-full font-bold uppercase tracking-widest text-sm hover:scale-105 transition-all relative z-10"
                >
                  Get Started Now
                </button>
              </div>

              {/* Reviews Section */}
              <div className="py-20">
                <div className="flex items-center justify-between mb-12">
                  <h3 className="text-3xl font-serif">Community Love</h3>
                  {user && (
                    <button 
                      onClick={() => setIsReviewModalOpen(true)}
                      className="px-6 py-3 rounded-full bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17] text-sm font-medium hover:opacity-90 transition-all"
                    >
                      Write a Review
                    </button>
                  )}
                </div>
                
                {reviews.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {reviews.map((review) => (
                      <div key={review.id} className="p-8 bg-white dark:bg-[#1E1E1E] rounded-[2rem] border border-[#E5E0DB] dark:border-[#333333] shadow-sm">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#F4D5C9] flex-shrink-0">
                            {review.photoURL ? (
                              <img src={review.photoURL} alt={review.displayName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#1C1A17] font-serif">
                                {review.displayName?.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-[#1C1A17] dark:text-[#FAFAFA]">{review.displayName}</h4>
                            <div className="flex gap-0.5 mt-1">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-[#1C1A17] dark:fill-[#FAFAFA] text-[#1C1A17] dark:text-[#FAFAFA]' : 'text-[#E5E0DB] dark:text-[#333333]'}`} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <p className="text-[#5C554F] dark:text-[#A3A3A3] font-light leading-relaxed italic">"{review.comment}"</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-[#F5F2ED] dark:bg-[#1A1A1A] rounded-[2rem] border border-dashed border-[#E5E0DB] dark:border-[#333333]">
                    <p className="text-[#8C857B] font-light">No reviews yet. Be the first to share your glow!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'dashboard' && user && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-white dark:border-[#1E1E1E] shadow-xl">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || 'User'} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#F4D5C9] flex items-center justify-center text-[#1C1A17] text-3xl font-serif">
                        {user.displayName?.charAt(0) || 'U'}
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-4xl font-serif text-[#1C1A17] dark:text-[#FAFAFA] tracking-tight mb-1">
                      {user.displayName?.split(' ')[0]}'s Aura
                    </h2>
                    <p className="text-[#8C857B] text-sm font-light">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleLogout}
                    className="px-6 py-3 rounded-full border border-[#E5E0DB] dark:border-[#333333] text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>

              {notifications.length > 0 && (
                <div className="mb-8 space-y-3">
                  {notifications.map(n => (
                    <motion.div 
                      key={n.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 bg-[#F4D5C9]/20 border border-[#F4D5C9] rounded-2xl flex items-center gap-4"
                    >
                      <div className="p-2 bg-[#F4D5C9] rounded-full text-[#1C1A17]">
                        {n.icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">{n.title}</h4>
                        <p className="text-xs text-[#5C554F] dark:text-[#A3A3A3]">{n.message}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-3xl border border-[#E5E0DB] dark:border-[#333333] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-serif">Update Your Journey</h3>
                    <CalendarDays className="w-5 h-5 text-[#8C857B]" />
                  </div>
                  <p className="text-[10px] text-[#8C857B] mb-6 uppercase tracking-wider">Today's check-in updates your tracker</p>
                  
                  <div className="flex gap-4 mb-8">
                    {(() => {
                      const date = new Date();
                      const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      const todayEntry = progressEntries.find(e => e.date === today);
                      return (
                        <>
                          <button 
                            onClick={() => handleCheckIn(!todayEntry?.completedAM, !!todayEntry?.completedPM)}
                            className={`flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${todayEntry?.completedAM ? 'bg-[#D4E0D9] border-[#D4E0D9] text-[#1C1A17]' : 'border-[#E5E0DB] dark:border-[#333333] text-[#5C554F] dark:text-[#A3A3A3] hover:border-[#1C1A17] dark:hover:border-[#FAFAFA]'}`}
                          >
                            <Sun className="w-6 h-6" />
                            <span className="text-xs font-medium uppercase tracking-wider">Morning</span>
                          </button>
                          <button 
                            onClick={() => handleCheckIn(!!todayEntry?.completedAM, !todayEntry?.completedPM)}
                            className={`flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${todayEntry?.completedPM ? 'bg-[#B6D3D9] border-[#B6D3D9] text-[#1C1A17]' : 'border-[#E5E0DB] dark:border-[#333333] text-[#5C554F] dark:text-[#A3A3A3] hover:border-[#1C1A17] dark:hover:border-[#FAFAFA]'}`}
                          >
                            <Moon className="w-6 h-6" />
                            <span className="text-xs font-medium uppercase tracking-wider">Night</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>

                  <div className="pt-6 border-t border-[#E5E0DB] dark:border-[#333333]">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-medium">Weekly Progress</span>
                      <button 
                        onClick={() => setView('progress')}
                        className="text-[10px] text-[#1C1A17] dark:text-[#FAFAFA] font-bold uppercase tracking-widest hover:underline"
                      >
                        View Full Journey
                      </button>
                    </div>
                    <div className="flex justify-between gap-1">
                      {Array.from({ length: 7 }).map((_, i) => {
                        const date = new Date();
                        date.setDate(date.getDate() - (6 - i));
                        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        const entry = progressEntries.find(e => e.date === dateStr);
                        return (
                          <div key={i} className="flex-1 aspect-square rounded-md bg-[#F4F1ED] dark:bg-[#2A2A2A] relative overflow-hidden">
                            <div className="absolute inset-0 flex flex-col">
                              <div className={`flex-1 ${entry?.completedAM ? 'bg-[#D4E0D9]' : ''}`}></div>
                              <div className={`flex-1 ${entry?.completedPM ? 'bg-[#B6D3D9]' : ''}`}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-3xl border border-[#E5E0DB] dark:border-[#333333] shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-serif">Quick Stats</h3>
                    <Star className="w-5 h-5 text-[#8C857B]" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-[#F4F1ED] dark:bg-[#2A2A2A]">
                      <span className="block text-2xl font-serif mb-1">{savedRoutines.length}</span>
                      <span className="text-[10px] uppercase tracking-widest text-[#8C857B]">Routines</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-[#F4F1ED] dark:bg-[#2A2A2A]">
                      <span className="block text-2xl font-serif mb-1">{inventory.length}</span>
                      <span className="text-[10px] uppercase tracking-widest text-[#8C857B]">Products</span>
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-serif mb-6">Saved Routines</h3>
              <div className="space-y-4">
                {savedRoutines.map(r => (
                  <div key={r.id} className="bg-white dark:bg-[#1E1E1E] p-6 rounded-2xl border border-[#E5E0DB] dark:border-[#333333] flex items-center justify-between group">
                    <div>
                      <h4 className="font-medium mb-1">Routine from {new Date(r.createdAt).toLocaleDateString()}</h4>
                      <p className="text-xs text-[#8C857B]">{r.am.length + r.pm.length} steps total</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => { setRoutine(r); setView('generator'); setStep(6); }}
                        className="p-2 rounded-full hover:bg-[#F4F1ED] dark:hover:bg-[#2A2A2A] transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => deleteRoutine(r.id)}
                        className="p-2 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {savedRoutines.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-[#E5E0DB] dark:border-[#333333] rounded-3xl">
                    <p className="text-[#8C857B]">No routines saved yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'shelf' && user && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-4xl font-serif text-[#1C1A17] dark:text-[#FAFAFA] tracking-tight">My Shelf</h2>
                <button 
                  onClick={() => setIsProductModalOpen(true)}
                  className="bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17] px-6 py-3 rounded-full text-sm font-medium flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </div>

              <div className="mb-10 flex items-start gap-4 p-6 bg-[#F4F1ED] dark:bg-[#2A2A2A] rounded-3xl border border-[#E5E0DB] dark:border-[#333333]">
                <div className="p-2 bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm">
                  <Info className="w-5 h-5 text-[#1C1A17] dark:text-[#FAFAFA]" />
                </div>
                <div>
                  <h3 className="font-medium text-[#1C1A17] dark:text-[#FAFAFA] mb-1">How it works</h3>
                  <p className="text-[#5C554F] dark:text-[#A3A3A3] text-sm leading-relaxed">
                    Your digital skincare cabinet. Add products here to keep track of your inventory. 
                    Aura uses this information to suggest how to integrate your existing products into your personalized routines.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {inventory.map(item => (
                  <div key={item.id} className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl border border-[#E5E0DB] dark:border-[#333333] relative group">
                    <button 
                      onClick={() => removeFromShelf(item.id)}
                      className="absolute top-4 right-4 p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="w-12 h-12 bg-[#F4F1ED] dark:bg-[#2A2A2A] rounded-2xl flex items-center justify-center mb-4">
                      <ShoppingBag className="w-6 h-6 text-[#8C857B]" />
                    </div>
                    <h4 className="font-medium text-lg">{item.name}</h4>
                    <p className="text-sm text-[#8C857B] mb-2">{item.brand || 'Unknown Brand'}</p>
                    <span className="text-[10px] uppercase tracking-widest bg-[#D4E0D9] px-2 py-1 rounded-md text-[#1C1A17]">{item.category || 'Skincare'}</span>
                  </div>
                ))}
                {inventory.length === 0 && (
                  <div className="col-span-full text-center py-20 border-2 border-dashed border-[#E5E0DB] dark:border-[#333333] rounded-3xl">
                    <ShoppingBag className="w-12 h-12 text-[#E5E0DB] mx-auto mb-4" />
                    <p className="text-[#8C857B]">Your shelf is empty.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'progress' && user && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-4xl font-serif text-[#1C1A17] dark:text-[#FAFAFA] tracking-tight">Skin Journey</h2>
                <div className="flex items-center gap-2 text-xs text-[#8C857B]">
                  <CheckCircle2 className="w-4 h-4 text-[#D4E0D9]" />
                  <span>Updates from Dashboard</span>
                </div>
              </div>

              <div className="mb-10 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 flex items-start gap-4 p-6 bg-[#F4F1ED] dark:bg-[#2A2A2A] rounded-3xl border border-[#E5E0DB] dark:border-[#333333]">
                  <div className="p-2 bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm">
                    <History className="w-5 h-5 text-[#1C1A17] dark:text-[#FAFAFA]" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[#1C1A17] dark:text-[#FAFAFA] mb-1">The 28-Day Cycle</h3>
                    <p className="text-[#5C554F] dark:text-[#A3A3A3] text-sm leading-relaxed">
                      Skincare is a marathon, not a sprint. It takes an average of <strong>28 days</strong> for your skin cells to regenerate. 
                      By tracking your consistency here, you're ensuring your skin gets the full benefit of your routine through an entire renewal cycle.
                    </p>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl border border-[#E5E0DB] dark:border-[#333333] flex flex-col justify-center">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#8C857B] mb-4 text-center">Today's Status</h4>
                  {(() => {
                    const date = new Date();
                    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    const todayEntry = progressEntries.find(e => e.date === today);
                    return (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleCheckIn(!todayEntry?.completedAM, !!todayEntry?.completedPM)}
                          className={`flex-1 p-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${todayEntry?.completedAM ? 'bg-[#D4E0D9] border-[#D4E0D9]' : 'border-[#E5E0DB] dark:border-[#333333]'}`}
                        >
                          <Sun className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase">AM</span>
                        </button>
                        <button 
                          onClick={() => handleCheckIn(!!todayEntry?.completedAM, !todayEntry?.completedPM)}
                          className={`flex-1 p-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${todayEntry?.completedPM ? 'bg-[#B6D3D9] border-[#B6D3D9]' : 'border-[#E5E0DB] dark:border-[#333333]'}`}
                        >
                          <Moon className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase">PM</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
              
              <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-3xl border border-[#E5E0DB] dark:border-[#333333] mb-12">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-serif">Consistency Tracker</h3>
                    <p className="text-xs text-[#8C857B]">Powered by your daily check-ins</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1 text-xs text-[#8C857B]">
                      <div className="w-3 h-3 bg-[#D4E0D9] rounded-sm"></div> AM
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#8C857B]">
                      <div className="w-3 h-3 bg-[#B6D3D9] rounded-sm"></div> PM
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 28 }).map((_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (27 - i));
                    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    const entry = progressEntries.find(e => e.date === dateStr);
                    
                    return (
                      <div key={i} className="aspect-square rounded-lg bg-[#F4F1ED] dark:bg-[#2A2A2A] relative overflow-hidden group">
                        <div className="absolute inset-0 flex flex-col">
                          <div className={`flex-1 transition-all ${entry?.completedAM ? 'bg-[#D4E0D9]' : ''}`}></div>
                          <div className={`flex-1 transition-all ${entry?.completedPM ? 'bg-[#B6D3D9]' : ''}`}></div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-all">
                          <span className="text-[8px] text-white font-bold">{date.getDate()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between text-[10px] text-[#8C857B] dark:text-[#666666]">
                  <span>Last 28 days</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#D4E0D9]"></div>
                    <span>AM</span>
                    <div className="w-2 h-2 rounded-full bg-[#B6D3D9]"></div>
                    <span>PM</span>
                    <span className="ml-2 opacity-50">({progressEntries.length} entries synced)</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-3xl border border-[#E5E0DB] dark:border-[#333333] text-center">
                  <History className="w-12 h-12 text-[#E5E0DB] mx-auto mb-4" />
                  <h4 className="font-serif text-xl mb-2">Skin Diary</h4>
                  <p className="text-sm text-[#8C857B] mb-6">Log how your skin feels each day.</p>
                  <button 
                    onClick={() => setIsDiaryModalOpen(true)}
                    className="w-full py-4 rounded-full bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17] font-medium"
                  >
                    Add Entry
                  </button>
                </div>
              </div>

              {diaryEntries.length > 0 && (
                <div className="mt-12">
                  <h3 className="text-2xl font-serif mb-6">Recent Entries</h3>
                  <div className="space-y-4">
                    {diaryEntries.map(entry => (
                      <div key={entry.id} className="bg-white dark:bg-[#1E1E1E] p-6 rounded-2xl border border-[#E5E0DB] dark:border-[#333333]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-[#8C857B]">{new Date(entry.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-[#5C554F] dark:text-[#A3A3A3] italic">"{entry.entry}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'tools' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-12">
                <h2 className="text-4xl font-serif text-[#1C1A17] dark:text-[#FAFAFA] mb-3 tracking-tight">Skincare Tools</h2>
                <p className="text-[#8C857B] text-sm font-light">Explore ingredients and get expert advice with Aura AI.</p>
              </div>
              <SkincareTools 
                analyzeInput={analyzeInput}
                setAnalyzeInput={setAnalyzeInput}
                handleAnalyzeProduct={handleAnalyzeProduct}
                isAnalyzing={isAnalyzing}
                analyzeResult={analyzeResult}
                aiQuestion={aiQuestion}
                setAiQuestion={setAiQuestion}
                handleAskAI={handleAskAI}
                isAsking={isAsking}
                aiAnswer={aiAnswer}
                toggleListen={toggleListen}
                isListening={isListening}
                activeInput={activeInput}
              />
            </div>
          )}

          {view === 'generator' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 print-container">
              {step < 6 && (
                <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.03)] dark:shadow-none p-6 md:p-12 mb-8 border border-[#E5E0DB] dark:border-[#333333] transition-colors duration-500">
                  <div className="flex items-center justify-between mb-12">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div key={s} className="flex items-center w-full last:w-auto">
                        <StepIcon stepNumber={step > s ? <CheckCircle2 className="w-5 h-5 stroke-[1.5]" /> : s} active={step === s} />
                        {s !== 5 && (
                          <div className={`flex-1 h-px mx-4 transition-colors duration-500 ${step > s ? 'bg-[#1C1A17] dark:bg-[#FAFAFA]' : 'bg-[#E5E0DB] dark:bg-[#333333]'}`} />
                        )}
                      </div>
                    ))}
                  </div>

              {/* Steps Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {step === 1 && (
                    <div className="space-y-10">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <h2 className="text-3xl font-serif text-[#1C1A17] dark:text-[#FAFAFA]">Let's get to know your skin</h2>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[#5C554F] dark:text-[#A3A3A3] mb-4 uppercase tracking-wider">What is your skin type?</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {SKIN_TYPES.map(type => (
                            <OptionCard key={type} label={type} selected={answers.skinType === type} onClick={() => handleSelect('skinType', type)} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#5C554F] dark:text-[#A3A3A3] mb-4 uppercase tracking-wider">Do you have known skin sensitivities?</label>
                        <div className="flex flex-wrap gap-4">
                          {SENSITIVITY_OPTS.map(opt => (
                            <Pill key={opt} label={opt} selected={answers.sensitivities === opt} onClick={() => handleSelect('sensitivities', opt)} />
                          ))}
                        </div>
                      </div>
                      {(answers.skinType === 'Sensitive' || answers.sensitivities === 'Yes' || answers.sensitivities === 'Sometimes') && (
                        <div>
                          <label className="block text-sm font-medium text-[#5C554F] dark:text-[#A3A3A3] mb-4 uppercase tracking-wider">What specific ingredients or products are you sensitive to?</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={answers.sensitiveTo}
                              onChange={(e) => handleSelect('sensitiveTo', e.target.value)}
                              placeholder="e.g., Fragrance, essential oils, niacinamide..."
                              className="w-full px-5 py-4 pr-14 rounded-2xl border border-[#E5E0DB] dark:border-[#333333] focus:outline-none focus:border-[#1C1A17] dark:focus:border-[#FAFAFA] transition-all bg-transparent text-[#1C1A17] dark:text-[#FAFAFA]"
                            />
                            <button
                              onClick={() => toggleListen((text) => handleSelect('sensitiveTo', text), 'sensitiveTo', answers.sensitiveTo)}
                              className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${isListening && activeInput === 'sensitiveTo' ? 'bg-[#F4D5C9] text-[#1C1A17] animate-pulse' : 'text-[#8C857B] hover:text-[#1C1A17]'}`}
                            >
                              <Mic className="w-5 h-5 stroke-[1.5]" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-[#5C554F] dark:text-[#A3A3A3] mb-4 uppercase tracking-wider">Are you currently seeing a dermatologist?</label>
                        <div className="flex flex-wrap gap-4">
                          {DERM_OPTS.map(opt => (
                            <Pill key={opt} label={opt} selected={answers.dermatologist === opt} onClick={() => handleSelect('dermatologist', opt)} />
                          ))}
                        </div>
                        {answers.dermatologist === 'Yes' && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-6 p-5 rounded-2xl border border-[#F4D5C9] bg-[#F4D5C9]/10 flex items-start gap-3"
                          >
                            <AlertCircle className="w-5 h-5 text-[#1C1A17] dark:text-[#FAFAFA] shrink-0 mt-0.5" />
                            <p className="text-sm text-[#5C554F] dark:text-[#A3A3A3] leading-relaxed">
                              Since you're seeing a dermatologist, please consult with them before introducing new active ingredients to your routine.
                            </p>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <h2 className="text-3xl font-serif text-[#1C1A17] dark:text-[#FAFAFA] mb-2">What are your primary skin goals?</h2>
                      <p className="text-[#5C554F] dark:text-[#A3A3A3] font-light mb-8">Select all that apply.</p>
                      <div className="flex flex-wrap gap-4">
                        {GOALS.map(goal => (
                          <Pill key={goal} label={goal} selected={answers.goals.includes(goal)} onClick={() => handleMultiSelect('goals', goal)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-10">
                      <h2 className="text-3xl font-serif text-[#1C1A17] dark:text-[#FAFAFA] mb-2">What's in your current lineup?</h2>
                      <div className="flex flex-wrap gap-3">
                        {PRODUCT_CATEGORIES.map(prod => (
                          <Pill key={prod} label={prod} selected={answers.currentProducts.includes(prod)} onClick={() => handleMultiSelect('currentProducts', prod)} />
                        ))}
                      </div>
                      <div className="p-6 rounded-2xl border border-[#E5E0DB] dark:border-[#333333]">
                        <label className="flex items-center text-sm font-medium text-[#1C1A17] dark:text-[#FAFAFA] mb-4 uppercase tracking-wider">
                          <AlertCircle className="w-5 h-5 mr-2 stroke-[1.5]" />
                          Past negative reactions?
                        </label>
                        <div className="flex flex-wrap gap-3">
                          {REACTIONS.map(reaction => (
                            <button
                              key={reaction}
                              onClick={() => handleMultiSelect('reactions', reaction)}
                              className={`px-5 py-2 rounded-full text-sm font-medium transition-all border ${answers.reactions.includes(reaction) ? 'bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17]' : 'bg-transparent text-[#5C554F] border-[#E5E0DB]'}`}
                            >
                              {reaction}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <div className="space-y-10">
                      <h2 className="text-3xl font-serif text-[#1C1A17] dark:text-[#FAFAFA] mb-8">How do you prefer your routine?</h2>
                      <div>
                        <label className="block text-sm font-medium text-[#5C554F] dark:text-[#A3A3A3] mb-4 uppercase tracking-wider">Budget range?</label>
                        <div className="flex flex-wrap gap-4">
                          {BUDGET_OPTS.map(opt => (
                            <Pill key={opt} label={opt} selected={answers.budget === opt} onClick={() => handleSelect('budget', opt)} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#5C554F] dark:text-[#A3A3A3] mb-4 uppercase tracking-wider">Commitment level?</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {COMMITMENT_OPTS.map(opt => (
                            <OptionCard key={opt} label={opt} selected={answers.commitment === opt} onClick={() => handleSelect('commitment', opt)} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#5C554F] dark:text-[#A3A3A3] mb-4 uppercase tracking-wider">Basic or Advanced?</label>
                        <div className="flex flex-wrap gap-4">
                          {ROUTINE_OPTS.map(opt => (
                            <Pill key={opt} label={opt} selected={answers.advanced === opt} onClick={() => handleSelect('advanced', opt)} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 5 && (
                    <div className="space-y-10">
                      <h2 className="text-3xl font-serif text-[#1C1A17] dark:text-[#FAFAFA] mb-8">Final details</h2>
                      <div>
                        <label className="block text-sm font-medium text-[#5C554F] dark:text-[#A3A3A3] mb-4 uppercase tracking-wider">Fragrance-free?</label>
                        <div className="flex flex-wrap gap-4">
                          {FRAGRANCE_OPTS.map(opt => (
                            <Pill key={opt} label={opt} selected={answers.fragranceFree === opt} onClick={() => handleSelect('fragranceFree', opt)} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#5C554F] dark:text-[#A3A3A3] mb-4 uppercase tracking-wider">Gentle or Active?</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <OptionCard label="Gentle & Soothing" icon={Flower2} selected={answers.gentleOrActive === 'Gentle'} onClick={() => handleSelect('gentleOrActive', 'Gentle')} />
                          <OptionCard label="Active & Results-driven" icon={Sparkles} selected={answers.gentleOrActive === 'Active'} onClick={() => handleSelect('gentleOrActive', 'Active')} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#5C554F] dark:text-[#A3A3A3] mb-4 uppercase tracking-wider">Daily time commitment?</label>
                        <div className="flex flex-wrap gap-4">
                          {TIME_OPTS.map(opt => (
                            <Pill key={opt} label={opt} selected={answers.routineTime === opt} onClick={() => handleSelect('routineTime', opt)} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="mt-14 flex items-center justify-between border-t border-[#E5E0DB] dark:border-[#333333] pt-8">
                <button 
                  onClick={prevStep}
                  className={`flex items-center text-[#8C857B] hover:text-[#1C1A17] transition-colors ${step === 1 ? 'invisible' : ''}`}
                >
                  <ChevronLeft className="w-5 h-5 mr-1 stroke-[1.5]" />
                  Back
                </button>
                <button 
                  onClick={nextStep}
                  className="group relative flex items-center px-8 py-4 rounded-full font-medium transition-all active:scale-95 border border-[#1C1A17] text-[#1C1A17] hover:bg-[#1C1A17] hover:text-white dark:border-[#FAFAFA] dark:text-[#FAFAFA] dark:hover:bg-[#FAFAFA] dark:hover:text-[#1C1A17]"
                >
                  <span className="flex items-center">
                    {step === 5 ? '✨ Generate Routine' : 'Continue'}
                    {step !== 5 && <ChevronRight className="w-5 h-5 ml-1 stroke-[1.5]" />}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Results Step */}
          {step === 6 && (
            <div className="animate-in fade-in zoom-in-95 duration-700 print-container">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-[#1E1E1E] rounded-3xl border border-[#E5E0DB] dark:border-[#333333] shadow-sm relative overflow-hidden">
                  <ThinkingAnimation />
                  <h2 className="text-3xl font-serif text-[#1C1A17] dark:text-[#FAFAFA] mb-3 tracking-tight">
                    {loadingSteps[loadingStepIndex]}
                  </h2>
                </div>
              ) : routine && (
                <>
                  <div className="text-center mb-8 print:hidden">
                    <h2 className="text-4xl font-serif text-[#1C1A17] dark:text-[#FAFAFA] mb-8 tracking-tight">Your Personalized Routine</h2>
                    
                    <div className="flex justify-center gap-2 mb-12">
                      <button 
                        onClick={() => setActiveTab('routine')}
                        className={`px-8 py-3 rounded-full text-sm font-medium transition-all ${activeTab === 'routine' ? 'bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17]' : 'bg-[#F4F1ED] dark:bg-[#2A2A2A] text-[#8C857B] hover:text-[#1C1A17] dark:hover:text-[#FAFAFA]'}`}
                      >
                        Routine Plan
                      </button>
                      <button 
                        onClick={() => setActiveTab('tools')}
                        className={`px-8 py-3 rounded-full text-sm font-medium transition-all ${activeTab === 'tools' ? 'bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17]' : 'bg-[#F4F1ED] dark:bg-[#2A2A2A] text-[#8C857B] hover:text-[#1C1A17] dark:hover:text-[#FAFAFA]'}`}
                      >
                        Skincare Tools
                      </button>
                    </div>

                    {activeTab === 'routine' && (
                      <div className="flex flex-wrap justify-center gap-4 mt-6">
                        <button onClick={handlePrint} className="flex items-center bg-transparent border border-[#E5E0DB] dark:border-[#333333] px-6 py-3 rounded-full text-sm font-medium hover:border-[#1C1A17] dark:hover:border-[#FAFAFA] transition-all">
                          <Printer className="w-4 h-4 mr-2 stroke-[1.5]" />
                          Print / PDF
                        </button>
                        {user && (
                          <button 
                            onClick={() => saveCurrentRoutine(routine)} 
                            className="flex items-center bg-[#1C1A17] text-white dark:bg-[#FAFAFA] dark:text-[#1C1A17] px-6 py-3 rounded-full text-sm font-medium hover:opacity-90 transition-all shadow-lg"
                          >
                            <Star className="w-4 h-4 mr-2 stroke-[1.5] fill-current" />
                            Save to Aura
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {activeTab === 'routine' ? (
                    <>
                      {/* SCREEN VIEW: Normal Layout */}
                      <div className="screen-only bg-inherit max-w-[800px] mx-auto p-8 sm:p-12">
                        {/* Analysis Section */}
                        {routine.analysis && (
                          <div className="bg-[#F4F1ED] dark:bg-[#2A2A2A] rounded-3xl p-8 mb-8 border border-[#E5E0DB] dark:border-[#333333]">
                            <div className="flex items-center mb-6">
                              <Sparkles className="w-6 h-6 text-[#1C1A17] dark:text-[#FAFAFA] mr-3 stroke-[1.5]" />
                              <h3 className="text-2xl font-serif">Expert Analysis</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                              <div className="space-y-0">
                                <h4 className="text-sm font-bold uppercase tracking-widest text-[#8C857B]">Working Well</h4>
                                <p className="text-sm font-light leading-relaxed">{routine.analysis.workingWell}</p>
                              </div>
                              <div className="space-y-0">
                                <h4 className="text-sm font-bold uppercase tracking-widest text-[#8C857B]">Needs Attention</h4>
                                <p className="text-sm font-light leading-relaxed">{routine.analysis.issuesToWatch}</p>
                              </div>
                              <div className="space-y-0">
                                <h4 className="text-sm font-bold uppercase tracking-widest text-[#8C857B]">Missing Pieces</h4>
                                <p className="text-sm font-light leading-relaxed">{routine.analysis.missingElements}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* AM Routine */}
                        <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm overflow-hidden mb-8 border border-[#E5E0DB] dark:border-[#333333]">
                          <div className="px-8 py-6 flex items-center border-b border-[#E5E0DB] dark:border-[#333333]">
                            <Sun className="w-6 h-6 text-[#1C1A17] dark:text-[#FAFAFA] mr-3 stroke-[1.5]" />
                            <h3 className="text-2xl font-serif">Morning Routine</h3>
                          </div>
                          <div className="p-8 space-y-10">
                            {routine.am.map((item: any, idx: number) => (
                              <div key={idx} className="flex">
                                <div className="flex flex-col items-center mr-6">
                                  <div className="relative w-10 h-10 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-[#F4D5C9] rounded-full opacity-50"></div>
                                    <span className="relative z-10 font-medium">{item.step}</span>
                                  </div>
                                  {idx !== routine.am.length - 1 && <div className="w-px h-full bg-[#E5E0DB] mt-3"></div>}
                                </div>
                                <div>
                                  <h4 className="text-lg font-medium mb-1">{item.name}</h4>
                                  <p className="text-[#5C554F] dark:text-[#A3A3A3] text-sm font-light leading-relaxed">{item.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* PM Routine */}
                        <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm overflow-hidden mb-8 border border-[#E5E0DB] dark:border-[#333333]">
                          <div className="px-8 py-6 flex items-center border-b border-[#E5E0DB] dark:border-[#333333]">
                            <Moon className="w-6 h-6 text-[#1C1A17] dark:text-[#FAFAFA] mr-3 stroke-[1.5]" />
                            <h3 className="text-2xl font-serif">Nighttime Routine</h3>
                          </div>
                          <div className="p-8 space-y-10">
                            {routine.pm.map((item: any, idx: number) => (
                              <div key={idx} className="flex">
                                <div className="flex flex-col items-center mr-6">
                                  <div className="relative w-10 h-10 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-[#B6D3D9] rounded-full opacity-50"></div>
                                    <span className="relative z-10 font-medium">{item.step}</span>
                                  </div>
                                  {idx !== routine.pm.length - 1 && <div className="w-px h-full bg-[#E5E0DB] mt-3"></div>}
                                </div>
                                <div>
                                  <h4 className="text-lg font-medium mb-1">{item.name}</h4>
                                  <p className="text-[#5C554F] dark:text-[#A3A3A3] text-sm font-light leading-relaxed">{item.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Weekly Breakdown */}
                        {routine.weeklySchedule?.length > 0 && (
                          <div className="bg-transparent rounded-3xl p-8 mb-8 border border-[#E5E0DB] dark:border-[#333333] overflow-hidden">
                            <div className="flex items-center mb-8">
                              <CalendarDays className="w-6 h-6 text-[#1C1A17] dark:text-[#FAFAFA] mr-3 stroke-[1.5]" />
                              <h3 className="text-2xl font-serif">7-Day PM Schedule</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              {routine.weeklySchedule.map((schedule: any, idx: number) => (
                                <div key={idx} className="bg-white dark:bg-[#1E1E1E] rounded-2xl p-6 border border-[#E5E0DB] dark:border-[#333333] flex flex-col h-full">
                                  <span className="text-[10px] font-bold uppercase tracking-widest bg-[#F4F1ED] dark:bg-[#2A2A2A] px-3 py-1 rounded-full w-fit mb-4">{schedule.day}</span>
                                  <h4 className="font-medium mb-2 text-base">{schedule.focus}</h4>
                                  <p className="text-[#5C554F] dark:text-[#A3A3A3] text-sm font-light leading-relaxed flex-grow">{schedule.details}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Reminders */}
                        <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-8 mb-8 border border-[#1C1A17] dark:border-[#FAFAFA] overflow-hidden">
                          <div className="flex items-center mb-6">
                            <Heart className="w-6 h-6 text-[#1C1A17] dark:text-[#FAFAFA] mr-3 stroke-[1.5]" />
                            <h3 className="text-2xl font-serif">Gentle Reminders</h3>
                          </div>
                          <div>
                            <ul className="space-y-4">
                              {routine.notes.map((note: string, idx: number) => (
                                <li key={idx} className="flex items-start">
                                  <div className="mt-1.5 mr-3 w-1.5 h-1.5 rounded-full bg-[#1C1A17] dark:bg-[#FAFAFA] flex-shrink-0"></div>
                                  <span className="text-[#5C554F] dark:text-[#A3A3A3] text-sm font-light">{note}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* PRINT VIEW: Ultra Compact Layout */}
                      <div id="routine-print-area" style={{ display: 'none' }}>
                        <div className="header">
                          <div className="header-brand">
                            <div className="header-title">Aura</div>
                            <div className="header-sub">Personalized Skincare Plan</div>
                          </div>
                          <div className="header-meta">
                            <div>Prepared for <strong>{user?.displayName || 'You'}</strong></div>
                            <div>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                          </div>
                        </div>

                        <div className="grid-2">
                          <div className="card card-accent-am">
                            <div className="card-header">Morning Routine</div>
                            {routine?.am?.map((item: any, idx: number) => (
                              <div key={idx} className="step">
                                <div className="step-num step-num-am">{item.step}</div>
                                <div>
                                  <div className="step-name">{item.name}</div>
                                  <div className="step-desc">{item.desc}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="card card-accent-pm">
                            <div className="card-header">Nighttime Routine</div>
                            {routine?.pm?.map((item: any, idx: number) => (
                              <div key={idx} className="step">
                                <div className="step-num step-num-pm">{item.step}</div>
                                <div>
                                  <div className="step-name">{item.name}</div>
                                  <div className="step-desc">{item.desc}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {routine?.weeklySchedule?.length > 0 && (
                          <div className="section-label">7-Day PM Schedule</div>
                        )}
                        {routine?.weeklySchedule?.length > 0 && (
                          <div className="grid-7">
                            {routine.weeklySchedule.map((s: any, idx: number) => (
                              <div key={idx} className="day-card">
                                <div className="day-name">{s.day}</div>
                                <div className="day-focus">{s.focus}</div>
                                <div className="day-detail">{s.details}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="grid-2">
                          {routine?.analysis && (
                            <div className="card">
                              <div className="card-header">Expert Analysis</div>
                              <div className="grid-3">
                                <div><div className="analysis-label">Working Well</div><div className="analysis-text">{routine.analysis.workingWell}</div></div>
                                <div><div className="analysis-label">Needs Attention</div><div className="analysis-text">{routine.analysis.issuesToWatch}</div></div>
                                <div><div className="analysis-label">Missing Pieces</div><div className="analysis-text">{routine.analysis.missingElements}</div></div>
                              </div>
                            </div>
                          )}
                          <div className="card card-dark">
                            <div className="card-header">Gentle Reminders</div>
                            {routine?.notes?.map((note: string, idx: number) => (
                              <div key={idx} className="reminder">
                                <div className="reminder-dot" style={{ background: '#FAFAFA' }}></div>
                                <div className="reminder-text" style={{ color: '#C8C4BE' }}>{note}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="footer">
                          <div className="footer-brand">Aura Skincare</div>
                          <div className="footer-tagline">Radiate your natural glow</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <SkincareTools 
                      analyzeInput={analyzeInput}
                      setAnalyzeInput={setAnalyzeInput}
                      handleAnalyzeProduct={handleAnalyzeProduct}
                      isAnalyzing={isAnalyzing}
                      analyzeResult={analyzeResult}
                      aiQuestion={aiQuestion}
                      setAiQuestion={setAiQuestion}
                      handleAskAI={handleAskAI}
                      isAsking={isAsking}
                      aiAnswer={aiAnswer}
                      toggleListen={toggleListen}
                      isListening={isListening}
                      activeInput={activeInput}
                    />
                  )}

                  <div className="mt-12 text-center print:hidden">
                    <button onClick={resetQuiz} className="text-[#1C1A17] dark:text-[#FAFAFA] font-medium underline underline-offset-8">Start Over</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </main>
    <ProductModal 
      isOpen={isProductModalOpen} 
      onClose={() => setIsProductModalOpen(false)} 
      onAdd={addToShelf} 
      toggleListen={toggleListen}
      isListening={isListening}
      activeInput={activeInput}
    />
    <SkinDiaryModal
      isOpen={isDiaryModalOpen}
      onClose={() => setIsDiaryModalOpen(false)}
      onAdd={addToDiary}
      toggleListen={toggleListen}
      isListening={isListening}
      activeInput={activeInput}
    />
    <ReviewModal
      isOpen={isReviewModalOpen}
      onClose={() => setIsReviewModalOpen(false)}
      onAdd={addReview}
      isSubmitting={isSubmittingReview}
    />
    </div>
    )}
    </ErrorBoundary>
  );
}

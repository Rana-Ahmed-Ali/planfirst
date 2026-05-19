/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { generateResponse } from "./services/geminiService";
import { PlanForgeResponse, ChatMessage, ChatSession } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Send, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Target, 
  Activity, 
  ShieldAlert,
  Loader2,
  RefreshCw,
  Trophy,
  History,
  Undo2,
  Copy,
  Menu,
  Plus,
  MessageSquare,
  Trash2,
  Paperclip,
  FileText,
  X,
  Settings,
  Key,
  Download,
  Upload
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "./lib/utils";
import { getApiKeys, saveApiKeys, ApiKeys } from "./lib/keys";

const LOADING_MESSAGES = [
  "Analyzing strategic viability...",
  "Evaluating market constraints...",
  "Synthesizing operational risks...",
  "Cross-referencing industry models...",
  "Drafting next phase..."
];

function DynamicLoader() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setIdx(i => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-xl shadow-lg w-auto mr-auto mt-4 inline-flex">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-xs font-black uppercase tracking-widest">{LOADING_MESSAGES[idx]}</span>
    </motion.div>
  );
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const savedSessions = localStorage.getItem("planfirst_sessions");
      if (savedSessions) {
        return JSON.parse(savedSessions);
      }
      const saved = localStorage.getItem("planfirst_messages");
      if (saved) {
        const msgs = JSON.parse(saved);
        if (msgs.length > 0) {
          return [{ id: Date.now().toString(), title: "Imported Strategy", createdAt: Date.now(), messages: msgs }];
        }
      }
      return [];
    } catch {
      return [];
    }
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    () => sessions.length > 0 ? sessions[0].id : null
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  const setMessages = (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setSessions(prevSessions => {
      let activeId = currentSessionId;
      let newSessions = [...prevSessions];
      
      if (!activeId) {
        activeId = Date.now().toString();
        const initialMsgs = typeof updater === "function" ? updater([]) : updater;
        const newTitle = initialMsgs.length > 0 && typeof initialMsgs[0].content === "string" 
          ? initialMsgs[0].content.substring(0, 30) + "..." 
          : "New Strategy";
          
        newSessions.unshift({
          id: activeId,
          title: newTitle,
          createdAt: Date.now(),
          messages: initialMsgs
        });
        // We defer state setting internally and setCurrentSessionId is run outside
        setTimeout(() => setCurrentSessionId(activeId), 0);
        return newSessions;
      }

      return newSessions.map(session => {
        if (session.id === activeId) {
          const newMsgs = typeof updater === "function" ? updater(session.messages) : updater;
          let newTitle = session.title;
          if (session.messages.length === 0 && newMsgs.length > 0 && typeof newMsgs[0].content === "string") {
            newTitle = newMsgs[0].content.substring(0, 30) + "...";
          }
          return { ...session, messages: newMsgs, title: newTitle };
        }
        return session;
      });
    });
  };

  const handleNewSession = () => {
    const newId = Date.now().toString();
    setSessions(prev => [{ id: newId, title: "New Strategy", createdAt: Date.now(), messages: [] }, ...prev]);
    setCurrentSessionId(newId);
  };

  const deleteSession = (id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (currentSessionId === id && filtered.length > 0) {
        setCurrentSessionId(filtered[0].id);
      } else if (currentSessionId === id && filtered.length === 0) {
        setCurrentSessionId(null);
      }
      return filtered;
    });
  };

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [pakiHealth, setPakiHealth] = useState<{ status: string; message: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => getApiKeys());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRefBackup = useRef<HTMLInputElement>(null);

  const handleExportSessions = () => {
    try {
      const dataStr = JSON.stringify(sessions, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `planfirst_backup_${new Date().toISOString().slice(0,10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e) {
      alert("Failed to export backup: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleImportSessions = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    fileReader.onload = event => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!Array.isArray(parsed)) {
          throw new Error("Backup file must contain an array of sessions.");
        }
        
        const validated = parsed.filter(session => {
          return session && typeof session.id === "string" && typeof session.title === "string" && Array.isArray(session.messages);
        });
        
        if (validated.length === 0) {
          throw new Error("No valid sessions found in the backup file.");
        }

        setSessions(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const newSessions = [...prev];
          
          validated.forEach(session => {
            if (existingIds.has(session.id)) {
              session.id = session.id + "_" + Date.now();
            }
            newSessions.push(session);
          });
          
          return newSessions;
        });

        alert(`Successfully imported ${validated.length} sessions!`);
        if (validated.length > 0) {
          setCurrentSessionId(validated[0].id);
        }
      } catch (error) {
        alert("Failed to import backup: " + (error instanceof Error ? error.message : String(error)));
      }
    };
    fileReader.readAsText(files[0]);
    if (fileInputRefBackup.current) {
      fileInputRefBackup.current.value = "";
    }
  };

  const contextDocs = currentSession?.contextDocs || [];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const newDoc = { name: file.name, content };
          setSessions(prev => {
             let activeId = currentSessionId;
             if (!activeId) {
                activeId = Date.now().toString();
                setCurrentSessionId(activeId);
                return [{ 
                  id: activeId, 
                  title: "New Strategy", 
                  createdAt: Date.now(), 
                  messages: [],
                  contextDocs: [newDoc]
                }, ...prev];
             } else {
                return prev.map(s => s.id === activeId ? { ...s, contextDocs: [...(s.contextDocs || []), newDoc] } : s);
             }
          });
        }
      };
      reader.readAsText(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeDoc = (idx: number) => {
     if (!currentSessionId) return;
     setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, contextDocs: (s.contextDocs || []).filter((_, i) => i !== idx) } : s));
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleUndo = () => {
    if (messages.length === 0 || isLoading) return;
    
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    
    if (lastUserIdx !== -1) {
      const lastUserMsg = messages[lastUserIdx].content;
      if (typeof lastUserMsg === "string") {
        setInput(lastUserMsg);
      }
      setMessages(prev => prev.slice(0, lastUserIdx));
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    localStorage.setItem("planfirst_sessions", JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/health");
        if (!res.ok) throw new Error("HTTP error " + res.status);
        const data = await res.json();
        if (active) setPakiHealth(data);
      } catch (e) {
        if (active) {
          setPakiHealth({
            status: "offline",
            message: "Local server is offline or unreachable."
          });
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleSubmit = async (e?: React.FormEvent, manualInput?: string) => {
    e?.preventDefault();
    const messageText = manualInput || input;
    if (!messageText.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: messageText };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    const isOpenRouter = selectedModel.includes("/");
    const isCustomPaki = selectedModel === "paki-gpt";
    
    // Check if keys are provided
    if (!isCustomPaki) {
      const activeKey = isOpenRouter ? apiKeys.openrouter : apiKeys.gemini;
      
      if (!activeKey) {
        setError(`${isOpenRouter ? 'OpenRouter' : 'Gemini'} API key is missing. Click the settings icon to add your own API key.`);
        setIsSettingsOpen(true);
        setIsLoading(false);
        return;
      }
    }

    try {
      // Prepare history for Gemini
      const history = messages.concat(userMsg).map(m => ({
        role: m.role === "user" ? "user" as const : "model" as const,
        parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
      }));

      if (contextDocs.length > 0 && history.length > 0) {
         const contextStr = "\n\n--- PROVIDED CONTEXT DOCUMENTS ---\n" + contextDocs.map(d => `Document Name: ${d.name}\n${d.content}`).join("\n\n") + "\n--- END CONTEXT DOCUMENTS ---\nUse the above documents as context for your planning.";
         history[0].parts[0].text += contextStr;
      }

      const responses = await generateResponse(history, selectedModel, apiKeys);
      
      const newMessages: ChatMessage[] = responses.map(r => ({
        role: "assistant",
        content: r as PlanForgeResponse,
        isNew: true
      }));

      setMessages(prev => [...prev, ...newMessages]);
    } catch (err: any) {
      const msg = err?.message || "Failed to forge the plan. Please check your connection and try again.";
      if (msg.includes("API key")) {
        setError("Invalid or missing API key. Please check your settings.");
      } else {
        setError(msg);
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0A0C10] text-slate-200 font-sans selection:bg-emerald-500/30 overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 no-print">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full border-r border-slate-800/50 bg-[#0A0C10]/95 backdrop-blur-xl flex flex-col w-[280px] z-20 flex-shrink-0 relative no-print"
          >
            <div className="p-4 border-b border-slate-800/50 flex flex-col gap-4">
              <div className="flex justify-between items-center px-1 pt-1">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Your Sessions</span>
              </div>
              <button onClick={handleNewSession} className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all">
                <Plus className="w-4 h-4" /> New Strategy
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
              {sessions.map(s => (
                <div 
                  key={s.id} 
                  className={cn(
                    "group flex items-center gap-3 w-full p-3 rounded-xl cursor-pointer transition-all", 
                    s.id === currentSessionId ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  )} 
                  onClick={() => setCurrentSessionId(s.id)}
                >
                   <MessageSquare className="w-4 h-4 flex-shrink-0" />
                   <div className="flex-1 truncate text-sm font-medium">{s.title}</div>
                   <button 
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} 
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      title="Delete Session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                   </button>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="text-center py-6 text-slate-600 text-sm italic">
                  No sessions yet.
                </div>
              )}
            </div>
            
            {/* Backup & Restore Action Bar */}
            <div className="p-4 border-t border-slate-800/50 flex gap-2 no-print bg-slate-900/10">
              <button 
                onClick={handleExportSessions}
                className="flex-1 py-2 px-3 rounded-lg border border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white hover:border-slate-700 transition-all font-bold text-xs flex items-center justify-center gap-1.5"
                title="Export all strategies to a JSON backup file"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" /> Export
              </button>
              <button 
                onClick={() => fileInputRefBackup.current?.click()}
                className="flex-1 py-2 px-3 rounded-lg border border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white hover:border-slate-700 transition-all font-bold text-xs flex items-center justify-center gap-1.5"
                title="Import strategies from a JSON backup file"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" /> Import
              </button>
              <input 
                type="file" 
                ref={fileInputRefBackup}
                onChange={handleImportSessions}
                accept=".json"
                className="hidden"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-screen relative z-10 w-full bg-[#0A0C10]/80 backdrop-blur-xl">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50 bg-[#0A0C10]/50 sticky top-0 z-10 backdrop-blur-md no-print">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors border border-transparent hover:border-slate-700"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-emerald-500/10 hidden sm:block">
                <img src="/logo.png" alt="Planfirst Logo" className="w-full h-full object-cover scale-150" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white leading-tight">Planfirst by Ahmed Ali</h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Elite Strategy</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedModel === "paki-gpt" && pakiHealth && (
              <div 
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all no-print",
                  pakiHealth.status === "ready" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                  pakiHealth.status === "cloudflare" && "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse",
                  pakiHealth.status === "logged_out" && "bg-orange-500/10 border-orange-500/20 text-orange-400 animate-pulse",
                  pakiHealth.status === "offline" && "bg-red-500/10 border-red-500/20 text-red-400"
                )}
                title={pakiHealth.message}
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  pakiHealth.status === "ready" && "bg-emerald-400",
                  pakiHealth.status === "cloudflare" && "bg-amber-400",
                  pakiHealth.status === "logged_out" && "bg-orange-400",
                  pakiHealth.status === "offline" && "bg-red-400"
                )} />
                {pakiHealth.status === "ready" ? "READY" : pakiHealth.status.toUpperCase()}
              </div>
            )}
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
            >
              <optgroup label="Google Gemini">
                 <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                 <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
                 <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                 <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              </optgroup>
              <optgroup label="OpenRouter">
                 <option value="minimax/minimax-m2.5:free">Minimax M2.5 (Free)</option>
                 <option value="google/gemma-4-31b-it:free">Gemma 4-31B (Free)</option>
                 <option value="inclusionai/ling-2.6-1t:free">Ling 2.6-1T (Free)</option>
              </optgroup>
              <optgroup label="Custom API">
                 <option value="paki-gpt">Paki GPT (Free ChatGPT)</option>
              </optgroup>
            </select>

            {messages.length > 0 && (
               <div className="flex items-center gap-1">
                 <button 
                    onClick={handleUndo} 
                    disabled={isLoading}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Undo Last Step"
                  >
                    <Undo2 className="w-5 h-5" />
                 </button>
                 <button 
                    onClick={() => setMessages([])} 
                    disabled={isLoading}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Reset Plan"
                  >
                    <RefreshCw className="w-5 h-5" />
                 </button>
                 <button 
                    onClick={() => setIsSettingsOpen(true)} 
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-emerald-400"
                    title="API Settings"
                  >
                    <Settings className="w-5 h-5" />
                 </button>
               </div>
            )}
            {messages.length === 0 && (
              <button 
                onClick={() => setIsSettingsOpen(true)} 
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-emerald-400"
                title="API Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>

          
          {/* Progress Bar */}
          {messages.length > 0 && (
            <div className="absolute bottom-0 left-0 h-[2px] w-full bg-slate-900 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ 
                  width: (() => {
                    const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
                    
                    if (lastAssistantMsg) {
                      const content = lastAssistantMsg.content as any;
                      if (content.type === "plan") return "100%";
                      if (content.type === "question") {
                        return `${content.estimated_completion_percentage || 5}%`;
                      }
                    }
                    return messages.length > 0 ? "5%" : "0%";
                  })()
                }}
                className="h-full bg-gradient-to-r from-emerald-400 to-blue-400 shadow-[0_0_10px_rgba(52,211,153,0.3)]"
              />
            </div>
          )}
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto px-6 py-8 scrollbar-thin scrollbar-thumb-slate-800">
          <div className="max-w-4xl mx-auto w-full space-y-8 flex flex-col">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-6"
                >
                  <Target className="w-8 h-8 text-emerald-400" />
                </motion.div>
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-3xl font-bold text-white mb-4"
                >
                  What's your vision?
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-slate-400 text-lg mb-8 leading-relaxed"
                >
                  Share your raw idea — a business, a project, or a personal goal. I'll help you turn it into a comprehensive execution plan.
                </motion.p>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full"
                >
                  {[
                    "A zero-waste local coffee subscription",
                    "A marketplace for vintage watch parts",
                    "Organizing a tech conference in Tokyo",
                    "Writing a sci-fi novel about AI judges"
                  ].map((hint, i) => (
                    <button
                      key={i}
                      onClick={() => handleSubmit(undefined, hint)}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left text-sm text-slate-300 group"
                    >
                      <span className="opacity-60 group-hover:opacity-100 transition-opacity">" {hint} "</span>
                    </button>
                  ))}
                </motion.div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <MessageItem 
                  key={idx} 
                  message={msg} 
                  onOptionSelect={(val) => handleSubmit(undefined, val)} 
                  onPlanEdit={(newContent, completedTasks) => {
                    setMessages(prev => {
                      const copy = [...prev];
                      const target = copy[idx];
                      if (target.role === "assistant" && typeof target.content !== "string" && target.content.type === "plan") {
                        target.content = { ...target.content, content: newContent, completedTasks: completedTasks ?? target.content.completedTasks } as any;
                      }
                      return copy;
                    });
                  }}
                  onRemoveIsNew={() => {
                    setMessages(prev => {
                      const copy = [...prev];
                      if (copy[idx]) {
                        copy[idx] = { ...copy[idx], isNew: false };
                      }
                      return copy;
                    });
                  }}
                />
              ))
            )}
            {isLoading && (
              <DynamicLoader />
            )}
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}
            <div ref={scrollRef} className="h-4" />
          </div>
        </main>

        {/* Input */}
        <footer className="p-6 border-t border-slate-800/50 bg-[#0A0C10]/80 sticky bottom-0 z-10 no-print">
          <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto flex flex-col gap-2">
            {contextDocs.length > 0 && (
               <div className="flex flex-wrap gap-2 mb-1 px-1">
                 {contextDocs.map((doc, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700/50 rounded-lg text-xs font-medium text-slate-300">
                      <FileText className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="truncate max-w-[120px]">{doc.name}</span>
                      <button type="button" onClick={() => removeDoc(i)} className="p-0.5 hover:bg-slate-800 hover:text-red-400 rounded-md transition-colors ml-1">
                         <X className="w-3 h-3" />
                      </button>
                    </div>
                 ))}
               </div>
            )}
            <div className="relative flex-1 flex items-end gap-2">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept=".txt,.json,.md,.csv" className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3.5 rounded-2xl bg-slate-900 text-slate-400 border border-slate-700/50 hover:bg-slate-800 hover:text-white hover:border-slate-500 transition-all focus:outline-none flex-shrink-0 mb-0.5"
                title="Attach texts or context files"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                onChange={(e) => setInput(e.target.value)}
                placeholder={messages.length === 0 ? "Describe your idea in a few sentences..." : "Type your answer..."}
                className="w-full bg-slate-900/80 border border-slate-700/50 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all text-white placeholder:text-slate-500 shadow-xl resize-none max-h-[200px] overflow-y-auto"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 bottom-2 p-2.5 rounded-xl bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            </div>
          </form>
          <p className="text-[10px] text-center text-slate-600 mt-4 uppercase tracking-[0.2em] font-bold">
            Planfirst Strategy Core v1.0 • Crafted by Ahmed Ali
          </p>
        </footer>
      </div>
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        keys={apiKeys} 
        onSave={(newKeys) => {
          setApiKeys(newKeys);
          saveApiKeys(newKeys);
          setIsSettingsOpen(false);
        }} 
      />
    </div>
  );
}

function SettingsModal({ isOpen, onClose, keys, onSave }: { isOpen: boolean, onClose: () => void, keys: ApiKeys, onSave: (keys: ApiKeys) => void }) {
  const [geminiKey, setGeminiKey] = useState(keys.gemini || "");
  const [openrouterKey, setOpenrouterKey] = useState(keys.openrouter || "");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-[#0F1117] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">API Configuration</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Key className="w-3 h-3" /> Google Gemini API Key
              </label>
              <input 
                type="password" 
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Paste your Gemini API key here..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <p className="text-[10px] text-slate-500">
                Get yours at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">Google AI Studio</a>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Key className="w-3 h-3" /> OpenRouter API Key
              </label>
              <input 
                type="password" 
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                placeholder="Paste your OpenRouter API key here..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <p className="text-[10px] text-slate-500">
                Get yours at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">OpenRouter.ai</a>
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-[11px] text-blue-400 leading-relaxed">
            <strong>Security Note:</strong> Your API keys are stored locally in your browser's <code>localStorage</code>. They are only sent to the respective AI providers and never to our servers.
          </div>
        </div>

        <div className="p-6 bg-slate-900/50 border-t border-slate-800 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-colors text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave({ gemini: geminiKey, openrouter: openrouterKey })}
            className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 text-sm"
          >
            Save Configuration
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-500 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100 mt-2 no-print"
      title="Copy to clipboard"
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? <span className="text-emerald-500">Copied</span> : <span>Copy</span>}
    </button>
  );
}

function MessageItem({ message, onOptionSelect, onPlanEdit, onRemoveIsNew }: { message: ChatMessage, onOptionSelect: (val: string) => void, onPlanEdit: (newContent: string, completedTasks?: string[]) => void, onRemoveIsNew: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [checkedOptions, setCheckedOptions] = useState<string[]>([]);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (message.role === "assistant" && typeof message.content !== "string" && (message.content as any).type === "plan") {
      setEditContent((message.content as any).content || "");
      setCompletedTasks((message.content as any).completedTasks || []);
    }
  }, [message]);

  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1 pr-2 group">
        <div className="bg-slate-800 px-5 py-3 rounded-2xl rounded-tr-none max-w-[80%] text-white border border-slate-700/50 shadow-md">
           {message.content as string}
        </div>
        <CopyButton text={message.content as string} />
      </div>
    );
  }

  const content = message.content as PlanForgeResponse;

  switch (content.type) {
    case "health_check":
      return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 group">
          <div className="flex gap-4 items-start">
             <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
               <Activity className="w-5 h-5 text-emerald-400" />
             </div>
             <div className="space-y-4 flex-1">
               <div className="flex items-center gap-4">
                 <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Viability Score</span>
                    <span className="text-2xl font-black text-emerald-400">{content.viability_score}/10</span>
                 </div>
                 <div className="h-8 w-px bg-slate-800" />
                 <p className="text-slate-300 text-lg font-medium leading-tight">
                    <TypewriterText content={content.first_impression} isNew={message.isNew} onComplete={onRemoveIsNew} />
                 </p>
               </div>
               
               {content.immediate_flags.length > 0 && (
                 <div className="flex flex-wrap gap-2">
                   {content.immediate_flags.map((flag, i) => (
                     <div key={i} className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold flex items-center gap-1.5 leading-none">
                       <ShieldAlert className="w-3 h-3" />
                       {flag}
                     </div>
                   ))}
                 </div>
               )}

               {content.tone_note && (
                 <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs italic">
                   {content.tone_note}
                 </div>
               )}
               <div className="flex justify-end">
                 <CopyButton text={`Health Check\nViability: ${content.viability_score}/10\n${content.first_impression}\n${content.immediate_flags.join(', ')}\n${content.tone_note || ''}`} />
               </div>
             </div>
          </div>
        </motion.div>
      );    case "question":
      return (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 group">
           <div className="flex gap-4 items-start">
             <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
               <Target className="w-4 h-4 text-emerald-500" />
             </div>
             <div className="space-y-3 flex-1">
               <div className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 mb-1">
                 {content.phase || "Discovery"}
               </div>
               <h3 className="text-xl font-semibold text-white leading-relaxed">
                  <TypewriterText content={content.question} isNew={message.isNew} onComplete={onRemoveIsNew} />
               </h3>
               <div className="grid grid-cols-1 gap-2 max-w-xl">
                 {content.options.map((opt, i) => {
                   const isChecked = checkedOptions.includes(opt.label);
                   return (
                     <div key={i} className="flex flex-col gap-2">
                       <div className="flex gap-2 items-stretch">
                         <button
                           onClick={() => setCheckedOptions(prev => prev.includes(opt.label) ? prev.filter(l => l !== opt.label) : [...prev, opt.label])}
                           className={cn(
                             "flex-shrink-0 w-12 flex items-center justify-center rounded-xl border transition-all",
                             isChecked ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-slate-900/50 border-slate-800 text-slate-600 hover:border-slate-600 hover:text-slate-400"
                           )}
                           title="Select multiple"
                         >
                           {isChecked ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-5 h-5 rounded border-2 border-current hover:bg-slate-700/50 transition-colors" />}
                         </button>
                         <button
                           onClick={() => {
                             if (isChecked && customTexts[opt.label]?.trim()) {
                               onOptionSelect(`${opt.label} (Note: ${customTexts[opt.label].trim()})`);
                             } else {
                               onOptionSelect(opt.label);
                             }
                           }}
                           className={cn(
                             "group text-left p-4 rounded-xl border transition-all relative overflow-hidden flex-1",
                             opt.recommended 
                              ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500 active:bg-emerald-500/10" 
                              : "bg-slate-900/50 border-slate-800 hover:border-slate-600 active:bg-slate-800",
                             opt.conflict && "border-amber-500/30 hover:border-amber-500/60"
                           )}
                           title="Click to submit this option instantly"
                         >
                           <div className="flex justify-between items-center gap-3">
                             <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{opt.label}</span>
                             <div className="flex items-center gap-2 flex-shrink-0">
                               {opt.recommended && (
                                 <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-[9px] font-black uppercase text-white shadow-sm">Recommended</span>
                               )}
                               <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-all transform group-hover:translate-x-1" />
                             </div>
                           </div>
                           {opt.conflict && (
                             <div className="mt-2 text-[10px] text-amber-500 font-bold bg-amber-500/5 rounded p-1.5 flex items-center gap-1.5 border border-amber-500/10">
                               <AlertTriangle className="w-3 h-3" />
                               {opt.conflict}
                             </div>
                           )}
                         </button>
                       </div>
                       <AnimatePresence>
                         {isChecked && (
                           <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="pl-[3.5rem] overflow-hidden">
                             <textarea 
                               autoFocus
                               value={customTexts[opt.label] || ""}
                               onChange={(e) => setCustomTexts(prev => ({...prev, [opt.label]: e.target.value}))}
                               placeholder="Adding more details to this option..."
                               className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all resize-none shadow-inner"
                               rows={2}
                             />
                           </motion.div>
                         )}
                       </AnimatePresence>
                     </div>
                   );
                 })}
               </div>
               <AnimatePresence>
                 {checkedOptions.length > 0 && (
                   <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="pt-2 max-w-xl overflow-hidden mt-2">
                     <button
                       onClick={() => {
                         const finalParts = checkedOptions.map(l => {
                           const custom = customTexts[l]?.trim();
                           return custom ? `${l} (Note: ${custom})` : l;
                         });
                         onOptionSelect(finalParts.join(" AND "));
                         setCheckedOptions([]);
                         setCustomTexts({});
                       }}
                       className="w-full py-4 rounded-xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                     >
                       <Send className="w-5 h-5" />
                       Submit {checkedOptions.length} Selected
                     </button>
                   </motion.div>
                 )}
               </AnimatePresence>
               <p className="text-xs text-slate-500 font-medium italic border-l-2 border-slate-800 pl-3 py-1">
                 {content.why_this_matters}
               </p>
               <div className="flex justify-end">
                  <CopyButton text={`${content.question}\n\n${content.options.map((o: any) => '- ' + o.label).join('\n')}\n\n${content.why_this_matters}`} />
               </div>
             </div>
           </div>
        </motion.div>
      );

    case "pivot_alert":
      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 space-y-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <RefreshCw className="w-24 h-24 rotate-12" />
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-xl">
              <History className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-black text-white italic tracking-tight underline decoration-indigo-500/50 underline-offset-8">PIVOT ALERT</h3>
          </div>
          
          <div className="space-y-4 relative z-10">
            <p className="text-slate-300 leading-relaxed text-lg italic mt-4">
               "<TypewriterText content={content.observation} isNew={message.isNew} onComplete={onRemoveIsNew} />"
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Original Path</span>
                <p className="text-sm text-slate-400 line-through decoration-slate-600">{content.original_path}</p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-2">Suggested Pivot</span>
                <p className="text-sm font-bold text-white">{content.suggested_pivot}</p>
              </div>
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
               <p className="text-sm text-slate-300 leading-relaxed">{content.pivot_reason}</p>
            </div>

            <div className="pt-4 space-y-4">
              <h4 className="text-white font-bold text-xl">{content.question}</h4>
              <div className="flex flex-wrap gap-2">
                {content.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => onOptionSelect(opt.label)}
                    className={cn(
                      "px-4 py-2.5 rounded-xl border text-sm font-bold transition-all",
                      opt.recommended 
                        ? "bg-white text-black border-white hover:bg-slate-200" 
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-white/10 mt-4">
                <CopyButton text={`Pivot Alert\nObservation: ${content.observation}\nOriginal Path: ${content.original_path}\nSuggested Pivot: ${content.suggested_pivot}\nReason: ${content.pivot_reason}\n\nQuestion: ${content.question}\nOptions:\n${content.options.map((o: any) => '- ' + o.label).join('\n')}`} />
            </div>
          </div>
        </motion.div>
      );

    case "plan":
      return (
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="space-y-12 pb-20">
          <div className="text-center space-y-6 py-12">
            <div className="inline-flex flex-col items-center">
              <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/40 mb-6 rotate-3">
                <Trophy className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-4xl font-black text-white tracking-tighter">PLAN READY</h2>
              <div className="h-1 w-24 bg-emerald-500 rounded-full mt-4" />
            </div>
            
            <div className="max-w-2xl mx-auto space-y-4">
               <p className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent italic">
                 "{content.tldr}"
               </p>
               <p className="text-slate-400 text-lg">
                 {content.summary}
               </p>
            </div>
            
            <div className="flex justify-center gap-8 py-6">
              <div className="text-center">
                <div className="text-3xl font-black text-emerald-400">{content.viability_score_final}/10</div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Final Viability</div>
              </div>
              <div className="h-12 w-px bg-slate-800" />
              <div className="text-center">
                <div className="text-3xl font-black text-blue-400">READY</div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Execution State</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end mb-4 no-print">
            <button 
              onClick={() => {
                if (isEditing) onPlanEdit(editContent);
                setIsEditing(!isEditing);
              }}
              className="text-emerald-400 hover:text-white text-sm font-bold flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-xl transition-colors mb-2 border border-emerald-500/20"
            >
              {isEditing ? <CheckCircle2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {isEditing ? "Save Edits" : "Edit Plan Markdown"}
            </button>
          </div>

          {isEditing ? (
            <textarea
              className="w-full h-[600px] bg-slate-900 border border-slate-700 rounded-xl p-6 text-slate-300 font-mono text-sm focus:outline-none focus:border-emerald-500 whitespace-pre-wrap"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
          ) : (
            <div className="prose prose-invert prose-emerald max-w-none 
              prose-headings:text-white prose-headings:font-black prose-headings:tracking-tight
              prose-p:text-slate-300 prose-p:leading-relaxed prose-p:text-lg
              prose-li:text-slate-300
              prose-strong:text-white prose-strong:font-bold
              prose-table:border prose-table:border-slate-800
              prose-th:bg-slate-900/50 prose-th:p-4 prose-th:text-emerald-400 prose-th:uppercase prose-th:tracking-widest prose-th:text-[10px]
              prose-td:p-4 prose-td:border-t prose-td:border-slate-800
              space-y-12
            ">
              <TypewriterMarkdown content={content.content} isNew={message.isNew} onComplete={onRemoveIsNew} />
            </div>
          )}

          {/* Interactive Checklist */}
          {content.checklist && content.checklist.length > 0 && (
            <div className="max-w-2xl mx-auto space-y-4 bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl mt-12 mb-12">
               <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                 <CheckCircle2 className="w-6 h-6 text-emerald-500" /> Quick-Start Checklist
               </h3>
               <div className="space-y-3">
                 {content.checklist.map((task: string, i: number) => {
                   const isDone = completedTasks.includes(task);
                   return (
                     <button
                       key={i}
                       onClick={() => {
                         const newCompleted = isDone ? completedTasks.filter(t => t !== task) : [...completedTasks, task];
                         setCompletedTasks(newCompleted);
                         onPlanEdit(editContent, newCompleted); 
                       }}
                       className={cn(
                         "flex items-start gap-4 p-4 rounded-2xl w-full text-left transition-all border shadow-sm",
                         isDone ? "bg-emerald-500/10 border-emerald-500/20 opacity-60" : "bg-slate-800/50 border-slate-700 hover:border-slate-500 hover:bg-slate-800"
                       )}
                     >
                       <div className={cn(
                         "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                         isDone ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-500"
                       )}>
                         {isDone && <CheckCircle2 className="w-4 h-4" />}
                       </div>
                       <span className={cn("text-sm font-medium leading-relaxed", isDone ? "text-emerald-400 line-through" : "text-white")}>{task}</span>
                     </button>
                   );
                 })}
               </div>
            </div>
          )}

          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl no-print">
             <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
             <h3 className="text-2xl font-bold text-white">Your journey starts here.</h3>
             <p className="text-slate-400 pb-4">This plan is yours. Export it or ask me a follow-up question below.</p>
             <div className="flex justify-center gap-4 flex-wrap">
               <button 
                  onClick={() => window.print()}
                  className="px-6 py-3 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  Export PDF
               </button>
               <button 
                  onClick={() => {
                    navigator.clipboard.writeText(content.content);
                    const btn = document.getElementById("copy-btn");
                    if (btn) btn.innerText = "Copied!";
                    setTimeout(() => { if (btn) btn.innerText = "Copy Markdown" }, 2000);
                  }}
                  id="copy-btn"
                  className="px-6 py-3 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  Copy Markdown
               </button>
               {content.checklist && (
                 <button 
                    onClick={() => {
                       let csvContent = "data:text/csv;charset=utf-8,Task,Status\n";
                       content.checklist.forEach((task: string) => csvContent += `"${task.replace(/"/g, '""')}","To Do"\n`);
                       const link = document.createElement("a");
                       link.setAttribute("href", encodeURI(csvContent));
                       link.setAttribute("download", "planfirst_tasks.csv");
                       document.body.appendChild(link);
                       link.click();
                       document.body.removeChild(link);
                    }}
                    className="px-6 py-3 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold hover:bg-blue-500 hover:text-white transition-colors flex items-center gap-2"
                  >
                    Download CSV (Trello)
                 </button>
               )}
             </div>
          </div>

          <div className="flex justify-center mt-12">
            <button
               onClick={() => onOptionSelect("Please brutally challenge the weakest assumptions in this plan. Act as a Devil's Advocate and tear this apart so I know what my blind spots are.")}
               className="px-8 py-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 hover:border-red-500 transition-all flex items-center gap-2 shadow-lg"
             >
               <ShieldAlert className="w-5 h-5" />
               Devil's Advocate: Challenge This Plan
            </button>
          </div>
        </motion.div>
      );

    case "follow_up":
      return (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 max-w-4xl mx-auto group">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0 border border-emerald-500/30 shadow-lg mt-1">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col">
              <div className="prose prose-invert prose-emerald max-w-none 
                prose-headings:text-white prose-headings:font-bold
                prose-p:text-slate-300 prose-p:leading-relaxed
                prose-strong:text-white
                prose-a:text-emerald-400
                prose-li:text-slate-300
              ">
                <TypewriterMarkdown content={content.content} isNew={message.isNew} onComplete={onRemoveIsNew} />
              </div>
              <div className="flex justify-end mt-4 pt-4 border-t border-slate-800/50">
                <CopyButton text={content.content} />
              </div>
            </div>
          </div>
        </motion.div>
      );

    default:
      return null;
  }
}

function TypewriterMarkdown({ content, isNew, onComplete }: { content: string, isNew?: boolean, onComplete?: () => void }) {
  const [displayedContent, setDisplayedContent] = useState(isNew ? "" : content);
  
  useEffect(() => {
    if (!isNew) {
       setDisplayedContent(content);
       return;
    }
    
    let i = 0;
    const interval = setInterval(() => {
      i += 15;
      if (i >= content.length) {
        setDisplayedContent(content);
        clearInterval(interval);
        onComplete?.();
      } else {
        setDisplayedContent(content.substring(0, i));
      }
    }, 15);
    
    return () => clearInterval(interval);
  }, [content, isNew]);

  return <ReactMarkdown>{displayedContent}</ReactMarkdown>;
}

function TypewriterText({ content, isNew, onComplete, className }: { content: string, isNew?: boolean, onComplete?: () => void, className?: string }) {
  const [displayedContent, setDisplayedContent] = useState(isNew ? "" : content);
  
  useEffect(() => {
    if (!isNew) {
       setDisplayedContent(content);
       return;
    }
    
    let i = 0;
    const interval = setInterval(() => {
      i += 3;
      if (i >= content.length) {
        setDisplayedContent(content);
        clearInterval(interval);
        onComplete?.();
      } else {
        setDisplayedContent(content.substring(0, i));
      }
    }, 15);
    
    return () => clearInterval(interval);
  }, [content, isNew]);

  return <span className={className}>{displayedContent}</span>;
}

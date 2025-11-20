/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Heart, Wifi, User, MessageSquare, FileText, AlertTriangle, Activity } from "lucide-react";

// --- 1. REAL IMPORTS (Uncomment these in your local project) ---
// import { RetellWebClient } from "retell-client-js-sdk";
// import { api } from "~/trpc/react";

// --- 2. MOCKS (Delete these in your local project) ---
// These exist only to make the Preview work without a backend
const api = {
  therapy: {
    createWebCall: {
      useMutation: () => ({
        mutateAsync: async (data: any) => {
          console.log("MOCK: Web call started", data);
          await new Promise(r => setTimeout(r, 1000));
          return { accessToken: "mock_token", callId: "mock_call_123" };
        }
      })
    },
    createPhoneCall: {
      useMutation: () => ({
        mutateAsync: async (data: any) => {
            console.log("MOCK: Phone call initiated", data);
            await new Promise(r => setTimeout(r, 1000));
            return { callId: "mock_phone_123" };
        }
      })
    },
    generateSummary: {
      useMutation: () => ({
        mutateAsync: async (data: any) => {
          console.log("MOCK: Generating summary", data);
          await new Promise(r => setTimeout(r, 2000));
          return {
            emotional_state: "Anxious but hopeful",
            key_topics: ["Work stress", "Sleep patterns"],
            risk_flags: ["None"],
            narrative_summary: "The user expressed concern about upcoming deadlines but showed resilience."
          };
        }
      })
    }
  }
};

class RetellWebClient {
  listeners: Record<string, Function[]> = {};
  constructor() { this.listeners = {}; }
  on(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  emit(event: string, ...args: any[]) {
    this.listeners[event]?.forEach(fn => fn(...args));
  }
  async startCall(config: any) {
    console.log("MOCK CLIENT: Connecting...");
    this.emit("call_started");
    // Simulate conversation flow
    setTimeout(() => this.emit("agent_start_talking"), 1000);
    setTimeout(() => this.emit("agent_stop_talking"), 3000);
    setTimeout(() => this.emit("agent_start_talking"), 5000);
    setTimeout(() => this.emit("agent_stop_talking"), 7000);
  }
  stopCall() {
    this.emit("call_ended");
  }
}
// --- END MOCKS ---

type CallState = "idle" | "connecting" | "active" | "summarizing" | "ended";

interface SessionSummary {
  emotional_state: string;
  key_topics: string[];
  risk_flags: string[];
  narrative_summary: string;
}

export default function TherapySession() {
  const [userName, setUserName] = useState("");
  const [userContext, setUserContext] = useState("");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans selection:bg-indigo-500/30">
      <div className="mb-8 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-indigo-400 mb-2">
          <Heart className="w-6 h-6 fill-current" />
          <span className="text-sm font-bold tracking-widest uppercase">Serenity AI</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extralight tracking-tight text-white">
          How are you <span className="text-indigo-400 font-normal">feeling</span>?
        </h1>
      </div>

      {/* Context Inputs */}
      <div className="w-full max-w-lg mb-6 grid grid-cols-2 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <User className="w-5 h-5 text-slate-500" />
            <input 
                type="text" 
                placeholder="Your Name" 
                className="bg-transparent outline-none w-full text-white placeholder-slate-600"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
            />
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-slate-500" />
            <input 
                type="text" 
                placeholder="Topic (Optional)" 
                className="bg-transparent outline-none w-full text-white placeholder-slate-600"
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
            />
        </div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-lg bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative p-8 min-h-[400px] flex flex-col items-center justify-center">
        <WebSessionView userName={userName} userContext={userContext} />
      </div>

      <div className="mt-8 text-xs text-slate-600 flex items-center gap-2">
        <Activity className="w-3 h-3" />
        <span>Powered by Groq LPU & Deepgram Aura</span>
      </div>
    </div>
  );
}

function WebSessionView({ userName, userContext }: { userName: string, userContext: string }) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  
  // Use Ref for callId to avoid triggering re-renders or effect cleanup
  const currentCallIdRef = useRef<string | null>(null);
  
  // Use 'any' here to support the Mock class, revert to RetellWebClient in prod
  const retellClient = useRef<any>(null);
  
  const startWebCallMutation = api.therapy.createWebCall.useMutation();
  const summaryMutation = api.therapy.generateSummary.useMutation();

  useEffect(() => {
    // Initialize client ONCE on mount
    retellClient.current = new RetellWebClient();

    retellClient.current.on("call_started", () => {
      setCallState("active");
      setIsAgentSpeaking(true); 
    });
    
    retellClient.current.on("call_ended", () => {
      setIsAgentSpeaking(false);
      // Trigger summary generation when call actually ends
      handleGenerateSummary();
    });

    retellClient.current.on("agent_start_talking", () => setIsAgentSpeaking(true));
    retellClient.current.on("agent_stop_talking", () => setIsAgentSpeaking(false));

    retellClient.current.on("error", (error: any) => {
        console.error("Retell Error:", error);
        setCallState("idle");
    });

    // Cleanup only on component unmount
    return () => {
      retellClient.current?.stopCall();
    };
  }, []); // Empty dependency array is CRITICAL to prevent "Start/Stop" loops

  const handleStart = async () => {
    setCallState("connecting");
    setSummary(null);
    try {
      const { accessToken, callId } = await startWebCallMutation.mutateAsync({
        userName: userName || "Friend",
        userContext: userContext || "General check-in"
      });
      
      // Store ID in ref, does not trigger re-render/effect cleanup
      currentCallIdRef.current = callId;
      
      if (!retellClient.current) return;
      await retellClient.current.startCall({ accessToken });
    } catch (err) {
      console.error(err);
      setCallState("idle");
      alert("Failed to connect. Check console.");
    }
  };

  const handleStop = () => {
    retellClient.current?.stopCall();
  };

  const handleGenerateSummary = async () => {
    const callId = currentCallIdRef.current;
    // For mock purposes, we allow empty callId
    if (!callId && process.env.NODE_ENV !== 'development') { 
        setCallState("idle");
        return;
    }
    
    setCallState("summarizing");
    try {
        // Wait 3s for Retell to finalize transcript logic simulation
        await new Promise(r => setTimeout(r, 2000));
        const data = await summaryMutation.mutateAsync({ callId: callId || "mock_id" });
        setSummary(data as SessionSummary);
        setCallState("ended");
    } catch (e) {
        console.error("Summary failed", e);
        setCallState("idle");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="flex flex-col items-center w-full"
      suppressHydrationWarning
    >
      {/* 1. SUMMARY VIEW */}
      {callState === "ended" && summary && (
         <motion.div 
           initial={{ scale: 0.9, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           className="w-full bg-slate-800/50 rounded-xl p-6 border border-indigo-500/30"
         >
           <div className="flex items-center gap-2 mb-4 text-indigo-400">
             <FileText className="w-5 h-5" />
             <h3 className="font-semibold">Session Analysis</h3>
           </div>
           
           <div className="space-y-4 text-sm text-slate-300">
             <div>
               <span className="text-slate-500 text-xs uppercase tracking-wider font-bold block mb-1">Emotional State</span>
               <p className="text-white text-lg">{summary.emotional_state}</p>
             </div>
             
             <div>
               <span className="text-slate-500 text-xs uppercase tracking-wider font-bold block mb-1">Summary</span>
               <p className="leading-relaxed">{summary.narrative_summary}</p>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div>
                    <span className="text-slate-500 text-xs uppercase tracking-wider font-bold block mb-1">Topics</span>
                    <div className="flex flex-wrap gap-2">
                        {summary.key_topics.map((t, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-700 rounded text-xs">{t}</span>
                        ))}
                    </div>
                </div>
                {summary.risk_flags.length > 0 && !summary.risk_flags.includes("None") && (
                    <div>
                        <span className="text-red-500 text-xs uppercase tracking-wider font-bold flex items-center gap-1 mb-1">
                            <AlertTriangle className="w-3 h-3" /> Risks
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {summary.risk_flags.map((t, i) => (
                                <span key={i} className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs border border-red-900/50">{t}</span>
                            ))}
                        </div>
                    </div>
                )}
             </div>
           </div>

           <button 
             onClick={() => setCallState("idle")}
             className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors text-white"
           >
             Start New Session
           </button>
         </motion.div>
      )}

      {/* 2. LOADING SUMMARY */}
      {callState === "summarizing" && (
         <div className="text-center py-10 space-y-4">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-indigo-300 animate-pulse">Generating insights...</p>
         </div>
      )}

      {/* 3. ACTIVE CALL (ORB) */}
      {(callState === "active" || callState === "connecting") && (
        <>
            <div className="relative w-64 h-64 flex items-center justify-center mb-8">
                {callState === "active" && (
                <>
                    <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full bg-indigo-500 blur-3xl"
                    />
                    <motion.div
                    animate={{ 
                        scale: isAgentSpeaking ? [1, 1.5, 1.4, 1.6, 1] : 1,
                        opacity: isAgentSpeaking ? 0.6 : 0.1 
                    }}
                    transition={{ duration: 0.5, repeat: isAgentSpeaking ? Infinity : 0, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full bg-indigo-400 blur-2xl mix-blend-screen"
                    />
                </>
                )}

                <div className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500
                ${callState === "active" ? "bg-indigo-600 shadow-[0_0_50px_rgba(79,70,229,0.5)]" : "bg-slate-800"}
                `}>
                {callState === "connecting" ? (
                    <Wifi className="w-10 h-10 text-white animate-pulse" />
                ) : (
                    <Mic className="w-10 h-10 text-white" />
                )}
                </div>
            </div>

            <div className="h-8 mb-8 text-center">
                {callState === "connecting" && <span className="text-indigo-400 animate-pulse">Connecting to Serenity...</span>}
                {callState === "active" && (
                isAgentSpeaking ? 
                <span className="text-indigo-300 font-medium">Serenity is speaking...</span> : 
                <span className="text-slate-400">Listening to you...</span>
                )}
            </div>

            <button
                onClick={handleStop}
                className="group relative px-8 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full transition-all flex items-center gap-3 border border-red-500/50"
            >
                <Square className="w-5 h-5 fill-current" />
                <span className="font-semibold">End Session</span>
            </button>
        </>
      )}

      {/* 4. IDLE (START) */}
      {callState === "idle" && (
        <div className="text-center">
            <div className="w-full flex flex-col items-center justify-center mb-8 text-slate-400 space-y-2">
                <p className="text-lg">Ready to begin?</p>
                <p className="text-xs text-slate-600">Headphones recommended for best experience</p>
            </div>
            <button
            onClick={handleStart}
            className="group relative px-10 py-5 bg-white hover:bg-indigo-50 text-indigo-950 rounded-full font-bold text-lg transition-all flex items-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] mx-auto"
            >
            <Mic className="w-6 h-6" />
            <span>Start Session</span>
            </button>
        </div>
      )}
    </motion.div>
  );
}
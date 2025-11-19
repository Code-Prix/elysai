"use client";

import React, { useState, useEffect, useRef } from "react";
// Dependency: Make sure 'retell-client-js-sdk' is installed via npm install
import { RetellWebClient } from "retell-client-js-sdk"; 
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Mic, Square, Heart, Wifi, User, MessageSquare } from "lucide-react";
// Path Alias: This should resolve to your /src/trpc/react file
import { api } from "~/trpc/react"; 

type CallState = "idle" | "connecting" | "active" | "ended";

export default function TherapySession() {
  const [activeTab, setActiveTab] = useState<"phone" | "web">("web");
  // State for Custom Payload
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

      {/* Context Inputs (Custom Payload) */}
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
                placeholder="Current Mood / Topic" 
                className="bg-transparent outline-none w-full text-white placeholder-slate-600"
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
            />
        </div>
      </div>

      <div className="w-full max-w-lg bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab("web")}
            className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${activeTab === "web" ? "bg-slate-800/50 text-white border-b-2 border-indigo-500" : "text-slate-500 hover:text-slate-300"}`}
          >
            <Mic className="w-4 h-4" /> Live Session
          </button>
          <button
            onClick={() => setActiveTab("phone")}
            className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${activeTab === "phone" ? "bg-slate-800/50 text-white border-b-2 border-indigo-500" : "text-slate-500 hover:text-slate-300"}`}
          >
            <Phone className="w-4 h-4" /> Phone Call
          </button>
        </div>

        <div className="p-8 min-h-[400px] flex flex-col items-center justify-center relative">
          <AnimatePresence mode="wait">
            {activeTab === "web" ? (
              <WebSessionView key="web" userName={userName} userContext={userContext} />
            ) : (
              <PhoneCallView key="phone" userName={userName} userContext={userContext} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// --- Web Session View ---
function WebSessionView({ userName, userContext }: { userName: string, userContext: string }) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const retellClient = useRef<RetellWebClient | null>(null);
  
  const startWebCallMutation = api.therapy.createWebCall.useMutation();

  useEffect(() => {
    // Initialize client on mount
    retellClient.current = new RetellWebClient();

    retellClient.current.on("call_started", () => {
      setCallState("active");
      setIsAgentSpeaking(true); 
    });
    
    retellClient.current.on("call_ended", () => {
      setCallState("ended");
      setIsAgentSpeaking(false);
      setTimeout(() => setCallState("idle"), 3000); 
    });

    retellClient.current.on("agent_start_talking", () => setIsAgentSpeaking(true));
    retellClient.current.on("agent_stop_talking", () => setIsAgentSpeaking(false));

    retellClient.current.on("error", (error) => {
        console.error("Retell Error:", error);
        setCallState("idle");
    });

    return () => {
      retellClient.current?.stopCall();
    };
  }, []);

  const handleStart = async () => {
    setCallState("connecting");
    try {
      // Pass Payload to Backend
      const { accessToken } = await startWebCallMutation.mutateAsync({
        userName: userName || "Friend",
        userContext: userContext || "General check-in"
      });
      
      if (!retellClient.current) return;
      
      await retellClient.current.startCall({
        accessToken: accessToken,
      });
    } catch (err) {
      console.error("Failed to start call:", err);
      setCallState("idle");
      alert("Failed to connect. Ensure Groq Bridge and ngrok are running.");
    }
  };

  const handleStop = () => {
    retellClient.current?.stopCall();
    setCallState("ended");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center w-full"
      suppressHydrationWarning
    >
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
          ) : callState === "active" ? (
             <Mic className="w-10 h-10 text-white" />
          ) : (
             <div className="w-3 h-3 rounded-full bg-slate-600" />
          )}
        </div>
      </div>

      <div className="h-8 mb-8 text-center">
        {callState === "idle" && <span className="text-slate-500">Ready to listen.</span>}
        {callState === "connecting" && <span className="text-indigo-400 animate-pulse">Securely connecting...</span>}
        {callState === "active" && (
           isAgentSpeaking ? 
           <span className="text-indigo-300 font-medium">Serenity is speaking...</span> : 
           <span className="text-slate-400">Listening to you...</span>
        )}
        {callState === "ended" && <span className="text-emerald-400">Session completed.</span>}
      </div>

      {callState === "active" ? (
        <button
          onClick={handleStop}
          className="group relative px-8 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full transition-all flex items-center gap-3 border border-red-500/50"
        >
          <Square className="w-5 h-5 fill-current" />
          <span className="font-semibold">End Session</span>
        </button>
      ) : (
        <button
          onClick={handleStart}
          disabled={callState === "connecting"}
          className="group relative px-8 py-4 bg-white hover:bg-indigo-50 text-indigo-950 rounded-full font-semibold transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Mic className="w-5 h-5" />
          <span>Start Therapy Session</span>
        </button>
      )}
    </motion.div>
  );
}

// --- Phone Call View ---
function PhoneCallView({ userName, userContext }: { userName: string, userContext: string }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [status, setStatus] = useState<"idle" | "calling" | "success">("idle");
  
  const callMutation = api.therapy.createPhoneCall.useMutation({
    onSuccess: () => setStatus("success"),
    onError: (error) => {
      console.error(error);
      setStatus("idle");
      alert("Failed to initiate call. Check phone number and backend logs.");
    },
  });

  const handleCall = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("calling");
    callMutation.mutate({ 
        userPhoneNumber: phoneNumber,
        userName: userName || "Friend",
        userContext: userContext || "General check-in"
    });
  };

  if (status === "success") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
          <Phone className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-medium text-white">Calling you now...</h3>
        <p className="text-slate-400">Please pick up your phone.</p>
        <button 
          onClick={() => setStatus("idle")}
          className="text-sm text-slate-500 hover:text-white underline mt-4"
        >
          Start over
        </button>
      </motion.div>
    );
  }

  return (
    <motion.form 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }}
      onSubmit={handleCall} 
      className="w-full space-y-6"
    >
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-400 ml-1">Phone Number</label>
        <input
          type="tel"
          placeholder="+1 (555) 000-0000"
          required
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
        />
        <p className="text-xs text-slate-600 ml-1">
          Note: Phone calls require a paid Retell number. Use 'Live Session' in India.
        </p>
      </div>

      <button
        type="submit"
        disabled={status === "calling" || !phoneNumber}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {status === "calling" ? (
          <span className="animate-pulse">Initiating Call...</span>
        ) : (
          <>
            <Phone className="w-5 h-5" />
            Call My Phone
          </>
        )}
      </button>
    </motion.form>
  );
}
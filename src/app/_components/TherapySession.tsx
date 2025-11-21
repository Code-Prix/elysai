/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import { api } from "~/trpc/react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Heart, Wifi, User, MessageSquare, FileText, AlertTriangle, Activity, Bug, CheckCircle, XCircle } from "lucide-react";

type CallState = "idle" | "connecting" | "active" | "summarizing" | "ended";

// Relaxed interface to catch any data shape
interface SessionSummary {
  emotional_state?: string;
  emotionalState?: string; // Handle potential camelCase
  key_topics?: string[];
  topics?: string[];      // Handle potential camelCase
  risk_flags?: string[];
  riskFlags?: string[];   // Handle potential camelCase
  narrative_summary?: string;
  summary?: string;       // Handle potential camelCase
}

export function TherapySession() {
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
            suppressHydrationWarning
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
            suppressHydrationWarning
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentCallIdRef = useRef<string | null>(null);
  const retellClient = useRef<RetellWebClient | null>(null);

  const startWebCallMutation = api.therapy.createWebCall.useMutation();
  const summaryMutation = api.therapy.generateSummary.useMutation();
  const testBridgeMutation = api.therapy.testBridge.useMutation();

  const [debugMode, setDebugMode] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<"unknown" | "success" | "failed">("unknown");

  useEffect(() => {
    retellClient.current = new RetellWebClient();

    retellClient.current.on("call_started", () => {
      setCallState("active");
      setIsAgentSpeaking(true);
      setErrorMsg(null);
    });

    retellClient.current.on("call_ended", () => {
      setIsAgentSpeaking(false);
      void handleGenerateSummary();
    });

    retellClient.current.on("agent_start_talking", () => setIsAgentSpeaking(true));
    retellClient.current.on("agent_stop_talking", () => setIsAgentSpeaking(false));

    retellClient.current.on("error", (error: any) => {
      console.error("Retell Error:", error);
      setErrorMsg("Connection error. Please try again.");
    });

    return () => {
      retellClient.current?.stopCall();
    };
  }, []);

  const handleStart = async () => {
    setCallState("connecting");
    setSummary(null);
    setErrorMsg(null);
    try {
      const { accessToken, callId } = await startWebCallMutation.mutateAsync({
        userName: userName || "Friend",
        userContext: userContext || "General check-in"
      });

      currentCallIdRef.current = callId;

      if (!retellClient.current) return;

      await retellClient.current.startCall({ accessToken });
    } catch (err) {
      console.error("Connection Failed:", err);
      setCallState("idle");
      setErrorMsg("Failed to start session. Check console.");
    }
  };

  const handleStop = () => {
    retellClient.current?.stopCall();
  };

  const handleGenerateSummary = async () => {
    const callId = currentCallIdRef.current;
    if (!callId) {
      setCallState("idle");
      return;
    }

    setCallState("summarizing");

    let attempts = 0;
    const maxAttempts = 10;

    const poll = async () => {
      try {
        console.log(`[Polling] Checking summary attempt ${attempts + 1}...`);
        const data = await summaryMutation.mutateAsync({ callId });

        console.log("[Polling] Response:", data);

        // Check for "Processing" state or empty data
        const isProcessing = data.emotional_state === "Processing" ||
          data.emotionalState === "Processing";

        if (isProcessing && attempts < maxAttempts) {
          attempts++;
          setTimeout(() => void poll(), 2000);
        } else if (data.emotional_state === "Error") {
          setErrorMsg("Could not analyze session.");
          setCallState("idle");
        } else {
          setSummary(data as SessionSummary);
          setCallState("ended");
        }
      } catch (e) {
        console.error("Summary failed", e);
        setErrorMsg("Error retrieving summary.");
        setCallState("idle");
      }
    };

    void poll();
  };

  const handleTestBridge = async () => {
    try {
      const res = await testBridgeMutation.mutateAsync();
      setBridgeStatus(res.success ? "success" : "failed");
    } catch (e) {
      setBridgeStatus("failed");
    }
  };

  // Helper to safely get properties regardless of casing
  const getSummaryProp = (prop: keyof SessionSummary, altProp: keyof SessionSummary) => {
    if (!summary) return "";
    return summary[prop] || summary[altProp] || "N/A";
  };

  const getSummaryArray = (prop: keyof SessionSummary, altProp: keyof SessionSummary) => {
    if (!summary) return [];
    const val = summary[prop] || summary[altProp];
    return Array.isArray(val) ? val : [];
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center w-full"
      suppressHydrationWarning
    >
      {/* DEBUG TOGGLE */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={() => setDebugMode(!debugMode)}
          className={`p-2 rounded-full transition-colors ${debugMode ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}
          title="Toggle Debug Mode"
        >
          <Bug className="w-4 h-4" />
        </button>
      </div>

      {/* DEBUG PANEL */}
      {debugMode && (
        <div className="w-full max-w-lg mb-6 p-4 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Bridge Status:</span>
            <div className="flex items-center gap-2">
              {bridgeStatus === "unknown" && <span className="text-slate-500">Untested</span>}
              {bridgeStatus === "success" && <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Connected</span>}
              {bridgeStatus === "failed" && <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</span>}
              <button
                onClick={handleTestBridge}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
              >
                Test
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Call State:</span>
            <span className="text-indigo-300">{callState}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Agent Speaking:</span>
            <span className={isAgentSpeaking ? "text-green-400" : "text-slate-500"}>{isAgentSpeaking ? "YES" : "NO"}</span>
          </div>
          {currentCallIdRef.current && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Call ID:</span>
              <span className="text-slate-500 truncate max-w-[150px]">{currentCallIdRef.current}</span>
            </div>
          )}
        </div>
      )}

      {/* ERROR MESSAGE */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded text-red-200 text-sm">
          {errorMsg}
        </div>
      )}

      {/* 1. SUMMARY VIEW */}
      {callState === "ended" && summary && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full bg-slate-800/50 rounded-xl p-6 border border-indigo-500/30"
          key="summary"
        >
          <div className="flex items-center gap-2 mb-4 text-indigo-400">
            <FileText className="w-5 h-5" />
            <h3 className="font-semibold">Session Analysis</h3>
          </div>

          <div className="space-y-4 text-sm text-slate-300">
            <div>
              <span className="text-slate-500 text-xs uppercase tracking-wider font-bold block mb-1">Emotional State</span>
              <p className="text-white text-lg">
                {getSummaryProp("emotional_state", "emotionalState") as string}
              </p>
            </div>

            <div>
              <span className="text-slate-500 text-xs uppercase tracking-wider font-bold block mb-1">Summary</span>
              <p className="leading-relaxed">
                {getSummaryProp("narrative_summary", "summary") as string}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wider font-bold block mb-1">Topics</span>
                <div className="flex flex-wrap gap-2">
                  {getSummaryArray("key_topics", "topics").map((t, i) => (
                    <span key={i} className="px-2 py-1 bg-slate-700 rounded text-xs">{t}</span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-red-500 text-xs uppercase tracking-wider font-bold flex items-center gap-1 mb-1">
                  <AlertTriangle className="w-3 h-3" /> Risks
                </span>
                <div className="flex flex-wrap gap-2">
                  {getSummaryArray("risk_flags", "riskFlags").map((t, i) => (
                    <span key={i} className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs border border-red-900/50">{t}</span>
                  ))}
                  {getSummaryArray("risk_flags", "riskFlags").length === 0 && (
                    <span className="px-2 py-1 bg-slate-700/50 text-slate-400 rounded text-xs">None detected</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setCallState("idle");
              setSummary(null);
              setErrorMsg(null);
            }}
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
          <p className="text-xs text-slate-500">This may take a moment...</p>
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
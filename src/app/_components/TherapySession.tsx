/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import { api } from "~/trpc/react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Heart, Wifi, User, MessageSquare, FileText, AlertTriangle, Activity, Bug, CheckCircle, XCircle, RefreshCw } from "lucide-react";

type CallState = "idle" | "connecting" | "active" | "summarizing" | "ended";

interface SessionSummary {
  emotional_state?: string;
  emotionalState?: string;
  key_topics?: string[];
  topics?: string[];
  risk_flags?: string[];
  riskFlags?: string[];
  narrative_summary?: string;
  summary?: string;
}

export function TherapySession() {
  const [userName, setUserName] = useState("");
  const [userContext, setUserContext] = useState("");

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-4 font-sans">
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
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-3 transition-all focus-within:bg-white/10 focus-within:border-indigo-500/50">
          <User className="w-5 h-5 text-indigo-300" />
          <input
            type="text"
            placeholder="Your Name"
            className="bg-transparent outline-none w-full text-white placeholder-slate-500"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            suppressHydrationWarning
          />
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-3 transition-all focus-within:bg-white/10 focus-within:border-indigo-500/50">
          <MessageSquare className="w-5 h-5 text-indigo-300" />
          <input
            type="text"
            placeholder="Topic (Optional)"
            className="bg-transparent outline-none w-full text-white placeholder-slate-500"
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            suppressHydrationWarning
          />
        </div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-lg bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden relative p-8 min-h-[450px] flex flex-col items-center justify-center">
        {/* Ambient Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />

        <WebSessionView userName={userName} userContext={userContext} />
      </div>

      <div className="mt-8 text-xs text-slate-500 flex items-center gap-2">
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
    setErrorMsg(null);

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
        } else if (data.emotional_state === "Error" || data.emotionalState === "Error") {
          setErrorMsg("Could not analyze session. Please try again.");
          setCallState("ended"); // Allow retry from ended state
        } else {
          setSummary(data as SessionSummary);
          setCallState("ended");
        }
      } catch (e) {
        console.error("Summary failed", e);
        setErrorMsg("Error retrieving summary.");
        setCallState("ended");
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
      className="flex flex-col items-center w-full relative z-10"
      suppressHydrationWarning
    >
      {/* DEBUG TOGGLE */}
      <div className="absolute -top-2 -right-2 flex items-center gap-2 z-50">
        <button
          onClick={() => setDebugMode(!debugMode)}
          className={`p-2 rounded-full transition-colors ${debugMode ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
          title="Toggle Debug Mode"
        >
          <Bug className="w-4 h-4" />
        </button>
      </div>

      {/* DEBUG PANEL */}
      {debugMode && (
        <div className="w-full max-w-lg mb-6 p-4 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl text-xs font-mono space-y-2 absolute top-0 left-0 z-40">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Bridge Status:</span>
            <div className="flex items-center gap-2">
              {bridgeStatus === "unknown" && <span className="text-slate-500">Untested</span>}
              {bridgeStatus === "success" && <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Connected</span>}
              {bridgeStatus === "failed" && <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</span>}
              <button
                onClick={handleTestBridge}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-slate-300 transition-colors"
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

      {/* 1. SUMMARY VIEW */}
      {callState === "ended" && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full"
          key="summary"
        >
          {errorMsg ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Analysis Failed</h3>
              <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
              <button
                onClick={() => handleGenerateSummary()}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-sm font-medium transition-colors flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" /> Retry Analysis
              </button>
              <button
                onClick={() => {
                  setCallState("idle");
                  setSummary(null);
                  setErrorMsg(null);
                }}
                className="mt-4 text-xs text-slate-500 hover:text-slate-300 underline"
              >
                Start New Session Instead
              </button>
            </div>
          ) : summary ? (
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-6 text-indigo-300">
                <FileText className="w-5 h-5" />
                <h3 className="font-semibold tracking-wide uppercase text-xs">Session Analysis</h3>
              </div>

              <div className="space-y-6 text-sm text-slate-300">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase tracking-widest font-bold block mb-2">Emotional State</span>
                  <p className="text-white text-2xl font-light">
                    {getSummaryProp("emotional_state", "emotionalState") as string}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] uppercase tracking-widest font-bold block mb-2">Summary</span>
                  <p className="leading-relaxed text-slate-200">
                    {getSummaryProp("narrative_summary", "summary") as string}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase tracking-widest font-bold block mb-2">Topics</span>
                    <div className="flex flex-wrap gap-2">
                      {getSummaryArray("key_topics", "topics").map((t, i) => (
                        <span key={i} className="px-3 py-1 bg-indigo-500/20 text-indigo-200 rounded-full text-xs border border-indigo-500/30">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-red-400/80 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1 mb-2">
                      <AlertTriangle className="w-3 h-3" /> Risk Factors
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {getSummaryArray("risk_flags", "riskFlags").map((t, i) => (
                        <span key={i} className="px-3 py-1 bg-red-500/20 text-red-200 rounded-full text-xs border border-red-500/30">{t}</span>
                      ))}
                      {getSummaryArray("risk_flags", "riskFlags").length === 0 && (
                        <span className="px-3 py-1 bg-white/5 text-slate-400 rounded-full text-xs border border-white/5">None detected</span>
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
                className="w-full mt-8 py-4 bg-white text-slate-900 hover:bg-indigo-50 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-indigo-900/20"
              >
                Start New Session
              </button>
            </div>
          ) : null}
        </motion.div>
      )}

      {/* 2. LOADING SUMMARY */}
      {callState === "summarizing" && (
        <div className="text-center py-12 space-y-6">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="space-y-1">
            <p className="text-indigo-200 font-light text-lg animate-pulse">Generating insights...</p>
            <p className="text-xs text-slate-500">Analyzing emotional tone and key topics</p>
          </div>
        </div>
      )}

      {/* 3. ACTIVE CALL (ORB) */}
      {(callState === "active" || callState === "connecting") && (
        <>
          <div className="relative w-72 h-72 flex items-center justify-center mb-8">
            {callState === "active" && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-indigo-500 blur-[60px]"
                />
                <motion.div
                  animate={{
                    scale: isAgentSpeaking ? [1, 1.1, 1] : 1,
                    opacity: isAgentSpeaking ? 0.8 : 0.3
                  }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 rounded-full bg-indigo-400/20 blur-3xl mix-blend-screen"
                />
              </>
            )}

            {/* Core Orb */}
            <div className={`relative z-10 w-40 h-40 rounded-full flex items-center justify-center transition-all duration-700
                ${callState === "active"
                ? "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_0_60px_rgba(99,102,241,0.6)]"
                : "bg-slate-800 border border-white/10"}
                `}>
              {callState === "connecting" ? (
                <Wifi className="w-12 h-12 text-white/50 animate-pulse" />
              ) : (
                <motion.div
                  animate={{ scale: isAgentSpeaking ? [1, 1.2, 1] : 1 }}
                  transition={{ duration: 0.4 }}
                >
                  <Mic className="w-12 h-12 text-white" />
                </motion.div>
              )}
            </div>

            {/* Ripple Rings */}
            {callState === "active" && isAgentSpeaking && (
              <>
                <motion.div
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: 0, scale: 2 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  className="absolute w-40 h-40 rounded-full border border-indigo-400/30"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: 0, scale: 2 }}
                  transition={{ duration: 2, delay: 0.5, repeat: Infinity, ease: "easeOut" }}
                  className="absolute w-40 h-40 rounded-full border border-indigo-400/20"
                />
              </>
            )}
          </div>

          <div className="h-8 mb-8 text-center">
            {callState === "connecting" && <span className="text-indigo-300 animate-pulse font-light tracking-wide">Connecting to Serenity...</span>}
            {callState === "active" && (
              isAgentSpeaking ?
                <span className="text-indigo-200 font-medium tracking-wide">Serenity is speaking...</span> :
                <span className="text-slate-400 font-light">Listening...</span>
            )}
          </div>

          <button
            onClick={handleStop}
            className="group relative px-8 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-full transition-all flex items-center gap-3 border border-red-500/20 hover:border-red-500/40"
          >
            <Square className="w-4 h-4 fill-current" />
            <span className="font-semibold text-sm uppercase tracking-wider">End Session</span>
          </button>
        </>
      )}

      {/* 4. IDLE (START) */}
      {callState === "idle" && (
        <div className="text-center">
          <div className="w-full flex flex-col items-center justify-center mb-10 text-slate-400 space-y-2">
            <p className="text-lg font-light text-slate-300">Ready to begin your journey?</p>
            <p className="text-xs text-slate-500 uppercase tracking-widest">Headphones recommended</p>
          </div>
          <button
            onClick={handleStart}
            className="group relative px-12 py-6 bg-white text-slate-900 hover:bg-indigo-50 rounded-[2rem] font-bold text-lg transition-all flex items-center gap-4 shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)] mx-auto transform hover:-translate-y-1"
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white">
              <Mic className="w-5 h-5" />
            </div>
            <span className="tracking-tight">Start Session</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}
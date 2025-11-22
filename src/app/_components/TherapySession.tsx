/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import { api } from "~/trpc/react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Heart, Wifi, User, MessageSquare, FileText, AlertTriangle, Activity, Bug, CheckCircle, XCircle, RefreshCw, ShieldAlert } from "lucide-react";

type CallState = "idle" | "connecting" | "active" | "summarizing" | "ended";

interface SessionSummary {
  emotional_state?: string;
  emotionalState?: string;
  key_topics?: string[];
  topics?: string[];
  risk_flags?: string[];
  riskFlags?: string[];
  safety_resources_provided?: string[];
  safetyResources?: string[];
  narrative_summary?: string;
  summary?: string;
}

export function TherapySession() {
  const [userName, setUserName] = useState("");
  const [userContext, setUserContext] = useState("");

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-4 font-sans">
      <div className="mb-12 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-slate-500 mb-2">
          <Heart className="w-5 h-5 fill-current" />
          <span className="text-xs font-bold tracking-[0.2em] uppercase">Serenity AI</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-light tracking-tight text-slate-200">
          How are you <span className="text-white font-normal">feeling</span>?
        </h1>
      </div>

      {/* Context Inputs */}
      <div className="w-full max-w-lg mb-8 grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-3 transition-all focus-within:border-slate-600">
          <User className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Your Name"
            className="bg-transparent outline-none w-full text-sm text-white placeholder-slate-600"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            suppressHydrationWarning
          />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-3 transition-all focus-within:border-slate-600">
          <MessageSquare className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Topic (Optional)"
            className="bg-transparent outline-none w-full text-sm text-white placeholder-slate-600"
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            suppressHydrationWarning
          />
        </div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative p-8 min-h-[450px] flex flex-col items-center justify-center">
        <WebSessionView userName={userName} userContext={userContext} />
      </div>

      <div className="mt-12 text-[10px] text-slate-600 flex items-center gap-2 uppercase tracking-widest">
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
          className={`p-2 rounded-full transition-colors ${debugMode ? "bg-white text-black" : "bg-slate-900 text-slate-600 hover:text-slate-400"}`}
          title="Toggle Debug Mode"
        >
          <Bug className="w-3 h-3" />
        </button>
      </div>

      {/* DEBUG PANEL */}
      {debugMode && (
        <div className="w-full max-w-lg mb-6 p-4 bg-black border border-slate-800 rounded-lg text-[10px] font-mono space-y-2 absolute top-0 left-0 z-40">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Bridge Status:</span>
            <div className="flex items-center gap-2">
              {bridgeStatus === "unknown" && <span className="text-slate-600">Untested</span>}
              {bridgeStatus === "success" && <span className="text-green-500 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Connected</span>}
              {bridgeStatus === "failed" && <span className="text-red-500 flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</span>}
              <button
                onClick={handleTestBridge}
                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded text-slate-400 transition-colors"
              >
                Test
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Call State:</span>
            <span className="text-white">{callState}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Agent Speaking:</span>
            <span className={isAgentSpeaking ? "text-green-500" : "text-slate-600"}>{isAgentSpeaking ? "YES" : "NO"}</span>
          </div>
          {currentCallIdRef.current && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Call ID:</span>
              <span className="text-slate-600 truncate max-w-[150px]">{currentCallIdRef.current}</span>
            </div>
          )}
        </div>
      )}

      {/* 1. SUMMARY VIEW */}
      {callState === "ended" && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full"
          key="summary"
        >
          {errorMsg ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-medium text-white mb-2">Analysis Failed</h3>
              <p className="text-slate-500 text-xs mb-6">{errorMsg}</p>
              <button
                onClick={() => handleGenerateSummary()}
                className="px-6 py-2 bg-white text-black hover:bg-slate-200 rounded-full text-xs font-bold transition-colors flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-3 h-3" /> Retry Analysis
              </button>
              <button
                onClick={() => {
                  setCallState("idle");
                  setSummary(null);
                  setErrorMsg(null);
                }}
                className="mt-6 text-[10px] text-slate-600 hover:text-slate-400 uppercase tracking-widest"
              >
                Start New Session
              </button>
            </div>
          ) : summary ? (
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-slate-400">
                  <FileText className="w-4 h-4" />
                  <h3 className="font-bold tracking-widest uppercase text-[10px]">Session Analysis</h3>
                </div>
                <span className="text-[10px] text-slate-600">{new Date().toLocaleDateString()}</span>
              </div>

              {/* SAFETY ALERT */}
              {getSummaryArray("safety_resources_provided", "safetyResources").length > 0 && (
                <div className="mb-6 bg-red-950/30 border border-red-900/50 rounded-lg p-4 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-red-400 text-xs font-bold uppercase tracking-wider mb-1">Safety Resources Provided</h4>
                    <ul className="space-y-1">
                      {getSummaryArray("safety_resources_provided", "safetyResources").map((res, i) => (
                        <li key={i} className="text-xs text-red-300/80 leading-relaxed">• {res}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="space-y-8 text-sm text-slate-300">
                <div>
                  <span className="text-slate-600 text-[10px] uppercase tracking-widest font-bold block mb-2">Emotional State</span>
                  <p className="text-white text-xl font-light">
                    {getSummaryProp("emotional_state", "emotionalState") as string}
                  </p>
                </div>

                <div>
                  <span className="text-slate-600 text-[10px] uppercase tracking-widest font-bold block mb-2">Summary</span>
                  <p className="leading-relaxed text-slate-400 text-xs">
                    {getSummaryProp("narrative_summary", "summary") as string}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <span className="text-slate-600 text-[10px] uppercase tracking-widest font-bold block mb-2">Topics</span>
                    <div className="flex flex-wrap gap-2">
                      {getSummaryArray("key_topics", "topics").map((t, i) => (
                        <span key={i} className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-[10px] border border-slate-700">{t}</span>
                      ))}
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
                className="w-full mt-8 py-4 bg-white text-black hover:bg-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
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
          <div className="relative w-12 h-12 mx-auto">
            <div className="absolute inset-0 border-2 border-slate-800 rounded-full"></div>
            <div className="absolute inset-0 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="space-y-1">
            <p className="text-white font-light text-sm animate-pulse">Generating insights...</p>
          </div>
        </div>
      )}

      {/* 3. ACTIVE CALL (ORB) */}
      {(callState === "active" || callState === "connecting") && (
        <>
          <div className="relative w-64 h-64 flex items-center justify-center mb-8">
            {callState === "active" && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.05, 0.1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-white blur-[80px]"
                />
              </>
            )}

            {/* Core Orb */}
            <div className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-700
                ${callState === "active"
                ? "bg-white shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                : "bg-slate-900 border border-slate-800"}
                `}>
              {callState === "connecting" ? (
                <Wifi className="w-8 h-8 text-slate-600 animate-pulse" />
              ) : (
                <motion.div
                  animate={{ scale: isAgentSpeaking ? [1, 1.1, 1] : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Mic className={`w-8 h-8 ${callState === 'active' ? 'text-black' : 'text-slate-500'}`} />
                </motion.div>
              )}
            </div>

            {/* Ripple Rings */}
            {callState === "active" && isAgentSpeaking && (
              <>
                <motion.div
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.5 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  className="absolute w-32 h-32 rounded-full border border-white/10"
                />
              </>
            )}
          </div>

          <div className="h-8 mb-8 text-center">
            {callState === "connecting" && <span className="text-slate-500 text-xs uppercase tracking-widest animate-pulse">Connecting...</span>}
            {callState === "active" && (
              isAgentSpeaking ?
                <span className="text-white text-xs uppercase tracking-widest font-bold">Serenity is speaking</span> :
                <span className="text-slate-600 text-xs uppercase tracking-widest">Listening</span>
            )}
          </div>

          <button
            onClick={handleStop}
            className="group relative px-8 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full transition-all flex items-center gap-3 border border-red-500/10 hover:border-red-500/30"
          >
            <Square className="w-3 h-3 fill-current" />
            <span className="font-bold text-[10px] uppercase tracking-widest">End Session</span>
          </button>
        </>
      )}

      {/* 4. IDLE (START) */}
      {callState === "idle" && (
        <div className="text-center">
          <div className="w-full flex flex-col items-center justify-center mb-10 text-slate-400 space-y-2">
            <p className="text-sm font-light text-slate-500">Ready to begin?</p>
          </div>
          <button
            onClick={handleStart}
            className="group relative px-10 py-5 bg-white text-black hover:bg-slate-200 rounded-full font-bold text-sm transition-all flex items-center gap-4 shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:shadow-[0_0_50px_rgba(255,255,255,0.1)] mx-auto"
          >
            <Mic className="w-4 h-4" />
            <span className="tracking-widest uppercase text-xs">Start Session</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}
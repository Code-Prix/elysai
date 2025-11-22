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
      <div className="mb-12 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-slate-400 mb-3">
          <Heart className="w-5 h-5 fill-current" />
          <span className="text-xs font-bold tracking-[0.2em] uppercase">Serenity AI</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white">
          How are you <span className="font-semibold">feeling</span>?
        </h1>
      </div>

      {/* Context Inputs */}
      <div className="w-full max-w-lg mb-8 grid grid-cols-2 gap-4">
        <div className="bg-slate-800 border-2 border-slate-700 rounded-xl p-4 flex items-center gap-3 transition-all focus-within:border-slate-500">
          <User className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Your Name"
            className="bg-transparent outline-none w-full text-base text-white placeholder-slate-500"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            suppressHydrationWarning
          />
        </div>
        <div className="bg-slate-800 border-2 border-slate-700 rounded-xl p-4 flex items-center gap-3 transition-all focus-within:border-slate-500">
          <MessageSquare className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Topic (Optional)"
            className="bg-transparent outline-none w-full text-base text-white placeholder-slate-500"
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            suppressHydrationWarning
          />
        </div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-lg bg-slate-900 border-2 border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative p-10 min-h-[500px] flex flex-col items-center justify-center">
        <WebSessionView userName={userName} userContext={userContext} />
      </div>

      <div className="mt-12 text-xs text-slate-500 flex items-center gap-2 uppercase tracking-widest">
        <Activity className="w-4 h-4" />
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
          setErrorMsg(data.narrative_summary || data.summary || "Could not analyze session.");
          setCallState("ended");
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
          className={`p-2 rounded-full transition-colors ${debugMode ? "bg-white text-black" : "bg-slate-800 text-slate-500 hover:text-slate-300"}`}
          title="Toggle Debug Mode"
        >
          <Bug className="w-4 h-4" />
        </button>
      </div>

      {/* DEBUG PANEL */}
      {debugMode && (
        <div className="w-full max-w-lg mb-6 p-4 bg-black border-2 border-slate-700 rounded-lg text-xs font-mono space-y-2 absolute top-0 left-0 z-40">
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
            <span className="text-white font-bold">{callState}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Agent Speaking:</span>
            <span className={isAgentSpeaking ? "text-green-400 font-bold" : "text-slate-500"}>{isAgentSpeaking ? "YES" : "NO"}</span>
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
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full"
          key="summary"
        >
          {errorMsg ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Analysis Failed</h3>
              <p className="text-slate-400 text-sm mb-8 leading-relaxed max-w-md mx-auto">{errorMsg}</p>
              <button
                onClick={() => handleGenerateSummary()}
                className="px-8 py-3 bg-white text-black hover:bg-slate-200 rounded-full text-sm font-bold transition-colors flex items-center gap-2 mx-auto shadow-lg"
              >
                <RefreshCw className="w-4 h-4" /> Retry Analysis
              </button>
              <button
                onClick={() => {
                  setCallState("idle");
                  setSummary(null);
                  setErrorMsg(null);
                }}
                className="mt-8 text-sm text-slate-400 hover:text-white uppercase tracking-widest transition-colors"
              >
                Start New Session
              </button>
            </div>
          ) : summary ? (
            <div className="bg-slate-800/50 rounded-2xl p-8 border-2 border-slate-700">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3 text-slate-300">
                  <FileText className="w-5 h-5" />
                  <h3 className="font-bold tracking-widest uppercase text-sm">Session Analysis</h3>
                </div>
                <span className="text-xs text-slate-500">{new Date().toLocaleDateString()}</span>
              </div>

              {/* SAFETY ALERT */}
              {getSummaryArray("safety_resources_provided", "safetyResources").length > 0 && (
                <div className="mb-8 bg-red-500/10 border-2 border-red-500/30 rounded-xl p-5 flex items-start gap-4">
                  <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 mt-1" />
                  <div>
                    <h4 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-2">Safety Resources Provided</h4>
                    <ul className="space-y-2">
                      {getSummaryArray("safety_resources_provided", "safetyResources").map((res, i) => (
                        <li key={i} className="text-sm text-red-300 leading-relaxed">• {res}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="space-y-8 text-base">
                <div>
                  <span className="text-slate-500 text-xs uppercase tracking-widest font-bold block mb-3">Emotional State</span>
                  <p className="text-white text-2xl font-medium">
                    {getSummaryProp("emotional_state", "emotionalState") as string}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 text-xs uppercase tracking-widest font-bold block mb-3">Summary</span>
                  <p className="leading-relaxed text-slate-300 text-sm">
                    {getSummaryProp("narrative_summary", "summary") as string}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <span className="text-slate-500 text-xs uppercase tracking-widest font-bold block mb-3">Topics</span>
                    <div className="flex flex-wrap gap-2">
                      {getSummaryArray("key_topics", "topics").map((t, i) => (
                        <span key={i} className="px-4 py-2 bg-slate-700 text-white rounded-full text-sm border-2 border-slate-600">{t}</span>
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
                className="w-full mt-10 py-4 bg-white text-black hover:bg-slate-200 rounded-xl text-sm font-bold uppercase tracking-widest transition-colors shadow-lg"
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
            <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="space-y-2">
            <p className="text-white font-medium text-base animate-pulse">Generating insights...</p>
            <p className="text-slate-400 text-sm">This may take a moment</p>
          </div>
        </div>
      )}

      {/* 3. ACTIVE CALL (ORB) */}
      {(callState === "active" || callState === "connecting") && (
        <>
          <div className="relative w-64 h-64 flex items-center justify-center mb-10">
            {callState === "active" && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.1, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-white blur-[100px]"
                />
              </>
            )}

            {/* Core Orb */}
            <div className={`relative z-10 w-40 h-40 rounded-full flex items-center justify-center transition-all duration-700
                ${callState === "active"
                ? "bg-white shadow-[0_0_60px_rgba(255,255,255,0.3)]"
                : "bg-slate-800 border-4 border-slate-700"}
                `}>
              {callState === "connecting" ? (
                <Wifi className="w-10 h-10 text-slate-500 animate-pulse" />
              ) : (
                <motion.div
                  animate={{ scale: isAgentSpeaking ? [1, 1.15, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Mic className={`w-10 h-10 ${callState === 'active' ? 'text-black' : 'text-slate-400'}`} />
                </motion.div>
              )}
            </div>

            {/* Ripple Rings */}
            {callState === "active" && isAgentSpeaking && (
              <>
                <motion.div
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.6 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  className="absolute w-40 h-40 rounded-full border-2 border-white/20"
                />
              </>
            )}
          </div>

          <div className="h-10 mb-10 text-center">
            {callState === "connecting" && <span className="text-slate-400 text-sm uppercase tracking-widest animate-pulse font-medium">Connecting...</span>}
            {callState === "active" && (
              isAgentSpeaking ?
                <span className="text-white text-base uppercase tracking-widest font-bold">Serenity is speaking</span> :
                <span className="text-slate-400 text-sm uppercase tracking-widest">Listening</span>
            )}
          </div>

          <button
            onClick={handleStop}
            className="group relative px-10 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full transition-all flex items-center gap-3 border-2 border-red-500/30 hover:border-red-500/50 shadow-lg"
          >
            <Square className="w-4 h-4 fill-current" />
            <span className="font-bold text-sm uppercase tracking-widest">End Session</span>
          </button>
        </>
      )}

      {/* 4. IDLE (START) */}
      {callState === "idle" && (
        <div className="text-center">
          <div className="w-full flex flex-col items-center justify-center mb-12 text-slate-400 space-y-3">
            <p className="text-base font-light text-slate-400">Ready to begin?</p>
          </div>
          <button
            onClick={handleStart}
            className="group relative px-12 py-5 bg-white text-black hover:bg-slate-200 rounded-full font-bold text-base transition-all flex items-center gap-4 shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)] mx-auto"
          >
            <Mic className="w-5 h-5" />
            <span className="tracking-widest uppercase">Start Session</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}
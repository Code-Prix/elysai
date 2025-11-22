/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import { api } from "~/trpc/react";
import { motion } from "framer-motion";
import { Mic, Square, Wifi, FileText, AlertTriangle, CheckSquare, Sparkles } from "lucide-react";
import { VoiceVisualizer } from "./VoiceVisualizer";

type CallState = "idle" | "connecting" | "active" | "summarizing" | "ended";

interface Task {
    id: string;
    description: string;
    isCompleted: boolean;
}

interface SessionSummary {
    emotional_state?: string;
    emotionalState?: string;
    key_topics?: string[];
    topics?: string[];
    risk_flags?: string[];
    riskFlags?: string[];
    narrative_summary?: string;
    summary?: string;
    generatedTasks?: Task[];
}

export function TherapySession() {
    const [userName, setUserName] = useState("");
    const [userContext, setUserContext] = useState("");

    return (
        <div className="min-h-screen flex flex-col relative">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px]" />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
                <div className="w-full max-w-4xl">
                    <WebSessionView userName={userName} userContext={userContext} />
                </div>
            </div>

            {/* Bottom Input Area */}
            <div className="border-t border-white/5 bg-black/20 backdrop-blur-md relative z-20">
                <div className="max-w-3xl mx-auto p-6">
                    <div className="text-center">
                        <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            Powered by ElysAI
                        </p>
                    </div>
                </div>
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
        } catch (err: any) {
            console.error("Connection Failed:", err);
            setCallState("idle");
            setErrorMsg(err.message || "Failed to start session.");
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
                const data = await summaryMutation.mutateAsync({ callId });

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

    const getSummaryProp = (prop: keyof SessionSummary, altProp: keyof SessionSummary): string => {
        if (!summary) return "";
        const val = summary[prop] || summary[altProp];
        if (typeof val === "string") return val;
        return "N/A";
    };

    const getSummaryArray = (prop: keyof SessionSummary, altProp: keyof SessionSummary): string[] => {
        if (!summary) return [];
        const val = summary[prop] || summary[altProp];
        return Array.isArray(val) ? val as string[] : [];
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center w-full"
            suppressHydrationWarning
        >
            {/* ERROR MESSAGE */}
            {errorMsg && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm backdrop-blur-md">
                    {errorMsg}
                </div>
            )}

            {/* 1. SUMMARY VIEW */}
            {callState === "ended" && summary && (
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full glass-card rounded-3xl p-8 border border-white/10"
                >
                    <div className="flex items-center gap-3 mb-6 text-indigo-400">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <FileText className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-xl text-white">Session Analysis</h3>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                            <span className="text-indigo-300 text-xs uppercase tracking-wider font-bold block mb-3">Emotional State</span>
                            <p className="text-white text-lg font-medium">
                                {getSummaryProp("emotional_state", "emotionalState")}
                            </p>
                        </div>

                        <div>
                            <span className="text-slate-400 text-xs uppercase tracking-wider font-bold block mb-3">Summary</span>
                            <p className="text-slate-300 leading-relaxed text-lg">
                                {getSummaryProp("narrative_summary", "summary")}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <span className="text-slate-400 text-xs uppercase tracking-wider font-bold block mb-3">Topics</span>
                                <div className="flex flex-wrap gap-2">
                                    {getSummaryArray("key_topics", "topics").map((t, i) => (
                                        <span key={i} className="px-4 py-2 bg-white/5 rounded-full text-sm text-slate-200 border border-white/5">{t}</span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-red-400 text-xs uppercase tracking-wider font-bold flex items-center gap-2 mb-3">
                                    <AlertTriangle className="w-4 h-4" /> Risks
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {getSummaryArray("risk_flags", "riskFlags").map((t, i) => (
                                        <span key={i} className="px-4 py-2 bg-red-500/10 text-red-200 rounded-full text-sm border border-red-500/20">{t}</span>
                                    ))}
                                    {getSummaryArray("risk_flags", "riskFlags").length === 0 && (
                                        <span className="px-4 py-2 bg-white/5 text-slate-400 rounded-full text-sm">None detected</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* GENERATED TASKS */}
                        {summary.generatedTasks && summary.generatedTasks.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-white/10">
                                <div className="flex items-center gap-2 mb-4 text-indigo-400">
                                    <CheckSquare className="w-5 h-5" />
                                    <span className="text-xs uppercase tracking-wider font-bold">Next Day Tasks</span>
                                </div>
                                <ul className="space-y-3">
                                    {summary.generatedTasks.map((task, i) => (
                                        <li key={i} className="flex items-start gap-4 bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                                            <div className="mt-1 w-5 h-5 rounded border-2 border-indigo-500/50 flex-shrink-0" />
                                            <span className="text-slate-200">{task.description}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            setCallState("idle");
                            setSummary(null);
                            setErrorMsg(null);
                        }}
                        className="w-full mt-8 btn-primary text-white font-semibold py-4 rounded-xl shadow-lg shadow-indigo-500/20"
                    >
                        Start New Session
                    </button>
                </motion.div>
            )}

            {/* 2. LOADING SUMMARY */}
            {callState === "summarizing" && (
                <div className="text-center py-16 space-y-6">
                    <div className="relative w-20 h-20 mx-auto">
                        <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full" />
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-indigo-400 font-medium text-lg animate-pulse">Generating insights...</p>
                        <p className="text-sm text-slate-500">Analyzing your session with care</p>
                    </div>
                </div>
            )}

            {/* 3. ACTIVE CALL (VISUALIZER) */}
            {(callState === "active" || callState === "connecting") && (
                <div className="w-full max-w-3xl mx-auto">
                    <div className="glass-card rounded-3xl p-8 border border-white/10 mb-8 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />

                        <div className="w-full mb-8 relative z-10">
                            <VoiceVisualizer
                                isActive={callState === "active"}
                                isAgentSpeaking={isAgentSpeaking}
                            />
                        </div>

                        <div className="h-8 mb-8 text-center relative z-10">
                            {callState === "connecting" && <span className="text-indigo-400 animate-pulse font-medium tracking-wide">Connecting to Serenity...</span>}
                            {callState === "active" && (
                                isAgentSpeaking ?
                                    <span className="text-indigo-400 font-medium tracking-wide">Serenity is speaking...</span> :
                                    <span className="text-slate-400 tracking-wide">Listening to you...</span>
                            )}
                        </div>

                        <div className="flex justify-center relative z-10">
                            <button
                                onClick={handleStop}
                                className="px-10 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all flex items-center gap-3 border border-red-500/20 hover:border-red-500/40 group"
                            >
                                <Square className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                                <span className="font-semibold">End Session</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. IDLE (START) */}
            {callState === "idle" && (
                <div className="text-center py-12 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                    <h1 className="text-5xl md:text-6xl font-bold mb-6 text-white tracking-tight relative z-10">
                        How are you <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">feeling</span>?
                    </h1>
                    <p className="text-slate-400 text-lg mb-12 max-w-xl mx-auto relative z-10">
                        Take a moment for yourself. Serenity is here to listen, understand, and guide you through your thoughts.
                    </p>

                    <button
                        onClick={handleStart}
                        className="btn-primary px-12 py-5 text-white rounded-2xl font-semibold text-xl transition-all flex items-center gap-4 shadow-2xl shadow-indigo-500/30 mx-auto group relative z-10"
                    >
                        <Mic className="w-7 h-7 group-hover:scale-110 transition-transform" />
                        <span>Start Session</span>
                    </button>

                    <p className="text-sm text-slate-500 mt-8 flex items-center justify-center gap-2 relative z-10">
                        <Wifi className="w-4 h-4" />
                        Headphones recommended for best experience
                    </p>
                </div>
            )}
        </motion.div>
    );
}
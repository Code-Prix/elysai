/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import { api } from "~/trpc/react";
import { motion } from "framer-motion";
import { Mic, Square, Wifi, FileText, AlertTriangle, CheckSquare } from "lucide-react";
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
        <div className="min-h-screen bg-[#343541] text-[#ECECF1] flex flex-col">
            {/* Main Content Area - Centered like ChatGPT */}
            <div className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-3xl">
                    <WebSessionView userName={userName} userContext={userContext} />
                </div>
            </div>

            {/* Bottom Input Area - ChatGPT Style */}
            <div className="border-t border-[#565869] bg-[#343541]">
                <div className="max-w-3xl mx-auto p-4">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="Your Name"
                            className="flex-1 bg-[#40414F] border border-[#565869] rounded-lg px-4 py-3 text-[#ECECF1] placeholder-[#8E8EA0] focus:outline-none focus:border-[#10A37F] transition-colors"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            suppressHydrationWarning
                        />
                        <input
                            type="text"
                            placeholder="Topic (Optional)"
                            className="flex-1 bg-[#40414F] border border-[#565869] rounded-lg px-4 py-3 text-[#ECECF1] placeholder-[#8E8EA0] focus:outline-none focus:border-[#10A37F] transition-colors"
                            value={userContext}
                            onChange={(e) => setUserContext(e.target.value)}
                            suppressHydrationWarning
                        />
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
                <div className="mb-4 p-4 bg-red-900/20 border border-red-800/50 rounded-lg text-red-200 text-sm">
                    {errorMsg}
                </div>
            )}

            {/* 1. SUMMARY VIEW */}
            {callState === "ended" && summary && (
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full bg-[#444654] rounded-lg p-6 border border-[#565869]"
                >
                    <div className="flex items-center gap-2 mb-4 text-[#10A37F]">
                        <FileText className="w-5 h-5" />
                        <h3 className="font-semibold text-lg">Session Analysis</h3>
                    </div>

                    <div className="space-y-4 text-sm">
                        <div>
                            <span className="text-[#8E8EA0] text-xs uppercase tracking-wider font-bold block mb-2">Emotional State</span>
                            <p className="text-[#ECECF1] text-base font-medium">
                                {getSummaryProp("emotional_state", "emotionalState")}
                            </p>
                        </div>

                        <div>
                            <span className="text-[#8E8EA0] text-xs uppercase tracking-wider font-bold block mb-2">Summary</span>
                            <p className="text-[#C5C5D2] leading-relaxed">
                                {getSummaryProp("narrative_summary", "summary")}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-[#8E8EA0] text-xs uppercase tracking-wider font-bold block mb-2">Topics</span>
                                <div className="flex flex-wrap gap-2">
                                    {getSummaryArray("key_topics", "topics").map((t, i) => (
                                        <span key={i} className="px-3 py-1 bg-[#565869] rounded-full text-xs text-[#ECECF1]">{t}</span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-red-400 text-xs uppercase tracking-wider font-bold flex items-center gap-1 mb-2">
                                    <AlertTriangle className="w-3 h-3" /> Risks
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {getSummaryArray("risk_flags", "riskFlags").map((t, i) => (
                                        <span key={i} className="px-3 py-1 bg-red-900/30 text-red-300 rounded-full text-xs border border-red-800/50">{t}</span>
                                    ))}
                                    {getSummaryArray("risk_flags", "riskFlags").length === 0 && (
                                        <span className="px-3 py-1 bg-[#565869]/50 text-[#8E8EA0] rounded-full text-xs">None detected</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* GENERATED TASKS */}
                        {summary.generatedTasks && summary.generatedTasks.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-[#565869]">
                                <div className="flex items-center gap-2 mb-3 text-[#10A37F]">
                                    <CheckSquare className="w-4 h-4" />
                                    <span className="text-xs uppercase tracking-wider font-bold">Next Day Tasks</span>
                                </div>
                                <ul className="space-y-2">
                                    {summary.generatedTasks.map((task, i) => (
                                        <li key={i} className="flex items-start gap-3 bg-[#343541] p-3 rounded-lg border border-[#565869]">
                                            <div className="mt-0.5 w-4 h-4 rounded border-2 border-[#10A37F] flex-shrink-0" />
                                            <span className="text-[#C5C5D2]">{task.description}</span>
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
                        className="w-full mt-6 py-3 bg-[#10A37F] hover:bg-[#19C37D] rounded-lg text-sm font-medium transition-colors text-white"
                    >
                        Start New Session
                    </button>
                </motion.div>
            )}

            {/* 2. LOADING SUMMARY */}
            {callState === "summarizing" && (
                <div className="text-center py-12 space-y-4">
                    <div className="w-10 h-10 border-3 border-[#10A37F] border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[#10A37F] animate-pulse font-medium">Generating insights...</p>
                    <p className="text-xs text-[#8E8EA0]">This may take a moment...</p>
                </div>
            )}

            {/* 3. ACTIVE CALL (VISUALIZER) */}
            {(callState === "active" || callState === "connecting") && (
                <>
                    <div className="w-full mb-8">
                        <VoiceVisualizer
                            isActive={callState === "active"}
                            isAgentSpeaking={isAgentSpeaking}
                        />
                    </div>

                    <div className="h-8 mb-8 text-center">
                        {callState === "connecting" && <span className="text-[#10A37F] animate-pulse font-medium">Connecting to Serenity...</span>}
                        {callState === "active" && (
                            isAgentSpeaking ?
                                <span className="text-[#10A37F] font-medium">Serenity is speaking...</span> :
                                <span className="text-[#8E8EA0]">Listening to you...</span>
                        )}
                    </div>

                    <button
                        onClick={handleStop}
                        className="px-8 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all flex items-center gap-3 border border-red-500/50"
                    >
                        <Square className="w-5 h-5 fill-current" />
                        <span className="font-semibold">End Session</span>
                    </button>
                </>
            )}

            {/* 4. IDLE (START) */}
            {callState === "idle" && (
                <div className="text-center py-8">
                    <h1 className="text-4xl font-light mb-2 text-[#ECECF1]">
                        How are you <span className="text-[#10A37F] font-normal">feeling</span>?
                    </h1>
                    <p className="text-[#8E8EA0] mb-8">Ready to begin your session?</p>
                    <button
                        onClick={handleStart}
                        className="px-10 py-4 bg-[#10A37F] hover:bg-[#19C37D] text-white rounded-lg font-semibold text-lg transition-all flex items-center gap-3 shadow-lg mx-auto"
                    >
                        <Mic className="w-6 h-6" />
                        <span>Start Session</span>
                    </button>
                    <p className="text-xs text-[#8E8EA0] mt-4">Headphones recommended for best experience</p>
                </div>
            )}
        </motion.div>
    );
}
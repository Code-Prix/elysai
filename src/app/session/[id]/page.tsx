"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { ArrowLeft, Calendar, MessageSquare, AlertTriangle, CheckSquare, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function SessionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const sessionId = params.id as string;

    const { data: session, isLoading, error } = api.therapy.getSessionById.useQuery({ sessionId });

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-6">
                    <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full" />
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-indigo-400 animate-pulse font-medium">Loading session details...</p>
                </div>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-6 max-w-md mx-auto p-6 glass-card rounded-3xl">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white">Session Not Found</h2>
                    <p className="text-slate-400">The session you're looking for could not be loaded or doesn't exist.</p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white transition-all shadow-lg shadow-indigo-900/20 mt-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString("en-US", {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen flex flex-col items-center p-6 relative">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-4xl space-y-8 relative z-10"
            >
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span>Back to New Session</span>
                    </Link>
                    <div className="flex items-center gap-2 text-indigo-400 text-sm bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-500/20">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(session.startedAt)}</span>
                    </div>
                </div>

                {/* Main Content */}
                <div className="space-y-8">
                    {/* Emotional State */}
                    <div className="glass-card rounded-3xl p-8 border border-white/10">
                        <div className="flex items-center gap-3 mb-6 text-indigo-400">
                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <h2 className="font-bold text-xl text-white">Emotional Analysis</h2>
                        </div>
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                <span className="text-indigo-300 text-xs uppercase tracking-wider font-bold block mb-3">State</span>
                                <div className="flex items-center gap-3">
                                    <Sparkles className="w-5 h-5 text-indigo-400" />
                                    <p className="text-white text-2xl font-medium">{session.emotionalState || "Neutral"}</p>
                                </div>
                            </div>
                            <div>
                                <span className="text-slate-400 text-xs uppercase tracking-wider font-bold block mb-3">Topics</span>
                                <div className="flex flex-wrap gap-2">
                                    {session.topics?.map((topic: string, i: number) => (
                                        <span key={i} className="px-4 py-2 bg-white/5 rounded-full text-sm text-slate-200 border border-white/5 hover:bg-white/10 transition-colors">
                                            {topic}
                                        </span>
                                    )) || <span className="text-slate-500 text-sm">No topics detected</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="glass-card rounded-3xl p-8 border border-white/10">
                        <div className="flex items-center gap-3 mb-6 text-indigo-400">
                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                <FileText className="w-6 h-6" />
                            </div>
                            <h2 className="font-bold text-xl text-white">Session Summary</h2>
                        </div>
                        <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-lg">
                            {session.summary || "No summary available for this session."}
                        </p>
                    </div>

                    {/* Risks */}
                    {session.riskFlags && session.riskFlags.length > 0 && (
                        <div className="bg-red-500/5 rounded-3xl p-8 border border-red-500/20 backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-6 text-red-400">
                                <div className="p-2 bg-red-500/10 rounded-lg">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <h2 className="font-bold text-xl">Risk Factors Detected</h2>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {session.riskFlags.map((flag: string, i: number) => (
                                    <span key={i} className="px-4 py-2 bg-red-500/10 text-red-200 rounded-full text-sm border border-red-500/20">
                                        {flag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tasks */}
                    {session.generatedTasks && session.generatedTasks.length > 0 && (
                        <div className="glass-card rounded-3xl p-8 border border-white/10">
                            <div className="flex items-center gap-3 mb-6 text-indigo-400">
                                <div className="p-2 bg-indigo-500/10 rounded-lg">
                                    <CheckSquare className="w-6 h-6" />
                                </div>
                                <h2 className="font-bold text-xl text-white">Generated Tasks</h2>
                            </div>
                            <ul className="space-y-3">
                                {session.generatedTasks.map((task: { id: string; description: string; isCompleted: boolean }) => (
                                    <li key={task.id} className="flex items-start gap-4 bg-white/5 p-5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                                        <div className={`mt-1 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${task.isCompleted ? "bg-indigo-500 border-indigo-500" : "border-slate-600"}`}>
                                            {task.isCompleted && <CheckSquare className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className={`text-lg ${task.isCompleted ? "line-through text-slate-500" : "text-slate-200"}`}>
                                            {task.description}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

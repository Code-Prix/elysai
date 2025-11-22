"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { ArrowLeft, Calendar, MessageSquare, AlertTriangle, CheckSquare, FileText } from "lucide-react";
import Link from "next/link";

export default function SessionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const sessionId = params.id as string;

    const { data: session, isLoading, error } = api.therapy.getSessionById.useQuery({ sessionId });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#343541] text-[#ECECF1] flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-8 h-8 border-2 border-[#10A37F] border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[#8E8EA0] text-sm">Loading session details...</p>
                </div>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="min-h-screen bg-[#343541] text-[#ECECF1] flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-red-400">Session not found or could not be loaded.</p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#10A37F] hover:bg-[#19C37D] rounded-lg text-white transition-colors"
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
        <div className="min-h-screen bg-[#343541] text-[#ECECF1] flex flex-col items-center p-6">
            <div className="w-full max-w-3xl space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#565869] pb-6">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-[#8E8EA0] hover:text-[#ECECF1] transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to New Session</span>
                    </Link>
                    <div className="flex items-center gap-2 text-[#8E8EA0] text-sm">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(session.startedAt)}</span>
                    </div>
                </div>

                {/* Main Content */}
                <div className="space-y-8">
                    {/* Emotional State */}
                    <div className="bg-[#444654] rounded-lg p-6 border border-[#565869]">
                        <div className="flex items-center gap-2 mb-4 text-[#10A37F]">
                            <MessageSquare className="w-5 h-5" />
                            <h2 className="font-semibold text-lg">Emotional Analysis</h2>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <span className="text-[#8E8EA0] text-xs uppercase tracking-wider font-bold block mb-2">State</span>
                                <p className="text-[#ECECF1] text-lg font-medium">{session.emotionalState || "Neutral"}</p>
                            </div>
                            <div>
                                <span className="text-[#8E8EA0] text-xs uppercase tracking-wider font-bold block mb-2">Topics</span>
                                <div className="flex flex-wrap gap-2">
                                    {session.topics?.map((topic: string, i: number) => (
                                        <span key={i} className="px-3 py-1 bg-[#565869] rounded-full text-xs text-[#ECECF1]">
                                            {topic}
                                        </span>
                                    )) || <span className="text-[#8E8EA0] text-sm">No topics detected</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-[#444654] rounded-lg p-6 border border-[#565869]">
                        <div className="flex items-center gap-2 mb-4 text-[#10A37F]">
                            <FileText className="w-5 h-5" />
                            <h2 className="font-semibold text-lg">Session Summary</h2>
                        </div>
                        <p className="text-[#C5C5D2] leading-relaxed whitespace-pre-wrap">
                            {session.summary || "No summary available for this session."}
                        </p>
                    </div>

                    {/* Risks */}
                    {session.riskFlags && session.riskFlags.length > 0 && (
                        <div className="bg-red-900/10 rounded-lg p-6 border border-red-900/30">
                            <div className="flex items-center gap-2 mb-4 text-red-400">
                                <AlertTriangle className="w-5 h-5" />
                                <h2 className="font-semibold text-lg">Risk Factors Detected</h2>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {session.riskFlags.map((flag: string, i: number) => (
                                    <span key={i} className="px-3 py-1 bg-red-900/30 text-red-300 rounded-full text-xs border border-red-800/50">
                                        {flag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tasks */}
                    {session.generatedTasks && session.generatedTasks.length > 0 && (
                        <div className="bg-[#444654] rounded-lg p-6 border border-[#565869]">
                            <div className="flex items-center gap-2 mb-4 text-[#10A37F]">
                                <CheckSquare className="w-5 h-5" />
                                <h2 className="font-semibold text-lg">Generated Tasks</h2>
                            </div>
                            <ul className="space-y-3">
                                {session.generatedTasks.map((task: { id: string; description: string; isCompleted: boolean }) => (
                                    <li key={task.id} className="flex items-start gap-3 bg-[#343541] p-4 rounded-lg border border-[#565869]">
                                        <div className={`mt-1 w-4 h-4 rounded border-2 flex-shrink-0 ${task.isCompleted ? "bg-[#10A37F] border-[#10A37F]" : "border-[#8E8EA0]"}`} />
                                        <span className={`text-[#ECECF1] ${task.isCompleted ? "line-through text-[#8E8EA0]" : ""}`}>
                                            {task.description}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "~/trpc/react";
import { MessageSquare, Plus, ChevronLeft, ChevronRight, LogOut, Settings, User } from "lucide-react";
import { useState } from "react";

export function Sidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const { data: sessions, isLoading } = api.therapy.getUserSessions.useQuery();

    const formatDate = (date: Date) => {
        const now = new Date();
        const sessionDate = new Date(date);
        const diffTime = Math.abs(now.getTime() - sessionDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        return sessionDate.toLocaleDateString();
    };

    const truncateText = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + "...";
    };

    return (
        <div
            className={`fixed left-0 top-0 h-full bg-[#080808] border-r border-white/5 transition-all duration-300 flex flex-col z-50 ${isCollapsed ? "w-20" : "w-72"
                }`}
        >
            {/* Header with Toggle */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                {!isCollapsed && (
                    <Link
                        href="/"
                        className="flex items-center gap-2 px-4 py-3 rounded-xl btn-primary text-white transition-all flex-1 shadow-lg shadow-indigo-900/20 group"
                    >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        <span className="font-semibold">New Session</span>
                    </Link>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors ml-2"
                >
                    {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
            </div>

            {/* Session History */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {!isCollapsed && (
                    <>
                        {isLoading ? (
                            <div className="text-slate-500 text-sm text-center py-8 animate-pulse">Loading sessions...</div>
                        ) : sessions && sessions.length > 0 ? (
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider px-3 mb-2 mt-2">Recent</p>
                                {sessions.map((session) => (
                                    <Link
                                        key={session.id}
                                        href={`/session/${session.id}`}
                                        className={`block px-4 py-3 rounded-xl transition-all group border border-transparent ${pathname === `/session/${session.id}`
                                            ? "bg-white/5 border-white/5 text-white"
                                            : "hover:bg-white/5 text-slate-400 hover:text-slate-200"
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${pathname === `/session/${session.id}` ? "text-indigo-400" : "text-slate-600 group-hover:text-slate-400"}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {session.emotionalState || "Session"}
                                                </p>
                                                <p className="text-xs opacity-60 mt-0.5">
                                                    {formatDate(session.startedAt)}
                                                </p>
                                                {session.summary && (
                                                    <p className="text-xs opacity-40 mt-1 line-clamp-2 leading-relaxed">
                                                        {truncateText(session.summary, 60)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-slate-500 text-sm text-center py-12">
                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <MessageSquare className="w-6 h-6 opacity-40" />
                                </div>
                                <p>No sessions yet</p>
                                <p className="text-xs mt-1 opacity-60">Start your journey today</p>
                            </div>
                        )}
                    </>
                )}

                {isCollapsed && sessions && sessions.length > 0 && (
                    <div className="space-y-2 mt-2">
                        {sessions.slice(0, 5).map((session) => (
                            <Link
                                key={session.id}
                                href={`/session/${session.id}`}
                                className={`block p-3 rounded-xl transition-colors flex justify-center ${pathname === `/session/${session.id}` ? "bg-white/5 text-indigo-400" : "hover:bg-white/5 text-slate-500 hover:text-slate-300"}`}
                                title={session.emotionalState || "Session"}
                            >
                                <MessageSquare className="w-5 h-5" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer - User & Sign Out */}
            <div className="p-4 border-t border-white/5 space-y-1">
                {!isCollapsed && (
                    <Link href="/profile" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                        <User className="w-4 h-4" />
                        <span className="text-sm">Profile</span>
                    </Link>
                )}

                <button
                    onClick={() => signOut()}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors ${isCollapsed ? "justify-center" : ""
                        }`}
                >
                    <LogOut className="w-4 h-4" />
                    {!isCollapsed && <span className="text-sm">Sign Out</span>}
                </button>
            </div>
        </div>
    );
}

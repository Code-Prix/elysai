"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "~/trpc/react";
import { MessageSquare, Plus, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
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
            className={`fixed left-0 top-0 h-full bg-[#202123] border-r border-[#565869] transition-all duration-300 flex flex-col ${isCollapsed ? "w-16" : "w-64"
                }`}
        >
            {/* Header with Toggle */}
            <div className="p-3 border-b border-[#565869] flex items-center justify-between">
                {!isCollapsed && (
                    <Link
                        href="/"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#10A37F] hover:bg-[#19C37D] text-white transition-colors flex-1"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-semibold">New Session</span>
                    </Link>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 rounded-lg hover:bg-[#2A2B32] text-[#C5C5D2] transition-colors"
                >
                    {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
            </div>

            {/* Session History */}
            <div className="flex-1 overflow-y-auto p-2">
                {!isCollapsed && (
                    <>
                        {isLoading ? (
                            <div className="text-[#C5C5D2] text-sm text-center py-4">Loading sessions...</div>
                        ) : sessions && sessions.length > 0 ? (
                            <div className="space-y-1">
                                {sessions.map((session) => (
                                    <Link
                                        key={session.id}
                                        href={`/session/${session.id}`}
                                        className={`block px-3 py-3 rounded-lg hover:bg-[#2A2B32] transition-colors group ${pathname === `/session/${session.id}` ? "bg-[#2A2B32]" : ""
                                            }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <MessageSquare className="w-4 h-4 text-[#C5C5D2] mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[#ECECF1] text-sm font-medium truncate">
                                                    {session.emotionalState || "Session"}
                                                </p>
                                                <p className="text-[#C5C5D2] text-xs mt-0.5">
                                                    {formatDate(session.startedAt)}
                                                </p>
                                                {session.summary && (
                                                    <p className="text-[#8E8EA0] text-xs mt-1 line-clamp-2">
                                                        {truncateText(session.summary, 60)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-[#8E8EA0] text-sm text-center py-8">
                                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No sessions yet</p>
                                <p className="text-xs mt-1">Start your first session!</p>
                            </div>
                        )}
                    </>
                )}

                {isCollapsed && sessions && sessions.length > 0 && (
                    <div className="space-y-2">
                        {sessions.slice(0, 5).map((session) => (
                            <Link
                                key={session.id}
                                href={`/session/${session.id}`}
                                className="block p-2 rounded-lg hover:bg-[#2A2B32] transition-colors"
                                title={session.emotionalState || "Session"}
                            >
                                <MessageSquare className="w-5 h-5 text-[#C5C5D2] mx-auto" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer - Sign Out */}
            <div className="p-3 border-t border-[#565869]">
                <button
                    onClick={() => signOut()}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#2A2B32] text-[#C5C5D2] hover:text-[#ECECF1] transition-colors ${isCollapsed ? "justify-center" : ""
                        }`}
                >
                    <LogOut className="w-5 h-5" />
                    {!isCollapsed && <span>Sign Out</span>}
                </button>
            </div>
        </div>
    );
}

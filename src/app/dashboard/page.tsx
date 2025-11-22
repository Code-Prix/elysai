// app/dashboard/page.tsx
import Link from "next/link";
import { auth, signOut } from "auth";
import { TherapySession } from "../_components/TherapySession";
import { prisma as db } from "~/server/db";
import { Clock, Calendar, MessageSquare, AlertTriangle } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();

  // Fetch history if logged in
  const history = session?.user?.id ? await db.therapySession.findMany({
    where: { userId: session.user.id },
    orderBy: { startedAt: 'desc' },
    take: 5
  }) : [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 pb-20">
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-bold text-xl">S</span>
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Serenity AI</h1>
            <p className="text-xs text-slate-500">Your Personal Companion</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {session?.user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400 hidden md:block">
                Welcome, <span className="text-white font-medium">{session.user.name}</span>
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </div>
          ) : (
            <Link href="/api/auth/signin" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full max-w-6xl mx-auto px-4">

        {/* Active Session Area */}
        <div className="mb-16">
          <TherapySession />
        </div>

        {/* History Section */}
        {session?.user && history.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-6 px-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-light text-white">Recent <span className="font-normal text-indigo-400">Insights</span></h2>
            </div>

            <div className="grid gap-4">
              {history.map((session) => (
                <div key={session.id} className="group bg-slate-900/50 hover:bg-slate-900/80 border border-white/5 hover:border-indigo-500/30 rounded-2xl p-6 transition-all duration-300">
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    {/* Meta */}
                    <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-1 min-w-[120px]">
                      <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <Calendar className="w-3 h-3" />
                        <span>{session.startedAt.toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {session.startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className={`mt-2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider inline-block
                                        ${session.emotionalState === 'Happy' ? 'bg-green-500/10 text-green-400' :
                          session.emotionalState === 'Sad' ? 'bg-blue-500/10 text-blue-400' :
                            session.emotionalState === 'Anxious' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-slate-700/30 text-slate-400'}`}>
                        {session.emotionalState ?? "Unknown"}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-3">
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {session.summary ?? "No summary available for this session."}
                      </p>

                      {/* Topics */}
                      {session.topics.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {session.topics.map((topic, i) => (
                            <span key={i} className="flex items-center gap-1 text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-full border border-indigo-500/10">
                              <MessageSquare className="w-3 h-3" /> {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Risks (if any) */}
                    {session.riskFlags.length > 0 && (
                      <div className="md:w-48 bg-red-500/5 border border-red-500/10 rounded-xl p-3">
                        <div className="flex items-center gap-2 text-red-400 mb-2">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Risk Factors</span>
                        </div>
                        <ul className="space-y-1">
                          {session.riskFlags.map((flag, i) => (
                            <li key={i} className="text-xs text-red-300/80 leading-tight">• {flag}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!session?.user && (
          <div className="text-center mt-12 p-8 bg-indigo-900/20 border border-indigo-500/20 rounded-3xl max-w-2xl mx-auto">
            <h3 className="text-lg font-medium text-indigo-300 mb-2">Save Your Journey</h3>
            <p className="text-slate-400 text-sm mb-6">Sign in to keep a private journal of your sessions and track your emotional well-being over time.</p>
            <Link href="/api/auth/signin" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-colors">
              Create Free Account
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

// app/dashboard/page.tsx
import Link from "next/link";
import { auth, signOut } from "auth";
import { TherapySession } from "../_components/TherapySession";

export default async function DashboardPage() {
  const session = await auth();
  console.log("SESSION ON DASHBOARD:", session);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div>
        <h1 className="text-2xl font-bold mb-4">
          Hello, {session?.user?.name ?? "Guest"}!
        </h1>
        {session?.user?.email && (
          <p className="text-sm mb-8">Email: {session.user.email}</p>
        )}
        {!session?.user && (
          <p className="text-sm mb-8 text-slate-500">You are using Serenity in Guest Mode.</p>
        )}

        <TherapySession />

        {session?.user ? (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
            className="mt-8 text-center"
          >
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          </form>
        ) : (
          <div className="mt-8 text-center">
            <Link href="/api/auth/signin" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
              Sign In to Save Progress
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

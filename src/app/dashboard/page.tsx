// app/dashboard/page.tsx
import { auth, signOut } from "@/../auth";

export default async function Dashboard() {
  const session = await auth();
  console.log("SESSION ON DASHBOARD:", session);

  if (!session?.user) {
    return <p>Not authenticated</p>;
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div>
        <h1 className="text-2xl font-bold">
          Hello, {session.user.name ?? "User"}!
        </h1>
        <p className="text-sm">Email: {session.user.email}</p>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="mt-4"
        >
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white rounded"
          >
            Sign Out
          </button>
        </form>
      </div>
    </main>
  );
}

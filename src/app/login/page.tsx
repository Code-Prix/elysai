// app/login/page.tsx
import { signIn } from "@/../auth";
import { AuthError } from "next-auth";

export default function LoginPage() {
  async function login(formData: FormData) {
    "use server";

    const email = formData.get("email");
    const password = formData.get("password");

    if (typeof email !== "string" || typeof password !== "string") {
      console.error("Email or password missing");
      return;
    }

    try {
      await signIn("credentials", {
        redirectTo: "/dashboard",
        email,
        password,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.type === "CredentialsSignin") {
          console.error("Invalid email or password");
          return;
        }
        throw error;
      }
      throw error;
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md space-y-4">
        <form action={login} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              name="email"
              type="email"
              className="border px-3 py-2 rounded w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              name="password"
              type="password"
              className="border px-3 py-2 rounded w-full"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded"
          >
            Log in
          </button>
        </form>

        {/* Google Login */}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="w-full bg-red-600 text-white py-2 rounded"
          >
            Sign in with Google 🚀
          </button>
        </form>
      </div>
    </main>
  );
}

// app/login/page.tsx
import { signIn } from "@/../auth";
import { AuthError } from "next-auth";
import { Heart, Sparkles } from "lucide-react";

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
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-[float_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] animate-[float_10s_ease-in-out_infinite_reverse]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="glass-card p-8 rounded-3xl shadow-2xl backdrop-blur-xl border border-white/10">
          <div className="text-center space-y-2 mb-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-50 rounded-full animate-pulse" />
                <Heart className="w-10 h-10 text-indigo-400 relative z-10 fill-indigo-400/20" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Welcome Back</h1>
            <p className="text-slate-400">Sign in to continue your journey</p>
          </div>

          <form action={login} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300 ml-1">Email</label>
              <input
                name="email"
                type="email"
                className="w-full input-premium rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300 ml-1">Password</label>
              <input
                name="password"
                type="password"
                className="w-full input-premium rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="w-full btn-primary text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 mt-2"
            >
              Log in
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-[#05050A] px-3 text-slate-500">Or continue with</span>
            </div>
          </div>

          {/* Google Login */}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="w-full bg-white text-slate-900 hover:bg-slate-100 font-medium py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 group"
            >
              <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>
          </form>
        </div>

        <div className="text-center mt-8 text-slate-500 text-sm">
          <p className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Powered by ElysAI
          </p>
        </div>
      </div>
    </main>
  );
}

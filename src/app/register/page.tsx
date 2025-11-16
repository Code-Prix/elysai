// src/app/register/page.tsx
"use client";

import React from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onSubmit",
  });

  async function onSubmit(data: RegisterInput) {
    console.log("✅ onSubmit called with:", data);
    alert("Submitting…");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      console.log("Response status:", res.status);

      if (res.ok) {
        alert("Registered! Redirecting to login…");
        router.push("/login");
      } else {
        const json = await res.json().catch(() => null);
        console.error("Register error response:", json);
        alert(json?.error || "Failed to register");
      }
    } catch (err) {
      console.error("Register request error:", err);
      alert("An error occurred");
    }
  }

  function onError(formErrors: FieldErrors<RegisterInput>) {
    console.log("❌ Validation errors:", formErrors);
    alert("Please fix the highlighted errors");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-md shadow">
        <h1 className="text-2xl font-semibold mb-4">Register</h1>

        <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              {...register("name")}
              className="w-full border px-3 py-2 rounded"
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">
                {errors.name.message as string}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              {...register("email")}
              className="w-full border px-3 py-2 rounded"
            />
            {errors.email && (
              <p className="text-sm text-red-600 mt-1">
                {errors.email.message as string}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              {...register("password")}
              className="w-full border px-3 py-2 rounded"
            />
            {errors.password && (
              <p className="text-sm text-red-600 mt-1">
                {errors.password.message as string}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        {/* Debug block – you can remove later */}
        <pre className="mt-4 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
          {JSON.stringify(errors, null, 2)}
        </pre>

        <div className="mt-4 text-sm text-center">
          Already have an account?{" "}
          <a href="/login" className="text-indigo-600">
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}

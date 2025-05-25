"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import { LogIn, Mail, LockKeyhole, ArrowRight } from "lucide-react";

export default function SigninPage() {
  const router = useRouter();
  const { login: setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const data = await login(email, password);
      if (data.token) {
        setAuth(data.token, data.user.email, data.user.id);
        router.push("/home");
      }
    } catch (err) {
      console.error(err);
      setError("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 relative">
      {/* Ambient circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md p-8 rounded-2xl shadow-2xl backdrop-blur-xl border border-zinc-700/50 bg-zinc-800/40 hover:shadow-sky-500/10 transition-all duration-500">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-xl blur-xl opacity-30 -z-10"></div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white text-center mb-2">
          Welcome Back
        </h1>
        <p className="text-zinc-400 text-center mb-6">
          Sign in to access your account
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <form onSubmit={handleSignin} className="space-y-5">
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
            <input
              type="email"
              placeholder="Email address"
              className="w-full pl-11 p-3.5 bg-zinc-800/80 text-white rounded-xl border border-zinc-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none transition-all duration-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div className="relative">
            <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
            <input
              type="password"
              placeholder="Password"
              className="w-full pl-11 p-3.5 bg-zinc-800/80 text-white rounded-xl border border-zinc-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none transition-all duration-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white p-3.5 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 hover:shadow-lg hover:shadow-sky-500/10 transform hover:-translate-y-0.5 active:translate-y-0 ${
              isLoading ? "opacity-80 cursor-not-allowed" : ""
            }`}
          >
            <span className="font-medium">Sign in</span>
            {isLoading ? (
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <ArrowRight className="w-5 h-5" />
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-zinc-400">
            Don&apos;t have an account?{" "}
            <span
              className="text-sky-500 hover:text-sky-400 font-medium transition-colors cursor-pointer"
              onClick={() => router.push("/auth/signup")}
            >
              Create account
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { signup } from "../../lib/api";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      await signup(email, password);
      router.push("/home");
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-customGray">
      {/* Outer Container */}
      <div className="relative w-full max-w-md p-8 rounded-xl shadow-2xl bg-opacity-80 bg-[#1e1f26] backdrop-blur-lg border border-gray-700">
        {/* Glowing Border Effect */}
        <div className=" rounded-xl"></div>

        <h1 className="text-3xl font-bold text-white text-center mb-6">Create an Account</h1>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        
        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 bg-[#2a2b33] text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-300"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 bg-[#2a2b33] text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-300"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 rounded-lg transition-all duration-300 shadow-lg hover:shadow-black/50 font-semibold"
          >
            Sign Up
          </button>
        </form>

        <p className="text-gray-400 text-center mt-4">
          Already have an account?{" "}
          <span
            className="text-blue-400 cursor-pointer hover:underline transition"
            onClick={() => router.push("/auth/signin")}
          >
            Sign in
          </span>
        </p>
      </div>
    </div>
  );
}

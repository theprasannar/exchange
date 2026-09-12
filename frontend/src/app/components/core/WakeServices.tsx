"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

const API_HEALTH_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v1$/, "")}/health`
  : "http://localhost:4000/health";

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:4002";

/**
 * This app runs on free-tier hosting where each backend service spins down
 * independently after ~15 min idle. The frontend already talks to api/ws
 * directly, which wakes those two — but nothing ever hits the matching
 * engine's URL, so it can stay asleep indefinitely with no way to recover
 * on its own. This fires a wake-up ping on first load so a cold visit
 * self-heals instead of hanging.
 */
export function WakeServices() {
  useEffect(() => {
    fetch(API_HEALTH_URL).catch(() => {});
    fetch(ENGINE_URL).catch(() => {});

    toast(
      "This demo runs on free-tier hosting — first load can take up to a minute while servers wake up. Thanks for your patience!",
      { icon: "⏳", duration: 8000 }
    );
  }, []);

  return null;
}

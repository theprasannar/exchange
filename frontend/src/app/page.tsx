"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const router = useRouter();
  const { token } = useAuth();


  useEffect(() => {
    if (!token) {
      router.push("/auth/signin");
    }
  }, [token, router]);

  return (
    <div></div>
  );
}

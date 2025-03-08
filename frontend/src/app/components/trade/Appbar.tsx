"use client";

import { usePathname, useRouter } from "next/navigation";
import { PrimaryButton, SuccessButton, DangerButton } from "../core/Button";
import { useAuth } from "../../../context/AuthContext";
import Image from "next/image";

export const Appbar = () => {
  const route = usePathname();
  const router = useRouter();
  const { token, email, logout } = useAuth();
  const isAuthenticated = Boolean(token);
  const userInitial = email ? email.charAt(0).toUpperCase() : null;

  const handleLogout = () => {
    logout();
    router.push("/auth/signin");
  };


  const handleNavigation = () => {
    if (isAuthenticated) {
      router.push("/home");
    }
  };
  
  return (
    <div className="text-white border-slate-800">
      <div className="flex justify-between items-center p-2">
        <div className="flex">
          <div
             className={`text-xxl pl-4 flex justify-center items-center gap-2 text-white ${
              isAuthenticated ? "cursor-pointer" : "cursor-default"
            }`}
            onClick={handleNavigation}
          >
              <Image
              src="/images/image.webp"
              alt="BTC"
              width={30}
              height={30}
              className="rounded-full"
            />
            <p>Nexus</p>
          </div>
        </div>
        <div className="flex">
          {isAuthenticated ? (
            // Show User Initial & Logout if logged in
            <div className="relative flex items-center gap-4">
              <div className="w-7 h-7 flex items-center justify-center bg-gray-700 text-white font-bold rounded-full">
                {userInitial}
              </div>
              <DangerButton onClick={handleLogout}>Logout</DangerButton>
            </div>
          ) : (
            // Show Sign up & Sign in if not logged in
            <div className="p-2 mr-2">
              <SuccessButton onClick={() => router.push("/auth/signup")}>
                Sign up
              </SuccessButton>
              <PrimaryButton onClick={() => router.push("/auth/signin")}>
                Sign in
              </PrimaryButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

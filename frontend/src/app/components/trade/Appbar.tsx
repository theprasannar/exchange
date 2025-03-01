"use client";

import { usePathname, useRouter } from "next/navigation";
import { PrimaryButton } from "../core/Button";
import { SuccessButton } from "../core/Button";
import Image from "next/image";

export const Appbar = () => {
  const route = usePathname();
  const router = useRouter();

  return (
    <div className="text-white border-slate-800">
      <div className="flex justify-between items-center p-2">
        <div className="flex">
          <div
            className="text-xxl pl-4 flex justify-center items-center cursor-pointer gap-2 text-white"
            onClick={() => router.push("/")}
          >
            <Image
              src="/images/image.webp"
              alt="BTC"
              width={30}
              height={30}
              className="rounded-full"
            />
            <p>
            Nexus
            </p>
          </div>
          <div
            className={`text-sm pt-1 flex flex-col justify-center pl-8 cursor-pointer ${
              route.startsWith("/trade") ? "text-slate-400" : "text-slate-500"
            }`}
            onClick={() => router.push("/trade/SOL_USDC")}
          >
            Trade
          </div>
        </div>
        <div className="flex">
          <div className="p-2 mr-2">
            <SuccessButton>Sign up</SuccessButton>
            <PrimaryButton>Sign in</PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
};

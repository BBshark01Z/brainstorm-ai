"use client";

import { createContext, ReactNode, useContext, useState } from "react";
import { Activity, Fingerprint, LineChart, Bot } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { BrainprintStatus } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CreditsModal } from "./CreditsModal";

// ---------------------------------------------------------------------------
// App-wide status context.
// Brainprint verification happens on /brainprint but the top Header (visible
// on every page) needs to reflect it — a small shared context is simpler
// here than prop-drilling through every route.
// ---------------------------------------------------------------------------

const AppStatusContext = createContext<{
  brainprintStatus: BrainprintStatus;
  setBrainprintStatus: (status: BrainprintStatus) => void;
} | null>(null);

export function useAppStatus() {
  const ctx = useContext(AppStatusContext);
  if (!ctx) throw new Error("useAppStatus must be used within DashboardShell");
  return ctx;
}

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Activity },
  { href: "/brainprint", label: "Brainprint", icon: Fingerprint },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/ai-consultant", label: "AI", icon: Bot },
];

function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-base-raised/95 backdrop-blur lg:hidden"
      style={{ borderTopColor: "rgba(30, 42, 61, 0.5)" }}
    >
      {MOBILE_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              active ? "text-cyan-400" : "text-slate-500"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// Pages that don't need auth (login, register, splash)
const PUBLIC_PAGES = ["/login", "/register", "/"];

export function DashboardShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Move all hooks BEFORE any conditional returns (Rules of Hooks)
  const [brainprintStatus, setBrainprintStatus] = useState<BrainprintStatus>("idle");
  const [creditsOpen, setCreditsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060810]">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated && !PUBLIC_PAGES.includes(pathname)) {
    router.push("/login");
    return null;
  }

  // Splash page is a full-bleed, unauthenticated landing — render it outside
  // the app chrome (no Sidebar / Header / MobileTabBar / in-shell grid).
  if (pathname === "/") {
    return (
      <AppStatusContext.Provider value={{ brainprintStatus, setBrainprintStatus }}>
        <div className="relative min-h-screen bg-[#060810]">{children}</div>
      </AppStatusContext.Provider>
    );
  }
  const connection = {
    deviceName: "EEG Stream",
    connected: true,
    signalStrength: 100,
    batteryPercent: 95,
    impedanceQuality: "good" as const,
    channelImpedances: [
      { channel: "F3", kOhm: 2.1 },
      { channel: "F4", kOhm: 2.3 },
      { channel: "C3", kOhm: 1.8 },
      { channel: "C4", kOhm: 2.0 },
      { channel: "P3", kOhm: 2.5 },
      { channel: "P4", kOhm: 2.4 },
    ],
  };

  return (
    <AppStatusContext.Provider value={{ brainprintStatus, setBrainprintStatus }}>
      <div className="relative flex min-h-screen bg-[#060810]">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Header
            connection={connection}
            brainprintStatus={brainprintStatus}
            wsLabel="Streaming"
            onOpenCredits={() => setCreditsOpen(true)}
          />
          <main
            className="flex-1 overflow-y-auto p-4 pb-20 sm:p-6 lg:pb-6"
            style={{
              backgroundImage: `
                linear-gradient(rgba(30, 42, 61, 0.25) 1px, transparent 1px),
                linear-gradient(90deg, rgba(30, 42, 61, 0.25) 1px, transparent 1px)
              `,
              backgroundSize: "32px 32px",
            }}
          >
            {children}
          </main>
        </div>
        <MobileTabBar />
        <CreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
      </div>
    </AppStatusContext.Provider>
  );
}

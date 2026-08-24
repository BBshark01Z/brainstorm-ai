import type { Metadata } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import { EEGProvider } from "@/hooks/useEEGContext";
import { AuthProvider } from "@/hooks/useAuth";
import { BrainprintProvider } from "@/hooks/useBrainprintContext";
import { LanguageProvider } from "@/hooks/useLanguageContext";
import PageTransition from "@/components/layout/PageTransition";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { NeuralWaveBackground } from "@/components/ui/NeuralWaveBackground";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Brainstorm AI",
  description: "Real-time EEG monitoring, Brainprint authentication, and AI-driven brain health insights.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        suppressHydrationWarning
        className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} font-body antialiased`}
      >
        {/* Site-wide ambient neural plexus — runs behind every route, subtle by
            default, full "hero" density only on the splash page. */}
        <NeuralWaveBackground />
        <LanguageProvider>
          <AuthProvider>
            <EEGProvider>
              <BrainprintProvider>
                <PageTransition>
                  <DashboardShell>{children}</DashboardShell>
                </PageTransition>
              </BrainprintProvider>
            </EEGProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

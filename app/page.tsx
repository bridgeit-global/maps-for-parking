"use client";

import { useState } from "react";
import MapView from "./components/MapView";

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [language, setLanguage] = useState<"en" | "mr">("en");

  const copy = {
    en: {
      tagline: "Park smarter, not harder",
      headline: "Park without the penalty",
      subhead:
        "Avoid fines with real-time rules, legal zones, and smart guidance across Mumbai.",
      ctaPrimary: "Find Parking Near Me",
      ctaSecondary: "View Today's Rules",
      rulesTitle: "Know the rules",
      rulesSubtitle: "Common regulations to keep you fine-free.",
      mapTitle: "Interactive parking map",
      mapCta: "Open map →",
      mapStatus: "Colaba: High Demand",
      mapLive: "Live zone updates",
      mapLiveStamp: "Updated 2 mins ago",
      actions: [
        {
          label: "Pay Challan",
          icon: "🧾",
          href: "https://mahatrafficechallan.gov.in/payechallan/PaymentService.htm",
        },
        { label: "Settings", icon: "⚙️" },
        { label: "Support", icon: "💬" },
      ],
    },
    mr: {
      tagline: "स्मार्ट पार्किंग, कमी त्रास",
      headline: "दंड टाळा, योग्य ठिकाणी पार्क करा",
      subhead:
        "मुंबईभर नियम, कायदेशीर झोन आणि मार्गदर्शन एका ठिकाणी मिळवा.",
      ctaPrimary: "जवळची पार्किंग शोधा",
      ctaSecondary: "आजचे नियम पहा",
      rulesTitle: "नियम जाणून घ्या",
      rulesSubtitle: "सामान्य नियम जे दंडापासून वाचवतात.",
      mapTitle: "इंटरॅक्टिव्ह पार्किंग नकाशा",
      mapCta: "नकाशा उघडा →",
      mapStatus: "कोलाबा: जास्त गर्दी",
      mapLive: "थेट झोन अपडेट",
      mapLiveStamp: "२ मिनिटांपूर्वी अपडेट",
      actions: [
        {
          label: "चलान भरा",
          icon: "🧾",
          href: "https://mahatrafficechallan.gov.in/payechallan/PaymentService.htm",
        },
        { label: "सेटिंग्स", icon: "⚙️" },
        { label: "सपोर्ट", icon: "💬" },
      ],
    },
  }[language];

  return (
    <div className="min-h-screen bg-[#0b1118] text-white">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#0b1118]/95 px-4 py-3 backdrop-blur">
        <button
          className="flex size-10 items-center justify-center rounded-full bg-white/5 transition hover:bg-white/10"
          aria-label="Open menu"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <a
          href="https://bridgeit.in"
          target="_blank"
          rel="noreferrer"
          className="text-center transition hover:text-white/80"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Mumbai
          </p>
          <h1 className="text-lg font-semibold tracking-tight">
            Maps for Parking
          </h1>
        </a>
        <button
          className="text-xs font-semibold text-white/70 transition hover:text-white"
          onClick={() =>
            setLanguage((current) => (current === "en" ? "mr" : "en"))
          }
          aria-pressed={language === "mr"}
        >
          {language === "en" ? "EN / मराठी" : "मराठी / EN"}
        </button>
      </header>

      <main>
        <section id="hero" className="relative overflow-hidden">
          <div
            className={`absolute left-4 top-20 z-40 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#121c26] shadow-xl transition ${
              isMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <div className="flex flex-col gap-1 p-3 text-sm">
              <a
                href="#hero"
                className="rounded-lg px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </a>
              <a
                href="#rules"
                className="rounded-lg px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                Rules
              </a>
              <a
                href="#map"
                className="rounded-lg px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                Map Preview
              </a>
              <a
                href="#actions"
                className="rounded-lg px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                Quick Actions
              </a>
              <a
                href="/privacy"
                className="rounded-lg px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="rounded-lg px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                Terms &amp; Conditions
              </a>
              <a
                href="https://bridgeit.in"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                bridgeit.in
              </a>
            </div>
          </div>
          <div
            id="map"
            className="relative h-[calc(100vh-4rem)] min-h-[70vh] w-full"
          >
            <div className="absolute inset-0">
              <MapView
                tilesetUrl={process.env.NEXT_PUBLIC_TILESET_URL}
                tilesetId={process.env.NEXT_PUBLIC_TILESET_ID}
                mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
              />
            </div>
          </div>
        </section>

        <section id="rules" className="px-4 py-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6">
              <h3 className="text-2xl font-semibold tracking-tight">
                Parking rules & regulations
              </h3>
              <p className="mt-2 text-sm text-white/60">
                Pointers based on Mumbai Traffic Police guidelines.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                    🚫
                  </span>
                  <h4 className="text-base font-semibold">No‑Parking Zones</h4>
                </div>
                <ul className="space-y-2 text-sm text-white/70">
                  <li>Never park in marked no‑parking zones.</li>
                  <li>No parking on footpaths or zebra crossings.</li>
                  <li>Avoid areas near signals and intersections.</li>
                  <li>Do not block emergency access or narrow streets.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-300">
                    💰
                  </span>
                  <h4 className="text-base font-semibold">
                    Parking fines (2025)
                  </h4>
                </div>
                <ul className="space-y-2 text-sm text-white/70">
                  <li>First offense: ₹500.</li>
                  <li>Subsequent offenses: ₹1,500.</li>
                  <li>Two‑wheelers: ₹5,000–₹8,300.</li>
                  <li>Light motor vehicles: ₹10,000–₹15,100.</li>
                  <li>Late payment charges apply beyond 60 days.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                    ✅
                  </span>
                  <h4 className="text-base font-semibold">
                    Parking best practices
                  </h4>
                </div>
                <ul className="space-y-2 text-sm text-white/70">
                  <li>Follow road signs and markings.</li>
                  <li>Use designated lots where available.</li>
                  <li>Park parallel to the curb unless told otherwise.</li>
                  <li>Leave space for other vehicles to maneuver.</li>
                  <li>Never abandon your vehicle in public spaces.</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-full bg-[#137fec]/15 text-[#6fb1ff]">
                    📅
                  </span>
                  <h4 className="text-base font-semibold">
                    Odd‑Even parking rule
                  </h4>
                </div>
                <ul className="space-y-2 text-sm text-white/70">
                  <li>Odd dates: park on the western side.</li>
                  <li>Even dates: park on the eastern side.</li>
                  <li>Applies only in notified zones.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-full bg-purple-500/15 text-purple-300">
                    📱
                  </span>
                  <h4 className="text-base font-semibold">E‑Challan system</h4>
                </div>
                <ul className="space-y-2 text-sm text-white/70">
                  <li>AI cameras detect violations automatically.</li>
                  <li>SMS notifications are sent instantly.</li>
                  <li>Pay within 60 days to avoid extra penalties.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-full bg-slate-500/15 text-slate-200">
                    📋
                  </span>
                  <h4 className="text-base font-semibold">
                    Documents to carry
                  </h4>
                </div>
                <ul className="space-y-2 text-sm text-white/70">
                  <li>Driving license, RC, insurance.</li>
                  <li>PUC certificate (physical or digital).</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="actions" className="px-4 pb-16">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-3 md:grid-cols-3">
              {copy.actions.map((item) =>
                item.href ? (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    <span className="text-xl">{item.icon}</span>
                    {item.label}
                  </a>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    <span className="text-xl">{item.icon}</span>
                    {item.label}
                  </button>
                )
              )}
            </div>
            <div className="mt-8 text-center text-xs text-white/50">
              <div className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <a
                  href="/privacy"
                  className="text-white/60 transition hover:text-white"
                >
                  Privacy Policy
                </a>
                <span aria-hidden="true">·</span>
                <a
                  href="/terms"
                  className="text-white/60 transition hover:text-white"
                >
                  Terms &amp; Conditions
                </a>
              </div>
              © 2026 Maps for Parking. Built by{" "}
              <a
                href="https://bridgeit.in"
                target="_blank"
                rel="noreferrer"
                className="text-white/70 transition hover:text-white"
              >
                bridgeit.in
              </a>
              .
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

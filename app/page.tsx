"use client";

import Link from "next/link";
import { useState } from "react";

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
        { label: "Pay Challan", icon: "🧾" },
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
        { label: "चलान भरा", icon: "🧾" },
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
        <section className="relative overflow-hidden">
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
            id="hero"
            className="relative flex min-h-[520px] items-center justify-center bg-cover bg-center px-6 py-16 text-center"
            style={{
              backgroundImage:
                'linear-gradient(rgba(11, 17, 24, 0.6) 0%, rgba(11, 17, 24, 0.4) 50%, rgba(11, 17, 24, 1) 100%), url("https://lh3.googleusercontent.com/aida-public/AB6AXuAvtZRqdfyz2BePWsqyrOmMp2__joVSS9OCrNqO1HRTOoNxZ3Y92Z1iH2Bl0_0bKV0M2rCefAENJpVoeO2e7ZprLFfcMtJ1YZMMincc1aySz7HM3VNy4hu6oaTkIrnTeA36hVrDE4K2OZRS--t5iR9eQ9WnbBIwBEI1YKSIONAbXkMz6jnhIn3KQ4JImHFFMAAJrYHVkkMwLbf1AuBTQu7HjCgitAsrcNilsPNr3CHRz5ow0WZBtTm_YY-U7keMeQcypvp8h73iH330")',
            }}
          >
            <div className="relative z-10 max-w-xl space-y-4">
              <p className="text-xs uppercase tracking-[0.4em] text-white/70">
                {copy.tagline}
              </p>
              <h2 className="text-4xl font-bold leading-tight md:text-5xl">
                {copy.headline}
              </h2>
              <p className="text-base text-white/80 md:text-lg">
                {copy.subhead}
              </p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/map"
                  className="inline-flex items-center justify-center rounded-full bg-[#137fec] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#137fec]/40 transition hover:bg-[#0f6ed3]"
                >
                  {copy.ctaPrimary}
                  <span className="ml-2 text-sm">→</span>
                </Link>
                <a
                  href="#rules"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
                >
                  {copy.ctaSecondary}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="rules" className="px-4 py-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6">
              <h3 className="text-2xl font-semibold tracking-tight">
                {copy.rulesTitle}
              </h3>
              <p className="mt-2 text-sm text-white/60">
                {copy.rulesSubtitle}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Odd/Even Dates",
                  description:
                    "Parking allowed on alternate sides based on date.",
                  tone: "bg-[#137fec]/15 text-[#6fb1ff]",
                },
                {
                  title: "Tow-Away Zones",
                  description:
                    "Avoid red zones to prevent immediate vehicle towing.",
                  tone: "bg-red-500/15 text-red-400",
                },
                {
                  title: "Pay & Park Rates",
                  description:
                    "Check standard hourly rates for public parking lots.",
                  tone: "bg-yellow-500/15 text-yellow-300",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/25"
                >
                  <div
                    className={`flex size-12 items-center justify-center rounded-full ${card.tone}`}
                  >
                    <span className="text-lg font-semibold">●</span>
                  </div>
                  <div>
                    <h4 className="text-base font-semibold">{card.title}</h4>
                    <p className="mt-1 text-sm text-white/70">
                      {card.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="map" className="px-4 pb-12">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-semibold tracking-tight">
                {copy.mapTitle}
              </h3>
              <Link
                href="/map"
                className="text-sm font-semibold text-[#6fb1ff] transition hover:text-white"
              >
                {copy.mapCta}
              </Link>
            </div>
            <div className="relative h-80 overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
                style={{
                  backgroundImage:
                    'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCuwEV7XzCKsEvWYFVCbflmKYJNQwLUE_f3JHkEe-ckcAk6XarIhSUz6IlufLqkl0Q1xRsIwbE-R2JF4lol07lE-nnlm21eu5yt-pXwEL9CTvxGKrN-DB9gbdi2BPWkXBKpVUUizdACJUYIJpVlFPSfcvEkjS3rXZdU0yvxJhcKq6BqSzj6oDXeVpGeNLf50EZf7Xf5PBIFBsuo7UJJSkBT06zY2q7k7TSqBR8V6FME52KXiIBwJGvHnGeZd1GuUSd_perwHNufkDHz")',
                }}
              />
              <div className="absolute inset-0 bg-black/40" />
              <div className="absolute left-4 top-4 flex gap-2">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-xs font-semibold">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  Legal
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-xs font-semibold">
                  <span className="size-2 rounded-full bg-red-400" />
                  Restricted
                </div>
              </div>
              <div className="absolute right-4 top-4 rounded-full bg-yellow-400 px-3 py-1 text-xs font-semibold text-black shadow-lg">
                {copy.mapStatus}
              </div>
              <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between bg-gradient-to-t from-black/90 to-transparent p-4 pt-12">
                <div>
                  <p className="text-sm font-semibold">{copy.mapLive}</p>
                  <p className="text-xs text-white/70">{copy.mapLiveStamp}</p>
                </div>
                <Link
                  href="/map"
                  className="inline-flex items-center gap-2 rounded-full bg-[#137fec] px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-[#0f6ed3]"
                >
                  Explore Map
                  <span className="text-sm">↗</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="actions" className="px-4 pb-16">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-3 md:grid-cols-3">
              {copy.actions.map((item) => (
                <button
                  key={item.label}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <span className="text-xl">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-8 text-center text-xs text-white/50">
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

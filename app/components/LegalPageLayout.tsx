import Link from "next/link";

type LegalPageLayoutProps = {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
};

export default function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0b1118] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b1118]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/"
            className="text-sm text-white/70 transition hover:text-white"
          >
            ← Back to Maps for Parking
          </Link>
          <a
            href="https://bridgeit.in"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-white/50 transition hover:text-white/80"
          >
            bridgeit.in
          </a>
        </div>
      </header>

      <main className="px-4 py-10">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-white/50">Last updated: {lastUpdated}</p>
          <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-white/75">
            {children}
          </div>
        </article>
      </main>

      <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-white/50">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/privacy" className="transition hover:text-white/80">
            Privacy Policy
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms" className="transition hover:text-white/80">
            Terms &amp; Conditions
          </Link>
        </div>
        <p className="mt-4">
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
        </p>
      </footer>
    </div>
  );
}

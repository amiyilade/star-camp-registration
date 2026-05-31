import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-16 text-center">
        <Image src="/tkh-logo.png" alt="The King's Hub logo" width={170} height={170} priority />
        <p className="mt-8 text-sm uppercase tracking-[0.35em] text-gold">The King&apos;s Hub</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-royalDark md:text-7xl">
          STAR Camp Registration
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
          Register for STAR Camp Abuja 2026 or STAR Camp Owerri 2026. Complete buyer details, attendee information, consent, and review before payment.
        </p>
        <Link
          href="/register"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-royal px-7 py-4 text-sm font-semibold text-white shadow-soft transition hover:bg-royalDark"
        >
          Start registration <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  );
}

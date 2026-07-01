import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Instagram,
  Facebook,
  Youtube
} from "lucide-react";
import { FaTiktok } from "react-icons/fa";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex max-w-6xl flex-col items-center px-6 py-8 text-center">
        <Image src="/tkh-logo.png" alt="The King's Hub logo" width={170} height={170} priority />
        <p className="mt-5 text-sm uppercase tracking-[0.35em] text-gold">The King&apos;s Hub</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-royalDark md:text-7xl">
          STAR Camp Registration
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
          Hello! Here, you can register for Global STAR Camp 2026 or Eastern Region STAR Camp 2026. Ensure you select the right camp, provide complete and accurate details, and pay. For inquiries or complaints, please contact us at hello@thekingshub.world. 
        </p>
        <Link
          href="/register"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-royal px-7 py-4 text-sm font-semibold text-white shadow-soft transition hover:bg-royalDark"
        >
          Start registration <ArrowRight size={18} />
        </Link>
      </section>
      <div className="mt-16 flex justify-center">
        <div className=" flex items-center gap-6 text-muted">
          <a
            href="https://www.instagram.com/thekingshubfamily/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-royal"
          >
            <Instagram size={24} />
          </a>

          <a
            href="https://www.facebook.com/TeensConnectWorld/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-royal"
          >
            <Facebook size={24} />
          </a>

          <a
            href="https://www.tiktok.com/@thekingshubfamilyglobal"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-royal"
          >
            <FaTiktok size={22} />
          </a>

          <a
            href="https://www.youtube.com/@TheKingshubfamily"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-royal"
          >
            <Youtube size={24} />
          </a>
        </div>
      </div>
    </main>
    
  );
}

import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { BRAND } from "@/lib/config";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: BRAND,
  description: "Te avisamos si baja el precio de tu hotel antes de que venza tu cancelación gratis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <div className="wrap">
          <header className="top">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true" />
              {BRAND}
            </Link>
            <span className="tag">Piloto · ORT Uruguay</span>
          </header>
        </div>
        {children}
        <div className="wrap">
          <footer className="foot">
            Proyecto académico de Nuevos Emprendimientos, Universidad ORT Uruguay. No pedimos claves de ninguna
            plataforma y usamos tus datos solo para vigilar tu reserva.
          </footer>
        </div>
      </body>
    </html>
  );
}

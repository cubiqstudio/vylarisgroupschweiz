import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// Content-Security-Policy: bewusst ohne script-src/default-src (Next.js nutzt Inline-Skripte für die Hydration). Sie sperrt Bilder von
// fremden Servern (Datenschutz), Einbettung in fremde Seiten, Plugins und fremde Formularziele.
const csp = ["img-src 'self' data: blob:", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].join("; ");
securityHeaders.push({ key: "Content-Security-Policy", value: csp });

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // Die Middleware puffert Anfragetexte (Standard 10 MB); Dokument-Uploads bis 10 MB samt Formular-Overhead sollen nicht abgeschnitten werden.
  experimental: { middlewareClientMaxBodySize: "12mb" },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

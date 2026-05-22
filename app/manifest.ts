import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Expense Tracker",
    short_name: "Expense AI",
    description: "Track expenses, recurring bills, and AI financial coaching from one installable web app.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/pwa-icons/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa-icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

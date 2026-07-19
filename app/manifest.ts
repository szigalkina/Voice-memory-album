import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Voice Baby Album",
    short_name: "BabyAlbum",
    description: "Your baby's first year, told in your own voice.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf6f0",
    theme_color: "#faf6f0",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

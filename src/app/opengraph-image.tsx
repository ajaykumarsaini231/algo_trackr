import { ImageResponse } from "next/og";
import { SITE } from "@/lib/seo";

export const runtime = "edge";
export const alt = "DSAspire — Master DSA & crack coding interviews";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social share image (1200×630). No external fonts → always builds. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0b0b12 0%, #1e1b4b 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1, opacity: 0.85 }}>
          {SITE.name}
        </div>
        <div style={{ fontSize: 74, fontWeight: 800, lineHeight: 1.05, maxWidth: 900 }}>
          Master DSA &amp; crack coding interviews
        </div>
        <div style={{ fontSize: 30, opacity: 0.7 }}>
          15,000+ problems · roadmaps · patterns · AI tutor
        </div>
      </div>
    ),
    { ...size },
  );
}

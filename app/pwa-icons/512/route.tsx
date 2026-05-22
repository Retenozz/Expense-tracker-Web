import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0f766e 0%, #0f172a 58%, #f97316 100%)",
          color: "white",
          fontSize: 220,
          fontWeight: 700,
          letterSpacing: -16,
        }}
      >
        AE
      </div>
    ),
    {
      width: 512,
      height: 512,
    }
  );
}

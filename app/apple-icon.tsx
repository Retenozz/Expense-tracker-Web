import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 82,
          fontWeight: 700,
          letterSpacing: -6,
        }}
      >
        AE
      </div>
    ),
    size
  );
}

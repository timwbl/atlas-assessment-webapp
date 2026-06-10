import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" }
        ]
      },
      {
        source: "/admin",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }
        ]
      }
    ];
  },
  outputFileTracingIncludes: {
    "/api/assessments/[id]/export/questions-pdf": [
      "./assets/fonts/**/*",
      "./node_modules/pdfkit/js/data/**/*"
    ],
    "/api/assessments/[id]/export/solutions-pdf": [
      "./assets/fonts/**/*",
      "./node_modules/pdfkit/js/data/**/*"
    ],
    "/api/assessments/[id]/export/review-pdf": [
      "./assets/fonts/**/*",
      "./node_modules/pdfkit/js/data/**/*"
    ]
  }
};

export default nextConfig;

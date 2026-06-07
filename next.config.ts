import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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

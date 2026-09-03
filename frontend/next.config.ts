import type { NextConfig } from "next";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load single .env from backend folder if present
const backendEnvPath = path.resolve(__dirname, "../backend/.env");
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
  },
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
};

export default nextConfig;

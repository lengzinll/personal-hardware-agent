import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    GEMINI_API_KEY: z.string(),
    GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
    OLLAMA_MODEL: z.string().default("ornith-1.5:9b"),
    OLLAMA_URL: z.string().default("http://localhost:11434"),
  },
  client: {
    NEXT_PUBLIC_GEMINI_API_KEY: z.string(),
    NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  },
  runtimeEnv: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL,
    OLLAMA_URL: process.env.OLLAMA_URL,
    NEXT_PUBLIC_GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});

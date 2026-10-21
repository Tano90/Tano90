// POS API keys: shown once on creation, stored only as a SHA-256 hash (they are long and random, so no salt is needed).
import "server-only";
import { createHash, randomBytes } from "node:crypto";

export const newApiKey = () => `mirepa_${randomBytes(24).toString("base64url")}`;
export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

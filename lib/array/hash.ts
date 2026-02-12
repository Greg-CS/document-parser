import crypto from "crypto";

export function sha256Hash(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

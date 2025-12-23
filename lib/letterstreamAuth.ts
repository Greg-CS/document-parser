import crypto from "crypto";

export function createLetterStreamAuth(apiKey: string) {
  const uniqueId = Date.now().toString(); // 10–18 digits

  const start = uniqueId.slice(-6);
  const end = uniqueId.slice(0, 6);

  const stringToHash = `${start}${apiKey}${end}`;

  const base64 = Buffer.from(stringToHash).toString("base64");
  const hash = crypto.createHash("md5").update(base64).digest("hex");

  return {
    t: uniqueId,
    h: hash,
  };
}

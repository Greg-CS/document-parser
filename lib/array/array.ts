import { sha256Hash } from "./hash";
import { CONFIG } from "../../config";

export function getArrayMergePullURL(
  email: string,
  password: string
): string {
  try {
    //const passwordAndSecret = `${password} ${CONFIG.ArraySecret}`;
    const passwordAndSecret = `${password.trim()} ${CONFIG.ArraySecret.trim()}`;

    const passwordHash = sha256Hash(passwordAndSecret);

    // Use CONFIG.URL from config
    const cleanDomain = CONFIG.URL.endsWith("/")
      ? CONFIG.URL.slice(0, -1)
      : CONFIG.URL;

    const url = new URL(
      `${cleanDomain}/retailermergedpull_v3.asp`
    );
    url.searchParams.set("customerEmail", email);
    url.searchParams.set("passwordHash", passwordHash);
    url.searchParams.set("type", "json");
    url.searchParams.set("noreorder", "1");

    return url.toString();
  } catch {
    return "";
  }
}

"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    const handler = (e: CustomEvent<ArrayEventDetail>) => {
      const { tagName, event, metadata = {} } = e.detail;
      console.log("component: " + tagName + "; user action: " + event, metadata);
    };
    window.addEventListener("array-event", handler);
    return () => window.removeEventListener("array-event", handler);
  }, []);

  return (
    <array-account-login
      appKey="3F03D20E-5311-43D8-8A76-E4B5D77793BD"
      userToken="AD45C4BF-5C0A-40B3-8A53-ED29D091FA11"
      apiUrl="https://mock.array.io"
      sandbox="true"
    ></array-account-login>
  );
}

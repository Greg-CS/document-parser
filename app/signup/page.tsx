"use client";

import { useEffect } from "react";

export default function SignupPage() {
  useEffect(() => {
    const handler = (e: CustomEvent<ArrayEventDetail>) => {
      const { tagName, event, metadata = {} } = e.detail;
      console.log("component: " + tagName + "; user action: " + event, metadata);
    };
    window.addEventListener("array-event", handler);
    return () => window.removeEventListener("array-event", handler);
  }, []);

  return (
    <array-account-enroll
      appKey="3F03D20E-5311-43D8-8A76-E4B5D77793BD"
      apiUrl="https://mock.array.io"
      sandbox="true"
      showQuickView="true"
    ></array-account-enroll>
  );
}

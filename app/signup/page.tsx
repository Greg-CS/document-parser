"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

export default function SignupPage() {
  // const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const detail = e.detail ?? {};
      console.log("ARRAY EVENT:", JSON.stringify(detail, null, 2));

      if (detail.event === "enrollment_complete") {
        const userToken = detail.metadata?.userToken ?? "";
        const userId = detail.metadata?.userId ?? "";
        console.log("Enrollment complete — userToken:", userToken, "userId:", userId);

        // Pass the enrollment-generated token to the login page
        const params = new URLSearchParams();
        if (userToken) params.set("userToken", String(userToken));
        if (userId) params.set("userId", String(userId));
        window.location.href = `/login?${params.toString()}`;
      }
    };
    window.addEventListener("array-event", handler as EventListener);
    return () => window.removeEventListener("array-event", handler as EventListener);
  }, []);

  return (
    <>
      <Script
        src="https://cdn.array.io/embedded/array-web-components.js"
        strategy="afterInteractive"
        // onLoad={() => setSdkReady(true)}
      />

      {/* {sdkReady ? ( */}
        <array-account-enroll
          appKey="3F03D20E-5311-43D8-8A76-E4B5D77793BD"
          apiUrl="https://mock.array.io"
          sandbox="true"
          showQuickView="true"
        />
      {/* ) : (
        <div className="flex items-center justify-center min-h-[300px] text-sm text-muted-foreground">Loading Array SDK...</div>
      )} */}
    </>
  );
}

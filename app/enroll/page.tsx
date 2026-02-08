"use client";

import Script from "next/script";
import { useState } from "react";

export default function EnrollPage() {
  const [sdkReady, setSdkReady] = useState(false);

  return (
    <>
      <Script
        src="https://cdn.array.io/sdk/array-web-sdk.js"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />

      <div id="array-enroll-container" />

      {sdkReady && (
        <Script id="array-init" strategy="afterInteractive">
          {`
            if (typeof window.Array !== "undefined" && window.Array.initialize) {
              window.Array.initialize({
                appKey: "${process.env.NEXT_PUBLIC_ARRAY_APP_KEY}",
                containerId: "array-enroll-container",
                onSuccess: function (data) {
                  window.location.href = "/report?userId=" + data.userId;
                },
                onError: function (err) {
                  console.error("Array SDK error:", err);
                }
              });
            } else {
              console.error("Array SDK not available");
            }
          `}
        </Script>
      )}
    </>
  );
}

"use client";

import Script from "next/script";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type FlowStep = "loading" | "error" | "login" | "kba";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[300px] text-sm text-muted-foreground">Loading...</div>}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();

  // Read userToken + userId from URL params (passed from /signup after enrollment)
  const urlToken = searchParams.get("userToken");
  const urlUserId = searchParams.get("userId");

  const [token] = useState<string | null>(urlToken);
  const [userId, setUserId] = useState<string | null>(urlUserId);
  const [sdkReady, setSdkReady] = useState(false);
  const [step, setStep] = useState<FlowStep>(() => urlToken ? "login" : "error");
  const [error, setError] = useState<string | null>(() => urlToken ? null : "No userToken provided. Please enroll first.");

  // 2. Listen for Array web-component events and sequence the flow
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const detail = e.detail ?? {};
      console.log("ARRAY EVENT:", JSON.stringify(detail, null, 2));

      switch (detail.event) {
        case "login_success":
          // Login succeeded — if KBA is needed, transition
          if (detail.metadata?.userId) setUserId(detail.metadata.userId);
          setStep("kba");
          break;
        case "enrollment_complete":
          console.log("Enrollment finished");
          break;
        case "authentication_complete":
          console.log("KBA complete — redirect to report");
          window.location.href = `/report?userId=${userId ?? detail.metadata?.userId ?? ""}`;
          break;
        case "error":
          console.error("Array error:", detail.metadata);
          setError(detail.metadata?.message ?? "Array component error");
          setStep("error");
          break;
      }
    };

    window.addEventListener("array-event", handler as EventListener);
    return () => window.removeEventListener("array-event", handler as EventListener);
  }, [userId]);

  // Loading state
  if (step === "loading") {
    return <div className="flex items-center justify-center min-h-[300px] text-sm text-muted-foreground">Loading...</div>;
  }

  // Error state
  if (step === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <p className="text-sm text-red-600">Error: {error}</p>
        <button className="text-sm underline" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <>
      {/* 3. Load Array SDK — gate components on onLoad */}
      <Script
        src="https://cdn.array.io/embedded/array-web-components.js"
        strategy="afterInteractive"
        // onLoad={() => setSdkReady(true)}
      />

      {sdkReady && step === "login" && (
        <array-account-login
          appKey="3F03D20E-5311-43D8-8A76-E4B5D77793BD"
          userToken={token!}
          apiUrl="https://mock.array.io"
          sandbox="true"
        />
      )}

      {sdkReady && step === "kba" && userId && (
        <array-authentication-kba
          appKey="3F03D20E-5311-43D8-8A76-E4B5D77793BD"
          apiUrl="https://mock.array.io"
          sandbox="true"
          userId={userId}
          showResultPages="true"
        />
      )}

      {!sdkReady && (
        <div className="flex items-center justify-center min-h-[300px] text-sm text-muted-foreground">Loading Array SDK...</div>
      )}
    </>
  );
}

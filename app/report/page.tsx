"use client";

import { useEffect, useState } from "react";

export default function ReportPage({ searchParams }: any) {
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  useEffect(() => {
    async function orderReport() {
      const res = await fetch("/api/order-report", {
        method: "POST",
        body: JSON.stringify({
          userId: searchParams.userId,
          userToken: searchParams.userToken,
        }),
      });

      const { reportKey, displayToken } = await res.json();

      setReportUrl(
        `${process.env.NEXT_PUBLIC_ARRAY_API_BASE}/api/report/v2/html?reportKey=${reportKey}&displayToken=${displayToken}`
      );
    }

    orderReport();
  }, []);

  if (!reportUrl) return <p>Loading report…</p>;

  return (
    <iframe
      src={reportUrl}
      className="w-full h-screen border-none"
    />
  );
}

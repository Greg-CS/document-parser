import ImportDashboard from "@/components/organisms/import-dashboard";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <ImportDashboard />
      </div>
    </div>
  );
}

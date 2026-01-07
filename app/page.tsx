import Dashboard from "@/components/organisms/Dashboard";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <Dashboard />
      </div>
    </div>
  );
}

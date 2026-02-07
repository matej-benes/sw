
export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center">
      <div className="space-y-4 max-w-md">
        <h1 className="text-4xl font-bold tracking-tighter">ŠkolaWeb</h1>
        <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
        <h2 className="text-2xl font-semibold">Probíhá údržba</h2>
        <p className="text-muted-foreground">
          Omlouváme se, ale aplikace je momentálně v údržbě. Připravujeme pro vás zcela novou verzi systému.
        </p>
      </div>
    </div>
  );
}

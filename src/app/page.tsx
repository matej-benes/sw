'use client';

import { Settings } from 'lucide-react';

export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <div className="relative mb-8">
        <Settings className="h-24 w-24 animate-spin-slow text-primary opacity-20" />
        <Settings className="absolute inset-0 h-24 w-24 animate-reverse-spin text-primary" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Aplikace v údržbě</h1>
      <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl">
        Právě připravujeme něco zcela nového. Obsah byl vymazán a stavíme projekt od základů. 
        Vraťte se prosím později.
      </p>
      <div className="mt-10 flex items-center justify-center gap-x-6">
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-progress bg-primary" />
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes reverse-spin {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        .animate-reverse-spin {
          animation: reverse-spin 4s linear infinite;
        }
        .animate-progress {
          animation: progress 2s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}

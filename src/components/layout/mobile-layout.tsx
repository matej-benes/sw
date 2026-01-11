'use client';

import { MobileHeader } from "./mobile-header";
import { MobileBottomNav } from "./mobile-bottom-nav";

export function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col relative">
        <MobileHeader />
        <main className="flex flex-1 flex-col gap-4 p-4 pb-20">
            {children}
        </main>
        <MobileBottomNav />
    </div>
  );
}

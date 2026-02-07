'use client';

import { Logo } from '@/components/logo';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <Logo className="h-20 w-20 text-primary mb-8" />
      <h1 className="text-4xl font-bold tracking-tight">Nová Aplikace</h1>
      <p className="mt-4 text-muted-foreground text-center max-w-md">
        Obsah byl vymazán. Jsme připraveni začít stavět něco nového. 
        Co vytvoříme jako první?
      </p>
    </main>
  );
}
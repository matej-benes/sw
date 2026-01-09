'use client';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { UserNav } from '@/components/layout/user-nav';
import { Logo } from '@/components/logo';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import Link from 'next/link';

const navLinks = [
    { name: "Třídní kniha", href: "/dashboard/tridy" },
    { name: "Hodnocení", href: "/dashboard/znamky" },
    { name: "Výuka", href: "/dashboard/rozvrh" },
    { name: "Komunikace", href: "/dashboard/zpravy" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);
  
  if (loading || !user) {
     return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-dashed border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 z-10">
        <div className="flex items-center gap-2 font-semibold text-primary">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-bold uppercase tracking-wider text-foreground">Škola Online</span>
        </div>
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
            {navLinks.map(link => (
                <Link key={link.name} href={link.href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {link.name}
                </Link>
            ))}
        </nav>
        <div className="flex w-full items-center justify-end gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <UserNav />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 md:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </header>
      <div className="flex flex-1">
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            {children}
        </main>
      </div>
    </div>
  );
}

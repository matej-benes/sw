'use client';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { UserNav } from '@/components/layout/user-nav';
import { Logo } from '@/components/logo';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { usePageTitleUpdater } from '@/hooks/usePageTitleUpdater';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileLayout } from '@/components/layout/mobile-layout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  usePageTitleUpdater();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);
  
  if (loading || !user) {
     return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Logo className="h-24 w-24 animate-boot-pulse text-primary" />
      </div>
    );
  }

  if (isMobile) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr] relative">
       <div className="hidden border-r bg-muted/40 md:block">
            <AppSidebar />
       </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <div className="w-full flex-1">
             
          </div>
          <UserNav />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
            {children}
        </main>
      </div>
    </div>
  );
}

'use client';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { DesktopDashboard } from '@/components/desktop-dashboard';
import { MobileDashboard } from '@/components/mobile-dashboard';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const isMobile = useIsMobile();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      // In a real app with a login page, you'd redirect.
      // For this setup, we assume the user should be logged in to see anything.
      // If you add a public landing page, you might redirect to '/login'
      console.log("No user found, should redirect to login.");
    }
  }, [user, loading, router]);


  if (loading || isMobile === null) {
      return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      );
  }

  return isMobile ? <MobileDashboard /> : <DesktopDashboard />;
}

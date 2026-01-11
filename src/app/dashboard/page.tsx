'use client';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { DesktopDashboard } from '@/components/desktop-dashboard';
import { MobileDashboard } from '@/components/mobile-dashboard';

export default function DashboardPage() {
  const isMobile = useIsMobile();

  if (isMobile === null) {
      return <div className="flex h-full w-full items-center justify-center">Načítání...</div>;
  }

  return isMobile ? <MobileDashboard /> : <DesktopDashboard />;
}

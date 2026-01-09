'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  GraduationCap,
  Home,
  MessageCircle,
  Package,
  Users,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

const teacherNav = [
  { name: 'Nástěnka', href: '/dashboard', icon: Home },
  { name: 'Studenti', href: '/dashboard/studenti', icon: Users },
  { name: 'Rozvrh', href: '/dashboard/rozvrh', icon: CalendarDays },
  { name: 'Zprávy', href: '/dashboard/zpravy', icon: MessageCircle },
];

const parentNav = [
  { name: 'Nástěnka', href: '/dashboard', icon: Home },
  { name: 'Známky', href: '/dashboard/znamky', icon: GraduationCap },
  { name: 'Rozvrh', href: '/dashboard/rozvrh', icon: CalendarDays },
  { name: 'Zprávy', href: '/dashboard/zpravy', icon: MessageCircle },
];

const studentNav = [
  { name: 'Nástěnka', href: '/dashboard', icon: Home },
  { name: 'Známky', href: '/dashboard/znamky', icon: GraduationCap },
  { name: 'Rozvrh', href: '/dashboard/rozvrh', icon: CalendarDays },
  { name: 'Materiály', href: '/dashboard/materialy', icon: Package },
  { name: 'Zprávy', href: '/dashboard/zpravy', icon: MessageCircle },
];

const navItemsByRole = {
  ucitel: teacherNav,
  rodic: parentNav,
  ziak: studentNav,
};

export function AppSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();

  const navItems = user ? navItemsByRole[user.role] : [];

  return (
    <div className="hidden border-r bg-card md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
            <Logo className="h-6 w-6" />
            <span>ŠkolaWeb</span>
          </Link>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                    isActive && 'bg-muted text-primary'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}

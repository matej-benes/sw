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
  Shield,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

const commonNav = [
  { name: 'Nástěnka', href: '/dashboard', icon: Home },
  { name: 'Rozvrh', href: '/dashboard/rozvrh', icon: CalendarDays },
  { name: 'Zprávy', href: '/dashboard/zpravy', icon: MessageCircle },
];

const navConfig = {
  ucitel: [
    ...commonNav,
    { name: 'Studenti', href: '/dashboard/studenti', icon: Users },
  ],
  rodic: [
    ...commonNav,
    { name: 'Známky', href: '/dashboard/znamky', icon: GraduationCap },
    { name: 'Materiály', href: '/dashboard/materialy', icon: Package },
  ],
  ziak: [
    ...commonNav,
    { name: 'Známky', href: '/dashboard/znamky', icon: GraduationCap },
    { name: 'Materiály', href: '/dashboard/materialy', icon: Package },
  ],
  administrator: [
    { name: 'Nástěnka', href: '/dashboard', icon: Home },
    { name: 'Uživatelé', href: '/dashboard/uzivatele', icon: Users },
    { name: 'Třídy', href: '/dashboard/tridy', icon: GraduationCap },
    { name: 'Systém', href: '/dashboard/system', icon: Shield },
  ],
};


export function AppSidebar() {
  const { user, hasRole } = useAuth();
  const pathname = usePathname();

  let navItems: { name: string; href: string; icon: React.ElementType }[] = [];

  if (user) {
    if (hasRole('administrator')) {
      // Admins see a special nav, plus teacher nav if they are also a teacher
      navItems.push(...navConfig.administrator);
      if (hasRole('ucitel')) {
         navItems.push(...navConfig.ucitel.filter(item => !navItems.some(i => i.href === item.href)));
      }
    } else {
        const userRoles = user.roles;
        const seenHrefs = new Set();
        userRoles.forEach(role => {
            if (role in navConfig) {
                navConfig[role as keyof typeof navConfig].forEach(item => {
                    if(!seenHrefs.has(item.href)) {
                        navItems.push(item);
                        seenHrefs.add(item.href);
                    }
                })
            }
        });
        // fallback to student nav if no specific role matches
        if(navItems.length === 0) {
            navItems = navConfig.ziak;
        }
    }
  }


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

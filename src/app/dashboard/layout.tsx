'use client';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { UserNav } from '@/components/layout/user-nav';
import { Logo } from '@/components/logo';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, ChevronDown, BookCopy, Settings, Users, School, Book, FileQuestion, Home, CalendarDays, MessageSquare, LayoutGrid, Replace, PencilRuler, ClipboardCheck, Backpack } from 'lucide-react';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { MobileNav } from '@/components/layout/mobile-nav';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUnreadMessages } from '@/hooks/use-unread-messages';
import { Badge } from '@/components/ui/badge';
import { usePageTitleUpdater } from '@/hooks/usePageTitleUpdater';

const mainNavLinks = [
    { name: 'Komunikace', href: '/dashboard/zpravy', icon: MessageSquare },
];

const studentParentLinks = [
    { name: 'Domácí úkoly', href: '/dashboard/ukoly', icon: Backpack },
    { name: 'Omluvenky', href: '/dashboard/omluvenky', icon: ClipboardCheck },
];

const adminNavLinks = [
    { name: 'Studijní materiály', href: '/dashboard/materialy', icon: FileQuestion },
];

const teacherNavLinks = [
    { name: "Rozvrhy a suplování", href: "/dashboard/rozvrhy-suplovani", icon: Replace },
    { name: "Hodnocení", href: "/dashboard/hodnoceni/nove", icon: PencilRuler },
    { name: 'Domácí úkoly', href: '/dashboard/ukoly', icon: Backpack },
    { name: 'Omluvenky', href: '/dashboard/omluvenky', icon: ClipboardCheck },
]

const spravaSystemuLinks = [
     { name: "Evidence osob", href: "/dashboard/sprava-systemu/evidence-osob", icon: Users },
     { name: "Třídy", href: "/dashboard/sprava-systemu/tridy", icon: School },
     { name: "Předměty", href: "/dashboard/sprava-systemu/predmety", icon: Book },
     { name: "Učebny", href: "/dashboard/sprava-systemu/ucebny", icon: Home },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, hasRole } = useAuth();
  const { unreadCount } = useUnreadMessages();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isAdministrator = hasRole('administrator');
  const isTeacher = hasRole('ucitel');
  const isParentOrStudent = hasRole('rodic') || hasRole('ziak');
  const isMobile = useIsMobile();
  usePageTitleUpdater();


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

  const renderNavLinks = (links: {name: string, href: string, icon?: any}[], isSubMenu = false) => (
    links.map(link => {
        const isActive = pathname.startsWith(link.href);
        const LinkIcon = link.icon;
        const isCommunication = link.name === 'Komunikace';
        return (
            <Link 
                key={link.name} 
                href={link.href} 
                className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                    isActive && "text-primary bg-muted",
                    isSubMenu && "text-sm"
                )}
            >
                <div className="flex items-center gap-3">
                    {LinkIcon && <LinkIcon className="h-4 w-4" />}
                    {link.name}
                </div>
                {isCommunication && unreadCount > 0 && (
                    <Badge className="h-5">{unreadCount}</Badge>
                )}
            </Link>
        )
    })
  )

  const sidebarContent = (
    <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
                <Logo className="h-8 w-8" />
                <span className="text-lg font-bold uppercase tracking-wider text-foreground">Škola Online</span>
            </Link>
        </div>
        <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                 {renderNavLinks(mainNavLinks)}
                 {isParentOrStudent && (
                    <>
                        <div className='my-2'></div>
                        {renderNavLinks(studentParentLinks)}
                    </>
                 )}
                 {(isTeacher) && (
                    <>
                        <div className='my-2'></div>
                        {renderNavLinks(teacherNavLinks)}
                    </>
                 )}
                {isAdministrator && (
                    <>
                        <div className='my-2'></div>
                        {renderNavLinks(adminNavLinks)}
                         <Accordion type="single" collapsible className="w-full" defaultValue={pathname.includes('/dashboard/sprava-systemu') ? 'sprava-systemu' : undefined}>
                            <AccordionItem value="sprava-systemu" className="border-b-0">
                                <AccordionTrigger className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:no-underline [&[data-state=open]>svg]:rotate-180">
                                     <Settings className="h-4 w-4" />
                                    Správa systému
                                </AccordionTrigger>
                                <AccordionContent className="pl-8 pb-0">
                                    <nav className='grid gap-1'>
                                        {renderNavLinks(spravaSystemuLinks, true)}
                                    </nav>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </>
                )}
            </nav>
        </div>
    </div>
  );

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
       <div className="hidden border-r bg-muted/40 md:block">
            {sidebarContent}
       </div>
      <div className="flex flex-col">
        <header className="hidden h-14 items-center gap-4 border-b bg-muted/40 px-4 md:flex lg:h-[60px] lg:px-6">
           <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
            </Button>
            {/* Mobile Sheet */}
            {isMobileMenuOpen && (
                 <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                    <div className="fixed inset-y-0 left-0 z-50 w-[280px] bg-card" onClick={(e) => e.stopPropagation()}>
                        {sidebarContent}
                    </div>
                </div>
            )}
           
          <div className="w-full flex-1">
            {/* Can add search bar here if needed */}
          </div>
          <UserNav />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
            {children}
        </main>
        {isMobile && <MobileNav />}
      </div>
    </div>
  );
}

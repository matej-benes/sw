'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, MessageSquare, LayoutGrid, User, Backpack, ClipboardCheck, Users, UserPlus, PencilRuler } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUnreadMessages } from '@/hooks/use-unread-messages';
import { Badge } from '../ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet"
import { Button } from '../ui/button';

const mainNavItems = [
    { href: '/dashboard', icon: CalendarDays, label: 'Rozvrh' },
    { href: '/dashboard/zpravy', icon: MessageSquare, label: 'Zprávy' },
]

const userMenuItems = [
    { href: '/dashboard/profil', icon: User, label: 'Můj profil' },
    { href: '/dashboard/profil/prepnout', icon: Users, label: 'Přepnout účet' },
    { href: '/dashboard/profil/pridat', icon: UserPlus, label: 'Přidat účet' },
];

const appMenuItems = [
    { href: '/dashboard/hodnoceni', icon: PencilRuler, label: 'Hodnocení' },
    { href: '/dashboard/ukoly', icon: Backpack, label: 'Domácí úkoly' },
    { href: '/dashboard/omluvenky', icon: ClipboardCheck, label: 'Omluvenky' },
]

export function MobileNav() {
    const pathname = usePathname();
    const { unreadCount } = useUnreadMessages();

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm md:hidden">
            <nav className="grid h-16 grid-cols-4 items-center justify-around">
                {mainNavItems.map(item => {
                    const isActive = pathname === item.href;
                    const isMessages = item.label === 'Zprávy';
                    return (
                        <Link 
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 transition-colors w-full h-full relative",
                                isActive ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                            )}
                        >
                            {isMessages && unreadCount > 0 && (
                                <Badge className="absolute top-1 right-4 h-5 w-5 justify-center p-0">{unreadCount}</Badge>
                            )}
                            <item.icon className="h-6 w-6" />
                            <span className="text-xs">{item.label}</span>
                        </Link>
                    )
                })}
                
                 <Sheet>
                    <SheetTrigger asChild>
                         <div className={cn("flex flex-col items-center justify-center gap-1 transition-colors w-full h-full cursor-pointer",
                          pathname.startsWith('/dashboard/profil') ? 'text-primary' : 'text-muted-foreground hover:text-primary')}>
                            <User className="h-6 w-6" />
                            <span className="text-xs">Profil</span>
                        </div>
                    </SheetTrigger>
                    <SheetContent side="bottom" className='rounded-t-lg'>
                        <SheetHeader className='text-left mb-4'>
                            <SheetTitle>Správa účtu</SheetTitle>
                        </SheetHeader>
                        <div className="grid gap-2">
                            {userMenuItems.map(item => (
                                <SheetClose asChild key={item.href}>
                                     <Link href={item.href}>
                                        <Button variant="ghost" className='w-full justify-start gap-3'>
                                            <item.icon className="h-5 w-5 text-muted-foreground" />
                                            {item.label}
                                        </Button>
                                    </Link>
                                </SheetClose>
                            ))}
                        </div>
                    </SheetContent>
                </Sheet>


                <Sheet>
                    <SheetTrigger asChild>
                         <div className={cn("flex flex-col items-center justify-center gap-1 transition-colors w-full h-full text-muted-foreground hover:text-primary cursor-pointer")}>
                            <LayoutGrid className="h-6 w-6" />
                            <span className="text-xs">Menu</span>
                        </div>
                    </SheetTrigger>
                    <SheetContent side="bottom" className='rounded-t-lg'>
                        <SheetHeader className='text-left mb-4'>
                            <SheetTitle>Další moduly</SheetTitle>
                        </SheetHeader>
                        <div className="grid gap-2">
                            {appMenuItems.map(item => (
                                <SheetClose asChild key={item.href}>
                                     <Link href={item.href}>
                                        <Button variant="ghost" className='w-full justify-start gap-3'>
                                            <item.icon className="h-5 w-5 text-muted-foreground" />
                                            {item.label}
                                        </Button>
                                    </Link>
                                </SheetClose>
                            ))}
                        </div>
                    </SheetContent>
                </Sheet>
            </nav>
        </div>
    )
}

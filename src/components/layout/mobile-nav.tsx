'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, MessageSquare, LayoutGrid, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUnreadMessages } from '@/hooks/use-unread-messages';
import { Badge } from '../ui/badge';

const navItems = [
    { href: '/dashboard', icon: CalendarDays, label: 'Rozvrh' },
    { href: '/dashboard/zpravy', icon: MessageSquare, label: 'Zprávy' },
    { href: '/dashboard/znamky', icon: LayoutGrid, label: 'Známky' },
    { href: '/dashboard/profil', icon: User, label: 'Profil' },
]

export function MobileNav() {
    const pathname = usePathname();
    const { unreadCount } = useUnreadMessages();

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm md:hidden">
            <nav className="grid h-16 grid-cols-4 items-center justify-around">
                {navItems.map(item => {
                    const isActive = pathname.startsWith(item.href);
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
            </nav>
        </div>
    )
}

'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { Badge } from "@/components/ui/badge";

const navItems = [
    { href: "/dashboard", icon: Home, label: "Nástěnka" },
    { href: "/dashboard/zpravy", icon: MessageSquare, label: "Zprávy" },
    { href: "/dashboard/profil", icon: UserIcon, label: "Profil" },
];

export function MobileBottomNav() {
    const pathname = usePathname();
    const { unreadCount } = useUnreadMessages();

    return (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-background/95 backdrop-blur-sm">
            <nav className="grid h-16 grid-cols-3 items-center gap-4 px-4 text-sm font-medium">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center gap-1 rounded-lg text-muted-foreground transition-all hover:text-primary",
                                isActive && "text-primary"
                            )}
                        >
                            <div className="relative">
                                <item.icon className="h-6 w-6" />
                                {item.href === "/dashboard/zpravy" && unreadCount > 0 && (
                                    <Badge className="absolute -right-3 -top-2 h-5 w-5 justify-center rounded-full p-0">
                                        {unreadCount}
                                    </Badge>
                                )}
                            </div>
                            <span className="text-xs">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

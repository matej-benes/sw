'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, PencilRuler, UserX, BookCopy, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { Badge } from "@/components/ui/badge";

const navItems = [
    { href: "/dashboard", icon: Home, label: "Nástěnka" },
    { href: "/dashboard/hodnoceni", icon: PencilRuler, label: "Klasifikace" },
    { href: "/dashboard/absence", icon: UserX, label: "Absence" },
    { href: "/dashboard/vyuka/vyucujici", icon: GraduationCap, label: "Vyučující" },
    { href: "/dashboard/zpravy", icon: MessageSquare, label: "Zprávy" },
    { href: "/dashboard/vysvedceni", icon: BookCopy, label: "Vysvědčení" },
];

export function MobileBottomNav() {
    const pathname = usePathname();
    const { unreadCount } = useUnreadMessages();

    return (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-background/95 backdrop-blur-sm">
            <nav className="grid h-16 grid-cols-6 items-center gap-1 px-1 text-sm font-medium">
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 rounded-lg text-muted-foreground transition-all h-full",
                                isActive ? "text-primary bg-primary/10" : "hover:text-primary"
                            )}
                        >
                            <div className="relative">
                                <item.icon className="h-5 w-5" />
                                {item.href === "/dashboard/zpravy" && unreadCount > 0 && (
                                    <Badge className="absolute -right-3 -top-2 h-5 w-5 justify-center rounded-full p-0">
                                        {unreadCount}
                                    </Badge>
                                )}
                            </div>
                            <span className="text-[10px] text-center truncate w-full px-1">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

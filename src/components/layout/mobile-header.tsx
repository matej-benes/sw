'use client';
import { Logo } from "@/components/logo";
import { UserNav } from "@/components/layout/user-nav";
import { PwaInstallButton } from "@/components/pwa-install-button";
import Link from "next/link";

export function MobileHeader() {
    return (
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
                <Logo className="h-7 w-7" />
            </Link>

            <div className="w-full flex-1">
                <PwaInstallButton />
            </div>
            
            <UserNav />
        </header>
    );
}

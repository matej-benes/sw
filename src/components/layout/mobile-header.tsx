'use client';
import { Logo } from "@/components/logo";
import { UserNav } from "@/components/layout/user-nav";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";
import Link from "next/link";

export function MobileHeader() {
    return (
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
                <Logo className="h-7 w-7" />
            </Link>

            <div className="w-full flex-1 flex justify-end">
                 <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/dashboard/napoveda">
                            <FileQuestion />
                            </Link>
                        </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                        <p>Nápověda a příručka</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            
            <UserNav />
        </header>
    );
}


'use client';
import { useAuth } from '@/hooks/use-auth';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useUnreadMessages } from '@/hooks/use-unread-messages';
import { Logo } from '@/components/logo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    MessageSquare,
    Backpack,
    ClipboardCheck,
    PencilRuler,
    Replace,
    Printer,
    BookCopy,
    FileQuestion,
    Settings,
    Users,
    School,
    Book,
    Home,
    UserCheck,
    UserX,
    FileText,
    GraduationCap,
    UserPlus,
    ChevronDown,
} from 'lucide-react';
import { Separator } from '../ui/separator';
import { useState } from 'react';

const mainNavLinks = [
    { name: 'Komunikace', href: '/dashboard/zpravy', icon: MessageSquare },
];

const studentParentLinks = [
    { name: 'Domácí úkoly', href: '/dashboard/ukoly', icon: Backpack },
    { name: 'Omluvenky', href: '/dashboard/omluvenky', icon: ClipboardCheck },
    { name: 'Absence', href: '/dashboard/absence', icon: UserX },
    { name: 'Klasifikace', href: '/dashboard/hodnoceni', icon: PencilRuler },
    { name: 'Chování', href: '/dashboard/chovani', icon: FileText },
    { name: 'Vysvědčení', href: '/dashboard/vysvedceni', icon: BookCopy },
];

const teacherNavLinks = [
    { name: "Rozvrhy a suplování", href: "/dashboard/rozvrhy-suplovani", icon: Replace },
    { name: 'Domácí úkoly', href: '/dashboard/ukoly', icon: Backpack },
    { name: 'Omluvenky', href: '/dashboard/omluvenky', icon: ClipboardCheck },
    { name: 'Absence', href: '/dashboard/absence', icon: UserX },
    { name: 'Klasifikace', href: '/dashboard/hodnoceni', icon: PencilRuler },
]

const printNavLinks = [
    { name: "Tiskové sestavy", href: "/dashboard/tiskove-sestavy", icon: Printer },
    { name: "Tisk vysvědčení", href: "/dashboard/tisk-vysvedceni", icon: BookCopy },
]

const adminNavLinks = [
    { name: 'Poznámky žáka', href: '/dashboard/poznamky-zaka', icon: FileText },
    { name: 'Studijní materiály', href: '/dashboard/materialy', icon: FileQuestion },
];

const spravaSystemuLinks = [
     { name: "Evidence osob", href: "/dashboard/sprava-systemu/evidence-osob", icon: Users },
     { name: "Třídy", href: "/dashboard/sprava-systemu/tridy", icon: School },
     { name: "Předměty", href: "/dashboard/sprava-systemu/predmety", icon: Book },
     { name: "Učebny", href: "/dashboard/sprava-systemu/ucebny", icon: Home },
     { name: "Přijímací řízení", href: "/dashboard/prijimaci-rizeni", icon: UserCheck },
]

const teachingLinks = [
    { name: 'Vyučující', href: '/dashboard/vyuka/vyucujici', icon: GraduationCap },
];

function getInitials(name: string) {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

export function AppSidebar() {
  const { user, hasRole, savedAccounts, switchAccount, addAccount } = useAuth();
  const { unreadCount } = useUnreadMessages();
  const pathname = usePathname();
  const [showAccounts, setShowAccounts] = useState(false);
  
  const isAdministrator = hasRole('administrator');
  const isTeacher = hasRole('ucitel');
  const isParentOrStudent = hasRole('rodic') || hasRole('ziak');
  
  const otherAccounts = savedAccounts.filter(a => a.id !== user?.id);

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
  );

  return (
    <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
                <Logo className="h-8 w-8" />
                <span className="text-lg font-bold uppercase tracking-wider text-foreground">ŠkolaWeb</span>
            </Link>
        </div>

        <div className="px-4 py-3">
            <div 
                className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border bg-muted/20"
                onClick={() => setShowAccounts(!showAccounts)}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={user?.avatarUrl} />
                        <AvatarFallback>{getInitials(user?.name || '')}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-bold truncate">{user?.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{user?.email}</span>
                    </div>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showAccounts && "rotate-180")} />
            </div>

            {showAccounts && (
                <div className="mt-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
                    {otherAccounts.map(account => (
                        <div 
                            key={account.id} 
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                            onClick={() => switchAccount(account)}
                        >
                            <Avatar className="h-7 w-7">
                                <AvatarImage src={account.avatarUrl} />
                                <AvatarFallback className="text-[10px]">{getInitials(account.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="text-xs font-medium">{account.name}</span>
                                <span className="text-[10px] text-muted-foreground">{account.email}</span>
                            </div>
                        </div>
                    ))}
                    <div 
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer text-primary"
                        onClick={() => addAccount()}
                    >
                        <div className="h-7 w-7 flex items-center justify-center rounded-full bg-primary/10">
                            <UserPlus className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-semibold">Přidat účet</span>
                    </div>
                    <Separator className="my-2" />
                </div>
            )}
        </div>

        <div className="flex-1 overflow-y-auto">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                 {renderNavLinks(mainNavLinks)}
                 
                 {isParentOrStudent && (
                    <>
                        <Separator className="my-2" />
                        <Accordion type="single" collapsible className="w-full" defaultValue={pathname.includes('/dashboard/vyuka') ? 'vyuka' : undefined}>
                            <AccordionItem value="vyuka" className="border-b-0">
                                <AccordionTrigger className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:no-underline [&[data-state=open]>svg]:rotate-180">
                                     <GraduationCap className="h-4 w-4" />
                                    Výuka
                                </AccordionTrigger>
                                <AccordionContent className="pl-8 pb-0">
                                    <nav className='grid gap-1'>
                                        {renderNavLinks(teachingLinks, true)}
                                    </nav>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        {renderNavLinks(studentParentLinks)}
                    </>
                 )}

                 {(isTeacher) && (
                    <>
                        <Separator className="my-2" />
                        {renderNavLinks(teacherNavLinks)}
                        
                        <Accordion type="single" collapsible className="w-full" defaultValue={pathname.includes('/dashboard/tisk') ? 'tiskove-vystupy' : undefined}>
                            <AccordionItem value="tiskove-vystupy" className="border-b-0">
                                <AccordionTrigger className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:no-underline [&[data-state=open]>svg]:rotate-180">
                                     <Printer className="h-4 w-4" />
                                    Tiskové výstupy
                                </AccordionTrigger>
                                <AccordionContent className="pl-8 pb-0">
                                    <nav className='grid gap-1'>
                                        {renderNavLinks(printNavLinks, true)}
                                    </nav>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </>
                 )}
                {(isAdministrator) && (
                    <>
                        <Separator className="my-2" />
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
         <div className="mt-auto p-4 border-t">
            {renderNavLinks([{name: 'Nápověda', href: '/dashboard/napoveda', icon: FileQuestion}])}
        </div>
    </div>
  );
}

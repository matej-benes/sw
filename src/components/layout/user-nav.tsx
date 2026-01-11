'use client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { LogOut, User as UserIcon, ChevronsUpDown, Building } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useFirestore, useDoc, useMemoFirebase, useActiveOrganization } from '@/firebase';
import { doc, collection, getDocs, where, query } from 'firebase/firestore';
import type { Trida, User, Organization } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

export function UserNav() {
  const { user, signOut, hasRole, activeMembership, activeOrganization } = useAuth();
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganization();
  const firestore = useFirestore();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  
  const isZiak = hasRole('ziak');

  useEffect(() => {
    const fetchOrganizations = async () => {
        if (!user || !user.memberships || !firestore) return;
        const orgIds = user.memberships.map(m => m.organizationId);
        if (orgIds.length === 0) return;
        
        const q = query(collection(firestore, 'organizations'), where('__name__', 'in', orgIds));
        const querySnapshot = await getDocs(q);
        const orgs: Organization[] = [];
        querySnapshot.forEach((doc) => {
             orgs.push({ id: doc.id, ...doc.data() } as Organization);
        });
        setOrganizations(orgs);
    };
    fetchOrganizations();
  }, [user, firestore]);
  
  useEffect(() => {
    if (activeOrganization?.status === 'trial' && activeOrganization.trialEndDate) {
        try {
            const endDate = parseISO(activeOrganization.trialEndDate);
            const days = differenceInDays(endDate, new Date());
            setTrialDaysLeft(days >= 0 ? days + 1 : 0);
        } catch(e) {
            console.error("Error parsing trialEndDate:", e);
            setTrialDaysLeft(null);
        }
    } else {
        setTrialDaysLeft(null);
    }
  }, [activeOrganization]);
  
  const currentActiveOrganization = organizations.find(org => org.id === activeOrganizationId);

  if (!user) {
    return null;
  }

  const getInitials = (name: string) => {
    if(!name) return '';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  const roleTranslations: { [key: string]: string } = {
    ucitel: 'Učitel',
    rodic: 'Rodič',
    ziak: 'Žák',
    administrator: 'Administrátor',
    'vedouci pracovnik': 'Vedoucí pracovník',
    'asistent pedagoga': 'Asistent pedagoga',
  };
  
  const handleOrgChange = (orgId: string) => {
      setActiveOrganizationId(orgId);
  }

  return (
    <div className="flex items-center gap-4">
       <div className="hidden text-right md:flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium leading-none">{user.name}</p>
             {activeMembership?.roles.length > 0 && (
                <div className="flex flex-wrap justify-end gap-1 mt-1">
                    {activeMembership?.roles.map(role => (
                    <Badge key={role} variant="secondary" className="text-xs">
                        {roleTranslations[role] || role}
                    </Badge>
                    ))}
                </div>
             )}
             {trialDaysLeft !== null && (
                <p className={cn("text-xs mt-1", trialDaysLeft <= 3 ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
                    Zkušební verze: {trialDaysLeft} {trialDaysLeft === 1 ? 'den' : (trialDaysLeft > 1 && trialDaysLeft < 5 ? 'dny' : 'dní')}
                </p>
             )}
          </div>
        </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
           <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    <Building className="mr-2 h-4 w-4" />
                    <span>{currentActiveOrganization?.name || "Vybrat organizaci"}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={activeOrganizationId || ''} onValueChange={handleOrgChange}>
                            {organizations.map(org => (
                                <DropdownMenuRadioItem key={org.id} value={org.id}>
                                    {org.name}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push('/dashboard/profil')}>
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Profil</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Odhlásit se</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

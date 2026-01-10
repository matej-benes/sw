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
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { LogOut, User as UserIcon } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Trida, User } from '@/lib/types';
import { Separator } from '../ui/separator';

export function UserNav() {
  const { user, signOut, hasRole } = useAuth();
  const firestore = useFirestore();
  const isZiak = hasRole('ziak');

  const tridaRef = useMemoFirebase(() => {
    if (!firestore || !user?.tridaId) return null;
    return doc(firestore, 'tridy', user.tridaId);
  }, [firestore, user?.tridaId]);
  const { data: tridaData } = useDoc<Trida>(tridaRef);

  const ucitelRef = useMemoFirebase(() => {
    if (!firestore || !tridaData?.ucitelId) return null;
    return doc(firestore, 'users', tridaData.ucitelId);
  }, [firestore, tridaData?.ucitelId]);
  const { data: ucitelData } = useDoc<User>(ucitelRef);

  if (!user) {
    return null;
  }

  const getInitials = (name: string) => {
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

  return (
    <div className="flex items-center gap-4">
       <div className="hidden text-right md:flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium leading-none">{user.name}</p>
             {!isZiak && (
                <div className="flex flex-wrap justify-end gap-1 mt-1">
                    {user.roles.map(role => (
                    <Badge key={role} variant="secondary" className="text-xs">
                        {roleTranslations[role] || role}
                    </Badge>
                    ))}
                </div>
             )}
          </div>

           {isZiak && (
             <div className="flex items-center gap-3 text-sm">
                <Separator orientation="vertical" className="h-8" />
                <div className="text-left">
                    <p className="font-semibold">{tridaData?.nazev || '...'}</p>
                    <p className="text-xs text-muted-foreground">{ucitelData?.name || '...'}</p>
                </div>
             </div>
          )}
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
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal md:hidden">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                 {isZiak && (
                    <div className="text-xs text-muted-foreground mt-1 pt-1 border-t">
                        <p>Třída: {tridaData?.nazev || '...'}</p>
                        <p>Třídní učitel: {ucitelData?.name || '...'}</p>
                    </div>
                )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="md:hidden"/>
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Profil</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Odhlásit se</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

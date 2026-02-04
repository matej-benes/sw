
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { LogOut, User as UserIcon, Baby, Check } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { User } from '@/lib/types';

export function UserNav() {
  const { user, signOut, hasRole, activeStudentId, setActiveStudentId } = useAuth();
  const router = useRouter();
  const firestore = useFirestore();

  const isParent = hasRole('rodic');
  const studentIds = user?.studentIds || (user?.studentId ? [user.studentId] : []);

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !isParent || studentIds.length === 0) return null;
    return query(collection(firestore, 'users'), where('id', 'in', studentIds));
  }, [firestore, isParent, studentIds]);

  const { data: students } = useCollection<User>(studentsQuery);

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

  return (
    <div className="flex items-center gap-4">
       <div className="hidden text-right md:flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium leading-none">{user.name}</p>
             {user.roles?.length > 0 && (
                <div className="flex flex-wrap justify-end gap-1 mt-1">
                    {user.roles.map(role => (
                    <Badge key={role} variant="secondary" className="text-xs">
                        {roleTranslations[role] || role}
                    </Badge>
                    ))}
                </div>
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
          
          {isParent && students && students.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-semibold uppercase text-muted-foreground">Přepnout dítě</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={activeStudentId || ''} onValueChange={setActiveStudentId}>
                {students.map((student) => (
                  <DropdownMenuRadioItem key={student.id} value={student.id} className="flex items-center gap-2">
                    <Baby className="h-4 w-4" />
                    <span>{student.name}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          )}

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

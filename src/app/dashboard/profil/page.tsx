'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { LogOut, PlusCircle, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';

const roleTranslations: { [key: string]: string } = {
  ucitel: 'Učitel',
  rodic: 'Rodič',
  ziak: 'Žák',
  administrator: 'Administrátor',
  'vedouci pracovnik': 'Vedoucí pracovník',
  'asistent pedagoga': 'Asistent pedagoga',
};

export default function ProfilPage() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const isMobile = useIsMobile();

    if (!user) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                Načítání profilu...
            </div>
        )
    }
    
    const getInitials = (name: string) => {
        if(!name) return '';
        return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase();
    };


    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Váš profil</h1>
                <p className="text-muted-foreground">Správa vašeho účtu a nastavení.</p>
            </div>

            <Card>
                <CardHeader className="flex flex-col items-center text-center">
                    <Avatar className="h-24 w-24 mb-4">
                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                        <AvatarFallback className="text-3xl">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-2xl">{user.name}</CardTitle>
                    <CardDescription>{user.email}</CardDescription>
                     {(user.roles?.length > 0) && (
                        <div className="flex flex-wrap justify-center gap-1 pt-2">
                            {user.roles.map(role => (
                            <Badge key={role} variant="secondary" className="text-sm">
                                {roleTranslations[role] || role}
                            </Badge>
                            ))}
                        </div>
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                    {isMobile && (
                        <div className="space-y-2">
                            <Button className="w-full" variant="outline" onClick={() => router.push('/dashboard/profil/prepnout')}>
                                <Users className="mr-2 h-4 w-4" />
                                Přepnout účet
                            </Button>
                            <Button className="w-full" variant="outline" onClick={() => router.push('/dashboard/profil/pridat')}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Přidat účet
                            </Button>
                        </div>
                    )}
                     <Button className="w-full" variant="destructive" onClick={signOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Odhlásit se
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}

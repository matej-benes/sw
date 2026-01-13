'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { PoznamkaZaka, User } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { FileText, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

function StudentParentBehaviorView() {
    const { user, hasRole } = useAuth();
    const firestore = useFirestore();

    const studentId = hasRole('ziak') ? user?.id : user?.studentId;

    const notesQuery = useMemoFirebase(() => {
        if (!firestore || !studentId) return null;
        return query(
            collection(firestore, 'poznamky-zaku'),
            where('studentId', '==', studentId),
            orderBy('datum', 'desc')
        );
    }, [firestore, studentId]);

    const { data: notes, isLoading: notesLoading } = useCollection<PoznamkaZaka>(notesQuery);

    const { data: teachers, isLoading: teachersLoading } = useCollection<User>(
        useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('roles', 'array-contains', 'ucitel')) : null, [firestore])
    );
    
    const getTeacherName = (id: string) => teachers?.find(t => t.id === id)?.name || 'Neznámý učitel';
    
    const isLoading = notesLoading || teachersLoading;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Přehled chování</CardTitle>
                <CardDescription>Zde naleznete všechny udělené poznámky a pochvaly.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : notes && notes.length > 0 ? (
                    <ul className="space-y-4">
                        {notes.map(note => (
                            <li key={note.id} className="p-4 border rounded-lg">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm text-muted-foreground">{format(new Date(note.datum), 'PPP', { locale: cs })}</p>
                                        <p className="font-semibold text-lg">{note.text}</p>
                                    </div>
                                    <Badge variant={note.druh.toLowerCase().includes('pochvala') ? 'default' : 'destructive'}>{note.druh}</Badge>
                                </div>
                                <Separator className="my-3" />
                                <div className="text-xs text-muted-foreground">
                                    <p>Předmět: {note.predmet || '-'}</p>
                                    <p>Učitel: {getTeacherName(note.ucitelId)}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center py-10 text-muted-foreground">Nebyly nalezeny žádné záznamy.</p>
                )}
            </CardContent>
        </Card>
    );
}

export default function ChovaniPage() {
    const { hasRole, loading } = useAuth();

    if (loading) {
        return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    if (!hasRole('ziak') && !hasRole('rodic')) {
         return (
            <Card>
                <CardHeader>
                    <CardTitle>Přístup odepřen</CardTitle>
                    <CardDescription>Tato stránka je určena pouze pro žáky a rodiče.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <FileText className="h-8 w-8" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Chování</h1>
                    <p className="text-muted-foreground">Přehled poznámek a pochval.</p>
                </div>
            </div>
            <StudentParentBehaviorView />
        </div>
    );
}

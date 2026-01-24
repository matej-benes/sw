'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { PoznamkaZaka, User, Trida } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { FileText, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function StudentParentBehaviorView() {
    const { user, hasRole } = useAuth();
    const firestore = useFirestore();

    const studentId = hasRole('ziak') ? user?.id : user?.studentId;

    const notesQuery = useMemoFirebase(() => {
        if (!firestore || !studentId) return null;
        return query(
            collection(firestore, 'poznamky-zaku'),
            where('studentId', '==', studentId)
        );
    }, [firestore, studentId]);

    const { data: notes, isLoading: notesLoading } = useCollection<PoznamkaZaka>(notesQuery);

    const sortedNotes = useMemo(() => {
        if (!notes) return [];
        return [...notes].sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());
    }, [notes]);

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
                ) : sortedNotes && sortedNotes.length > 0 ? (
                    <ul className="space-y-4">
                        {sortedNotes.map(note => (
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

function TeacherAdminBehaviorView() {
    const firestore = useFirestore();
    const { user } = useAuth();
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    const { data: classes, isLoading: classesLoading } = useCollection<Trida>(
        useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore])
    );

    const studentsInClassQuery = useMemoFirebase(() => {
        if (!firestore || !selectedClassId) return null;
        return query(collection(firestore, 'users'), where('tridaId', '==', selectedClassId), where('roles', 'array-contains', 'ziak'));
    }, [firestore, selectedClassId]);
    const { data: studentsInClass, isLoading: studentsLoading } = useCollection<User>(studentsInClassQuery);

    const notesQuery = useMemoFirebase(() => {
        if (!firestore || !selectedStudentId) return null;
        return query(
            collection(firestore, 'poznamky-zaku'),
            where('studentId', '==', selectedStudentId)
        );
    }, [firestore, selectedStudentId]);

    const { data: notes, isLoading: notesLoading } = useCollection<PoznamkaZaka>(notesQuery);

    const sortedNotes = useMemo(() => {
        if (!notes) return [];
        return [...notes].sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());
    }, [notes]);
    
    const { data: teachers, isLoading: teachersLoading } = useCollection<User>(
        useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('roles', 'array-contains', 'ucitel')) : null, [firestore])
    );
    
    const getTeacherName = (id: string) => teachers?.find(t => t.id === id)?.name || 'Neznámý učitel';
    
    const isLoading = notesLoading || teachersLoading;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Přehled chování</CardTitle>
                <CardDescription>Zde můžete prohlížet poznámky a pochvaly pro jednotlivé žáky.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="grid gap-1.5">
                        <label className="text-sm font-medium">Třída</label>
                        <Select onValueChange={(value) => { setSelectedClassId(value); setSelectedStudentId(null); }} value={selectedClassId || ''} disabled={classesLoading}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vyberte třídu" /></SelectTrigger>
                            <SelectContent>{classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-1.5">
                        <label className="text-sm font-medium">Žák</label>
                        <Select onValueChange={setSelectedStudentId} value={selectedStudentId || ''} disabled={!selectedClassId || studentsLoading}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vyberte žáka" /></SelectTrigger>
                            <SelectContent>{studentsInClass?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : !selectedStudentId ? (
                     <p className="text-center py-10 text-muted-foreground">Vyberte třídu a žáka pro zobrazení záznamů.</p>
                ) : sortedNotes && sortedNotes.length > 0 ? (
                    <ul className="space-y-4">
                        {sortedNotes.map(note => (
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
                    <p className="text-center py-10 text-muted-foreground">Nebyly nalezeny žádné záznamy pro vybraného žáka.</p>
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
    
    const showStudentParentView = hasRole('ziak') || hasRole('rodic');
    const showTeacherAdminView = hasRole('ucitel') || hasRole('administrator');

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <FileText className="h-8 w-8" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Chování</h1>
                    <p className="text-muted-foreground">Přehled poznámek a pochval.</p>
                </div>
            </div>
            {showStudentParentView && <StudentParentBehaviorView />}
            {showTeacherAdminView && <TeacherAdminBehaviorView />}
            {!showStudentParentView && !showTeacherAdminView && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Přístup odepřen</CardTitle>
                        <CardDescription>Pro zobrazení této stránky nemáte dostatečná oprávnění.</CardDescription>
                    </CardHeader>
                </Card>
            )}
        </div>
    );
}

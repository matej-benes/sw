'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Trida, User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users } from 'lucide-react';

export default function TridyPage() {
    const { user, hasRole, loading: userLoading } = useAuth();
    const firestore = useFirestore();

    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

    const classesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        if (hasRole('ucitel') && user) {
            // Teacher sees classes they teach
            return query(collection(firestore, 'tridy'), where('ucitelId', '==', user.id));
        }
        if (hasRole('administrator')) {
            // Admin sees all classes
            return collection(firestore, 'tridy');
        }
        // Students and parents don't need a list of all classes, they are in one.
        if ((hasRole('ziak') || hasRole('rodic')) && user?.tridaId) {
             return query(collection(firestore, 'tridy'), where('id', '==', user.tridaId));
        }
        return null;
    }, [firestore, user, hasRole]);

    const { data: classes, isLoading: classesLoading } = useCollection<Trida>(classesQuery);
    
    const { data: classTeacher, isLoading: teacherLoading } = useCollection<User>(useMemoFirebase(() => {
        if (!firestore || !selectedClassId) return null;
        const selectedClass = classes?.find(c => c.id === selectedClassId);
        if (!selectedClass?.ucitelId) return null;
        return query(collection(firestore, 'users'), where('id', '==', selectedClass.ucitelId));
    }, [firestore, selectedClassId, classes]));


    const handleSelectClass = (classId: string) => {
        setSelectedClassId(classId);
    };
    
    const isLoading = userLoading || classesLoading;
    
    if(isLoading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Třídy</h1>
                <p className="text-muted-foreground">Přehled tříd a jejich žáků.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {classes?.map((cls) => (
                    <Card key={cls.id} className={`cursor-pointer transition-all ${selectedClassId === cls.id ? 'border-primary ring-2 ring-primary' : 'hover:border-muted-foreground/50'}`} onClick={() => handleSelectClass(cls.id)}>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>{cls.nazev}</span>
                                <div className="flex items-center text-sm text-muted-foreground">
                                    <Users className="h-4 w-4 mr-1"/>
                                    {cls.ziaciIds?.length || 0}
                                </div>
                            </CardTitle>
                            <CardDescription>
                                {teacherLoading && selectedClassId === cls.id ? 'Načítání...' : (classTeacher?.[0]?.name || 'Třídní učitel nepřiřazen')}
                            </CardDescription>
                        </CardHeader>
                    </Card>
                ))}
            </div>

             <Card>
                <CardHeader>
                    <CardTitle>Detail třídy</CardTitle>
                     <CardDescription>
                        {selectedClassId ? `Informace o třídě ${classes?.find(c => c.id === selectedClassId)?.nazev}` : 'Vyberte třídu pro zobrazení detailů.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   {selectedClassId ? (
                       <div>Zde bude zobrazen seznam žáků a další informace o třídě.</div>
                   ) : (
                       <p className="text-center text-muted-foreground py-10">Pro zobrazení informací vyberte jednu z karet tříd výše.</p>
                   )}
                </CardContent>
            </Card>

        </div>
    );
}

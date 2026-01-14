'use client';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Grading, User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, User as UserIcon, Calendar, Info, Star } from 'lucide-react';
import { format, parse } from 'date-fns';
import { cs } from 'date-fns/locale';

export default function HodnoceniDetailPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const gradingId = Array.isArray(params.id) ? params.id[0] : params.id;

    const gradingRef = useMemoFirebase(() => {
        if (!firestore || !gradingId) return null;
        return doc(firestore, 'grades', gradingId);
    }, [firestore, gradingId]);

    const { data: grading, isLoading } = useDoc<Grading>(gradingRef);

    const teacherRef = useMemoFirebase(() => {
        if (!firestore || !grading?.ucitelId) return null;
        return doc(firestore, 'users', grading.ucitelId);
    }, [firestore, grading]);

    const { data: teacher, isLoading: teacherLoading } = useDoc<User>(teacherRef);

    if (isLoading || teacherLoading) {
        return <div className="p-6">Načítání detailu hodnocení...</div>;
    }

    if (!grading) {
        return <div className="p-6">Hodnocení nebylo nalezeno.</div>;
    }

    const gradingDate = parse(`${grading.datum} ${grading.cas}`, 'dd.MM.yyyy HH:mm', new Date());

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">{grading.predmet}</h1>
                    <p className="text-muted-foreground">Detail hodnocení</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <span>{grading.komentar || 'Hodnocení'}</span>
                        <span className="text-5xl font-bold text-primary">{grading.znamka}</span>
                    </CardTitle>
                    <CardDescription>
                        {format(gradingDate, "EEEE, d. MMMM yyyy 'v' HH:mm", { locale: cs })}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-base">
                        <div className="flex items-start gap-3">
                            <BookOpen className="h-5 w-5 mt-0.5 text-muted-foreground" />
                            <div>
                                <p className="text-muted-foreground">Předmět</p>
                                <p className="font-medium">{grading.predmet}</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-3">
                            <Star className="h-5 w-5 mt-0.5 text-muted-foreground" />
                            <div>
                                <p className="text-muted-foreground">Váha</p>
                                <p className="font-medium">{grading.vaha}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <UserIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                            <div>
                                <p className="text-muted-foreground">Žák</p>
                                <p className="font-medium">{grading.ziakJmeno}</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-3">
                            <UserIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                            <div>
                                <p className="text-muted-foreground">Vyučující</p>
                                <p className="font-medium">{teacher?.name || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                     {grading.komentar && (
                        <div className="flex items-start gap-3 pt-4 border-t">
                            <Info className="h-5 w-5 mt-0.5 text-muted-foreground" />
                            <div>
                                <p className="text-muted-foreground">Komentář / Název</p>
                                <p className="font-medium">{grading.komentar}</p>
                            </div>
                        </div>
                     )}
                </CardContent>
            </Card>
        </div>
    );
}

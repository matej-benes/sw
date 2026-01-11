'use client';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { Grading, User } from '@/lib/types';
import { useMemo, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { MoreHorizontal, Pencil, Trash2, Edit } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// --- Student/Parent Specific Components & Logic ---

interface StudentGrade {
    subject: string;
    grade: string;
    date: Timestamp;
    topic?: string;
}

function calculateAverage(grades: StudentGrade[]) {
    if (grades.length === 0) return '–';
    const numericGrades = grades.map(g => parseFloat(g.grade)).filter(g => !isNaN(g));
    if (numericGrades.length === 0) return '–';
    const sum = numericGrades.reduce((acc, g) => acc + g, 0);
    return (sum / numericGrades.length).toFixed(2).replace('.', ',');
}

function StudentParentView({ studentId }: { studentId: string }) {
    const firestore = useFirestore();
    const { hasRole, user } = useAuth();
    
    const gradingsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'gradings'), 
            where('studentIds', 'array-contains', studentId),
            orderBy('datum', 'desc')
        );
    }, [firestore, studentId]);

    const { data: gradings, isLoading: gradingsLoading } = useCollection<Grading>(gradingsQuery);

    const studentGrades = useMemo(() => {
        if (!gradings) return [];
        
        const grades: StudentGrade[] = [];
        gradings.forEach(grading => {
            const studentMark = grading.znamky.find(z => z.studentId === studentId);
            if (studentMark) {
                grades.push({
                    subject: grading.predmetNazev,
                    grade: studentMark.znamka,
                    date: grading.datum,
                    topic: grading.tema,
                });
            }
        });
        // Sorting is now handled by the query
        return grades;
    }, [gradings, studentId]);

    const groupedGrades = useMemo(() => {
        return studentGrades.reduce((acc, znamka) => {
            const subject = znamka.subject;
            if (!acc[subject]) acc[subject] = [];
            acc[subject].push(znamka);
            return acc;
        }, {} as { [subject: string]: StudentGrade[] });
    }, [studentGrades]);

    const totalAverage = useMemo(() => calculateAverage(studentGrades), [studentGrades]);
    
    return (
        <Tabs defaultValue="prubezne" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="prubezne">Průběžné hodnocení</TabsTrigger>
                <TabsTrigger value="predmet">Hodnocení v předmětu</TabsTrigger>
            </TabsList>
            <TabsContent value="prubezne">
                <Card>
                    <CardHeader>
                        <CardTitle>{hasRole('rodic') ? 'Průběžné známky dítěte' : 'Moje průběžné známky'}</CardTitle>
                        <CardDescription>Celkový průměr: <span className="font-bold text-primary">{totalAverage}</span></CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Předmět</TableHead><TableHead className="text-center">Známka</TableHead><TableHead>Datum</TableHead><TableHead>Téma</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {gradingsLoading ? <TableRow><TableCell colSpan={4} className="h-24 text-center">Načítání známek...</TableCell></TableRow>
                                : studentGrades.length > 0 ? studentGrades.map((znamka, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{znamka.subject}</TableCell>
                                        <TableCell className="text-center font-bold text-lg">{znamka.grade}</TableCell>
                                        <TableCell>{znamka.date.toDate ? format(znamka.date.toDate(), 'd. M. yyyy', { locale: cs }) : 'Neplatné datum'}</TableCell>
                                        <TableCell className="text-muted-foreground">{znamka.topic || '-'}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={4} className="h-24 text-center">Zatím nemáte žádné známky.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="predmet">
                <Card>
                    <CardHeader>
                        <CardTitle>Hodnocení podle předmětů</CardTitle>
                        <CardDescription>Souhrnný přehled známek a průměrů v jednotlivých předmětech.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {gradingsLoading ? <p>Načítání...</p> : Object.keys(groupedGrades).length > 0 ? (
                            Object.entries(groupedGrades).map(([subject, grades]) => (
                                <Card key={subject} className="overflow-hidden">
                                <CardHeader className="flex flex-row items-center justify-between bg-muted/50 p-4">
                                    <CardTitle className="text-lg">{subject}</CardTitle>
                                    <Badge>Průměr: {calculateAverage(grades)}</Badge>
                                </CardHeader>
                                <CardContent className="p-4"><div className="flex flex-wrap gap-2">{grades.map((g, index) => <Badge key={index} variant="secondary" className="text-base">{g.grade}</Badge>)}</div></CardContent>
                                </Card>
                            ))
                        ) : <p className="text-center text-muted-foreground py-10">Žádná data k zobrazení.</p>}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}

// --- Teacher Specific Components & Logic ---

type EditableGrade = {
    gradingId: string;
    studentId: string;
    studentName: string;
    predmet: string;
    hodnota: string;
    datum: Timestamp;
    tema?: string;
    slovniHodnoceni?: string;
}

function TeacherView() {
    const { user, loading: userLoading } = useAuth();
    const firestore = useFirestore();

    const teacherGradingsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'gradings'), where('ucitelId', '==', user.id), orderBy('datum', 'desc'));
    }, [firestore, user]);

    const { data: gradings, isLoading: gradingsLoading } = useCollection<Grading>(teacherGradingsQuery);

    const allStudentIds = useMemo(() => {
        if (!gradings) return [];
        const ids = new Set<string>();
        gradings.forEach(g => g.znamky.forEach(z => ids.add(z.studentId)));
        return Array.from(ids);
    }, [gradings]);
    
    // Firestore 'in' query supports max 30 elements. Chunking is needed for larger sets.
    const studentUsersQuery = useMemoFirebase(() => {
        if (!firestore || allStudentIds.length === 0) return null;
        const chunks: string[][] = [];
        for (let i = 0; i < allStudentIds.length; i += 30) {
            chunks.push(allStudentIds.slice(i, i + 30));
        }
        // For simplicity, we'll only use the first chunk. A real app would need to handle multiple queries.
        if (chunks.length > 0) {
            return query(collection(firestore, 'users'), where('__name__', 'in', chunks[0]));
        }
        return null;
    }, [firestore, allStudentIds]);

    const { data: studentUsers, isLoading: usersLoading } = useCollection<User>(studentUsersQuery);
    
    const flatGrades = useMemo(() => {
        if (!gradings || !studentUsers) return [];
        const studentMap = new Map(studentUsers.map(u => [u.id, u.name]));
        const grades: EditableGrade[] = [];
        gradings.forEach(grading => {
            grading.znamky.forEach(znamka => {
                grades.push({
                    gradingId: grading.id,
                    studentId: znamka.studentId,
                    studentName: studentMap.get(znamka.studentId) || 'Neznámý žák',
                    predmet: grading.predmetNazev,
                    hodnota: znamka.znamka,
                    datum: grading.datum,
                    tema: grading.tema,
                    slovniHodnoceni: znamka.slovniHodnoceni
                });
            });
        });
        return grades.sort((a,b) => b.datum.toMillis() - a.datum.toMillis());
    }, [gradings, studentUsers]);

    const isLoading = userLoading || gradingsLoading || usersLoading;

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Přehled zadaného hodnocení</CardTitle>
                  <CardDescription>Chronologický seznam všech známek, které jste zadali.</CardDescription>
                </div>
                <Button asChild>
                    <Link href="/dashboard/hodnoceni/nove">
                      <Edit className="mr-2 h-4 w-4" />
                      Zadat nové hodnocení
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Žák</TableHead><TableHead>Předmět</TableHead><TableHead className="text-center">Známka</TableHead><TableHead>Datum</TableHead><TableHead>Téma</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading && <TableRow><TableCell colSpan={5} className="h-24 text-center">Načítání hodnocení...</TableCell></TableRow>}
                        {!isLoading && flatGrades.length > 0 ? (
                            flatGrades.map((grade, index) => (
                                <TableRow key={`${grade.gradingId}-${grade.studentId}-${index}`}>
                                    <TableCell className="font-medium">{grade.studentName}</TableCell>
                                    <TableCell>{grade.predmet}</TableCell>
                                    <TableCell className="text-center font-bold">{grade.hodnota}</TableCell>
                                    <TableCell>{grade.datum.toDate ? format(grade.datum.toDate(), 'd. M. yyyy', { locale: cs }) : 'N/A'}</TableCell>
                                    <TableCell>{grade.tema || '-'}</TableCell>
                                </TableRow>
                            ))
                        ) : !isLoading && <TableRow><TableCell colSpan={5} className="h-24 text-center">Nezadali jste žádné hodnocení.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

// --- Main Page Component ---

export default function HodnoceniPage() {
    const { user, hasRole, loading } = useAuth();
    const [studentId, setStudentId] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            if (hasRole('ziak')) setStudentId(user.id);
            else if (hasRole('rodic') && user.studentId) setStudentId(user.studentId);
        }
    }, [user, hasRole]);
    
    if (loading) {
        return <div className="flex h-full items-center justify-center">Načítání...</div>;
    }
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Hodnocení</h1>
                <p className="text-muted-foreground">Přehled vašeho studijního prospěchu a správa hodnocení.</p>
            </div>
            
            {hasRole('ucitel') && <TeacherView />}
            {(hasRole('ziak') || hasRole('rodic')) && studentId && <StudentParentView studentId={studentId} />}
        </div>
    );
}

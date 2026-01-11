'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import type { Znamka, Grading } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, orderBy, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

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

export default function HodnoceniPage() {
  const { user, hasRole, loading } = useAuth();
  const firestore = useFirestore();
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (hasRole('ziak')) {
        setStudentId(user.id);
      } else if (hasRole('rodic') && user.studentId) {
        setStudentId(user.studentId);
      }
    }
  }, [user, hasRole]);

  const gradingsQuery = useMemoFirebase(() => {
    if (!firestore || !studentId) return null;
    return query(
        collection(firestore, 'gradings'), 
        where('znamky', 'array-contains', { studentId: studentId })
    );
  }, [firestore, studentId]);

  const { data: gradings, isLoading: gradingsLoading } = useCollection<Grading>(gradingsQuery);

  const studentGrades = useMemo(() => {
    if (!gradings || !studentId) return [];
    
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
    return grades.sort((a,b) => b.date.toMillis() - a.date.toMillis());

  }, [gradings, studentId]);


  const groupedGrades = useMemo(() => {
    if (!studentGrades) return {};
    return studentGrades.reduce((acc, znamka) => {
      const subject = znamka.subject;
      if (!acc[subject]) {
        acc[subject] = [];
      }
      acc[subject].push(znamka);
      return acc;
    }, {} as { [subject: string]: StudentGrade[] });
  }, [studentGrades]);

  const isLoading = loading || (!!studentId && gradingsLoading);
  
  const totalAverage = useMemo(() => {
    if (!studentGrades || studentGrades.length === 0) return 'N/A';
    return calculateAverage(studentGrades);
  }, [studentGrades]);

  const isStudentOrParent = hasRole('ziak') || hasRole('rodic');
  const isTeacher = hasRole('ucitel');

  if (loading) {
    return <div>Načítání...</div>;
  }

  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-3xl font-bold tracking-tight">Hodnocení</h1>
        <p className="text-muted-foreground">Přehled vašeho studijního prospěchu.</p>
      </div>

       <Tabs defaultValue={isStudentOrParent ? "prubezne" : "prehled"} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                {isStudentOrParent && <TabsTrigger value="prubezne">Průběžné hodnocení</TabsTrigger>}
                {isStudentOrParent && <TabsTrigger value="predmet">Hodnocení v předmětu</TabsTrigger>}
                 {isTeacher && <TabsTrigger value="prehled" asChild><Link href="/dashboard/hodnoceni/prehled-hodnoceni">Přehled hodnocení</Link></TabsTrigger>}
            </TabsList>
            
            {isStudentOrParent && (
            <>
                <TabsContent value="prubezne">
                    <Card>
                        <CardHeader>
                        <CardTitle>
                            {hasRole('rodic') ? `Průběžné známky` : 'Moje průběžné známky'}
                        </CardTitle>
                        <CardDescription>
                            Celkový průměr: <span className="font-bold text-primary">{totalAverage}</span>
                        </CardDescription>
                        </CardHeader>
                        <CardContent>
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Předmět</TableHead>
                                <TableHead className="text-center">Známka</TableHead>
                                <TableHead>Datum</TableHead>
                                <TableHead>Téma</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                             {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center">Načítání známek...</TableCell></TableRow>
                             ) : studentGrades && studentGrades.length > 0 ? (
                                studentGrades.map((znamka, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">{znamka.subject}</TableCell>
                                    <TableCell className="text-center font-bold text-lg">{znamka.grade}</TableCell>
                                    <TableCell>{znamka.date.toDate ? format(znamka.date.toDate(), 'd. M. yyyy', { locale: cs }) : 'Neplatné datum'}</TableCell>
                                    <TableCell className="text-muted-foreground">{znamka.topic || '-'}</TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    Zatím nemáte žádné známky.
                                </TableCell>
                                </TableRow>
                            )}
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
                            {isLoading ? <p>Načítání...</p> : Object.keys(groupedGrades).length > 0 ? (
                               Object.entries(groupedGrades).map(([subject, grades]) => (
                                 <Card key={subject} className="overflow-hidden">
                                    <CardHeader className="flex flex-row items-center justify-between bg-muted/50 p-4">
                                        <CardTitle className="text-lg">{subject}</CardTitle>
                                        <Badge>Průměr: {calculateAverage(grades)}</Badge>
                                    </CardHeader>
                                    <CardContent className="p-4">
                                        <div className="flex flex-wrap gap-2">
                                            {grades.map((g, index) => (
                                                <Badge key={index} variant="secondary" className="text-base">{g.grade}</Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                 </Card>
                               ))
                            ) : (
                                <p className="text-center text-muted-foreground py-10">Žádná data k zobrazení.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </>
            )}
             {isTeacher && (
                <TabsContent value="prehled">
                    {/* Content will be on the /prehled-hodnoceni page */}
                     <Card>
                        <CardContent className="pt-6">
                            <p className="text-center text-muted-foreground">
                                Zde naleznete přehled vámi zadaných hodnocení. Pro zobrazení detailů klikněte na tlačítko "Přehled hodnocení" výše.
                            </p>
                        </CardContent>
                     </Card>
                </TabsContent>
            )}
        </Tabs>
    </div>
  );
}

    
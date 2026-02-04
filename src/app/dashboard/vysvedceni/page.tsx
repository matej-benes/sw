
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookCopy, Printer, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import type { Grading, User } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SubjectAverage {
    subject: string;
    average: string;
}

export default function VysvedceniPage() {
    const { user, hasRole, loading: userLoading, activeStudentId } = useAuth();
    const firestore = useFirestore();
    const [grades, setGrades] = useState<Grading[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const targetStudentId = hasRole('rodic') ? activeStudentId : (hasRole('ziak') ? user?.id : null);

    const activeStudentRef = useMemoFirebase(() => {
        if (!firestore || !targetStudentId) return null;
        return doc(firestore, 'users', targetStudentId);
    }, [firestore, targetStudentId]);
    const { data: activeStudent } = useDoc<User>(activeStudentRef);

    const studentName = activeStudent?.name || '...';

    useEffect(() => {
        if (!firestore || !targetStudentId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const q = query(collection(firestore, 'grades'), where('ziakId', '==', targetStudentId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results = snapshot.docs.map(doc => ({...doc.data(), id: doc.id})) as Grading[];
            setGrades(results);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching grades for report card:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [firestore, targetStudentId]);

    const finalGrades = useMemo(() => {
        if (!grades) return [];

        const gradesBySubject: { [key: string]: Grading[] } = {};
        for (const grade of grades) {
            if (!gradesBySubject[grade.predmet]) {
                gradesBySubject[grade.predmet] = [];
            }
            gradesBySubject[grade.predmet].push(grade);
        }

        const averages: SubjectAverage[] = [];
        for (const subject in gradesBySubject) {
            const subjectGrades = gradesBySubject[subject];
            const totalWeight = subjectGrades.reduce((sum, g) => sum + g.vaha, 0);
            const weightedSum = subjectGrades.reduce((sum, g) => sum + g.znamka * g.vaha, 0);
            
            let finalGrade = 0;
            if (totalWeight > 0) {
                 finalGrade = Math.round(weightedSum / totalWeight);
            } else if (subjectGrades.length > 0) {
                finalGrade = Math.round(subjectGrades.reduce((sum, g) => sum + g.znamka, 0) / subjectGrades.length);
            }
            
            if(finalGrade > 0) {
                 averages.push({ subject, average: String(finalGrade) });
            }
        }
        return averages.sort((a,b) => a.subject.localeCompare(b.subject));
    }, [grades]);

    const isPageLoading = userLoading || isLoading;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <BookCopy className="h-8 w-8" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Vysvědčení</h1>
                    <p className="text-muted-foreground">Přehled a tisk vysvědčení.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Náhled vysvědčení pro: {studentName}</CardTitle>
                    <CardDescription>Školní rok 2023/2024 - 2. pololetí</CardDescription>
                </CardHeader>
                <CardContent>
                    {isPageLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : finalGrades.length > 0 ? (
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Předmět</TableHead>
                                        <TableHead className="text-right">Výsledná známka</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {finalGrades.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-medium">{item.subject}</TableCell>
                                            <TableCell className="text-right font-bold text-lg">{item.average}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-10">Pro tohoto žáka nebyly nalezeny žádné uzavřené známky pro zobrazení na vysvědčení.</p>
                    )}
                </CardContent>
                <CardFooter className="border-t pt-6">
                     <Button variant="outline" onClick={() => window.print()} disabled={isPageLoading || finalGrades.length === 0}>
                        <Printer className="mr-2 h-4 w-4" />
                        Tisknout vysvědčení
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

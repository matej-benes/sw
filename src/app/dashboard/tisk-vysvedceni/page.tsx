'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Trida, User, Grading, ZapisHodiny } from '@/lib/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, CheckCircle, AlertTriangle, Calculator, FileEdit } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const printForms = ["SEVT", "OFTIS", "OPTYS", "Bianco blankety"];

type StudentReportData = {
    id: string;
    name: string;
    avgGrade: string;
    attendance: number;
    status: 'V pořádku' | 'Hranice docházky' | 'Chybí známky';
};


export default function TiskVysvedceniPage() {
    const { user, hasRole } = useAuth();
    const firestore = useFirestore();
    
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedSemester, setSelectedSemester] = useState<string>('2pololeti');
    const [studentReportData, setStudentReportData] = useState<StudentReportData[]>([]);

    const teacherClassesQuery = useMemoFirebase(() => {
        if (!firestore || !user || !hasRole('ucitel')) return null;
        return query(collection(firestore, 'tridy'), where('ucitelId', '==', user.id));
    }, [firestore, user, hasRole]);
    const { data: teacherClasses, isLoading: classesLoading } = useCollection<Trida>(teacherClassesQuery);

    const studentsQuery = useMemoFirebase(() => {
        if (!firestore || !selectedClassId) return null;
        return query(collection(firestore, 'users'), where('tridaId', '==', selectedClassId), where('roles', 'array-contains', 'ziak'));
    }, [firestore, selectedClassId]);
    const { data: students, isLoading: studentsLoading } = useCollection<User>(studentsQuery);
    
    const gradesQuery = useMemoFirebase(() => {
        if (!firestore || !selectedClassId) return null;
        // Correctly query gradings only for the selected class
        return query(collection(firestore, 'gradings'), where('tridaId', '==', selectedClassId));
    }, [firestore, selectedClassId]);
    const { data: allGrades, isLoading: gradesLoading } = useCollection<Grading>(gradesQuery);

    const attendanceQuery = useMemoFirebase(() => {
         if (!firestore || !selectedClassId) return null;
        return query(collection(firestore, 'zapisyHodin'), where('tridaId', '==', selectedClassId));
    }, [firestore, selectedClassId]);
    const { data: attendanceRecords, isLoading: attendanceLoading } = useCollection<ZapisHodiny>(attendanceQuery);

    useEffect(() => {
        if (teacherClasses && teacherClasses.length > 0 && !selectedClassId) {
            setSelectedClassId(teacherClasses[0].id);
        }
    }, [teacherClasses, selectedClassId]);

    useEffect(() => {
        if (students && allGrades && attendanceRecords) {
            const studentIdsInClass = students.map(s => s.id);
            const reportData = students.map(student => {
                const studentGrades = allGrades.filter(g => g.ziakId === student.id);
                const totalLessons = attendanceRecords.length;
                const presentLessons = attendanceRecords.filter(r => r.attendance.some(a => a.studentId === student.id && a.status === '-')).length;

                let avgGrade = 'N/A';
                if (studentGrades.length > 0) {
                    const sum = studentGrades.reduce((acc, g) => acc + g.znamka, 0);
                    avgGrade = (sum / studentGrades.length).toFixed(2);
                }

                const attendance = totalLessons > 0 ? Math.round((presentLessons / totalLessons) * 100) : 100;
                
                let status: StudentReportData['status'] = 'V pořádku';
                if (attendance < 90) { // Example threshold
                    status = 'Hranice docházky';
                }
                if(studentGrades.length === 0){
                    status = 'Chybí známky';
                }

                return {
                    id: student.id,
                    name: student.name,
                    avgGrade,
                    attendance,
                    status
                };
            });
            setStudentReportData(reportData);
        }
    }, [students, allGrades, attendanceRecords]);
    
    const isLoading = classesLoading || studentsLoading || gradesLoading || attendanceLoading;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Tisk vysvědčení</h1>
                <p className="text-muted-foreground">Kompletní agenda pro uzavírání hodnocení a tisk vysvědčení.</p>
            </div>

            <Card>
                <CardHeader className="flex-row items-start justify-between">
                    <div>
                        <CardTitle>Uzávěrky a tisk</CardTitle>
                        <CardDescription>Vyberte třídu a pololetí pro zahájení procesu uzávěrek.</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                         <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoading}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Vyberte třídu" />
                            </SelectTrigger>
                            <SelectContent>
                                {teacherClasses?.map(c => <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select defaultValue={selectedSemester} onValueChange={setSelectedSemester}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Vyberte pololetí" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1pololeti">1. pololetí</SelectItem>
                                <SelectItem value="2pololeti">2. pololetí</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Stav uzávěrky třídy</label>
                        <div className="flex items-center gap-4">
                            <Progress value={75} className="w-full" />
                            <span className="text-sm font-semibold">75%</span>
                        </div>
                         <p className="text-xs text-muted-foreground">3 ze 4 žáků mají kompletní hodnocení.</p>
                    </div>

                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"><Checkbox /></TableHead>
                                    <TableHead>Jméno žáka</TableHead>
                                    <TableHead><Calculator className="h-4 w-4 inline mr-1"/>Vážený průměr</TableHead>
                                    <TableHead>Docházka</TableHead>
                                    <TableHead>Stav</TableHead>
                                    <TableHead className="text-right">Akce</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center h-24">Načítání dat...</TableCell></TableRow>
                                ) : (
                                    studentReportData.map((student) => (
                                    <TableRow key={student.id}>
                                        <TableCell><Checkbox /></TableCell>
                                        <TableCell className="font-medium">{student.name}</TableCell>
                                        <TableCell className="font-semibold">{student.avgGrade}</TableCell>
                                        <TableCell>{student.attendance}%</TableCell>
                                        <TableCell>
                                            <Badge variant={student.status === "V pořádku" ? "default" : "destructive"} className={student.status === "V pořádku" ? "bg-green-500" : ""}>
                                                {student.status === "V pořádku" ? <CheckCircle className="mr-1 h-3 w-3"/> : <AlertTriangle className="mr-1 h-3 w-3"/>}
                                                {student.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm">
                                                <FileEdit className="mr-2 h-4 w-4" />
                                                Slovní hodnocení
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="flex-col items-start gap-4">
                    <div>
                        <h3 className="font-semibold mb-2">Nastavení tisku</h3>
                         <div className="flex items-center gap-4">
                            <Select defaultValue="SEVT">
                                <SelectTrigger className="w-[240px]">
                                    <SelectValue placeholder="Formulář pro tisk" />
                                </SelectTrigger>
                                <SelectContent>
                                    {printForms.map(form => <SelectItem key={form} value={form}>{form}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="bianco" />
                                <label htmlFor="bianco" className="text-sm font-medium">Tisknout na bianco blankety</label>
                            </div>
                        </div>
                    </div>
                     <Button onClick={() => window.print()} disabled={isLoading || studentReportData.length === 0}>
                        <Printer className="mr-2 h-4 w-4" />
                        Tisknout vybraná vysvědčení ({studentReportData.length})
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

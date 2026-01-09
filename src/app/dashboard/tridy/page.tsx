'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockStudents, getStudentById } from '@/lib/mock-data';
import type { Grade, Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle } from 'lucide-react';

const mockClasses = [
  { id: 'trida-1', name: '1.A', studentCount: 25, teacher: 'Matěj Mikolášek' },
  { id: 'trida-4', name: '4.C', studentCount: 22, teacher: 'Robert Bartošek' },
  { id: 'trida-2', name: '2.B', studentCount: 28, teacher: 'Jana Nováková' },
];

const subjects = ["Matematika", "Český jazyk", "Anglický jazyk", "Dějepis", "Fyzika", "Chemie"];

function AddGradeModal() {
    const { toast } = useToast();
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [subject, setSubject] = useState('');
    const [grade, setGrade] = useState('');

    const handleAddGrade = () => {
        if (!selectedStudentId || !subject || !grade) {
             toast({
                variant: "destructive",
                title: "Chyba",
                description: "Všechna pole jsou povinná.",
            });
            return;
        }
        
        toast({
            title: "Známka přidána",
            description: `Známka ${grade} z předmětu ${subject} byla přidána studentovi.`,
        });
        // Here you would typically call a function to add the grade to the database
        console.log({ studentId: selectedStudentId, subject, grade });
    }

    return (
         <Dialog>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Přidat známku
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                <DialogTitle>Přidat novou známku</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="student" className="text-right">Žák</Label>
                         <Select onValueChange={setSelectedStudentId}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Vyberte žáka" />
                            </SelectTrigger>
                            <SelectContent>
                                {mockStudents.map((student) => (
                                    <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="subject" className="text-right">Předmět</Label>
                        <Select onValueChange={setSubject}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Vyberte předmět" />
                            </SelectTrigger>
                            <SelectContent>
                               {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="grade" className="text-right">Známka</Label>
                        <Input id="grade" type="number" min="1" max="5" value={grade} onChange={(e) => setGrade(e.target.value)} className="col-span-3" />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleAddGrade}>Uložit známku</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


export default function TridyPage() {
    const [selectedClass, setSelectedClass] = useState(mockClasses[0]);
    const [grades, setGrades] = useState(mockStudents.flatMap(s => s.grades.map(g => ({...g, studentName: s.name}))));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Třídní kniha</h1>
                <p className="text-muted-foreground">Správa tříd a hodnocení žáků.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {mockClasses.map((cls) => (
                    <Card key={cls.id} className={`cursor-pointer transition-all ${selectedClass.id === cls.id ? 'border-primary ring-2 ring-primary' : 'hover:border-muted-foreground/50'}`} onClick={() => setSelectedClass(cls)}>
                        <CardHeader>
                            <CardTitle>{cls.name}</CardTitle>
                            <CardDescription>{cls.teacher}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{cls.studentCount}</p>
                            <p className="text-xs text-muted-foreground">Počet žáků</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

             <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>Nedávné hodnocení pro třídu {selectedClass.name}</CardTitle>
                        <CardDescription>Zde je real-time přehled posledních přidaných známek.</CardDescription>
                    </div>
                   <AddGradeModal />
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Žák</TableHead>
                                <TableHead>Předmět</TableHead>
                                <TableHead className="text-center">Známka</TableHead>
                                <TableHead>Datum</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {grades.length > 0 ? (
                                grades.slice(0, 5).map((grade) => (
                                    <TableRow key={grade.id}>
                                        <TableCell className="font-medium">{grade.studentName}</TableCell>
                                        <TableCell>{grade.subject}</TableCell>
                                        <TableCell className="text-center font-bold">{grade.grade}</TableCell>
                                        <TableCell>{new Date(grade.date).toLocaleDateString('cs-CZ')}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Žádné známky k zobrazení.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

        </div>
    );
}

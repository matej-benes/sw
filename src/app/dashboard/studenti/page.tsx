'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockStudents, getStudentById } from '@/lib/mock-data';
import type { Grade, Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { generateGradeSummary } from '@/ai/flows/generate-grade-summary';
import { Loader2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

function GradeTable({ grades }: { grades: Grade[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Předmět</TableHead>
          <TableHead className="text-center">Známka</TableHead>
          <TableHead>Datum</TableHead>
          <TableHead>Poznámky</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {grades.length > 0 ? (
          grades.map((grade) => (
            <TableRow key={grade.id}>
              <TableCell className="font-medium">{grade.subject}</TableCell>
              <TableCell className="text-center">{grade.grade}</TableCell>
              <TableCell>{new Date(grade.date).toLocaleDateString('cs-CZ')}</TableCell>
              <TableCell className="text-muted-foreground">{grade.notes}</TableCell>
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
  );
}

export default function StudentiPage() {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(mockStudents[0].id);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(mockStudents[0]);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const { toast } = useToast();

  const handleStudentChange = (studentId: string) => {
    setSelectedStudentId(studentId);
    const student = getStudentById(studentId);
    setSelectedStudent(student || null);
    setSummary('');
  };

  const handleGenerateSummary = async () => {
    if (!selectedStudent) return;
    setIsSummaryLoading(true);
    setSummary('');
    try {
      const result = await generateGradeSummary({
        studentName: selectedStudent.name,
        grades: selectedStudent.grades.map(g => ({ subject: g.subject, grade: g.grade })),
        period: 'aktuální pololetí',
      });
      setSummary(result.summary);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Chyba při generování',
        description: 'Nepodařilo se vygenerovat souhrn. Zkuste to prosím znovu.',
      });
    } finally {
      setIsSummaryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-3xl font-bold tracking-tight">Správa studentů</h1>
        <p className="text-muted-foreground">Vyberte studenta pro zobrazení a správu známek.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Výběr studenta</CardTitle>
          <Select onValueChange={handleStudentChange} defaultValue={selectedStudentId || undefined}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Vyberte studenta" />
            </SelectTrigger>
            <SelectContent>
              {mockStudents.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {selectedStudent ? (
            <div>
              <h3 className="text-xl font-semibold mb-4">Známky - {selectedStudent.name}</h3>
              <GradeTable grades={selectedStudent.grades} />
            </div>
          ) : (
            <p className="text-muted-foreground">Vyberte prosím studenta ze seznamu.</p>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handleGenerateSummary} disabled={!selectedStudent || isSummaryLoading}>
                {isSummaryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Generovat AI souhrn
            </Button>
            {/* Add Grade Dialog can be implemented here */}
            <Button>Přidat známku</Button>
        </CardFooter>
      </Card>
      {isSummaryLoading && (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-center space-x-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Generuji souhrn...</span>
                </div>
            </CardContent>
        </Card>
      )}
      {summary && (
        <Card>
            <CardHeader>
                <CardTitle>Vygenerovaný souhrn</CardTitle>
                <CardDescription>Toto je AI souhrn prospěchu studenta {selectedStudent?.name}.</CardDescription>
            </CardHeader>
            <CardContent>
                <Textarea value={summary} readOnly rows={6} className="bg-muted" />
            </CardContent>
        </Card>
      )}
    </div>
  );
}

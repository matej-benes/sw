'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { getStudentForParent, getStudentById } from '@/lib/mock-data';
import type { Grade, Student } from '@/lib/types';
import { useEffect, useState } from 'react';

export default function ZnamkyPage() {
  const { user, hasRole } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (user) {
      if (hasRole('rodic') && user.studentId) {
        // In a real app, user.studentId would probably be the student's user ID, not student-1
        // but for mock data this works. We might need to adjust based on final user<->student link
        const studentUser = getStudentById(`student-${user.studentId.split('-')[1]}`);
        setStudent(studentUser || null);
      } else if (hasRole('ziak')) {
        const self = getStudentById(`student-${user.id.split('-')[1]}`); 
        setStudent(self || null);
      }
    }
  }, [user, hasRole]);
  
  // Use Adam Volný as default for parent view if their child is not found, for demo purposes
  useEffect(()=> {
    if(hasRole('rodic') && !student){
        setStudent(getStudentById('student-1') || null)
    }
  },[hasRole, student])


  const grades = student?.grades || [];
  
  const calculateAverage = (grades: Grade[]) => {
    if (grades.length === 0) return 'N/A';
    const sum = grades.reduce((acc, g) => acc + g.grade, 0);
    return (sum / grades.length).toFixed(2);
  }

  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-3xl font-bold tracking-tight">Přehled známek</h1>
        <p className="text-muted-foreground">Zde naleznete přehled všech Vašich známek.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {hasRole('rodic') ? `Známky pro ${student?.name || 'Vaše dítě'}` : 'Moje známky'}
          </CardTitle>
          <CardDescription>
            Průměrná známka: <span className="font-bold text-primary">{calculateAverage(grades)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    <TableCell className="text-center font-bold text-lg">{grade.grade}</TableCell>
                    <TableCell>{new Date(grade.date).toLocaleDateString('cs-CZ')}</TableCell>
                    <TableCell className="text-muted-foreground">{grade.notes || '-'}</TableCell>
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
    </div>
  );
}

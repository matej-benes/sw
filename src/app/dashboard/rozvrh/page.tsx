'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockStudentTimetable, mockTeacherTimetable } from '@/lib/mock-data';
import type { Timetable } from '@/lib/types';

function TimetableDisplay({ timetable, isTeacher }: { timetable: Timetable; isTeacher: boolean }) {
  const days = Object.keys(timetable);

  return (
    <Tabs defaultValue={days[0]} className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        {days.map((day) => (
          <TabsTrigger key={day} value={day}>{day}</TabsTrigger>
        ))}
      </TabsList>
      {days.map((day) => (
        <TabsContent key={day} value={day}>
          <Card>
            <CardContent className="p-0">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[120px]">Čas</TableHead>
                    <TableHead>Předmět</TableHead>
                    <TableHead>{isTeacher ? 'Třída' : 'Učitel'}</TableHead>
                    <TableHead className="text-right">Místnost</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {timetable[day].length > 0 ? (
                        timetable[day].map((lesson, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium">{lesson.time}</TableCell>
                                <TableCell>{lesson.subject}</TableCell>
                                <TableCell>{isTeacher ? lesson.class : lesson.teacher}</TableCell>
                                <TableCell className="text-right">{lesson.room}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                Dnes není žádná výuka.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                </Table>
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}


export default function RozvrhPage() {
  const { user } = useAuth();

  const isTeacher = user?.role === 'ucitel';
  const timetable = isTeacher ? mockTeacherTimetable : mockStudentTimetable;
  
  const title = isTeacher ? 'Váš rozvrh' : (user?.role === 'rodic' ? 'Rozvrh dítěte' : 'Váš rozvrh');
  const description = isTeacher ? 'Přehled Vašich vyučovacích hodin.' : 'Přehled vyučovacích hodin.';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <TimetableDisplay timetable={timetable} isTeacher={isTeacher} />
    </div>
  );
}

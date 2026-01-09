'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { TimetableWidget } from '@/components/timetable-widget';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState, useMemo, useEffect } from 'react';
import { addDays, format, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { UserNav } from '@/components/layout/user-nav';
import type { Udalost, Rozvrh, Substitution, Trida, Znamka, Oznameni, User } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

// --- Teacher Dashboard ---
function TeacherDashboard() {
    const firestore = useFirestore();
    const { user } = useAuth();
    const { toast } = useToast();

    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [grade, setGrade] = useState('');
    const [subject, setSubject] = useState('');

    const teacherClassesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'tridy'), where('ucitelId', '==', user.id));
    }, [firestore, user]);
    const { data: teacherClasses } = useCollection<Trida>(teacherClassesQuery);

    const studentsQuery = useMemoFirebase(() => {
        if (!firestore || !selectedClassId) return null;
        return query(collection(firestore, 'users'), where('tridaId', '==', selectedClassId));
    }, [firestore, selectedClassId]);
    const { data: students } = useCollection<User>(studentsQuery);
    
    const handleAddGrade = () => {
        if (!firestore || !user || !selectedStudentId || !grade || !subject) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Všechna pole jsou povinná.'});
            return;
        }

        const newGrade: Omit<Znamka, 'id'> = {
            studentId: selectedStudentId,
            predmet: subject,
            hodnota: parseInt(grade, 10),
            datum: new Date().toISOString(),
            ucitelId: user.id,
        };

        addDocumentNonBlocking(collection(firestore, 'znamky'), newGrade);
        toast({ title: 'Známka uložena', description: 'Známka byla úspěšně přidána.' });
        setGrade('');
        setSubject('');
    };

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">Přehled učitele</h1>
            <Card>
                <CardHeader><CardTitle>Moje třídy</CardTitle></CardHeader>
                <CardContent className="flex gap-2">
                    {teacherClasses?.map(c => (
                        <Button key={c.id} onClick={() => setSelectedClassId(c.id)} variant={selectedClassId === c.id ? 'default' : 'outline'}>
                            {c.nazev}
                        </Button>
                    ))}
                </CardContent>
            </Card>

            {selectedClassId && (
                 <Card>
                    <CardHeader><CardTitle>Přidat známku</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Student</Label>
                                <div className="flex flex-col gap-2 mt-2">
                                {students?.map(s => (
                                    <Button key={s.id} onClick={() => setSelectedStudentId(s.id)} variant={selectedStudentId === s.id ? 'secondary' : 'ghost'} className="justify-start">
                                        {s.name}
                                    </Button>
                                ))}
                                </div>
                            </div>
                             <div>
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Předmět</Label>
                                    <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Např. Matematika" />
                                </div>
                                 <div className="space-y-2 mt-4">
                                    <Label htmlFor="grade">Známka (1-5)</Label>
                                    <Input id="grade" type="number" min="1" max="5" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="1" />
                                </div>
                                <Button onClick={handleAddGrade} disabled={!selectedStudentId} className="mt-4">Uložit známku</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}


// --- Parent Dashboard ---
function ParentDashboard() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const router = useRouter();

  const gradesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.studentId) return null;
    return query(collection(firestore, 'znamky'), where('studentId', '==', user.studentId));
  }, [firestore, user]);
  const { data: grades } = useCollection<Znamka>(gradesQuery);
  
  const averageGrade = useMemo(() => {
    if (!grades || grades.length === 0) return "N/A";
    const sum = grades.reduce((acc, g) => acc + g.hodnota, 0);
    return (sum / grades.length).toFixed(2);
  }, [grades]);

  return (
    <div className="space-y-4">
        <h1 className="text-2xl font-bold">Přehled rodiče</h1>
        <Card>
            <CardHeader>
                <CardTitle>Známky</CardTitle>
                <CardDescription>Průměr: <span className="font-bold text-primary">{averageGrade}</span></CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow><TableHead>Předmět</TableHead><TableHead>Známka</TableHead><TableHead>Datum</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                        {grades?.map(g => (
                            <TableRow key={g.id}><TableCell>{g.predmet}</TableCell><TableCell>{g.hodnota}</TableCell><TableCell>{format(new Date(g.datum), 'd.M.yyyy')}</TableCell></TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Button onClick={() => router.push('/dashboard/zpravy')}>Poslat zprávu učiteli</Button>
    </div>
  );
}


// --- Student Dashboard ---
function StudentDashboard() {
  const { user } = useAuth();
  const firestore = useFirestore();

  const scheduleQuery = useMemoFirebase(() => {
    if (!firestore || !user?.tridaId) return null;
    const today = format(new Date(), 'yyyy-MM-dd');
    return doc(firestore, 'rozvrhy', `${user.tridaId}-${today}`);
  }, [firestore, user]);
  const { data: schedule } = useCollection<Rozvrh>(scheduleQuery as any); // useCollection for single doc for simplicity

  const gradesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'znamky'), where('studentId', '==', user.id));
  }, [firestore, user]);
  const { data: grades } = useCollection<Znamka>(gradesQuery);
  
  const announcementsQuery = useMemoFirebase(() => {
    if(!firestore || !user?.tridaId) return null;
    return query(collection(firestore, 'oznameni'), where('proTridu', '==', user.tridaId));
  }, [firestore, user]);
  const { data: announcements } = useCollection<Oznameni>(announcementsQuery);
  
  const todaySchedule = schedule?.[0]; // useCollection returns array

  return (
    <div className="space-y-4">
        <h1 className="text-2xl font-bold">Můj přehled</h1>
        <div className="grid md:grid-cols-2 gap-4">
            <Card>
                <CardHeader><CardTitle>Rozvrh na dnes</CardTitle></CardHeader>
                <CardContent>
                    {todaySchedule?.hodiny?.length > 0 ? (
                         <Table>
                            <TableHeader>
                                <TableRow><TableHead>Hodina</TableHead><TableHead>Předmět</TableHead></TableRow>
                            </TableHeader>
                             <TableBody>
                                {todaySchedule.hodiny.map((h, i) => h && <TableRow key={i}><TableCell>{i+1}</TableCell><TableCell>{h.subjectName}</TableCell></TableRow>)}
                            </TableBody>
                        </Table>
                    ) : <p>Dnes není výuka.</p>}
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Poslední známky</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow><TableHead>Předmět</TableHead><TableHead>Známka</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {grades?.slice(0, 5).map(g => (
                                <TableRow key={g.id}><TableCell>{g.predmet}</TableCell><TableCell>{g.hodnota}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
         <Card>
            <CardHeader><CardTitle>Oznámení</CardTitle></CardHeader>
            <CardContent>
                {announcements?.map(a => (
                    <div key={a.id} className="border-b pb-2 mb-2">
                        <p className="font-semibold">{a.text}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(a.datum), 'd.M.yyyy')}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { user, hasRole } = useAuth();

  if (!user) return null;

  if (hasRole('ucitel')) {
    return <TeacherDashboard />;
  }
  if (hasRole('rodic')) {
    return <ParentDashboard />;
  }
  if (hasRole('ziak')) {
    return <StudentDashboard />;
  }

  // Fallback for administrator or other roles
  return (
    <div>
        <h1 className="text-3xl font-bold tracking-tight">Vítejte zpět, {user.name}!</h1>
        <p className="text-muted-foreground">Vyberte akci z menu.</p>
    </div>
  )
}

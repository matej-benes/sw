'use client';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, ChevronLeft, Info, Save, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useDoc, useCollection, useMemoFirebase, setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, writeBatch } from 'firebase/firestore';
import type { User, Trida, Predmet, AttendanceStatus, ZapisHodiny, Absence } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { Checkbox } from '@/components/ui/checkbox';


const attendanceCycle: AttendanceStatus[] = ['-', '/', 'O', 'N', 'S'];

const attendanceLegend: { [key in AttendanceStatus]: string } = {
    '-': 'přítomen',
    '/': 'nepřítomen (neurčitá absence)',
    'O': 'omluveno',
    'N': 'neomluveno',
    'S': 'nezapočítávaná absence (akce školy, ...)',
};

type StudentWithAttendance = User & { attendanceStatus: AttendanceStatus; reason: string };

export default function TridniKnihaZapisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user: teacherUser } = useAuth();

  const tridaId = searchParams.get('tridaId');
  const datum = searchParams.get('datum');
  const hodina = searchParams.get('hodina');
  const predmetId = searchParams.get('predmetId');
  
  const zapisId = useMemo(() => {
    if (!tridaId || !datum || !hodina) return null;
    return `${tridaId}-${datum}-${hodina}`;
  }, [tridaId, datum, hodina]);

  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [students, setStudents] = useState<StudentWithAttendance[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Fetch existing entry if it exists
  const zapisRef = useMemoFirebase(() => {
      if(!firestore || !zapisId) return null;
      return doc(firestore, 'zapisyHodin', zapisId);
  }, [firestore, zapisId]);
  const { data: existingZapis, isLoading: zapisLoading } = useDoc<ZapisHodiny>(zapisRef);

  // Fetch class info
  const tridaRef = useMemoFirebase(() => {
      if(!firestore || !tridaId) return null;
      return doc(firestore, 'tridy', tridaId);
  }, [firestore, tridaId]);
  const { data: tridaData, isLoading: tridaLoading } = useDoc<Trida>(tridaRef);

  // Fetch subject info
  const predmetRef = useMemoFirebase(() => {
      if(!firestore || !predmetId) return null;
      return doc(firestore, 'predmety', predmetId);
  }, [firestore, predmetId]);
  const { data: predmetData, isLoading: predmetLoading } = useDoc<Predmet>(predmetRef);

  // Fetch students for the class
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !tridaId) return null;
    return query(collection(firestore, "users"), where("tridaId", "==", tridaId));
  }, [firestore, tridaId]);
  const { data: studentDocs, isLoading: studentsLoading } = useCollection<User>(studentsQuery);
  
  const isClassTeacher = teacherUser?.id === tridaData?.ucitelId;

    useEffect(() => {
        if(tridaData?.organizationId) {
            setOrganizationId(tridaData.organizationId);
        }
  }, [tridaData]);

  useEffect(() => {
    if (!studentsLoading && studentDocs) {
        if (existingZapis) {
            // Load from existing entry
            setTopic(existingZapis.topic);
            setNote(existingZapis.note || '');
            setStudents(studentDocs.map(s => {
                const attendanceRecord = existingZapis.attendance.find(a => a.studentId === s.id);
                return {
                    ...s,
                    attendanceStatus: attendanceRecord?.status || '-',
                    reason: attendanceRecord?.reason || ''
                }
            }));
        } else {
            // New entry
            setStudents(studentDocs.map(s => ({
                ...s,
                attendanceStatus: '-',
                reason: ''
            })));
        }
    }
  }, [studentDocs, studentsLoading, existingZapis]);

  useEffect(() => {
     setIsLoading(tridaLoading || predmetLoading || studentsLoading || zapisLoading);
  }, [tridaLoading, predmetLoading, studentsLoading, zapisLoading]);


  const handleSave = async (goBack: boolean) => {
    if (!firestore || !teacherUser || !zapisId || !tridaId || !datum || !hodina || !predmetId || !organizationId) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Nekompletní data pro uložení.'});
        return;
    }
    
    const zapisData: ZapisHodiny = {
        id: zapisId,
        tridaId,
        datum,
        hodina,
        predmetId,
        ucitelId: teacherUser.id,
        topic,
        note,
        organizationId: organizationId,
        attendance: students.map(s => ({
            studentId: s.id,
            status: s.attendanceStatus,
            reason: s.reason,
        })),
    };
    
    try {
      const batch = writeBatch(firestore);

      // 1. Save the class book entry
      batch.set(doc(firestore, 'zapisyHodin', zapisId), zapisData, { merge: true });

      // 2. Create absence records for absent students
      const absentStudents = students.filter(s => s.attendanceStatus !== '-');
      for (const student of absentStudents) {
        const absenceId = `${student.id}-${datum}-${hodina}`;
        const absenceRef = doc(firestore, 'absences', absenceId);
        const absenceData: Omit<Absence, 'id'> = {
          organizationId: organizationId,
          studentId: student.id,
          tridaId,
          datum,
          hodina,
          predmetId,
          ucitelId: teacherUser.id,
          status: student.attendanceStatus,
        };
        batch.set(absenceRef, absenceData, { merge: true });
      }

      await batch.commit();

      toast({
        title: 'Uloženo',
        description: 'Zápis do třídní knihy a záznamy o absenci byly úspěšně uloženy.',
      });
      if (goBack) {
        router.back();
      }
    } catch(e) {
      console.error("Error saving class book entry and absences:", e);
      toast({ variant: 'destructive', title: 'Chyba ukládání', description: 'Nepodařilo se uložit data.'});
    }
  };

  const handleAttendanceClick = (studentId: string) => {
    setStudents(prevStudents => 
        prevStudents.map(student => {
            if (student.id === studentId) {
                const currentStatus = student.attendanceStatus;
                const currentIndex = attendanceCycle.indexOf(currentStatus);
                const nextIndex = (currentIndex + 1) % attendanceCycle.length;
                return { ...student, attendanceStatus: attendanceCycle[nextIndex] };
            }
            return student;
        })
    );
  };

  const handleReasonChange = (studentId: string, reason: string) => {
    setStudents(prevStudents => 
        prevStudents.map(student => 
            student.id === studentId ? { ...student, reason } : student
        )
    );
  }

  const handleSelectStudent = (studentId: string, isSelected: boolean) => {
    setSelectedStudents(prev => 
        isSelected ? [...prev, studentId] : prev.filter(id => id !== studentId)
    );
  }

  const handleBulkUpdate = (status: AttendanceStatus) => {
    if (selectedStudents.length === 0) {
        toast({ variant: 'destructive', title: 'Není vybrán žádný žák' });
        return;
    }
    // This is a client-side only update for the UI. The actual saving happens when 'handleSave' is called.
    // In a real app, you might want to update all lesson entries for the day for these students.
    // This example only updates the current lesson's view.
    setStudents(prev => prev.map(s => 
        selectedStudents.includes(s.id) ? { ...s, attendanceStatus: status } : s
    ));
    toast({ title: 'Docházka aktualizována', description: `U ${selectedStudents.length} žáků byla nastavena ${status === 'O' ? 'omluvená' : 'neomluvená'} absence.`})
  }
  
  const getAttendanceCellClass = (status: AttendanceStatus) => {
    switch (status) {
        case '/': return 'bg-yellow-200';
        case 'O': return 'bg-green-200';
        case 'N': return 'bg-red-200';
        case 'S': return 'bg-blue-200';
        default: return 'cursor-pointer';
    }
  }
  
  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center">Načítání dat...</div>;
  }
  
  if (!tridaId || !datum || !hodina || !predmetId) {
    return <div className="flex h-screen w-full items-center justify-center text-destructive">Chybějící parametry v URL.</div>;
  }


  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Zápis do třídní knihy</CardTitle>
          <CardDescription>
            Zápis pro třídu {tridaData?.nazev || '...'} dne {datum ? format(parseISO(datum), 'd. M. yyyy', {locale: cs}) : '...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Top form section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm font-medium">Třída</label>
              <Input value={tridaData?.nazev || ''} readOnly />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Datum</label>
              <div className="relative">
                <Input value={datum ? format(parseISO(datum), 'd. M. yyyy', {locale: cs}) : ''} readOnly />
                <CalendarIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Vyučovací hodina</label>
              <Input value={hodina || ''} readOnly />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Předmět</label>
              <Input value={predmetData?.name || ''} readOnly />
            </div>
             <div className="flex flex-wrap gap-2 col-span-full xl:col-span-2">
                 <Button variant="outline" size="sm">Vybrat hodinu z rozvrhu</Button>
                 <Button variant="outline" size="sm">Povolit změnu</Button>
            </div>
             <div className="space-y-1 col-span-1 md:col-span-2">
              <label className="text-sm font-medium">Skupina</label>
              <Input value={`${tridaData?.nazev || ''} (Celá třída)`} readOnly />
            </div>
            <div className="col-span-1 md:col-span-2 lg:col-span-4 space-y-1">
              <label className="text-sm font-medium">Probírané učivo</label>
              <div className="flex flex-col sm:flex-row gap-2">
                 <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
                 <div className="flex gap-2">
                    <Button size="sm">Vybrat z probraného učiva</Button>
                    <Button size="sm">Vybrat z tematických plánů</Button>
                 </div>
              </div>
            </div>
            <div className="col-span-1 md:col-span-2 lg:col-span-4 space-y-1">
              <label className="text-sm font-medium">Poznámka (BOZP, EU projekty, ...)</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex items-end col-span-full">
                 <Button variant="outline">Zápis/zobrazení informací k výuce</Button>
            </div>
          </div>

          {/* Attendance Table */}
          <div>
            <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-muted-foreground">
                Seznam dětí/žáků třídy (Přítomnost [-] nebo Nepřítomnost [/] se přepíná kliknutím v levé části pole):
                </p>
                 {isClassTeacher && (
                    <div className="flex items-center gap-2">
                         <Button size="sm" onClick={() => handleBulkUpdate('O')} disabled={selectedStudents.length === 0}><CheckCircle className="mr-2 h-4 w-4"/>Omluvit celý den</Button>
                         <Button size="sm" variant="destructive" onClick={() => handleBulkUpdate('N')} disabled={selectedStudents.length === 0}><XCircle className="mr-2 h-4 w-4"/>Neomluvit celý den</Button>
                    </div>
                 )}
            </div>
            <div className="overflow-x-auto border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {isClassTeacher && (
                                 <TableHead className="w-12">
                                    <Checkbox 
                                        checked={selectedStudents.length === students.length && students.length > 0}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedStudents(students.map(s => s.id));
                                            } else {
                                                setSelectedStudents([]);
                                            }
                                        }}
                                    />
                                </TableHead>
                            )}
                            <TableHead className="min-w-[200px]">Příjmení a jméno (ČVTV)</TableHead>
                            <TableHead className="text-center w-12">{hodina}</TableHead>
                            <TableHead className="min-w-[150px]">Důvod absence</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {students.map((student) => (
                            <TableRow key={student.id}>
                                {isClassTeacher && (
                                    <TableCell>
                                        <Checkbox 
                                            checked={selectedStudents.includes(student.id)}
                                            onCheckedChange={(checked) => handleSelectStudent(student.id, !!checked)}
                                        />
                                    </TableCell>
                                )}
                                <TableCell className="font-medium flex items-center gap-2">
                                    <span>{student.name}</span>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                   <Info className="h-4 w-4 text-blue-500" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-background border p-4">
                                                <div className="text-sm space-y-2">
                                                    <p className="font-bold">Doporučení pro vzdělávání</p>
                                                    <p><strong>Druh postižení:</strong> Středně závažné poruchy učení</p>
                                                    <p><strong>Doporučení pro učitele:</strong> Individuální přístup, kooperace s asistentkou, ...</p>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </TableCell>
                                <TableCell className={cn("p-0 text-center", getAttendanceCellClass(student.attendanceStatus))} onClick={() => handleAttendanceClick(student.id)}>
                                    <div className="w-full h-full flex items-center justify-center p-2">{student.attendanceStatus}</div>
                                </TableCell>
                                <TableCell>
                                    <Input 
                                      className="h-8" 
                                      value={student.reason} 
                                      onChange={(e) => handleReasonChange(student.id, e.target.value)}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
             <p className="text-sm text-muted-foreground mt-2">
                Celkem dětí/žáků: {students.length} (přítomno: {students.filter(s => s.attendanceStatus === '-').length}, nepřítomno: {students.filter(s => s.attendanceStatus !== '-').length})
            </p>
          </div>
            
            {/* Legend */}
            <div>
                <CardTitle className="text-lg mb-2">Legenda</CardTitle>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    {Object.entries(attendanceLegend).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                            <Badge variant="outline" className="text-base font-mono">{key}</Badge>
                            <span>{value}</span>
                        </div>
                    ))}
                </div>
            </div>

        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row sm:justify-between gap-4">
            <div className="flex flex-wrap gap-2">
                 <Button onClick={() => handleSave(false)}>
                    <Save className="mr-2 h-4 w-4" />
                    Uložit a zůstat
                 </Button>
                 <Button onClick={() => handleSave(true)}>
                    <Save className="mr-2 h-4 w-4" />
                    Uložit a zpět
                </Button>
            </div>
            
            <Button variant="outline" onClick={() => router.back()}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Zpět
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

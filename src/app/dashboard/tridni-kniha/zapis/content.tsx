'use client';
import { useState, useEffect } from 'react';
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
import { CalendarIcon, ChevronLeft, Info, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { User, Trida, Predmet } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';

type AttendanceStatus = '-' | '/' | 'O' | 'N' | 'S';
const attendanceCycle: AttendanceStatus[] = ['-', '/', 'O', 'N', 'S'];

const attendanceLegend: { [key in AttendanceStatus]: string } = {
    '-': 'přítomen',
    '/': 'nepřítomen (neurčitá absence)',
    'O': 'omluveno',
    'N': 'neomluveno',
    'S': 'nezapočítávaná absence (akce školy, ...)',
};

type StudentWithAttendance = User & { attendance: AttendanceStatus[] };

export default function TridniKnihaZapisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { toast } = useToast();

  const tridaId = searchParams.get('tridaId');
  const datum = searchParams.get('datum');
  const hodina = searchParams.get('hodina');
  const predmetId = searchParams.get('predmetId');

  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [students, setStudents] = useState<StudentWithAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch class info
  const tridaRef = useMemoFirebase(() => tridaId ? doc(firestore, 'tridy', tridaId) : null, [firestore, tridaId]);
  const { data: tridaData, isLoading: tridaLoading } = useDoc<Trida>(tridaRef);

  // Fetch subject info
  const predmetRef = useMemoFirebase(() => predmetId ? doc(firestore, 'predmety', predmetId) : null, [firestore, predmetId]);
  const { data: predmetData, isLoading: predmetLoading } = useDoc<Predmet>(predmetRef);

  // Fetch students for the class
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !tridaData?.ziaciIds || tridaData.ziaciIds.length === 0) return null;
    return query(collection(firestore, "users"), where('__name__', 'in', tridaData.ziaciIds));
  }, [firestore, tridaData]);
  const { data: studentDocs, isLoading: studentsLoading } = useCollection<User>(studentsQuery);
  
  useEffect(() => {
    if (!studentsLoading && studentDocs) {
      setStudents(studentDocs.map(s => ({
        ...s,
        attendance: Array(10).fill('-')
      })));
    }
  }, [studentDocs, studentsLoading]);

  useEffect(() => {
     setIsLoading(tridaLoading || predmetLoading || studentsLoading);
  }, [tridaLoading, predmetLoading, studentsLoading]);


  const handleSave = (goBack: boolean) => {
    // In a real app, you would save the data to a database
    console.log({
      tridaId,
      datum,
      hodina,
      predmetId,
      topic,
      note,
      attendance: students.map(s => ({ studentId: s.id, attendance: s.attendance })),
    });
    toast({
      title: 'Uloženo',
      description: 'Zápis do třídní knihy byl úspěšně uložen.',
    });
    if (goBack) {
      router.back();
    }
  };

  const handleAttendanceClick = (studentId: string, hourIndex: number) => {
    setStudents(prevStudents => 
        prevStudents.map(student => {
            if (student.id === studentId) {
                const newAttendance = [...student.attendance];
                const currentStatus = newAttendance[hourIndex];
                const currentIndex = attendanceCycle.indexOf(currentStatus);
                const nextIndex = (currentIndex + 1) % attendanceCycle.length;
                newAttendance[hourIndex] = attendanceCycle[nextIndex];
                return { ...student, attendance: newAttendance };
            }
            return student;
        })
    );
  };
  
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 items-end">
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
             <div className="flex gap-2 col-span-full xl:col-span-2">
                 <Button variant="outline">Vybrat hodinu z rozvrhu</Button>
                 <Button variant="outline">Povolit změnu</Button>
            </div>
             <div className="space-y-1">
              <label className="text-sm font-medium">Skupina</label>
              <Input value={`${tridaData?.nazev || ''} (Celá třída)`} readOnly />
            </div>
            <div className="md:col-span-2 lg:col-span-4 xl:col-span-2 space-y-1">
              <label className="text-sm font-medium">Probírané učivo</label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
             <div className="flex gap-2 items-end col-span-full xl:col-span-3">
                 <Button>Vybrat z probraného učiva</Button>
                 <Button>Vybrat z tematických plánů</Button>
            </div>
            <div className="md:col-span-2 lg:col-span-4 xl:col-span-3 space-y-1">
              <label className="text-sm font-medium">Poznámka (BOZP, EU projekty, ...)</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex items-end col-span-full xl:col-span-3">
                 <Button variant="outline">Zápis/zobrazení informací k výuce</Button>
            </div>
          </div>

          {/* Attendance Table */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Seznam dětí/žáků třídy (Přítomnost [-] nebo Nepřítomnost [/] se přepíná kliknutím v levé části pole):
            </p>
            <div className="overflow-x-auto border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[250px]">Příjmení a jméno (ČVTV)</TableHead>
                            {Array.from({ length: 10 }, (_, i) => (
                                <TableHead key={i} className="text-center w-12">{i + 1}</TableHead>
                            ))}
                            <TableHead>Důvod absence</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {students.map((student) => (
                            <TableRow key={student.id}>
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
                                {student.attendance.map((status, i) => (
                                    <TableCell key={i} className={cn("p-0 text-center", getAttendanceCellClass(status))} onClick={() => handleAttendanceClick(student.id, i)}>
                                        <div className="w-full h-full flex items-center justify-center p-2">{status}</div>
                                    </TableCell>
                                ))}
                                <TableCell>
                                    <Input className="h-8" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
             <p className="text-sm text-muted-foreground mt-2">
                Celkem dětí/žáků: {students.length} (přítomno: {students.filter(s => s.attendance[Number(hodina)-1] === '-').length}, nepřítomno: {students.filter(s => s.attendance[Number(hodina)-1] !== '-').length})
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
        <CardFooter className="flex justify-between">
            <div className="flex gap-2">
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

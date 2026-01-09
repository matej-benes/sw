'use client';
import { useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, ChevronLeft, ChevronRight, User, Info, Save } from 'lucide-react';
import { mockStudents } from '@/lib/mock-data'; // Using mock data for now
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

type AttendanceStatus = '-' | '/' | 'O' | 'N' | 'S';
const attendanceCycle: AttendanceStatus[] = ['-', '/', 'O', 'N', 'S'];

const attendanceLegend: { [key in AttendanceStatus]: string } = {
    '-': 'přítomen',
    '/': 'nepřítomen (neurčitá absence)',
    'O': 'omluveno',
    'N': 'neomluveno',
    'S': 'nezapočítávaná absence (akce školy, ...)',
};

const students = mockStudents.map(s => ({...s, attendance: Array(10).fill('-') as AttendanceStatus[]}))

export default function TridniKnihaEntryPage({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const [topic, setTopic] = useState('Psaní au, ou');
  const [note, setNote] = useState('');
  const [studentData, setStudentData] = useState(students);

  const handleSave = (goBack: boolean) => {
    // In a real app, you would save the data to a database
    console.log({
      lessonId: params.id,
      topic,
      note,
      attendance: studentData.map(s => ({ studentId: s.id, attendance: s.attendance })),
    });
    toast({
      title: 'Uloženo',
      description: 'Zápis do třídní knihy byl úspěšně uložen.',
    });
    if (goBack) {
      // In a real app, you might use useRouter to go back
      // For now, we just log it
      console.log("Navigating back...");
    }
  };

  const handleAttendanceClick = (studentId: string, hourIndex: number) => {
    setStudentData(prevStudents => 
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


  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Zápis do třídní knihy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Top form section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm font-medium">Třída</label>
              <Input value="2.A" readOnly />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Datum</label>
              <div className="relative">
                <Input value="12.05.2025" readOnly />
                <CalendarIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Vyučovací hodina</label>
              <Input value="1" readOnly />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Předmět</label>
              <Input value="Český jazyk" readOnly />
            </div>
             <div className="flex gap-2 col-span-full xl:col-span-2">
                 <Button variant="outline">Vybrat hodinu z rozvrhu</Button>
                 <Button variant="outline">Povolit změnu</Button>
            </div>
             <div className="space-y-1">
              <label className="text-sm font-medium">Skupina</label>
              <Input value="2.A (Celá třída)" readOnly />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Pořadové číslo</label>
              <div className="flex items-center">
                <Input type="number" value="8" readOnly className="text-center" />
                <div className='flex flex-col'>
                    <Button variant="ghost" size="icon" className="h-5 w-5"><ChevronLeft className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 lg:col-span-4 xl:col-span-2 space-y-1">
              <label className="text-sm font-medium">Probírané učivo</label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
             <div className="flex gap-2 items-end col-span-full xl:col-span-2">
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
                        {studentData.map((student) => (
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
                Celkem dětí/žáků: {studentData.length} (přítomno: {studentData.filter(s => s.attendance[0] === '-').length}, nepřítomno: {studentData.filter(s => s.attendance[0] !== '-').length})
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
                    <Save className="mr-2" />
                    Uložit a zůstat
                 </Button>
                 <Button onClick={() => handleSave(true)}>
                    <Save className="mr-2" />
                    Uložit a zpět
                </Button>
            </div>
            <Link href="/dashboard">
                <Button variant="outline">
                    <ChevronLeft className="mr-2" />
                    Zpět
                </Button>
            </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

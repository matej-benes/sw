'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar as CalendarIcon, Plus, Trash2, Settings, FileSpreadsheet, Printer } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Trida, User, PoznamkaZaka } from '@/lib/types';


export default function PoznamkaZakaPage() {
  const firestore = useFirestore();

  const [selectedClass, setSelectedClass] = useState<string | undefined>();
  const [selectedStudent, setSelectedStudent] = useState<string | undefined>();
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Data fetching
  const tridyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]);
  const { data: classes, isLoading: classesLoading } = useCollection<Trida>(tridyCollection);

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !selectedClass) return null;
    return query(collection(firestore, "users"), where("tridaId", "==", selectedClass), where("roles", "array-contains", "ziak"));
  }, [firestore, selectedClass]);
  const { data: students, isLoading: studentsLoading } = useCollection<User>(studentsQuery);
  
  const notesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedStudent) {
      return null;
    }
    
    let q = query(collection(firestore, 'poznamky-zaku'), where('studentId', '==', selectedStudent));
    if (dateFrom) {
        q = query(q, where('datum', '>=', format(dateFrom, 'yyyy-MM-dd')));
    }
    if (dateTo) {
        q = query(q, where('datum', '<=', format(dateTo, 'yyyy-MM-dd')));
    }

    return q;
  }, [firestore, selectedStudent, dateFrom, dateTo]);
  const { data: notes, isLoading: notesLoading } = useCollection<PoznamkaZaka>(notesQuery);

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
    setSelectedStudent(undefined); // Reset student when class changes
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Poznámka žáka/studenta</h1>
        <Button variant="ghost" size="icon" onClick={() => window.print()}>
          <Printer className="h-6 w-6" />
        </Button>
      </div>
      <p className="text-muted-foreground">
        Formulář slouží pro evidenci poznámek vztažených ke konkrétnímu žákovi/studentovi. Poznámky si může zobrazit třídní učitel v uzávěrce třídního učitele.
      </p>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1.5">
              <label htmlFor="class-select" className="text-sm font-medium">Třída:</label>
              <Select onValueChange={handleClassChange} value={selectedClass}>
                <SelectTrigger id="class-select" className="w-[180px]">
                  <SelectValue placeholder="Vyberte třídu" />
                </SelectTrigger>
                <SelectContent>
                  {classesLoading ? <SelectItem value="loading" disabled>Načítání...</SelectItem> : 
                   classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="student-select" className="text-sm font-medium">Žák/Student:</label>
              <Select onValueChange={setSelectedStudent} disabled={!selectedClass || studentsLoading} value={selectedStudent}>
                <SelectTrigger id="student-select" className="w-[180px]">
                  <SelectValue placeholder="Vyberte žáka" />
                </SelectTrigger>
                <SelectContent>
                  {studentsLoading ? <SelectItem value="loading" disabled>Načítání...</SelectItem> :
                   students?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
             <Button>Změna parametrů výpisu</Button>
            
            <div className="grid gap-1.5">
              <label htmlFor="date-from" className="text-sm font-medium">Datum od:</label>
               <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-from"
                    variant={"outline"}
                    className="w-[180px] justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'PPP', { locale: cs }) : <span>Vyberte datum</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="grid gap-1.5">
              <label htmlFor="date-to" className="text-sm font-medium">do:</label>
                <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-to"
                    variant={"outline"}
                    className="w-[180px] justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'PPP', { locale: cs }) : <span>Vyberte datum</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-0">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Předmět</TableHead>
                        <TableHead>Žák/Student</TableHead>
                        <TableHead>Druh poznámky</TableHead>
                        <TableHead>Text poznámky</TableHead>
                        <TableHead>Učitel</TableHead>
                        <TableHead>Datum podpisu</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {notesLoading && (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Načítání poznámek...</TableCell>
                          </TableRow>
                        )}
                        {!notesLoading && notes?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    {!selectedStudent ? "Pro zobrazení poznámek vyberte třídu a žáka." : "Žádné záznamy k zobrazení."}
                                </TableCell>
                            </TableRow>
                        )}
                        {!notesLoading && notes?.map(note => {
                          const student = students?.find(s => s.id === note.studentId);
                          // In a real app, you would fetch teacher name based on ucitelId
                          const teacherName = 'Neznámý učitel'; 
                          return (
                            <TableRow key={note.id}>
                              <TableCell>{format(new Date(note.datum), 'dd.MM.yyyy')}</TableCell>
                              <TableCell>{note.predmet || '-'}</TableCell>
                              <TableCell>{student?.name || note.studentId}</TableCell>
                              <TableCell>{note.druh}</TableCell>
                              <TableCell className="max-w-xs truncate">{note.text}</TableCell>
                              <TableCell>{note.ucitelId}</TableCell>
                              <TableCell>{note.datumPodpisu ? format(new Date(note.datumPodpisu), 'dd.MM.yyyy') : 'Nepodepsáno'}</TableCell>
                            </TableRow>
                          )
                        })}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
        <CardFooter className="p-3 flex justify-between items-center bg-muted/50">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <p>Počet záznamů: {notes?.length || 0}</p>
            </div>
            <div className="flex items-center gap-2">
                 <Button><Plus className="mr-2 h-4 w-4" /> Nový záznam</Button>
                 <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Smazat vybrané</Button>
            </div>
             <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon"><Settings className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon"><FileSpreadsheet className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon"><Printer className="h-5 w-5" /></Button>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}

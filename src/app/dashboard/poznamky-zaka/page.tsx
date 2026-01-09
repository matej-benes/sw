'use client';

import { useState } from 'react';
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

// Mock data for demonstration
const classes = [{ id: 'trida-1', nazev: 'VI.A' }, { id: 'trida-2', nazev: 'VII.B' }];
const students = [{ id: 'student-1', name: 'Kropáček Pavel', classId: 'trida-1' }, { id: 'student-2', name: 'Nováková Eva', classId: 'trida-1' }];

export default function PoznamkaZakaPage() {
  const [selectedClass, setSelectedClass] = useState<string | undefined>();
  const [selectedStudent, setSelectedStudent] = useState<string | undefined>();
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filteredStudents = selectedClass ? students.filter(s => s.classId === selectedClass) : students;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Poznámka žáka/studenta</h1>
        <Button variant="ghost" size="icon">
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
              <Select onValueChange={setSelectedClass}>
                <SelectTrigger id="class-select" className="w-[180px]">
                  <SelectValue placeholder="Vyberte třídu" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="student-select" className="text-sm font-medium">Žák/Student:</label>
              <Select onValueChange={setSelectedStudent} disabled={!selectedClass}>
                <SelectTrigger id="student-select" className="w-[180px]">
                  <SelectValue placeholder="Vyberte žáka" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
                        <TableHead>Vyuč. hod.</TableHead>
                        <TableHead>Předmět</TableHead>
                        <TableHead>Žák/Student</TableHead>
                        <TableHead>Druh poznámky</TableHead>
                        <TableHead>Text poznámky</TableHead>
                        <TableHead>Datum podpisu</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                Žádné záznamy k zobrazení.
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </CardContent>
        <CardFooter className="p-3 flex justify-between items-center bg-muted/50">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <p>Počet záznamů: 0</p>
                <p>Stránky: 1</p>
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

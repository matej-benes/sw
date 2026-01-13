
'use client';
import React, { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Absence, Trida, User, Predmet } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, UserX } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';


const attendanceStatusText = {
  '/': 'Neurčená',
  'O': 'Omluvená',
  'N': 'Neomluvená',
  'S': 'Nezapočítávaná',
  '-': 'Přítomen'
};

const attendanceStatusVariant = {
  '/': 'secondary',
  'O': 'default',
  'N': 'destructive',
  'S': 'outline',
  '-': 'default'
};


function AbsenceView() {
    const { user, hasRole, activeOrganizationId } = useAuth();
    const firestore = useFirestore();

    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    
    // Determine the student ID to query for based on the user role
    const targetStudentId = useMemo(() => {
        if (hasRole('ziak')) return user?.id;
        if (hasRole('rodic')) return user?.studentId;
        return selectedStudentId; // For teachers/admins
    }, [user, hasRole, selectedStudentId]);


    // Data fetching
    const absencesQuery = useMemoFirebase(() => {
        if (!firestore || !targetStudentId) return null;
        
        let q = query(collection(firestore, 'absences'), where('studentId', '==', targetStudentId));
        if (dateRange?.from) {
             q = query(q, where('datum', '>=', format(dateRange.from, 'yyyy-MM-dd')));
        }
        if (dateRange?.to) {
            q = query(q, where('datum', '<=', format(dateRange.to, 'yyyy-MM-dd')));
        }
        // Ordering by date descending would be nice, but requires composite index
        // q = query(q, orderBy('datum', 'desc'));
        return q;
    }, [firestore, targetStudentId, dateRange]);
    const { data: absences, isLoading } = useCollection<Absence>(absencesQuery);
    
    const { data: classes } = useCollection<Trida>(useMemoFirebase(() => {
        return firestore ? collection(firestore, 'tridy') : null;
    }, [firestore]));
    
    const studentsInClassQuery = useMemoFirebase(() => {
        if(!firestore || !selectedClassId) return null;
        return query(collection(firestore, 'users'), where('tridaId', '==', selectedClassId));
    }, [firestore, selectedClassId]);
    const { data: studentsInClass } = useCollection<User>(studentsInClassQuery);

    const { data: predmety } = useCollection<Predmet>(useMemoFirebase(() => {
        return firestore ? collection(firestore, 'predmety') : null;
    }, [firestore]));

    const getSubjectName = (id: string) => predmety?.find(p => p.id === id)?.shortcut || 'Neznámý';

    const sortedAbsences = useMemo(() => {
        return absences?.sort((a, b) => parseISO(b.datum).getTime() - parseISO(a.datum).getTime()) || [];
    }, [absences]);
    
    const isTeacherOrAdmin = hasRole('ucitel') || hasRole('administrator');


    return (
        <Card>
            <CardHeader>
                <CardTitle>Přehled absence</CardTitle>
                <CardDescription>Zde naleznete záznamy o zameškaných hodinách.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 {isTeacherOrAdmin && (
                    <div className="flex flex-wrap gap-4 p-4 border rounded-lg bg-muted/50">
                        <div className="grid gap-1.5">
                            <label className="text-sm font-medium">Třída</label>
                            <Select onValueChange={setSelectedClassId} value={selectedClassId || ''}>
                                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vyberte třídu" /></SelectTrigger>
                                <SelectContent>{classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <label className="text-sm font-medium">Žák</label>
                            <Select onValueChange={setSelectedStudentId} value={selectedStudentId || ''} disabled={!selectedClassId}>
                                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vyberte žáka" /></SelectTrigger>
                                <SelectContent>{studentsInClass?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
                 <div className="flex flex-wrap gap-4 items-center">
                     <label className="text-sm font-medium">Filtrovat podle data:</label>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                    dateRange.to ? `${format(dateRange.from, 'd.M.y')} - ${format(dateRange.to, 'd.M.y')}` : format(dateRange.from, 'd.M.y')
                                ) : <span>Vyberte rozsah</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="range" selected={dateRange} onSelect={setDateRange} locale={cs} />
                        </PopoverContent>
                    </Popover>
                    <Button variant="ghost" onClick={() => setDateRange(undefined)}>Zrušit filtr</Button>
                 </div>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Datum</TableHead>
                                <TableHead>Hodina</TableHead>
                                <TableHead>Předmět</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && <TableRow><TableCell colSpan={4} className="h-24 text-center">Načítání...</TableCell></TableRow>}
                            {!isLoading && sortedAbsences.length === 0 && (
                                 <TableRow><TableCell colSpan={4} className="h-24 text-center">Nebyly nalezeny žádné záznamy o absenci.</TableCell></TableRow>
                            )}
                            {!isLoading && sortedAbsences.map(absence => (
                                <TableRow key={absence.id}>
                                    <TableCell>{format(parseISO(absence.datum), 'EEEE, d.M.yyyy', {locale: cs})}</TableCell>
                                    <TableCell>{absence.hodina}.</TableCell>
                                    <TableCell>{getSubjectName(absence.predmetId)}</TableCell>
                                    <TableCell>
                                        <Badge variant={attendanceStatusVariant[absence.status] as any}>
                                            {attendanceStatusText[absence.status]}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
        </Card>
    )
}

export default function AbsencePage() {
    const { hasRole, loading } = useAuth();

    if (loading) {
        return <div>Načítání...</div>;
    }

    if (!hasRole('rodic') && !hasRole('ziak') && !hasRole('ucitel') && !hasRole('administrator')) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Přístup odepřen</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Tato stránka je určena pro žáky, rodiče a učitele.</p>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                 <UserX className="h-8 w-8" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Absence</h1>
                    <p className="text-muted-foreground">Přehled zameškaných vyučovacích hodin.</p>
                </div>
            </div>
            <AbsenceView />
        </div>
    );
}


    
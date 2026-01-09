'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { TimetableWidget } from '@/components/timetable-widget';
import {
  startOfWeek,
  addDays,
  format,
  subWeeks,
  addWeeks,
  isSameDay,
} from 'date-fns';
import { cs } from 'date-fns/locale';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type {
  Trida,
  User,
  Predmet,
  Ucebna,
  Rozvrh,
  Udalost,
  Substitution,
} from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

export default function RozvrhySuplovaniPage() {
  const firestore = useFirestore();
  const { user, hasRole, isUserLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  // Data fetching
  const { data: predmety } = useCollection<Predmet>(
    useMemoFirebase(
      () => (firestore ? collection(firestore, 'predmety') : null),
      [firestore]
    )
  );
  const { data: tridy } = useCollection<Trida>(
    useMemoFirebase(
      () => (firestore ? collection(firestore, 'tridy') : null),
      [firestore]
    )
  );
  const { data: ucitele } = useCollection<User>(
    useMemoFirebase(
      () =>
        firestore
          ? query(
              collection(firestore, 'users'),
              where('roles', 'array-contains', 'ucitel')
            )
          : null,
      [firestore]
    )
  );
  const { data: ucebny } = useCollection<Ucebna>(
    useMemoFirebase(
      () => (firestore ? collection(firestore, 'ucebny') : null),
      [firestore]
    )
  );
  const { data: schedulesData } = useCollection<Rozvrh>(
    useMemoFirebase(
      () => (firestore ? collection(firestore, 'rozvrhy') : null),
      [firestore]
    )
  );
  const { data: eventsData } = useCollection<Udalost>(
    useMemoFirebase(
      () => (firestore ? collection(firestore, 'udalosti') : null),
      [firestore]
    )
  );
  const { data: substitutionsData } = useCollection<Substitution>(
    useMemoFirebase(
      () => (firestore ? collection(firestore, 'suplovani') : null),
      [firestore]
    )
  );

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('tridy'); // 'tridy', 'ucitele', 'ucebny'
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(
    undefined
  );

  // Memoized derived data
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 5 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const weekLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[4];
    return `${format(start, 'd. M.')} - ${format(end, 'd. M. yyyy')}`;
  }, [weekDays]);

  const tridyOptions = useMemo(
    () =>
      tridy?.map((t) => ({ value: t.id, label: t.nazev })) || [],
    [tridy]
  );
    
  // Set default selected class once data is loaded
  useEffect(() => {
      if (tridy && !selectedClassId) {
          setSelectedClassId(tridy[0]?.id);
      }
  }, [tridy, selectedClassId]);

  // Handlers
  const handlePrevWeek = useCallback(() => {
    setCurrentDate((prev) => subWeeks(prev, 1));
  }, []);

  const handleNextWeek = useCallback(() => {
    setCurrentDate((prev) => addWeeks(prev, 1));
  }, []);

  const handleSetToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);
    
   const handleClassChange = useCallback((value: string) => {
    setSelectedClassId(value);
  }, []);


  const filteredSchedules = useMemo(() => {
    if (!schedulesData || !selectedClassId) return [];
    return schedulesData.filter((s) => s.tridaId === selectedClassId);
  }, [schedulesData, selectedClassId]);


  const isDataLoading = !schedulesData || !eventsData || !substitutionsData || !tridy || isUserLoading;

  if (isDataLoading) {
    return <div>Načítání dat rozvrhu...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Rozvrhy a Suplování</h1>
        <p className="text-muted-foreground">
          Týdenní přehled rozvrhů, suplování a událostí.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Zobrazit podle..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tridy">Třídy</SelectItem>
                <SelectItem value="ucitele">Učitelé</SelectItem>
                <SelectItem value="ucebny">Učebny</SelectItem>
              </SelectContent>
            </Select>

            {viewMode === 'tridy' && (
              <Select value={selectedClassId} onValueChange={handleClassChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Vyberte třídu" />
                </SelectTrigger>
                <SelectContent>
                  {tridyOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="w-48" onClick={handleSetToday}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {weekLabel}
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {user && (
             <TimetableWidget
                schedules={filteredSchedules}
                eventsData={eventsData || []}
                substitutionsData={substitutionsData || []}
                isTeacher={hasRole('ucitel')}
                userId={user.id}
                userClassId={user.tridaId}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

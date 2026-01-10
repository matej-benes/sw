'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
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
  ChevronDown,
} from 'lucide-react';
import { TimetableWidget } from '@/components/timetable-widget';
import {
  startOfWeek,
  addDays,
  format,
  subWeeks,
  addWeeks,
  isSameDay,
  isWithinInterval,
  parseISO,
  getDay,
} from 'date-fns';
import { cs } from 'date-fns/locale';

import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, doc, writeBatch, getDoc } from 'firebase/firestore';
import type {
  Trida,
  User,
  Predmet,
  Ucebna,
  Rozvrh,
  Udalost,
  Substitution,
  ScheduleTemplate,
} from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileTimetable } from '@/components/mobile-timetable';


export default function DashboardPage() {
  const firestore = useFirestore();
  const { user, hasRole, loading: isUserLoading } = useAuth();
  const isMobile = useIsMobile();
  
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
  
  const allStaffQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, "users"), where("roles", "array-contains-any", ["ucitel", "asistent pedagoga", "vedouci pracovnik"]));
  }, [firestore]);
  const { data: allStaff } = useCollection<User>(allStaffQuery);

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
  const [isFullWeekView, setIsFullWeekView] = useState(false);


  // Memoized derived data
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    if (isFullWeekView || isMobile) {
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    // Compact view logic
    const today = new Date();
    const isSunday = getDay(today) === 0; // 0 for Sunday
    if (isSunday) {
        // If it's Sunday, show Monday and Tuesday of the next week
        const nextMonday = addDays(start, 7);
        return [nextMonday, addDays(nextMonday, 1)];
    }
    // Default: today and tomorrow
    return [today, addDays(today, 1)];
  }, [currentDate, isFullWeekView, isMobile]);

  const weekLabel = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = addDays(start, 6);
    return `${format(start, 'd. M.')} - ${format(end, 'd. M. yyyy')}`;
  }, [currentDate]);

  const tridyOptions = useMemo(
    () =>
      tridy?.map((t) => ({ value: t.id, label: t.nazev })) || [],
    [tridy]
  );
    
  // Set default selected class once data is loaded
  useEffect(() => {
      if (tridy && !selectedClassId) {
          const defaultId = hasRole('ucitel') ? tridy[0]?.id : user?.tridaId;
          setSelectedClassId(defaultId);
      }
  }, [tridy, selectedClassId, hasRole, user?.tridaId]);

  const targetClassId = useMemo(() => {
    return hasRole('ucitel') ? selectedClassId : user?.tridaId;
  }, [hasRole, selectedClassId, user?.tridaId]);


  // Logic to generate schedules from template if they don't exist
  useEffect(() => {
    const generateSchedulesForWeek = async () => {
        if (!firestore || !targetClassId || !schedulesData) return;

        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);

        // Check if schedules for this week and class already exist
        const weekSchedulesExist = schedulesData.some(s => 
            s.tridaId === targetClassId &&
            isWithinInterval(parseISO(s.datum), { start: weekStart, end: weekEnd })
        );

        if (weekSchedulesExist) {
            return; // Schedules already exist
        }

        // Fetch the template
        const templateRef = doc(firestore, 'scheduleTemplates', targetClassId);
        const templateSnap = await getDoc(templateRef);

        if (!templateSnap.exists()) {
            console.log(`No schedule template found for class ${targetClassId}`);
            return;
        }

        const template = templateSnap.data() as ScheduleTemplate;
        
        console.log(`Generating schedules for class ${targetClassId} for week starting ${format(weekStart, 'yyyy-MM-dd')}`);

        const batch = writeBatch(firestore);

        for (let i = 0; i < 7; i++) {
            const dayDate = addDays(weekStart, i);
            const dayDateString = format(dayDate, 'yyyy-MM-dd');
            const templateDay = template.days.find(d => d.dayIndex === i);
            const dayLessons = templateDay ? templateDay.lessons : [];

            const rozvrhId = `${targetClassId}-${dayDateString}`;
            const rozvrhRef = doc(firestore, 'rozvrhy', rozvrhId);

            const newRozvrh: Omit<Rozvrh, 'id'> = {
                tridaId: targetClassId,
                datum: dayDateString,
                timeSlots: template.timeSlots,
                hodiny: dayLessons,
            };
            batch.set(rozvrhRef, newRozvrh);
        }

        try {
            await batch.commit();
            console.log("Successfully generated weekly schedules.");
            // Data will be re-fetched by useCollection hook automatically
        } catch (error) {
            console.error("Error generating weekly schedules:", error);
        }
    };

    if(targetClassId){
      generateSchedulesForWeek();
    }
  }, [firestore, targetClassId, currentDate, schedulesData]);


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
    if (!schedulesData) return [];

    if (!user) return [];
    
    // For teachers, filter by selected class ID. For others, filter by their own class ID.
    const targetId = hasRole('ucitel') ? selectedClassId : user.tridaId;

    if (!targetId) return [];

    return schedulesData.filter((s) => s.tridaId === targetId);
  }, [schedulesData, selectedClassId, hasRole, user]);

  const classInfo = useMemo(() => {
    if (!user || !tridy || !allStaff) {
      return { studentClassName: null, classTeacherName: null, substitutes: [], assistants: [] };
    }
    const studentClass = tridy.find(t => t.id === user.tridaId);
    if (!studentClass) {
      return { studentClassName: null, classTeacherName: null, substitutes: [], assistants: [] };
    }
    const classTeacher = allStaff.find(t => t.id === studentClass.ucitelId);
    
    const substitutes = (studentClass.zastupciIds || []).map(id => allStaff.find(t => t.id === id)?.name).filter(Boolean) as string[];
    const assistants = (studentClass.asistentiIds || []).map(id => allStaff.find(t => t.id === id)?.name).filter(Boolean) as string[];

    return {
      studentClassName: studentClass.nazev,
      classTeacherName: classTeacher?.name || 'Nenalezen',
      substitutes,
      assistants,
    };
  }, [user, tridy, allStaff]);


  const isDataLoading = !schedulesData || !eventsData || !substitutionsData || !tridy || isUserLoading;

  if (isDataLoading) {
    return <div className="flex h-full w-full items-center justify-center">Načítání dat...</div>;
  }
  
  if (!user) {
     return <div className="flex h-full w-full items-center justify-center">Uživatel nenalezen.</div>;
  }
  
  if (isMobile) {
    return (
      <MobileTimetable 
        schedules={filteredSchedules}
        eventsData={eventsData || []}
        substitutionsData={substitutionsData || []}
        isTeacher={hasRole('ucitel')}
        userId={user.id}
        userClassId={user.tridaId}
        days={weekDays}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div 
        className="flex items-center gap-2 cursor-pointer group"
        onClick={() => setIsFullWeekView(prev => !prev)}
        >
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Kalendář</h1>
            <p className="text-muted-foreground">
            {isFullWeekView ? 'Váš týdenní přehled událostí.' : 'Váš přehled na dnešek a zítřek.'}
            </p>
        </div>
        <ChevronDown className={cn("h-6 w-6 text-muted-foreground transition-transform group-hover:text-foreground", isFullWeekView && "rotate-180")} />
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
           <div className="flex flex-wrap items-center gap-4">
            {hasRole('ucitel') && (
              <>
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
              </>
            )}
            
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
            
            {(hasRole('ziak') || hasRole('rodic')) && classInfo.studentClassName && (
              <div className="flex items-center gap-3 text-sm">
                <Separator orientation="vertical" className="h-8 hidden md:block" />
                <div className="text-left">
                    <p className="font-semibold text-lg">{classInfo.studentClassName}</p>
                    <div className="text-sm text-muted-foreground">
                      <p>
                        <span className="font-semibold">Třídní učitel:</span> {classInfo.classTeacherName}
                      </p>
                      {classInfo.substitutes.length > 0 && (
                         <p>
                           <span className="font-semibold">{classInfo.substitutes.length > 1 ? 'Zástupci třídního učitele:' : 'Zástupce třídního učitele:'}</span> {classInfo.substitutes.join(', ')}
                         </p>
                      )}
                      {classInfo.assistants.length > 0 && (
                        <p>
                          <span className="font-semibold">{classInfo.assistants.length > 1 ? 'Asistenti pedagoga:' : 'Asistent pedagoga:'}</span> {classInfo.assistants.join(', ')}
                        </p>
                      )}
                    </div>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
             <TimetableWidget
                schedules={filteredSchedules}
                eventsData={eventsData || []}
                substitutionsData={substitutionsData || []}
                isTeacher={hasRole('ucitel')}
                userId={user.id}
                userClassId={user.tridaId}
                days={weekDays}
            />
        </CardContent>
      </Card>
    </div>
  );
}

'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
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
  User as UserIcon,
  Users,
  School,
  Book,
  Home,
  UserCheck,
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
import { WhatsNewDialog } from '@/components/dashboard/whats-new-dialog';
import { useRouter } from 'next/navigation';

import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, useDoc } from '@/firebase';
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
  Omluvenka,
  Organization,
  LessonBlock,
  ZapisHodiny,
} from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useUnreadMessages } from '@/hooks/use-unread-messages';

const defaultTimeSlots = [
    "07:55-08:40", "08:55-09:40", "09:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00",
    "15:05-15:50", "15:55-16:40"
];

const adminQuickActions = [
    { title: "Evidence osob", icon: Users, href: "/dashboard/sprava-systemu/evidence-osob", color: "bg-blue-500/10 text-blue-600" },
    { title: "Třídy", icon: School, href: "/dashboard/sprava-systemu/tridy", color: "bg-green-500/10 text-green-600" },
    { title: "Předměty", icon: Book, href: "/dashboard/sprava-systemu/predmety", color: "bg-purple-500/10 text-purple-600" },
    { title: "Učebny", icon: Home, href: "/dashboard/sprava-systemu/ucebny", color: "bg-orange-500/10 text-orange-600" },
    { title: "Zápis", icon: UserCheck, href: "/dashboard/prijimaci-rizeni", color: "bg-pink-500/10 text-pink-600" },
];

export function DesktopDashboard() {
  const firestore = useFirestore();
  const { user, hasRole, isSuperAdmin, loading: isUserLoading, activeStudentId } = useAuth();
  const { unreadCount } = useUnreadMessages();
  const router = useRouter();

  const isTeacher = hasRole('ucitel');
  const isAdmin = hasRole('administrator') || isSuperAdmin();
  const isOnlyStudentParent = !isAdmin && !isTeacher;
  
  const initialViewMode = isAdmin ? 'tridy' : (isTeacher ? 'muj-rozvrh' : 'tridy');
  const [viewMode, setViewMode] = useState(initialViewMode);
  const isPersonalView = viewMode === 'muj-rozvrh';

  const { data: organizations, isLoading: orgsLoading } = useCollection<Organization>(
    useMemoFirebase(
      () => (firestore ? collection(firestore, 'organizations') : null),
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
      return query(collection(firestore, "users"), where("roles", "array-contains-any", ["ucitel", "asistent pedagoga", "vedouci pracovnik", "administrator"]));
  }, [firestore]);
  const { data: allStaff } = useCollection<User>(allStaffQuery);

  const { data: subjects } = useCollection<Predmet>(
    useMemoFirebase(
      () => (firestore ? collection(firestore, 'predmety') : null),
      [firestore]
    )
  );

  const studentRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // Fix: Use activeStudentId for parents, fallback to studentId for legacy or user.id for students
    const studentId = hasRole('rodic') ? activeStudentId : (hasRole('ziak') ? user.id : user.studentId);
    if (!studentId) return null;
    return doc(firestore, 'users', studentId);
  }, [firestore, user, hasRole, activeStudentId]);
  const { data: studentData } = useDoc<User>(studentRef);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
  const [isFullWeekView, setIsFullWeekView] = useState(false);
  
  const [teacherWeekSchedules, setTeacherWeekSchedules] = useState<Rozvrh[]>([]);
  const [teacherSchedulesLoading, setTeacherSchedulesLoading] = useState(false);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    if (isFullWeekView) {
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const today = new Date();
    const isSunday = getDay(today) === 0;
    if (isSunday) {
        const nextMonday = addDays(start, 7);
        return [nextMonday, addDays(nextMonday, 1)];
    }
    return [today, addDays(today, 1)];
  }, [currentDate, isFullWeekView]);

  const targetClassId = useMemo(() => {
    if (isPersonalView) return undefined;
    if (isAdmin) return selectedClassId;
    if (hasRole('ziak')) return user?.tridaId;
    if (hasRole('rodic')) return studentData?.tridaId;
    return undefined;
  }, [isAdmin, isPersonalView, user, studentData, selectedClassId, hasRole]);

  const substitutionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const effectiveOrgId = user?.organizationId || (tridy && tridy.length > 0 ? tridy[0].organizationId : null);
    if (effectiveOrgId) {
        return query(collection(firestore, 'suplovani'), where('organizationId', '==', effectiveOrgId));
    }
    if (!isPersonalView && targetClassId) {
        return query(collection(firestore, 'suplovani'), where('originalLesson.classId', '==', targetClassId));
    }
    return null;
  }, [firestore, user?.organizationId, tridy, targetClassId, isPersonalView]);

  const { data: substitutionsData } = useCollection<Substitution>(substitutionsQuery);

  const zapisyQuery = useMemoFirebase(() => {
    if (!firestore || !targetClassId) return null;
    return query(collection(firestore, 'zapisyHodin'), where('tridaId', '==', targetClassId));
  }, [firestore, targetClassId]);
  const { data: zapisyData } = useCollection<ZapisHodiny>(zapisyQuery);

  useEffect(() => {
    if (!isPersonalView || !firestore || weekDays.length === 0 || !user?.id || !substitutionsData) return;

    const aggregateSchedules = async () => {
        setTeacherSchedulesLoading(true);
        const weekSchedules: Rozvrh[] = [];
        let resolvedTimeSlots = defaultTimeSlots; 

        for (const day of weekDays) {
            const dayStr = format(day, 'yyyy-MM-dd');
            const q = query(
                collection(firestore, 'rozvrhy'), 
                where('datum', '==', dayStr)
            );
            const querySnapshot = await getDocs(q);
            const schedulesForDay = querySnapshot.docs.map(d => d.data() as Rozvrh);
            
            if (schedulesForDay.length > 0 && schedulesForDay[0].timeSlots.length > 0) {
                resolvedTimeSlots = schedulesForDay[0].timeSlots;
            }

            const teacherDayLessons: (LessonBlock | null)[] = Array(resolvedTimeSlots.length).fill(null);
            const subsToday = substitutionsData.filter(s => s.date === dayStr);

            for (const schedule of schedulesForDay) {
                schedule.hodiny.forEach((lesson, index) => {
                    if (!lesson) return;
                    const sub = subsToday.find(s => 
                        s.originalLesson.classId === schedule.tridaId && 
                        s.originalLesson.period === index
                    );
                    let shouldInclude = false;
                    let finalLesson = { ...lesson };
                    if (sub) {
                        const isAssignedToMe = sub.changes.teacherIds?.includes(user.id);
                        const isCancelled = Array.isArray(sub.changes.type) 
                            ? sub.changes.type.includes('zruseno') 
                            : sub.changes.type === 'zruseno';
                        if (isAssignedToMe && !isCancelled) {
                            shouldInclude = true;
                            finalLesson = {
                                ...lesson,
                                teacherId: user.id,
                                teacherName: user.name,
                                isSubstitution: true,
                            };
                            if (sub.changes.subjectId && subjects) {
                                const newSubj = subjects.find(s => s.id === sub.changes.subjectId);
                                if (newSubj) {
                                    finalLesson.subjectId = newSubj.id;
                                    finalLesson.subjectName = newSubj.name;
                                    finalLesson.subjectShortcut = newSubj.shortcut;
                                }
                            }
                        } else if (lesson.teacherId === user.id && !isCancelled) {
                            const isReplaced = sub.changes.teacherIds && sub.changes.teacherIds.length > 0 && !sub.changes.teacherIds.includes(user.id);
                            if (!isReplaced) shouldInclude = true;
                        }
                    } else if (lesson.teacherId === user.id) {
                        shouldInclude = true;
                    }
                    if (shouldInclude) teacherDayLessons[index] = finalLesson;
                });
            }
            weekSchedules.push({
                id: `teacher-schedule-${dayStr}`,
                tridaId: user.id, 
                organizationId: user.organizationId || '',
                datum: dayStr,
                timeSlots: resolvedTimeSlots,
                hodiny: teacherDayLessons,
            });
        }
        weekSchedules.sort((a, b) => a.datum.localeCompare(b.datum));
        setTeacherWeekSchedules(weekSchedules);
        setTeacherSchedulesLoading(false);
    };
    aggregateSchedules();
  }, [isPersonalView, firestore, weekDays, user?.id, user?.organizationId, substitutionsData, subjects]);

  useEffect(() => {
    if (isAdmin && !isPersonalView && tridy && tridy.length > 0 && !selectedClassId) {
      setSelectedClassId(tridy[0].id);
    } else if (!isAdmin) {
      setSelectedClassId(user?.tridaId || studentData?.tridaId);
    }
  }, [tridy, selectedClassId, isAdmin, isPersonalView, user?.tridaId, studentData?.tridaId]);

  const schedulesQuery = useMemoFirebase(() => {
      if (isPersonalView || !firestore || !targetClassId) return null;
      return query(collection(firestore, 'rozvrhy'), where('tridaId', '==', targetClassId));
  }, [firestore, targetClassId, isPersonalView]);

  const { data: schedulesData, isLoading: schedulesLoading } = useCollection<Rozvrh>(schedulesQuery);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !targetClassId) return null; 
    return query(
      collection(firestore, 'udalosti'),
      where('tridyIds', 'array-contains', targetClassId)
    );
  }, [firestore, targetClassId]);
  const { data: eventsData } = useCollection<Udalost>(eventsQuery);

  const teacherClassesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !hasRole('ucitel')) return null;
    return query(collection(firestore, 'tridy'), where('ucitelId', '==', user.id));
  }, [firestore, user, hasRole]);
  const { data: teacherClasses } = useCollection<Trida>(teacherClassesQuery);
  const isClassTeacher = (teacherClasses?.length || 0) > 0;

  const pendingExcusesQuery = useMemoFirebase(() => {
      if (!firestore || !isClassTeacher || !teacherClasses || teacherClasses.length === 0) return null;
      const classIds = teacherClasses.map(c => c.id);
      if (classIds.length === 0) return null;
      return query(collection(firestore, 'omluvenky'), where('status', '==', 'pending'), where('tridaId', 'in', classIds));
  }, [firestore, isClassTeacher, teacherClasses]);

  const { data: pendingExcuses } = useCollection<Omluvenka>(pendingExcusesQuery);

  const studentClassRef = useMemoFirebase(() => {
    if (!firestore || !studentData?.tridaId) return null;
    return doc(firestore, 'tridy', studentData.tridaId);
  }, [firestore, studentData]);
  const { data: studentClassData } = useDoc<Trida>(studentClassRef);

  const classTeacherRef = useMemoFirebase(() => {
    if (!firestore || !studentClassData?.ucitelId) return null;
    return doc(firestore, 'users', studentClassData.ucitelId);
  }, [firestore, studentClassData]);
  const { data: classTeacherData } = useDoc<User>(classTeacherRef);

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
  
  const classInfo = useMemo(() => {
    if (!studentClassData || !allStaff) {
      return { className: null, classTeacherName: null, substitutes: [], assistants: [] };
    }
    const substitutes = (studentClassData.zastupciIds || []).map(id => allStaff.find(t => t.id === id)?.name).filter(Boolean) as string[];
    const assistants = (studentClassData.asistentiIds || []).map(id => allStaff.find(t => t.id === id)?.name).filter(Boolean) as string[];
    return {
      className: studentClassData.nazev,
      classTeacherName: classTeacherData?.name || 'Nenalezen',
      substitutes,
      assistants,
    };
  }, [studentClassData, allStaff, classTeacherData]);

  const isLoading = isUserLoading || !user || orgsLoading || (isPersonalView ? teacherSchedulesLoading : (schedulesLoading || !substitutionsData));

  if (isLoading) {
    return <div className="flex h-full w-full items-center justify-center">Načítání dat...</div>;
  }

  if (!isLoading && organizations && organizations.length === 0) {
    return (
        <Card className="mt-10 max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl">Vítejte ve ŠkolaWeb!</CardTitle>
                <CardDescription>Pro plné využití aplikace je nejprve potřeba vytvořit vaši školu nebo organizaci.</CardDescription>
            </CardHeader>
            <CardContent><p>Kliknutím na tlačítko níže přejdete na stránku pro správu organizací.</p></CardContent>
            <CardFooter><Button onClick={() => router.push('/dashboard/sprava-systemu/organizace')}>Vytvořit organizaci</Button></CardFooter>
        </Card>
    );
  }

  return (
    <>
      <WhatsNewDialog 
          unreadMessagesCount={unreadCount} 
          pendingExcusesCount={pendingExcuses?.length || 0}
          isClassTeacher={isClassTeacher}
      />
      <div className="space-y-6">
        {isAdmin && (
            <div className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">Rychlý přístup - Správa</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {adminQuickActions.map((action) => (
                        <Card 
                            key={action.title} 
                            className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                            onClick={() => router.push(action.href)}
                        >
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3">
                                <div className={cn("p-3 rounded-full", action.color)}><action.icon className="h-6 w-6" /></div>
                                <span className="font-medium text-sm">{action.title}</span>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )}

        <div className="flex items-center gap-2 cursor-pointer group pt-4" onClick={() => setIsFullWeekView(prev => !prev)}>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Kalendář</h1>
                <p className="text-muted-foreground">{isFullWeekView ? 'Váš týdenní přehled.' : 'Váš přehled na dnešek a zítřek.'}</p>
            </div>
            <ChevronDown className={cn("h-6 w-6 text-muted-foreground transition-transform group-hover:text-foreground", isFullWeekView && "rotate-180")} />
        </div>

        <Card>
          <CardHeader className="flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              {(isAdmin || isTeacher) && (
                <>
                  <Select value={viewMode} onValueChange={setViewMode}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Zobrazit podle..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tridy">Třídy</SelectItem>
                      {isTeacher && <SelectItem value="muj-rozvrh">Můj rozvrh</SelectItem>}
                    </SelectContent>
                  </Select>
                  {viewMode === 'tridy' && isAdmin && (
                    <Select value={selectedClassId} onValueChange={handleClassChange}>
                      <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vyberte třídu" /></SelectTrigger>
                      <SelectContent>
                        {tridyOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePrevWeek}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" className="w-48" onClick={handleSetToday}><CalendarIcon className="mr-2 h-4 w-4" />{weekLabel}</Button>
                <Button variant="outline" size="icon" onClick={handleNextWeek}><ChevronRight className="h-4 w-4" /></Button>
              </div>
              
              {!isPersonalView && (hasRole('ziak') || hasRole('rodic')) && classInfo.className && (
                <div className="flex items-center gap-3 text-sm">
                  <Separator orientation="vertical" className="h-8 hidden md:block" />
                  <div className="text-left">
                      {hasRole('rodic') && studentData && <p className="font-semibold text-base">Dítě: {studentData.name}</p>}
                      <p className="font-semibold text-lg">{classInfo.className}</p>
                      <div className="text-sm text-muted-foreground">
                        <p><span className="font-semibold">Třídní učitel:</span> {classInfo.classTeacherName}</p>
                        {classInfo.substitutes.length > 0 && <p><span className="font-semibold">{classInfo.substitutes.length > 1 ? 'Zástupci:' : 'Zástupce:'}</span> {classInfo.substitutes.join(', ')}</p>}
                        {classInfo.assistants.length > 0 && <p><span className="font-semibold">{classInfo.assistants.length > 1 ? 'Asistenti:' : 'Asistent:'}</span> {classInfo.assistants.join(', ')}</p>}
                      </div>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {weekDays.map(day => {
              const scheduleForDay = isPersonalView
                  ? teacherWeekSchedules.find(s => isSameDay(parseISO(s.datum), day))
                  : schedulesData?.find(s => isSameDay(parseISO(s.datum), day));

              return (
                <div key={day.toISOString()}>
                  <TimetableWidget
                    dailySchedule={scheduleForDay}
                    eventsData={eventsData || []}
                    substitutionsData={substitutionsData || []}
                    zapisyData={zapisyData || []}
                    isTeacher={hasRole('ucitel') || isAdmin}
                    userId={user.id}
                    userClassId={isPersonalView ? undefined : targetClassId}
                    day={day}
                    teachers={allStaff || []}
                    subjects={subjects || []}
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

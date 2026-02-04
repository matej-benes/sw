
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

import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc, writeBatch, getDoc, limit } from 'firebase/firestore';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

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
  const isParent = hasRole('rodic');
  
  const initialViewMode = isAdmin ? 'tridy' : (isTeacher ? 'muj-rozvrh' : 'tridy');
  const [viewMode, setViewMode] = useState(initialViewMode);
  const isPersonalView = viewMode === 'muj-rozvrh';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
  const [isFullWeekView, setIsFullWeekView] = useState(false);
  
  const [teacherWeekSchedules, setTeacherWeekSchedules] = useState<Rozvrh[]>([]);
  const [teacherSchedulesLoading, setTeacherSchedulesLoading] = useState(false);

  // Parent specific data
  const studentIds = useMemo(() => user?.studentIds || (user?.studentId ? [user.studentId] : []), [user]);
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !isParent || studentIds.length === 0) return null;
    return query(collection(firestore, 'users'), where('id', 'in', studentIds));
  }, [firestore, isParent, studentIds]);
  const { data: studentsDataFetched } = useCollection<User>(studentsQuery);

  const studentTridaIds = useMemo(() => {
    if (isPersonalView) return [];
    if (isAdmin) return selectedClassId ? [selectedClassId] : [];
    if (isParent && studentsDataFetched) return [...new Set(studentsDataFetched.map(s => s.tridaId).filter(Boolean))] as string[];
    if (hasRole('ziak') && user?.tridaId) return [user.tridaId];
    return [];
  }, [isAdmin, isParent, studentsDataFetched, user?.tridaId, selectedClassId, isPersonalView]);

  const parentClassesQuery = useMemoFirebase(() => {
    if (!firestore || studentTridaIds.length === 0) return null;
    return query(collection(firestore, 'tridy'), where('id', 'in', studentTridaIds));
  }, [firestore, studentTridaIds]);
  const { data: parentClasses } = useCollection<Trida>(parentClassesQuery);

  const { data: organizations, isLoading: orgsLoading } = useCollection<Organization>(
    useMemoFirebase(() => (firestore ? collection(firestore, 'organizations') : null), [firestore])
  );

  const { data: allTridy } = useCollection<Trida>(
    useMemoFirebase(() => (firestore ? collection(firestore, 'tridy') : null), [firestore])
  );
  
  const allStaffQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, "users"), where("roles", "array-contains-any", ["ucitel", "asistent pedagoga", "vedouci pracovnik", "administrator"]));
  }, [firestore]);
  const { data: allStaff } = useCollection<User>(allStaffQuery);

  const { data: subjects } = useCollection<Predmet>(
    useMemoFirebase(() => (firestore ? collection(firestore, 'predmety') : null), [firestore])
  );

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

  const substitutionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const effectiveOrgId = user?.organizationId || (allTridy && allTridy.length > 0 ? allTridy[0].organizationId : null);
    if (effectiveOrgId) {
        return query(collection(firestore, 'suplovani'), where('organizationId', '==', effectiveOrgId));
    }
    return null;
  }, [firestore, user?.organizationId, allTridy]);

  const { data: substitutionsData } = useCollection<Substitution>(substitutionsQuery);

  const zapisyQuery = useMemoFirebase(() => {
    if (!firestore || isPersonalView || studentTridaIds.length === 0) return null;
    return query(collection(firestore, 'zapisyHodin'), where('tridaId', 'in', studentTridaIds));
  }, [firestore, studentTridaIds, isPersonalView]);
  const { data: zapisyData } = useCollection<ZapisHodiny>(zapisyQuery);

  const schedulesQuery = useMemoFirebase(() => {
      if (isPersonalView || !firestore || studentTridaIds.length === 0) return null;
      return query(collection(firestore, 'rozvrhy'), where('tridaId', 'in', studentTridaIds));
  }, [firestore, studentTridaIds, isPersonalView]);
  const { data: schedulesData, isLoading: schedulesLoading } = useCollection<Rozvrh>(schedulesQuery);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || isPersonalView || studentTridaIds.length === 0) return null; 
    return query(
      collection(firestore, 'udalosti'),
      where('tridyIds', 'array-contains-any', studentTridaIds)
    );
  }, [firestore, studentTridaIds, isPersonalView]);
  const { data: eventsData } = useCollection<Udalost>(eventsQuery);

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
    if (isAdmin && !isPersonalView && allTridy && allTridy.length > 0 && !selectedClassId) {
      setSelectedClassId(allTridy[0].id);
    } else if (!isAdmin && !isParent) {
      setSelectedClassId(user?.tridaId);
    }
  }, [allTridy, selectedClassId, isAdmin, isPersonalView, user?.tridaId, isParent]);

  const weekLabel = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = addDays(start, 6);
    return `${format(start, 'd. M.')} - ${format(end, 'd. M. yyyy')}`;
  }, [currentDate]);

  const tridyOptions = useMemo(
    () =>
      allTridy?.map((t) => ({ value: t.id, label: t.nazev })) || [],
    [allTridy]
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

  const isLoading = isUserLoading || !user || orgsLoading || (isPersonalView ? teacherSchedulesLoading : (schedulesLoading || !substitutionsData));

  if (isLoading) {
    return <div className="flex h-full w-full items-center justify-center py-20">Načítání dat...</div>;
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
          pendingExcusesCount={0} // Logic handled in Dialog component usually
          isClassTeacher={isTeacher}
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
            </div>
          </CardHeader>
          <CardContent className="space-y-10">
            {weekDays.map(day => {
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className="space-y-6">
                  <div className={cn("flex items-center gap-3 py-3 border-b-2", isToday ? "border-primary" : "border-muted")}>
                    <div className={cn("p-2 rounded-lg", isToday ? "bg-primary text-primary-foreground" : "bg-muted")}>
                       <CalendarIcon className="h-5 w-5" />
                    </div>
                    <div>
                       <h3 className="text-xl font-bold capitalize">{format(day, 'EEEE', { locale: cs })}</h3>
                       <p className="text-sm text-muted-foreground">{format(day, 'd. MMMM yyyy', { locale: cs })}</p>
                    </div>
                  </div>

                  {(!isPersonalView && isParent && studentsDataFetched && studentsDataFetched.length > 0) ? (
                    <div className="space-y-8 pl-4">
                      {studentsDataFetched.map(student => {
                        const studentClass = parentClasses?.find(c => c.id === student.tridaId);
                        const studentSchedule = schedulesData?.find(s => s.tridaId === student.tridaId && isSameDay(parseISO(s.datum), day));
                        
                        const teacher = allStaff?.find(t => t.id === studentClass?.ucitelId);
                        const substitutes = (studentClass?.zastupciIds || []).map(id => allStaff?.find(t => t.id === id)?.name).filter(Boolean);
                        const assistants = (studentClass?.asistentiIds || []).map(id => allStaff?.find(t => t.id === id)?.name).filter(Boolean);

                        return (
                          <div key={student.id} className="space-y-4 p-5 rounded-2xl bg-muted/20 border shadow-sm">
                             <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-muted pb-4">
                                <div className="flex items-center gap-4">
                                   <Avatar className="h-12 w-12 ring-2 ring-primary/10 ring-offset-2">
                                      <AvatarImage src={student.avatarUrl} />
                                      <AvatarFallback className="bg-primary/5 text-primary text-lg font-bold">{student.name.charAt(0)}</AvatarFallback>
                                   </Avatar>
                                   <div>
                                      <h4 className="text-xl font-extrabold tracking-tight">{student.name}</h4>
                                      <div className="flex items-center gap-2 mt-0.5">
                                         <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-2 py-0">
                                            {studentClass?.nazev || 'Bez třídy'}
                                         </Badge>
                                      </div>
                                   </div>
                                </div>
                                <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                                   <div className="space-y-0.5">
                                      <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Třídní učitel</p>
                                      <p className="font-semibold">{teacher?.name || 'Nenalezen'}</p>
                                   </div>
                                   {substitutes.length > 0 && (
                                      <div className="space-y-0.5">
                                         <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Zástupci</p>
                                         <p className="font-medium text-muted-foreground">{substitutes.join(', ')}</p>
                                      </div>
                                   )}
                                   {assistants.length > 0 && (
                                      <div className="space-y-0.5">
                                         <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Asistenti</p>
                                         <p className="font-medium text-muted-foreground">{assistants.join(', ')}</p>
                                      </div>
                                   )}
                                </div>
                             </div>
                             <TimetableWidget
                                dailySchedule={studentSchedule}
                                eventsData={eventsData || []}
                                substitutionsData={substitutionsData || []}
                                zapisyData={zapisyData || []}
                                isTeacher={false}
                                userId={user.id}
                                userClassId={student.tridaId}
                                day={day}
                                teachers={allStaff || []}
                                subjects={subjects || []}
                             />
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <TimetableWidget
                      dailySchedule={isPersonalView
                        ? teacherWeekSchedules.find(s => isSameDay(parseISO(s.datum), day))
                        : schedulesData?.find(s => s.tridaId === studentTridaIds[0] && isSameDay(parseISO(s.datum), day))
                      }
                      eventsData={eventsData || []}
                      substitutionsData={substitutionsData || []}
                      zapisyData={zapisyData || []}
                      isTeacher={hasRole('ucitel') || isAdmin}
                      userId={user.id}
                      userClassId={isPersonalView ? undefined : studentTridaIds[0]}
                      day={day}
                      teachers={allStaff || []}
                      subjects={subjects || []}
                    />
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

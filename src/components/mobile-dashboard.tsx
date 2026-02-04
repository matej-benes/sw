
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
  Users,
  School,
  Book,
  Home,
  UserCheck,
} from 'lucide-react';
import { MobileTimetableList } from '@/components/mobile-timetable-list';
import {
  startOfWeek,
  addDays,
  format,
  subDays,
  isSameDay,
  isWithinInterval,
  parseISO,
  getDay,
} from 'date-fns';
import { cs } from 'date-fns/locale';

import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDoc, doc, writeBatch, getDocs, documentId } from 'firebase/firestore';
import type {
  Trida,
  User,
  Rozvrh,
  Udalost,
  Substitution,
  ScheduleTemplate,
  ZapisHodiny,
  Predmet,
  LessonBlock,
} from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const defaultTimeSlots = [
    "07:55-08:40", "08:55-09:40", "09:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00",
    "15:05-15:50", "15:55-16:40"
];

const adminQuickActions = [
    { title: "Lidé", icon: Users, href: "/dashboard/sprava-systemu/evidence-osob", color: "bg-blue-500/10 text-blue-600" },
    { title: "Třídy", icon: School, href: "/dashboard/sprava-systemu/tridy", color: "bg-green-500/10 text-green-600" },
    { title: "Předměty", icon: Book, href: "/dashboard/sprava-systemu/predmety", color: "bg-purple-500/10 text-purple-600" },
    { title: "Zápis", icon: UserCheck, href: "/dashboard/prijimaci-rizeni", color: "bg-pink-500/10 text-pink-600" },
];

export function MobileDashboard() {
  const firestore = useFirestore();
  const { user, hasRole, isSuperAdmin, loading: isUserLoading, activeStudentId } = useAuth();
  const router = useRouter();
  
  const isTeacher = hasRole('ucitel');
  const isAdmin = hasRole('administrator') || isSuperAdmin();
  const isParent = hasRole('rodic');
  
  const initialViewMode = isAdmin ? 'tridy' : (isTeacher ? 'muj-rozvrh' : 'tridy');
  const [viewMode, setViewMode] = useState(initialViewMode);
  const isPersonalView = viewMode === 'muj-rozvrh';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);

  const [teacherDailySchedule, setTeacherDailySchedule] = useState<Rozvrh | null>(null);
  const [teacherScheduleLoading, setTeacherScheduleLoading] = useState(false);

  // Parent specific data
  const studentIds = useMemo(() => user?.studentIds || (user?.studentId ? [user.studentId] : []), [user]);
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !isParent || studentIds.length === 0) return null;
    return query(collection(firestore, 'users'), where(documentId(), 'in', studentIds));
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
    return query(collection(firestore, 'tridy'), where(documentId(), 'in', studentTridaIds));
  }, [firestore, studentTridaIds]);
  const { data: parentClasses } = useCollection<Trida>(parentClassesQuery);

  const allTridyQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'tridy') : null), [firestore]);
  const { data: allTridy, isLoading: tridyLoading } = useCollection<Trida>(allTridyQuery);
    
  useEffect(() => {
    if (isAdmin && !isPersonalView && allTridy && allTridy.length > 0 && !selectedClassId) {
      setSelectedClassId(allTridy[0].id);
    }
  }, [allTridy, selectedClassId, isAdmin, isPersonalView]);

  const substitutionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const effectiveOrgId = user?.organizationId || (allTridy && allTridy.length > 0 ? allTridy[0].organizationId : null);
    if (effectiveOrgId) {
        return query(collection(firestore, 'suplovani'), where('organizationId', '==', effectiveOrgId));
    }
    return null;
  }, [firestore, user?.organizationId, allTridy]);

  const { data: substitutionsData } = useCollection<Substitution>(substitutionsQuery);

  const { data: subjects } = useCollection<Predmet>(useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'predmety');
  }, [firestore]));

  const { data: allStaff } = useCollection<User>(useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"), where("roles", "array-contains-any", ["ucitel", "asistent pedagoga", "vedouci pracovnik", "administrator"]));
  }, [firestore]));

  const schedulesQuery = useMemoFirebase(() => {
    if (isPersonalView || !firestore || studentTridaIds.length === 0) return null;
    return query(
      collection(firestore, 'rozvrhy'), 
      where('tridaId', 'in', studentTridaIds), 
      where('datum', '==', format(currentDate, 'yyyy-MM-dd'))
    );
  }, [firestore, studentTridaIds, currentDate, isPersonalView]);
  const { data: schedulesData, isLoading: schedulesLoading } = useCollection<Rozvrh>(schedulesQuery);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || isPersonalView || studentTridaIds.length === 0) return null;
    return query(collection(firestore, 'udalosti'), where('tridyIds', 'array-contains-any', studentTridaIds));
  }, [firestore, studentTridaIds, isPersonalView]);
  
  const zapisyQuery = useMemoFirebase(() => {
    if (!firestore || isPersonalView || studentTridaIds.length === 0) return null;
    return query(collection(firestore, 'zapisyHodin'), where('tridaId', 'in', studentTridaIds));
  }, [firestore, studentTridaIds, isPersonalView]);

  const { data: eventsData, isLoading: eventsLoading } = useCollection<Udalost>(eventsQuery);
  const { data: zapisyData, isLoading: zapisyLoading } = useCollection<ZapisHodiny>(zapisyQuery);

  useEffect(() => {
    if (!isPersonalView || !firestore || !user?.id || !substitutionsData) return;

    const fetchAndAggregate = async () => {
        setTeacherScheduleLoading(true);

        const dayStr = format(currentDate, 'yyyy-MM-dd');
        const q = query(
            collection(firestore, 'rozvrhy'), 
            where('datum', '==', dayStr)
        );
        const querySnapshot = await getDocs(q);
        const schedulesForDay = querySnapshot.docs.map(d => d.data() as Rozvrh);
        
        let resolvedTimeSlots = defaultTimeSlots;
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
                        if (!isReplaced) {
                            shouldInclude = true;
                        }
                    }
                } else if (lesson.teacherId === user.id) {
                    shouldInclude = true;
                }

                if (shouldInclude) {
                    teacherDayLessons[index] = finalLesson;
                }
            });
        }

        setTeacherDailySchedule({
            id: `teacher-schedule-${dayStr}`,
            tridaId: user.id,
            organizationId: user.organizationId || '',
            datum: dayStr,
            timeSlots: resolvedTimeSlots,
            hodiny: teacherDayLessons,
        });
        setTeacherScheduleLoading(false);
    };

    fetchAndAggregate();
  }, [isPersonalView, firestore, currentDate, user?.id, user?.organizationId, substitutionsData, subjects]);

  const scheduleToRender = isPersonalView ? teacherDailySchedule : (schedulesData?.length === 1 ? schedulesData[0] : null);
  const isDataLoading = isUserLoading || (subjects === null) || eventsLoading || zapisyLoading || (isPersonalView ? teacherScheduleLoading : (schedulesLoading || tridyLoading || !substitutionsData));

  if (isDataLoading) {
    return <div className="flex h-full w-full items-center justify-center py-20">Načítání...</div>;
  }
   if (!user) {
     return <div className="flex h-full w-full items-center justify-center">Uživatel nenalezen.</div>;
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">Správa</h2>
            <div className="grid grid-cols-4 gap-2">
                {adminQuickActions.map((action) => (
                    <div 
                        key={action.title} 
                        className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                        onClick={() => router.push(action.href)}
                    >
                        <div className={cn("p-3 rounded-xl", action.color)}>
                            <action.icon className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-medium text-center">{action.title}</span>
                    </div>
                ))}
            </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rozvrh</CardTitle>
          <CardDescription>Váš denní přehled.</CardDescription>
        </CardHeader>
        <CardContent className="px-3">
          <div className="flex items-center justify-between gap-2 mb-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(prev => subDays(prev, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="flex-grow" onClick={() => setCurrentDate(new Date())}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(currentDate, 'EEEE, d. MMMM', { locale: cs })}
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(prev => addDays(prev, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {(isAdmin || isTeacher) && (
            <div className="mb-4">
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Zobrazit..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tridy">Třídy</SelectItem>
                  {isTeacher && <SelectItem value="muj-rozvrh">Můj rozvrh</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}

          {viewMode === 'tridy' && isAdmin && (
            <div className="mb-4">
              <Select value={selectedClassId || ''} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte třídu" />
                </SelectTrigger>
                <SelectContent>
                  {allTridy?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(!isPersonalView && isParent && studentsDataFetched && studentsDataFetched.length > 0) ? (
            <div className="space-y-10">
              {studentsDataFetched.map(student => {
                const studentClass = parentClasses?.find(c => c.id === student.tridaId);
                const studentSchedule = schedulesData?.find(s => s.tridaId === student.tridaId && isSameDay(parseISO(s.datum), currentDate));
                
                const teacher = allStaff?.find(t => t.id === studentClass?.ucitelId);
                const substitutes = (studentClass?.zastupciIds || []).map(id => allStaff?.find(t => t.id === id)?.name).filter(Boolean);

                return (
                  <div key={student.id} className="space-y-4">
                    <div className="flex items-center justify-between gap-3 bg-muted/30 p-3 rounded-xl border border-muted/50">
                       <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 ring-1 ring-primary/20 ring-offset-1">
                             <AvatarImage src={student.avatarUrl} />
                             <AvatarFallback className="bg-primary/5 text-primary font-bold">{student.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="overflow-hidden">
                             <h4 className="font-extrabold text-sm truncate">{student.name}</h4>
                             <p className="text-[10px] text-primary font-bold">{studentClass?.nazev || 'Bez třídy'}</p>
                          </div>
                       </div>
                       <div className="text-right flex flex-col items-end">
                          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Třídní učitel</p>
                          <p className="text-[10px] font-semibold truncate max-w-[100px]">{teacher?.name || 'N/A'}</p>
                       </div>
                    </div>
                    <MobileTimetableList
                      dailySchedule={studentSchedule || null}
                      eventsData={eventsData || []}
                      substitutionsData={substitutionsData || []}
                      zapisyData={zapisyData || []}
                      isTeacher={false}
                      userId={user.id}
                      userClassId={student.tridaId}
                      day={currentDate}
                      teachers={allStaff || []}
                      subjects={subjects || []}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <MobileTimetableList
              dailySchedule={scheduleToRender}
              eventsData={eventsData || []}
              substitutionsData={substitutionsData || []}
              zapisyData={zapisyData || []}
              isTeacher={isAdmin || isTeacher}
              userId={user.id}
              userClassId={isPersonalView ? undefined : studentTridaIds[0]}
              day={currentDate}
              teachers={allStaff || []}
              subjects={subjects || []}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

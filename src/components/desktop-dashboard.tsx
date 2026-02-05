
'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  parseISO,
  getDay,
} from 'date-fns';
import { cs } from 'date-fns/locale';
import { WhatsNewDialog } from '@/components/dashboard/whats-new-dialog';
import { useRouter } from 'next/navigation';

import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc, documentId } from 'firebase/firestore';
import type {
  Trida,
  User,
  Predmet,
  Rozvrh,
  Udalost,
  Substitution,
  LessonBlock,
  ZapisHodiny,
} from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { useUnreadMessages } from '@/hooks/use-unread-messages';

const defaultTimeSlots = [
    "07:55-08:40", "08:55-09:40", "09:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00",
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
  const { user, hasRole, isSuperAdmin, loading: isUserLoading } = useAuth();
  const { unreadCount } = useUnreadMessages();
  const router = useRouter();

  const isTeacher = hasRole('ucitel');
  const isAdmin = hasRole('administrator') || isSuperAdmin();
  const isParent = hasRole('rodic');
  
  const [viewMode, setViewMode] = useState(isAdmin ? 'tridy' : (isTeacher ? 'muj-rozvrh' : 'tridy'));
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
  const [isFullWeekView, setIsFullWeekView] = useState(false);
  
  const [teacherWeekSchedules, setTeacherWeekSchedules] = useState<Rozvrh[]>([]);
  const [teacherSchedulesLoading, setTeacherSchedulesLoading] = useState(false);

  // Student profile for parents/students
  const targetStudentId = isParent ? user?.studentId : (hasRole('ziak') ? user?.id : null);
  const { data: studentData } = useDoc<User>(useMemoFirebase(() => 
    firestore && targetStudentId ? doc(firestore, 'users', targetStudentId) : null, 
  [firestore, targetStudentId]));

  const activeClassId = useMemo(() => {
    if (viewMode === 'muj-rozvrh') return null;
    if (isAdmin) return selectedClassId;
    return studentData?.tridaId;
  }, [isAdmin, studentData, selectedClassId, viewMode]);

  const { data: allTridy } = useCollection<Trida>(useMemoFirebase(() => (firestore ? collection(firestore, 'tridy') : null), [firestore]));
  const { data: allStaff } = useCollection<User>(useMemoFirebase(() => (firestore ? query(collection(firestore, "users"), where("roles", "array-contains-any", ["ucitel", "administrator"])) : null), [firestore]));
  const { data: subjects } = useCollection<Predmet>(useMemoFirebase(() => (firestore ? collection(firestore, 'predmety') : null), [firestore]));

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return isFullWeekView ? Array.from({ length: 7 }, (_, i) => addDays(start, i)) : [new Date(), addDays(new Date(), 1)];
  }, [currentDate, isFullWeekView]);

  const { data: substitutionsData } = useCollection<Substitution>(useMemoFirebase(() => firestore ? collection(firestore, 'suplovani') : null, [firestore]));
  const { data: zapisyData } = useCollection<ZapisHodiny>(useMemoFirebase(() => firestore && activeClassId ? query(collection(firestore, 'zapisyHodin'), where('tridaId', '==', activeClassId)) : null, [firestore, activeClassId]));
  const { data: schedulesData, isLoading: schedulesLoading } = useCollection<Rozvrh>(useMemoFirebase(() => firestore && activeClassId ? query(collection(firestore, 'rozvrhy'), where('tridaId', '==', activeClassId)) : null, [firestore, activeClassId]));
  const { data: eventsData } = useCollection<Udalost>(useMemoFirebase(() => firestore && activeClassId ? query(collection(firestore, 'udalosti'), where('tridyIds', 'array-contains', activeClassId)) : null, [firestore, activeClassId]));

  useEffect(() => {
    if (viewMode !== 'muj-rozvrh' || !firestore || !user?.id || !substitutionsData) return;
    const aggregate = async () => {
        setTeacherSchedulesLoading(true);
        const results: Rozvrh[] = [];
        for (const day of weekDays) {
            const dayStr = format(day, 'yyyy-MM-dd');
            const q = query(collection(firestore, 'rozvrhy'), where('datum', '==', dayStr));
            const snap = await getDocs(q);
            const teacherLessons: (LessonBlock | null)[] = Array(defaultTimeSlots.length).fill(null);
            snap.docs.forEach(d => {
                const s = d.data() as Rozvrh;
                s.hodiny.forEach((l, i) => { if (l?.teacherId === user.id) teacherLessons[i] = l; });
            });
            results.push({ id: dayStr, tridaId: user.id, organizationId: '', datum: dayStr, timeSlots: defaultTimeSlots, hodiny: teacherLessons });
        }
        setTeacherWeekSchedules(results);
        setTeacherSchedulesLoading(false);
    };
    aggregate();
  }, [viewMode, firestore, weekDays, user?.id, substitutionsData]);

  useEffect(() => {
    if (isAdmin && allTridy?.length && !selectedClassId) setSelectedClassId(allTridy[0].id);
  }, [allTridy, isAdmin, selectedClassId]);

  const isLoading = isUserLoading || (viewMode === 'muj-rozvrh' ? teacherSchedulesLoading : schedulesLoading);

  if (isLoading) return <div className="flex h-full w-full items-center justify-center py-20">Načítání...</div>;

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {adminQuickActions.map(a => (
            <Card key={a.title} className="cursor-pointer hover:border-primary" onClick={() => router.push(a.href)}>
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className={cn("p-3 rounded-full", a.color)}><a.icon className="h-6 w-6" /></div>
                <span className="font-medium text-sm">{a.title}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex gap-4">
            {(isAdmin || isTeacher) && (
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="tridy">Třídy</SelectItem>{isTeacher && <SelectItem value="muj-rozvrh">Můj rozvrh</SelectItem>}</SelectContent>
              </Select>
            )}
            {viewMode === 'tridy' && isAdmin && (
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>{allTridy?.map(t => <SelectItem key={t.id} value={t.id}>{t.nazev}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}><ChevronLeft/></Button>
            <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Dnes</Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}><ChevronRight/></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {weekDays.map(day => (
            <div key={day.toISOString()} className="space-y-4">
              <h3 className="text-xl font-bold border-b pb-2">{format(day, 'EEEE, d. MMMM', { locale: cs })}</h3>
              <TimetableWidget
                dailySchedule={viewMode === 'muj-rozvrh' ? teacherWeekSchedules.find(s => isSameDay(parseISO(s.datum), day)) : schedulesData?.find(s => isSameDay(parseISO(s.datum), day))}
                eventsData={eventsData || []}
                substitutionsData={substitutionsData || []}
                zapisyData={zapisyData || []}
                isTeacher={isTeacher || isAdmin}
                userId={user?.id || ''}
                userClassId={activeClassId}
                day={day}
                teachers={allStaff || []}
                subjects={subjects || []}
              />
            </div>
          ))}
        </CardContent>
      </Card>
      <WhatsNewDialog unreadMessagesCount={unreadCount} pendingExcusesCount={0} isClassTeacher={isTeacher} />
    </div>
  );
}

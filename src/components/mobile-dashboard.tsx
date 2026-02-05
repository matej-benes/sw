
'use client';
import { useState, useMemo, useEffect } from 'react';
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
  UserCheck,
} from 'lucide-react';
import { MobileTimetableList } from '@/components/mobile-timetable-list';
import {
  format,
  subDays,
  addDays,
  isSameDay,
  parseISO,
} from 'date-fns';
import { cs } from 'date-fns/locale';

import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import type {
  Trida,
  User,
  Rozvrh,
  Udalost,
  Substitution,
  ZapisHodiny,
  Predmet,
  LessonBlock,
} from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const defaultTimeSlots = [
    "07:55-08:40", "08:55-09:40", "09:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00",
];

const adminQuickActions = [
    { title: "Lidé", icon: Users, href: "/dashboard/sprava-systemu/evidence-osob", color: "bg-blue-500/10 text-blue-600" },
    { title: "Třídy", icon: School, href: "/dashboard/sprava-systemu/tridy", color: "bg-green-500/10 text-green-600" },
    { title: "Předměty", icon: Book, href: "/dashboard/sprava-systemu/predmety", color: "bg-purple-500/10 text-purple-600" },
    { title: "Zápis", icon: UserCheck, href: "/dashboard/prijimaci-rizeni", color: "bg-pink-500/10 text-pink-600" },
];

export function MobileDashboard() {
  const firestore = useFirestore();
  const { user, hasRole, isSuperAdmin, loading: isUserLoading } = useAuth();
  const router = useRouter();
  
  const isTeacher = hasRole('ucitel');
  const isAdmin = hasRole('administrator') || isSuperAdmin();
  const isParent = hasRole('rodic');
  
  const [viewMode, setViewMode] = useState(isAdmin ? 'tridy' : (isTeacher ? 'muj-rozvrh' : 'tridy'));
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);

  const [teacherDailySchedule, setTeacherDailySchedule] = useState<Rozvrh | null>(null);
  const [teacherScheduleLoading, setTeacherScheduleLoading] = useState(false);

  // Student context for parents/students
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

  useEffect(() => {
    if (isAdmin && !selectedClassId && allTridy?.length) setSelectedClassId(allTridy[0].id);
  }, [allTridy, isAdmin, selectedClassId]);

  const { data: substitutionsData } = useCollection<Substitution>(useMemoFirebase(() => firestore ? collection(firestore, 'suplovani') : null, [firestore]));
  const { data: zapisyData } = useCollection<ZapisHodiny>(useMemoFirebase(() => firestore && activeClassId ? query(collection(firestore, 'zapisyHodin'), where('tridaId', '==', activeClassId)) : null, [firestore, activeClassId]));
  const { data: schedulesData, isLoading: schedulesLoading } = useCollection<Rozvrh>(useMemoFirebase(() => firestore && activeClassId ? query(collection(firestore, 'rozvrhy'), where('tridaId', '==', activeClassId), where('datum', '==', format(currentDate, 'yyyy-MM-dd'))) : null, [firestore, activeClassId, currentDate]));
  const { data: eventsData } = useCollection<Udalost>(useMemoFirebase(() => firestore && activeClassId ? query(collection(firestore, 'udalosti'), where('tridyIds', 'array-contains', activeClassId)) : null, [firestore, activeClassId]));

  useEffect(() => {
    if (viewMode !== 'muj-rozvrh' || !firestore || !user?.id || !substitutionsData) return;
    const fetchTeacherSchedule = async () => {
        setTeacherScheduleLoading(true);
        const dayStr = format(currentDate, 'yyyy-MM-dd');
        const q = query(collection(firestore, 'rozvrhy'), where('datum', '==', dayStr));
        const snap = await getDocs(q);
        const teacherLessons: (LessonBlock | null)[] = Array(defaultTimeSlots.length).fill(null);
        snap.docs.forEach(d => {
            const s = d.data() as Rozvrh;
            s.hodiny.forEach((l, i) => { if (l?.teacherId === user.id) teacherLessons[i] = l; });
        });
        setTeacherDailySchedule({ id: dayStr, tridaId: user.id, organizationId: '', datum: dayStr, timeSlots: defaultTimeSlots, hodiny: teacherLessons });
        setTeacherScheduleLoading(false);
    };
    fetchTeacherSchedule();
  }, [viewMode, firestore, currentDate, user?.id, substitutionsData]);

  const isLoading = isUserLoading || (viewMode === 'muj-rozvrh' ? teacherScheduleLoading : schedulesLoading);

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="grid grid-cols-4 gap-2">
            {adminQuickActions.map((action) => (
                <div key={action.title} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => router.push(action.href)}>
                    <div className={cn("p-3 rounded-xl", action.color)}><action.icon className="h-5 w-5" /></div>
                    <span className="text-[10px] font-medium text-center">{action.title}</span>
                </div>
            ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rozvrh</CardTitle>
          <CardDescription>{format(currentDate, 'EEEE, d. MMMM', { locale: cs })}</CardDescription>
        </CardHeader>
        <CardContent className="px-3">
          <div className="flex items-center justify-between gap-2 mb-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" className="flex-grow" onClick={() => setCurrentDate(new Date())}><CalendarIcon className="mr-2 h-4 w-4" />Dnes</Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          
          {(isAdmin || isTeacher) && (
            <div className="grid gap-2 mb-4">
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="tridy">Třídy</SelectItem>{isTeacher && <SelectItem value="muj-rozvrh">Můj rozvrh</SelectItem>}</SelectContent>
              </Select>
              {viewMode === 'tridy' && isAdmin && (
                <Select value={selectedClassId || ''} onValueChange={setSelectedClassId}>
                  <SelectTrigger><SelectValue placeholder="Vyberte třídu" /></SelectTrigger>
                  <SelectContent>{allTridy?.map(c => <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          )}

          {isLoading ? <div className="text-center py-10 text-muted-foreground">Načítání...</div> : (
            <MobileTimetableList
              dailySchedule={viewMode === 'muj-rozvrh' ? teacherDailySchedule : (schedulesData?.find(s => isSameDay(parseISO(s.datum), currentDate)) || null)}
              eventsData={eventsData || []}
              substitutionsData={substitutionsData || []}
              zapisyData={zapisyData || []}
              isTeacher={isAdmin || isTeacher}
              userId={user?.id || ''}
              userClassId={activeClassId}
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

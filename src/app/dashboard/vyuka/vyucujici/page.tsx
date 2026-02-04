'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, documentId } from 'firebase/firestore';
import type { User, ScheduleTemplate } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Mail, GraduationCap, Loader2, Users } from 'lucide-react';

function getInitials(name: string) {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

interface TeacherListProps {
  student: User;
  allTeachers: User[];
  scheduleTemplate: ScheduleTemplate | null;
  showAllTeachers: boolean;
}

function TeacherList({ student, allTeachers, scheduleTemplate, showAllTeachers }: TeacherListProps) {
  const myTeachersInfo = useMemo(() => {
    if (!scheduleTemplate || !allTeachers) return new Map<string, Set<string>>();

    const teacherToSubjects = new Map<string, Set<string>>();

    scheduleTemplate.days.forEach(day => {
      day.lessons.forEach(lesson => {
        if (lesson) {
          if (!teacherToSubjects.has(lesson.teacherId)) {
            teacherToSubjects.set(lesson.teacherId, new Set());
          }
          teacherToSubjects.get(lesson.teacherId)?.add(lesson.subjectName);
        }
      });
    });

    return teacherToSubjects;
  }, [scheduleTemplate, allTeachers]);

  const teachersToDisplay = useMemo(() => {
    if (!allTeachers) return [];

    if (showAllTeachers) {
      return [...allTeachers].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
    }

    return allTeachers
      .filter(t => myTeachersInfo.has(t.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }, [allTeachers, myTeachersInfo, showAllTeachers]);

  if (teachersToDisplay.length === 0 && !showAllTeachers) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center border rounded-xl border-dashed bg-muted/20">
        <Users className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Pro třídu tohoto žáka nebyli v rozvrhu nalezeni žádní vyučující.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {teachersToDisplay.map((teacher) => {
        const subjectsTaught = myTeachersInfo.get(teacher.id);
        const isMyTeacher = !!subjectsTaught;

        return (
          <Card key={teacher.id} className={cn("overflow-hidden transition-all hover:shadow-md", isMyTeacher && "ring-1 ring-primary/20")}>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
                <AvatarImage src={teacher.avatarUrl} alt={teacher.name} />
                <AvatarFallback className="bg-primary/5 text-primary text-lg">
                  {getInitials(teacher.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-lg leading-tight">{teacher.name}</CardTitle>
                <CardDescription className="flex items-center gap-1.5 mt-1">
                  <Mail className="h-3 w-3" />
                  <span className="truncate max-w-[150px]">{teacher.email}</span>
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {isMyTeacher ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                    <GraduationCap className="h-3 w-3" />
                    Vyučuje:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(subjectsTaught).map(sub => (
                      <Badge key={sub} variant="secondary" className="font-medium">
                        {sub}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pt-4 flex items-center justify-center">
                   <p className="text-xs text-muted-foreground italic">Nevyučuje třídu tohoto žáka</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function VyucujiciPage() {
  const { user, hasRole } = useAuth();
  const firestore = useFirestore();
  const [showAllTeachers, setShowAllTeachers] = useState(false);

  // 1. Získání ID všech dětí (nebo sebe jako žáka)
  const studentIds = useMemo(() => {
    if (!user) return [];
    if (hasRole('rodic')) {
      return user.studentIds || (user.studentId ? [user.studentId] : []);
    }
    if (hasRole('ziak')) {
      return [user.id];
    }
    return [];
  }, [user, hasRole]);

  // 2. Načtení profilů všech dětí
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || studentIds.length === 0) return null;
    return query(collection(firestore, 'users'), where(documentId(), 'in', studentIds));
  }, [firestore, studentIds]);
  const { data: students, isLoading: studentsLoading } = useCollection<User>(studentsQuery);

  // 3. Načtení šablon rozvrhů pro všechny dotčené třídy
  const classIds = useMemo(() => {
    if (!students) return [];
    return [...new Set(students.map(s => s.tridaId).filter(Boolean))] as string[];
  }, [students]);

  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || classIds.length === 0) return null;
    return query(collection(firestore, 'scheduleTemplates'), where(documentId(), 'in', classIds));
  }, [firestore, classIds]);
  const { data: templates, isLoading: templatesLoading } = useCollection<ScheduleTemplate>(templatesQuery);

  // 4. Načtení všech učitelů školy
  const teachersQuery = useMemoFirebase(() => {
    if (!firestore || !user?.organizationId) return null;
    return query(
      collection(firestore, 'users'), 
      where('organizationId', '==', user.organizationId),
      where('roles', 'array-contains', 'ucitel')
    );
  }, [firestore, user?.organizationId]);
  const { data: allTeachers, isLoading: teachersLoading } = useCollection<User>(teachersQuery);

  const isLoading = studentsLoading || templatesLoading || teachersLoading;

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isStudentOrParent = hasRole('ziak') || hasRole('rodic');

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vyučující</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            {isStudentOrParent 
              ? (showAllTeachers ? 'Seznam všech pedagogů školy.' : 'Pedagogové vyučující vaše děti.')
              : 'Seznam pedagogických pracovníků.'
            }
          </p>
        </div>
        {isStudentOrParent && (
          <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-lg border">
            <Switch
              id="show-all"
              checked={showAllTeachers}
              onCheckedChange={setShowAllTeachers}
            />
            <Label htmlFor="show-all" className="cursor-pointer">Zobrazit všechny učitele</Label>
          </div>
        )}
      </div>

      {isStudentOrParent && students && students.length > 0 ? (
        <div className="space-y-16">
          {students.map(student => {
            const template = templates?.find(t => t.id === student.tridaId) || null;
            return (
              <div key={student.id} className="space-y-6">
                <div className="flex items-center gap-4 border-b pb-4">
                  <Avatar className="h-12 w-12 ring-2 ring-primary/10 ring-offset-2">
                    <AvatarImage src={student.avatarUrl} />
                    <AvatarFallback className="bg-primary/5 text-primary text-xl font-bold">
                      {student.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{student.name}</h2>
                    <p className="text-sm text-muted-foreground">Vyučující žáka v tomto pololetí</p>
                  </div>
                </div>
                <TeacherList 
                  student={student} 
                  allTeachers={allTeachers || []} 
                  scheduleTemplate={template} 
                  showAllTeachers={showAllTeachers} 
                />
              </div>
            );
          })}
        </div>
      ) : !isStudentOrParent ? (
        <TeacherList 
          student={{} as User} 
          allTeachers={allTeachers || []} 
          scheduleTemplate={null} 
          showAllTeachers={true} 
        />
      ) : (
        <div className="text-center py-20 text-muted-foreground border rounded-xl border-dashed">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Nenalezeni žádní žáci k zobrazení vyučujících.</p>
        </div>
      )}
    </div>
  );
}

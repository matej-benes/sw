'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { User, ScheduleTemplate, Trida } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Mail, GraduationCap, Loader2, Users } from 'lucide-react';

function getInitials(name: string) {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

export default function VyucujiciPage() {
  const { user, hasRole } = useAuth();
  const firestore = useFirestore();
  const [showAllTeachers, setShowAllTeachers] = useState(false);

  // 1. Získání informací o žákovi (pokud je uživatel rodič, bereme studentId)
  const studentRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const targetId = hasRole('rodic') ? user.studentId : user.id;
    if (!targetId) return null;
    return doc(firestore, 'users', targetId);
  }, [firestore, user, hasRole]);
  const { data: studentData, isLoading: studentLoading } = useDoc<User>(studentRef);

  const tridaId = studentData?.tridaId;

  // 2. Načtení šablony rozvrhu pro danou třídu, abychom věděli, kdo tam učí
  const templateRef = useMemoFirebase(() => {
    if (!firestore || !tridaId) return null;
    return doc(firestore, 'scheduleTemplates', tridaId);
  }, [firestore, tridaId]);
  const { data: scheduleTemplate, isLoading: templateLoading } = useDoc<ScheduleTemplate>(templateRef);

  // 3. Načtení všech učitelů
  const teachersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('roles', 'array-contains', 'ucitel'));
  }, [firestore]);
  const { data: allTeachers, isLoading: teachersLoading } = useCollection<User>(teachersQuery);

  // 4. Analýza vyučujících a jejich předmětů z rozvrhu
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

  // 5. Filtrace učitelů pro zobrazení
  const teachersToDisplay = useMemo(() => {
    if (!allTeachers) return [];

    if (showAllTeachers) {
      return allTeachers.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
    }

    // Zobrazíme pouze ty, kteří učí v dané třídě
    return allTeachers
      .filter(t => myTeachersInfo.has(t.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }, [allTeachers, myTeachersInfo, showAllTeachers]);

  const isLoading = studentLoading || templateLoading || teachersLoading;

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isStudentOrParent = hasRole('ziak') || hasRole('rodic');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vyučující</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            {isStudentOrParent 
              ? (showAllTeachers ? 'Seznam všech pedagogů školy.' : 'Pedagogové, kteří vás v tomto pololetí vyučují.')
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

      {!tridaId && isStudentOrParent && !showAllTeachers && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nemáte přiřazenou žádnou třídu, nelze určit vaše vyučující.</p>
            <Button variant="link" onClick={() => setShowAllTeachers(true)}>Zobrazit seznam všech učitelů</Button>
          </CardContent>
        </Card>
      )}

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
                      Vás vyučuje:
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
                     <p className="text-xs text-muted-foreground italic">Nevyučuje vaši třídu</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {teachersToDisplay.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          Nenalezeni žádní učitelé odpovídající výběru.
        </div>
      )}
    </div>
  );
}

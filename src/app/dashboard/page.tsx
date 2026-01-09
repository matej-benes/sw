'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, GraduationCap, MessageCircle, BookOpen } from 'lucide-react';
import { mockStudents } from '@/lib/mock-data';

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  const teacherStats = [
    { title: 'Počet studentů', value: mockStudents.length, icon: Users },
    { title: 'Nepřečtené zprávy', value: 3, icon: MessageCircle },
    { title: 'Průměrná známka', value: '1.85', icon: GraduationCap },
  ];
  
  const parentStats = [
    { title: 'Průměrná známka', value: '1.75', icon: GraduationCap },
    { title: 'Nové zprávy', value: 1, icon: MessageCircle },
    { title: 'Nové materiály', value: 2, icon: BookOpen },
  ];

  const studentStats = [
    { title: 'Průměrná známka', value: '1.75', icon: GraduationCap },
    { title: 'Nové zprávy', value: 1, icon: MessageCircle },
    { title: 'Nové materiály', value: 2, icon: BookOpen },
  ];
  
  let stats;
  switch (user.role) {
    case 'ucitel':
      stats = teacherStats;
      break;
    case 'rodic':
      stats = parentStats;
      break;
    case 'ziak':
      stats = studentStats;
      break;
    default:
      stats = [];
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Vítejte, {user.name.split(' ')[1]}!</h1>
        <p className="text-muted-foreground">Zde je přehled Vašeho dnešního dne.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
       <div className="mt-8">
        <Card>
            <CardHeader>
                <CardTitle>Oznámení</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Zatím zde nejsou žádná nová oznámení.</p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

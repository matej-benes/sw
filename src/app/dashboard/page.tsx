'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, GraduationCap, MessageCircle, BookOpen, Shield } from 'lucide-react';
import { mockStudents } from '@/lib/mock-data';

export default function DashboardPage() {
  const { user, hasRole } = useAuth();

  if (!user) return null;

  const getStats = () => {
    let stats = [];

    if(hasRole('administrator')) {
        stats.push({ title: 'Správa systému', value: 'Aktivní', icon: Shield });
    }
    if(hasRole('ucitel')) {
        stats.push({ title: 'Počet studentů', value: mockStudents.length, icon: Users });
        stats.push({ title: 'Nepřečtené zprávy', value: 3, icon: MessageCircle });
    }
    if(hasRole('rodic')) {
        stats.push({ title: 'Průměrná známka dítěte', value: '1.75', icon: GraduationCap });
        stats.push({ title: 'Nové zprávy', value: 1, icon: MessageCircle });
    }
     if(hasRole('ziak')) {
        stats.push({ title: 'Průměrná známka', value: '1.75', icon: GraduationCap });
        stats.push({ title: 'Nové materiály', value: 2, icon: BookOpen });
    }
    // Remove duplicates by title
    return stats.filter((v,i,a)=>a.findIndex(t=>(t.title === v.title))===i)
  }

  const stats = getStats();

  return (
    <div className="flex-1 space-y-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Vítejte, {user.name.split(' ')[0]}!</h1>
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

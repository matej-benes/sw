'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import type { Znamka } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

function calculateAverage(grades: Znamka[]) {
    if (grades.length === 0) return '–';
    const sum = grades.reduce((acc, g) => acc + g.hodnota, 0);
    return (sum / grades.length).toFixed(2).replace('.', ',');
}

export default function HodnoceniPage() {
  const { user, hasRole, loading } = useAuth();
  const firestore = useFirestore();
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (hasRole('ziak')) {
        setStudentId(user.id);
      } else if (hasRole('rodic') && user.studentId) {
        setStudentId(user.studentId);
      }
    }
  }, [user, hasRole]);

  const znamkyQuery = useMemoFirebase(() => {
    if (!firestore || !studentId) return null;
    return query(collection(firestore, 'users', studentId, 'znamky'), orderBy('datum', 'desc'));
  }, [firestore, studentId]);

  const { data: znamky, isLoading: znamkyLoading } = useCollection<Znamka>(znamkyQuery);

  const groupedGrades = useMemo(() => {
    if (!znamky) return {};
    return znamky.reduce((acc, znamka) => {
      const subject = znamka.predmet;
      if (!acc[subject]) {
        acc[subject] = [];
      }
      acc[subject].push(znamka);
      return acc;
    }, {} as { [subject: string]: Znamka[] });
  }, [znamky]);

  const isLoading = loading || znamkyLoading;
  
  const totalAverage = useMemo(() => {
    if (!znamky || znamky.length === 0) return 'N/A';
    return calculateAverage(znamky);
  }, [znamky]);


  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-3xl font-bold tracking-tight">Hodnocení</h1>
        <p className="text-muted-foreground">Přehled vašeho studijního prospěchu.</p>
      </div>

       <Tabs defaultValue="prubezne" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="prubezne">Průběžné hodnocení</TabsTrigger>
                <TabsTrigger value="predmet">Hodnocení v předmětu</TabsTrigger>
            </TabsList>
            <TabsContent value="prubezne">
                <Card>
                    <CardHeader>
                    <CardTitle>
                        {hasRole('rodic') ? `Průběžné známky` : 'Moje průběžné známky'}
                    </CardTitle>
                    <CardDescription>
                        Celkový průměr: <span className="font-bold text-primary">{totalAverage}</span>
                    </CardDescription>
                    </CardHeader>
                    <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Předmět</TableHead>
                            <TableHead className="text-center">Známka</TableHead>
                            <TableHead>Datum</TableHead>
                            <TableHead>Téma</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                         {isLoading ? (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">Načítání známek...</TableCell></TableRow>
                         ) : znamky && znamky.length > 0 ? (
                            znamky.map((znamka, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium">{znamka.predmet}</TableCell>
                                <TableCell className="text-center font-bold text-lg">{znamka.hodnota}</TableCell>
                                <TableCell>{format(znamka.datum.toDate(), 'd. M. yyyy', { locale: cs })}</TableCell>
                                <TableCell className="text-muted-foreground">{znamka.tema || '-'}</TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">
                                Zatím nemáte žádné známky.
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="predmet">
                <Card>
                    <CardHeader>
                        <CardTitle>Hodnocení podle předmětů</CardTitle>
                        <CardDescription>Souhrnný přehled známek a průměrů v jednotlivých předmětech.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoading ? <p>Načítání...</p> : Object.keys(groupedGrades).length > 0 ? (
                           Object.entries(groupedGrades).map(([subject, grades]) => (
                             <Card key={subject} className="overflow-hidden">
                                <CardHeader className="flex flex-row items-center justify-between bg-muted/50 p-4">
                                    <CardTitle className="text-lg">{subject}</CardTitle>
                                    <Badge>Průměr: {calculateAverage(grades)}</Badge>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="flex flex-wrap gap-2">
                                        {grades.map((g, index) => (
                                            <Badge key={index} variant="secondary" className="text-base">{g.hodnota}</Badge>
                                        ))}
                                    </div>
                                </CardContent>
                             </Card>
                           ))
                        ) : (
                            <p className="text-center text-muted-foreground py-10">Žádná data k zobrazení.</p>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}

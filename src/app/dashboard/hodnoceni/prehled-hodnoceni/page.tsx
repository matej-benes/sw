'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { Znamka, User, Trida, Grading } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';


export default function HodnoceniPrehledPage() {
  const { user, loading: userLoading } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const gradingsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    // Query the subcollection for the specific user (teacher)
    return query(
      collection(firestore, `users/${user.id}/gradings`),
      orderBy('datum', 'desc')
    );
  }, [firestore, user?.id]);

  const { data: gradings, isLoading } = useCollection<Grading>(gradingsQuery);

  const handleDelete = async (gradingId: string) => {
    if (!firestore || !user) return;
    // Correctly reference the document in the subcollection
    const docRef = doc(firestore, `users/${user.id}/gradings`, gradingId);
    await deleteDocumentNonBlocking(docRef);
    toast({ title: "Hodnocení smazáno." });
  };
  
  const allStudentIds = useMemo(() => {
    if (!gradings) return [];
    const ids = new Set<string>();
    gradings.forEach(g => {
      g.znamky.forEach(z => ids.add(z.studentId));
    });
    return Array.from(ids);
  }, [gradings]);

  const usersQuery = useMemoFirebase(() => {
      if (!firestore || allStudentIds.length === 0) return null;
      return query(collection(firestore, 'users'), where('__name__', 'in', allStudentIds));
  }, [firestore, allStudentIds]);

  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const studentNameMap = useMemo(() => {
      if (!users) return new Map<string, string>();
      return new Map(users.map(u => [u.id, u.name]));
  }, [users]);
  
  const toggleRow = (id: string) => {
    setExpandedRow(prev => (prev === id ? null : id));
  };
  
  const isDataLoading = userLoading || isLoading || usersLoading;

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Přehled zadaného hodnocení</h1>
          <p className="text-muted-foreground">Chronologický seznam všech hodnotících událostí, které jste zadali.</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Předmět</TableHead>
                  <TableHead>Téma</TableHead>
                  <TableHead className="text-center">Počet žáků</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isDataLoading && <TableRow><TableCell colSpan={6} className="h-24 text-center">Načítání hodnocení...</TableCell></TableRow>}
                {!isDataLoading && gradings && gradings.length > 0 ? (
                  gradings.map(grading => (
                    <React.Fragment key={grading.id}>
                      <TableRow className="cursor-pointer" onClick={() => toggleRow(grading.id)}>
                         <TableCell>
                           {expandedRow === grading.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                         </TableCell>
                         <TableCell>{(grading.datum as unknown as Timestamp)?.toDate ? format((grading.datum as unknown as Timestamp).toDate(), 'd. M. yyyy', { locale: cs }) : 'N/A'}</TableCell>
                         <TableCell className="font-medium">{grading.predmetNazev}</TableCell>
                         <TableCell>{grading.tema || '-'}</TableCell>
                         <TableCell className="text-center">{grading.znamky.length}</TableCell>
                         <TableCell className="text-right">
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem disabled>
                                  <Pencil className="mr-2 h-4 w-4" /> Upravit
                                </DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                          <Trash2 className="mr-2 h-4 w-4" /> Smazat
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                     <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Opravdu smazat hodnocení?</AlertDialogTitle>
                                            <AlertDialogDescription>Tato akce je nevratná a smaže všechny známky v tomto hodnocení.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Zrušit</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(grading.id)}>Smazat</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                         </TableCell>
                      </TableRow>
                      {expandedRow === grading.id && (
                        <TableRow>
                          <TableCell colSpan={6} className="p-0">
                            <div className="p-4 bg-muted/50">
                                <h4 className="font-semibold mb-2">Detail hodnocení</h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Žák</TableHead>
                                      <TableHead>Známka</TableHead>
                                      <TableHead>Slovní hodnocení</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {grading.znamky.map((znamka, index) => (
                                      <TableRow key={index}>
                                        <TableCell>{studentNameMap.get(znamka.studentId) || 'Neznámý žák'}</TableCell>
                                        <TableCell className="font-bold">{znamka.znamka}</TableCell>
                                        <TableCell>{znamka.slovniHodnoceni || '-'}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  !isDataLoading && <TableRow><TableCell colSpan={6} className="h-24 text-center">Nezadali jste žádné hodnocení.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

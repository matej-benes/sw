'use client';

import React, { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Grading } from '@/lib/types';
import { format } from 'date-fns';

export default function HodnoceniPage() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const firestore = useFirestore();

  // --- Teacher View Query ---
  const teacherGradingsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !hasRole('ucitel')) return null;
    return query(collection(firestore, 'gradings'), where('ucitelId', '==', user.id), orderBy('datum', 'desc'));
  }, [firestore, user, hasRole]);
  const { data: teacherGradings, isLoading: teacherGradingsLoading } = useCollection<Grading>(teacherGradingsQuery);
  
  // --- Student/Parent View Query ---
  const studentId = useMemo(() => hasRole('ziak') ? user?.id : user?.studentId, [hasRole, user]);
  const studentGradingsQuery = useMemoFirebase(() => {
    if (!firestore || !studentId) return null;
    return query(collection(firestore, 'gradings'), where('ziakId', '==', studentId), orderBy('datum', 'desc'));
  }, [firestore, studentId]);
  const { data: studentGradings, isLoading: studentGradingsLoading } = useCollection<Grading>(studentGradingsQuery);

  const isLoading = authLoading || teacherGradingsLoading || studentGradingsLoading;

  if (isLoading) {
    return <div>Načítání dat...</div>;
  }

  if (!user) {
    return <div>Uživatel nenalezen.</div>;
  }

  if (hasRole('ucitel')) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Žákovská knížka - Učitel</h1>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="p-2">Datum</th>
              <th className="p-2">Žák</th>
              <th className="p-2">Předmět</th>
              <th className="p-2">Známka</th>
              <th className="p-2">Komentář</th>
            </tr>
          </thead>
          <tbody>
            {teacherGradings?.map(grading => (
              <tr key={grading.id} className="border-b">
                <td className="p-2">{format(grading.datum.toDate(), 'd. M. yyyy HH:mm')}</td>
                <td className="p-2">{grading.ziakJmeno}</td>
                <td className="p-2">{grading.predmet}</td>
                <td className="p-2 font-bold">{grading.znamka}</td>
                 <td className="p-2">{grading.komentar}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (hasRole('ziak') || hasRole('rodic')) {
     return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Žákovská knížka</h1>
            
            <h2 className="text-xl font-semibold mt-6 mb-2">Průběžné hodnocení</h2>
             <table className="w-full text-left">
                <thead>
                    <tr className="border-b">
                    <th className="p-2">Datum</th>
                    <th className="p-2">Předmět</th>
                    <th className="p-2">Známka</th>
                    <th className="p-2">Komentář</th>
                    </tr>
                </thead>
                <tbody>
                    {studentGradings?.map(grading => (
                    <tr key={grading.id} className="border-b">
                        <td className="p-2">{format(grading.datum.toDate(), 'd. M. yyyy')}</td>
                        <td className="p-2">{grading.predmet}</td>
                        <td className="p-2 font-bold">{grading.znamka}</td>
                        <td className="p-2">{grading.komentar}</td>
                    </tr>
                    ))}
                </tbody>
            </table>

            <h2 className="text-xl font-semibold mt-8 mb-2">Hodnocení podle předmětu</h2>
            <p>Zde bude souhrn známek a průměrů pro jednotlivé předměty.</p>
        </div>
    );
  }

  return (
      <div className="p-6">
      <h1>Žákovská knížka</h1>
      <p>Pro zobrazení hodnocení je nutné mít roli učitele, žáka nebo rodiče.</p>
    </div>
  );
}

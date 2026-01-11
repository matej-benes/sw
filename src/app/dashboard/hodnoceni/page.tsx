'use client'
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Grading, User } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';

export default function HodnoceniPage() {
  const { user, loading } = useAuth();
  const firestore = useFirestore();
  
  const [gradings, setGradings] = useState<Grading[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const gradingsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    
    if (user.roles?.includes('ucitel')) {
      // For teachers, get all gradings they created
      return query(collection(firestore, 'gradings'), where('ucitelId', '==', user.id), orderBy('datum', 'desc'));
    } else {
      // For students/parents, get gradings where they are the student
      const studentId = user.roles?.includes('ziak') ? user.id : user.studentId;
      if (!studentId) return null;
      return query(collection(firestore, 'gradings'), where('ziakId', '==', studentId), orderBy('datum', 'desc'));
    }
  }, [firestore, user]);

  const { data: gradingsData, isLoading: gradingsLoading, error } = useCollection<Grading>(gradingsQuery);

  useEffect(() => {
    if (error) {
      console.error("Error fetching gradings:", error);
    }
  }, [error]);

  if (loading || gradingsLoading) return <div>Načítám...</div>;
  if (!user) return <div>Přihlas se</div>;

  const formatDate = (timestamp: any) => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleDateString('cs-CZ');
    }
    return 'N/A';
  }

  const formatTime = (timestamp: any) => {
     if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    }
    return 'N/A';
  }

  if (user.roles?.includes('ucitel')) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Žákovská knížka - Učitel</h1>
        <div className="bg-card shadow rounded-lg overflow-hidden border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Datum</th>
                <th className="px-6 py-3 text-left font-semibold">Čas</th>
                <th className="px-6 py-3 text-left font-semibold">Žák</th>
                <th className="px-6 py-3 text-left font-semibold">Předmět</th>
                <th className="px-6 py-3 text-left font-semibold">Známka</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {gradingsData?.map(grading => (
                <tr key={grading.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4">{formatDate(grading.datum)}</td>
                  <td className="px-6 py-4">{formatTime(grading.datum)}</td>
                  <td className="px-6 py-4">{grading.ziakJmeno}</td>
                  <td className="px-6 py-4">{grading.predmet}</td>
                  <td className="px-6 py-4 font-semibold">{grading.znamka}</td>
                </tr>
              ))}
              {gradingsData?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Žádné hodnocení. Přidej první!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Žákovská knížka</h1>
      <div className="text-center py-12 text-muted-foreground">
         <div className="bg-card shadow rounded-lg overflow-hidden border mt-6">
           <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Datum</th>
                <th className="px-6 py-3 text-left font-semibold">Předmět</th>
                <th className="px-6 py-3 text-left font-semibold">Známka</th>
                 <th className="px-6 py-3 text-left font-semibold">Komentář</th>
              </tr>
            </thead>
             <tbody className="divide-y divide-border">
              {gradingsData?.map(grading => (
                <tr key={grading.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4">{formatDate(grading.datum)}</td>
                  <td className="px-6 py-4">{grading.predmet}</td>
                  <td className="px-6 py-4 font-semibold">{grading.znamka}</td>
                   <td className="px-6 py-4">{grading.komentar}</td>
                </tr>
              ))}
                {gradingsData?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    Zatím nemáš žádné známky.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

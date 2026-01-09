'use client';
import { useState, useMemo } from 'react';
import { generateCommunicationMessage } from '@/ai/flows/generate-communication-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Send, Wand2 } from 'lucide-react';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { Trida, User } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function ZpravyPage() {
  const { user, hasRole } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isTeacher = hasRole('ucitel');
  const isStudent = hasRole('ziak');

  // Fetch all teachers
  const teachersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"), where("roles", "array-contains", "ucitel"));
  }, [firestore]);
  const { data: teachers } = useCollection<User>(teachersQuery);

  // Fetch student's class to find the class teacher
  const tridaRef = useMemoFirebase(() => {
    if (!firestore || !user?.tridaId) return null;
    return doc(firestore, 'tridy', user.tridaId);
  }, [firestore, user?.tridaId]);
  const { data: tridaData } = useDoc<Trida>(tridaRef);
  
  // Fetch students for teacher view
  const studentsCollection = useMemoFirebase(() => {
    if (!firestore || !isTeacher) return null;
    return query(collection(firestore, "users"), where("roles", "array-contains", "ziak"));
  }, [firestore, isTeacher]);
  const { data: students } = useCollection<User>(studentsCollection);


  const handleGenerateMessage = async () => {
    if (!user || !isTeacher) return;

    setIsLoading(true);
    try {
      const result = await generateCommunicationMessage({
        studentName: 'Tomáš Dvořák',
        performanceSummary: 'Tomáš se v hodinách zlepšuje, ale stále má problémy s domácími úkoly.',
        strengths: 'Aktivní při hodinách, dobrá spolupráce.',
        areasForImprovement: 'Důslednost v plnění domácích úkolů.',
        teacherName: user.name,
      });
      setMessage(result.message);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Chyba při generování zprávy',
        description: 'Zprávu se nepodařilo vygenerovat. Zkuste to prosím znovu.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!message) {
      toast({
        variant: "destructive",
        title: "Prázdná zpráva",
        description: "Nemůžete odeslat prázdnou zprávu.",
      });
      return;
    }
    
    toast({
      title: 'Zpráva odeslána',
      description: 'Vaše zpráva byla úspěšně odeslána.',
    });
    setMessage('');
  };

  const sortedTeachers = useMemo(() => {
    if (!teachers) return [];
    if (!isStudent || !tridaData) return teachers;

    const { ucitelId, zastupciIds = [] } = tridaData;
    
    return [...teachers].sort((a, b) => {
        const isAClassTeacher = a.id === ucitelId;
        const isBClassTeacher = b.id === ucitelId;
        const isASubstitute = zastupciIds.includes(a.id);
        const isBSubstitute = zastupciIds.includes(b.id);

        if (isAClassTeacher) return -1;
        if (isBClassTeacher) return 1;
        if (isASubstitute && !isBSubstitute) return -1;
        if (!isASubstitute && isBSubstitute) return 1;
        
        return a.name.localeCompare(b.name);
    });
}, [teachers, tridaData, isStudent]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Komunikace</h1>
        <p className="text-muted-foreground">Posílejte a přijímejte zprávy.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle>Konverzace</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">Zatím zde nejsou žádné konverzace.</p>
                </CardContent>
            </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Nová zpráva</CardTitle>
              <CardDescription>Napište novou zprávu.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isTeacher && (
                <div className="space-y-2">
                  <Label htmlFor="student-select">Příjemce</Label>
                  <Select>
                    <SelectTrigger id="student-select">
                      <SelectValue placeholder="Vyberte studenta nebo rodiče" />
                    </SelectTrigger>
                    <SelectContent>
                      {students?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} (Žák)</SelectItem>
                      ))}
                       {students?.map((s) => (
                        <SelectItem key={`${s.id}-rodic`} value={`${s.studentId}`}>Rodič - {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
                {isStudent && (
                <div className="space-y-2">
                  <Label htmlFor="teacher-select">Příjemce</Label>
                  <Select>
                    <SelectTrigger id="teacher-select">
                      <SelectValue placeholder="Vyberte učitele" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedTeachers?.map((t) => {
                        const isClassTeacher = t.id === tridaData?.ucitelId;
                        const isSubstitute = tridaData?.zastupciIds?.includes(t.id);
                        const isSpecial = isClassTeacher || isSubstitute;

                        return (
                            <SelectItem key={t.id} value={t.id}>
                               <span className={cn(isSpecial && "text-destructive")}>
                                    {t.name} {isClassTeacher && "(třídní učitel)"} {isSubstitute && !isClassTeacher && "(zástupce)"}
                               </span>
                            </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
                )}
                {!isTeacher && !isStudent && (
                    <div className="space-y-2">
                        <Label htmlFor="teacher-select">Příjemce</Label>
                        <Input id="teacher-select" value="Není specifikováno" readOnly />
                    </div>
                )}
              <div className="space-y-2">
                <Label htmlFor="message-content">Zpráva</Label>
                <Textarea
                  id="message-content"
                  placeholder="Napište svou zprávu zde..."
                  rows={8}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              <div className="flex justify-between items-center">
                {isTeacher && (
                  <Button variant="outline" onClick={handleGenerateMessage} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    Vytvořit s AI
                  </Button>
                )}
                <div className="flex-grow"></div>
                <Button onClick={handleSendMessage}>
                  <Send className="mr-2 h-4 w-4" />
                  Odeslat
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

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
import { MultiSelect } from '@/components/ui/multi-select';

export default function ZpravyPage() {
  const { user, hasRole } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const isTeacher = hasRole('ucitel');
  const isStudent = hasRole('ziak');

  // Fetch all users to be used as potential recipients
  const usersCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, "users");
  }, [firestore]);
  const { data: allUsers } = useCollection<User>(usersCollection);


  // Fetch student's class to find the class teacher
  const tridaRef = useMemoFirebase(() => {
    if (!firestore || !user?.tridaId) return null;
    return doc(firestore, 'tridy', user.tridaId);
  }, [firestore, user?.tridaId]);
  const { data: tridaData } = useDoc<Trida>(tridaRef);
  

  const recipientOptions = useMemo(() => {
    if (!allUsers) return [];

    if (isTeacher) {
        // Teachers can message students and parents
        const studentOptions = allUsers.filter(u => u.roles.includes('ziak')).map(u => ({ value: u.id, label: `${u.name} (Žák)` }));
        const parentOptions = allUsers.filter(u => u.roles.includes('rodic')).map(u => ({ value: u.id, label: `${u.name} (Rodič)` }));
        return [...studentOptions, ...parentOptions];
    }

    if (isStudent && tridaData) {
        // Students can message teachers, with special labels for their class staff
        return allUsers
            .filter(u => u.roles.includes('ucitel') || u.roles.includes('asistent pedagoga'))
            .map(u => {
                let label = `${u.name}`;
                if (u.id === tridaData.ucitelId) {
                    label += ' (Třídní učitel)';
                } else if (tridaData.zastupciIds?.includes(u.id)) {
                    label += ' (Zástupce třídního)';
                } else if (tridaData.asistentiIds?.includes(u.id)) {
                    label += ' (Asistent pedagoga ve vaší třídě)';
                } else if (u.roles.includes('ucitel')) {
                    label += ' (Učitel)';
                } else if (u.roles.includes('asistent pedagoga')) {
                    label += ' (Asistent pedagoga)';
                }
                return { value: u.id, label };
            });
    }
    
    // Default/other roles
    return allUsers.map(u => ({ value: u.id, label: u.name }));
  }, [allUsers, isTeacher, isStudent, tridaData]);


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
     if (recipients.length === 0) {
      toast({
        variant: "destructive",
        title: "Chybí příjemce",
        description: "Prosím vyberte alespoň jednoho příjemce.",
      });
      return;
    }
    
    toast({
      title: 'Zpráva odeslána',
      description: 'Vaše zpráva byla úspěšně odeslána.',
    });
    setMessage('');
    setRecipients([]);
  };

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
               <div className="space-y-2">
                  <Label htmlFor="recipient-select">Příjemce</Label>
                  <MultiSelect
                    options={recipientOptions}
                    onValueChange={setRecipients}
                    defaultValue={recipients}
                    placeholder="Vyberte příjemce..."
                    className="w-full"
                   />
                </div>
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

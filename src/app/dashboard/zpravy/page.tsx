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
import { Loader2, Send, Wand2, X, UserPlus, Check } from 'lucide-react';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { Trida, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';


export default function ZpravyPage() {
  const { user, hasRole } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [isRecipientDialogOpen, setIsRecipientDialogOpen] = useState(false);

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
  
  const selectedRecipientDetails = useMemo(() => {
    return recipients.map(id => recipientOptions.find(opt => opt.value === id)).filter(Boolean);
  }, [recipients, recipientOptions]);


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

  const toggleRecipient = (recipientId: string) => {
    setRecipients(prev => 
        prev.includes(recipientId) 
            ? prev.filter(id => id !== recipientId) 
            : [...prev, recipientId]
    );
  };

  return (
    <>
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
                    <Label>Příjemce:</Label>
                    <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setIsRecipientDialogOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Přidat příjemce
                    </Button>
                    {selectedRecipientDetails.length > 0 && (
                        <div className="pt-2 flex flex-wrap gap-2">
                            {selectedRecipientDetails.map(r => (
                                <Badge key={r!.value} variant="secondary">
                                    {r!.label}
                                    <button onClick={() => toggleRecipient(r!.value)} className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                        <X className="h-3 w-3" />
                                        <span className="sr-only">Odstranit příjemce</span>
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}
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
      
       <Dialog open={isRecipientDialogOpen} onOpenChange={setIsRecipientDialogOpen}>
            <DialogContent className="sm:max-w-xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Vybrat příjemce</DialogTitle>
                </DialogHeader>
                <Command className="flex-grow overflow-hidden">
                    <CommandInput placeholder="Hledat uživatele..." />
                    <CommandList className="max-h-full">
                        <CommandEmpty>Žádní uživatelé nenalezeni.</CommandEmpty>
                        <CommandGroup>
                            {recipientOptions.map((option) => {
                                const isSelected = recipients.includes(option.value);
                                return (
                                    <CommandItem
                                        key={option.value}
                                        onSelect={() => toggleRecipient(option.value)}
                                        className="cursor-pointer"
                                    >
                                        <Checkbox checked={isSelected} className="mr-2" />
                                        <span>{option.label}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
                <DialogFooter>
                    <Button onClick={() => setIsRecipientDialogOpen(false)}>
                        <Check className="mr-2 h-4 w-4" />
                        Potvrdit ({recipients.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}

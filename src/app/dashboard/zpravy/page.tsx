'use client';
import { useState } from 'react';
import { generateCommunicationMessage } from '@/ai/flows/generate-communication-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { mockStudents } from '@/lib/mock-data';
import { Loader2, Send, Wand2 } from 'lucide-react';

export default function ZpravyPage() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isTeacher = hasRole('ucitel');

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
                      {mockStudents.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} (Žák)</SelectItem>
                      ))}
                       {mockStudents.map((s) => (
                        <SelectItem key={`${s.id}-rodic`} value={`${s.parentId}`}>Rodič - {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
                {!isTeacher && (
                <div className="space-y-2">
                  <Label htmlFor="teacher-select">Příjemce</Label>
                  <Input id="teacher-select" value="Mgr. Robert Bartošek" readOnly />
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

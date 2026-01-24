'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { ZaznamSchuzky } from '@/lib/types';
import { collection, query, where, orderBy, Timestamp, doc, getDocs, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const meetingSchema = z.object({
  datum: z.string().min(1, 'Datum je povinný.'),
  cas: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Neplatný formát času (HH:MM)'),
  topic: z.string().min(1, 'Téma je povinné.'),
  notes: z.string().optional(),
});

type MeetingFormData = z.infer<typeof meetingSchema>;

export default function SchuzkyPage() {
  const { user, hasRole } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      datum: format(new Date(), 'yyyy-MM-dd'),
      cas: format(new Date(), 'HH:mm'),
      topic: '',
      notes: '',
    },
  });

  const meetingsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.organizationId) return null;
    return query(
      collection(firestore, 'zaznamy-schuzek'),
      where('organizationId', '==', user.organizationId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user?.organizationId]);

  const { data: meetings, isLoading } = useCollection<ZaznamSchuzky>(meetingsQuery);

  const handleSaveMeeting = async (data: MeetingFormData) => {
    if (!firestore || !user) return;
    
    try {
      const orgsQuery = query(collection(firestore, 'organizations'), limit(1));
      const orgsSnap = await getDocs(orgsQuery);
      if (orgsSnap.empty) {
        throw new Error("V databázi neexistuje žádná organizace.");
      }
      const organizationId = orgsSnap.docs[0].id;
      
      const newMeeting: Omit<ZaznamSchuzky, 'id'> = {
        ...data,
        organizationId: organizationId,
        createdBy: user.id,
        createdAt: Timestamp.now(),
      };

      await addDocumentNonBlocking(collection(firestore, 'zaznamy-schuzek'), newMeeting);
      toast({ title: 'Záznam uložen', description: 'Nový záznam o schůzce byl úspěšně přidán.' });
      reset({
          datum: format(new Date(), 'yyyy-MM-dd'),
          cas: format(new Date(), 'HH:mm'),
          topic: '',
          notes: '',
      });
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Chyba', description: e.message || 'Při ukládání záznamu došlo k chybě.' });
    }
  };
  
  const handleDeleteMeeting = async (id: string) => {
      if (!firestore) return;
      try {
        await deleteDocumentNonBlocking(doc(firestore, 'zaznamy-schuzek', id));
        toast({ title: 'Záznam smazán'});
      } catch (e) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Při mazání záznamu došlo k chybě.' });
      }
  }

  if (!hasRole('administrator') && !hasRole('ucitel')) {
      return (
          <Card>
            <CardHeader>
                <CardTitle>Přístup odepřen</CardTitle>
                <CardDescription>Tato stránka je dostupná pouze pro vedoucí zájmových skupin.</CardDescription>
            </CardHeader>
        </Card>
      )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Evidence schůzek</h1>
        <p className="text-muted-foreground">
          Zde můžete plánovat schůzky a zaznamenávat jejich průběh.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <Card>
            <form onSubmit={handleSubmit(handleSaveMeeting)}>
              <CardHeader>
                <CardTitle>Nový záznam</CardTitle>
                <CardDescription>
                  Zadejte informace o nadcházející nebo proběhlé schůzce.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="datum">Datum</Label>
                        <Controller
                            name="datum"
                            control={control}
                            render={({ field }) => <Input id="datum" type="date" {...field} />}
                        />
                        {errors.datum && <p className="text-sm text-destructive">{errors.datum.message}</p>}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="cas">Čas</Label>
                        <Controller
                            name="cas"
                            control={control}
                            render={({ field }) => <Input id="cas" type="time" {...field} />}
                        />
                         {errors.cas && <p className="text-sm text-destructive">{errors.cas.message}</p>}
                    </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="topic">Téma / Program schůzky</Label>
                  <Controller
                    name="topic"
                    control={control}
                    render={({ field }) => <Input id="topic" {...field} placeholder="Např. Nácvik na vystoupení" />}
                  />
                  {errors.topic && <p className="text-sm text-destructive">{errors.topic.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="notes">Poznámky</Label>
                   <Controller
                    name="notes"
                    control={control}
                    render={({ field }) => <Textarea id="notes" {...field} placeholder="Další detaily, co je potřeba připravit atd." />}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit">
                  <PlusCircle className="mr-2 h-4 w-4" /> Uložit záznam
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        <div className="md:col-span-2">
            <Card>
                 <CardHeader>
                    <CardTitle>Seznam schůzek</CardTitle>
                    <CardDescription>Chronologický přehled všech záznamů.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg max-h-[60vh] overflow-y-auto">
                        {isLoading ? (
                            <p className="p-4 text-center">Načítání schůzek...</p>
                        ) : meetings && meetings.length > 0 ? (
                           <ul className="divide-y">
                             {meetings.map(meeting => (
                                <li key={meeting.id} className="p-4 space-y-2">
                                   <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{meeting.topic}</p>
                                            <p className="text-sm text-muted-foreground">{format(new Date(meeting.datum), 'd. M. yyyy', {locale: cs})} v {meeting.cas}</p>
                                        </div>
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                 <Button variant="ghost" size="icon" className="text-destructive h-8 w-8">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Smazat záznam?</AlertDialogTitle>
                                                    <AlertDialogDescription>Tato akce je nevratná.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Zrušit</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteMeeting(meeting.id)}>Smazat</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                   </div>
                                    {meeting.notes && <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{meeting.notes}</p>}
                                </li>
                             ))}
                           </ul>
                        ) : (
                            <p className="p-4 text-center text-muted-foreground">Zatím nebyly zadány žádné schůzky.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

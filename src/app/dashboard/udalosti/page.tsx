'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Trida, User } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { MultiSelect } from '@/components/ui/multi-select';

const eventSchema = z.object({
  nazev: z.string().min(1, 'Název je povinný'),
  typ: z.string().min(1, 'Druh události je povinný'),
  datum: z.date({ required_error: 'Datum je povinné' }),
  cas: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Neplatný formát času (HH:MM)'),
  tridyIds: z.array(z.string()).min(1, 'Vyberte alespoň jednu třídu'),
  uciteleIds: z.array(z.string()).min(1, 'Vyberte alespoň jednoho učitele'),
});

type EventFormData = z.infer<typeof eventSchema>;

const eventTypes = ['Školní akce', 'Porada', 'Exkurze', 'Prázdniny', 'Ředitelské volno'];

export default function ObecnaUdalostPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const { control, handleSubmit, reset, formState: { errors } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema)
  });

  const tridyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]);
  const { data: classes } = useCollection<Trida>(tridyCollection);

  const uciteleQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "users"), where("roles", "array-contains", "ucitel")) : null, [firestore]);
  const { data: teachers } = useCollection<User>(uciteleQuery);

  const classOptions = classes?.map(c => ({ value: c.id, label: c.nazev })) || [];
  const teacherOptions = teachers?.map(t => ({ value: t.id, label: t.name })) || [];

  const handleSaveEvent = (data: EventFormData) => {
    if (!firestore) return;

    const newEvent = {
        ...data,
        datum: format(data.datum, 'yyyy-MM-dd')
    };

    addDocumentNonBlocking(collection(firestore, 'udalosti'), newEvent);
    toast({
        title: 'Událost vytvořena',
        description: `Událost "${data.nazev}" byla úspěšně vytvořena.`,
    });
    reset({ nazev: '', typ: '', cas: '', tridyIds: [], uciteleIds: [] });
  };


  return (
    <form onSubmit={handleSubmit(handleSaveEvent)} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Obecná událost</h1>
        <p className="text-muted-foreground">Vytvořte novou událost pro třídy a učitele.</p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Vytvořit novou událost</CardTitle>
            <CardDescription>Zadejte podrobnosti o nové události.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Název události</label>
              <Controller
                name="nazev"
                control={control}
                render={({ field }) => <Input {...field} placeholder="Např. Vánoční besídka" />}
              />
              {errors.nazev && <p className="text-sm text-destructive">{errors.nazev.message}</p>}
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Druh události:</label>
               <Controller
                name="typ"
                control={control}
                render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Vyberte druh" /></SelectTrigger>
                        <SelectContent>
                            {eventTypes.map(et => <SelectItem key={et} value={et}>{et}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
              />
              {errors.typ && <p className="text-sm text-destructive">{errors.typ.message}</p>}
            </div>

            <div className="grid gap-1.5">
                <label className="text-sm font-medium">Datum konání:</label>
                <Controller
                    name="datum"
                    control={control}
                    render={({ field }) => (
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className="w-full justify-start text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, 'PPP', { locale: cs }) : <span>Vyberte datum</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                    )}
                />
                {errors.datum && <p className="text-sm text-destructive">{errors.datum.message}</p>}
            </div>

             <div className="grid gap-1.5">
              <label className="text-sm font-medium">Čas (HH:MM)</label>
              <Controller
                name="cas"
                control={control}
                render={({ field }) => <Input {...field} placeholder="Např. 10:00" />}
              />
              {errors.cas && <p className="text-sm text-destructive">{errors.cas.message}</p>}
            </div>

            <div className="grid gap-1.5 md:col-span-2">
              <label className="text-sm font-medium">Třídy</label>
               <Controller
                    name="tridyIds"
                    control={control}
                    render={({ field }) => (
                        <MultiSelect
                            options={classOptions}
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            placeholder="Vyberte třídy..."
                        />
                    )}
                />
              {errors.tridyIds && <p className="text-sm text-destructive">{errors.tridyIds.message}</p>}
            </div>

            <div className="grid gap-1.5 md:col-span-2">
              <label className="text-sm font-medium">Učitelé</label>
               <Controller
                    name="uciteleIds"
                    control={control}
                    render={({ field }) => (
                        <MultiSelect
                            options={teacherOptions}
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            placeholder="Vyberte učitele..."
                        />
                    )}
                />
              {errors.uciteleIds && <p className="text-sm text-destructive">{errors.uciteleIds.message}</p>}
            </div>
          </div>
          <div className="flex gap-4 pt-4 border-t">
            <Button type="submit">
                <Plus className="mr-2 h-4 w-4" />
                Vytvořit událost
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

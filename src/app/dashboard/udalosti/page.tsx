'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Trida, User } from '@/lib/types';


// Mock data for demonstration purposes
const periods = ['1. pololetí', '2. pololetí'];
const eventTypes = ['Školní akce', 'Porada', 'Exkurze'];
const classrooms = ['Učebna 1', 'Učebna 2', 'Tělocvična'];

export default function ObecnaUdalostPage() {
  const [date, setDate] = useState<Date | undefined>();
  const firestore = useFirestore();

  const tridyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]);
  const { data: classes } = useCollection<Trida>(tridyCollection);

  const uciteleQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "users"), where("roles", "array-contains", "ucitel")) : null, [firestore]);
  const { data: teachers } = useCollection<User>(uciteleQuery);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Obecná událost</h1>
      </div>
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
            {/* Row 1 */}
            <div className="grid gap-1.5">
              <label htmlFor="period-select" className="text-sm font-medium">Období:</label>
              <Select defaultValue={periods[0]}>
                <SelectTrigger id="period-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="class-select" className="text-sm font-medium">Třída:</label>
              <Select>
                <SelectTrigger id="class-select">
                  <SelectValue placeholder="Vyberte třídu" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="event-type-select" className="text-sm font-medium">Druh události:</label>
              <Select>
                <SelectTrigger id="event-type-select">
                  <SelectValue placeholder="Vyberte druh" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map(et => <SelectItem key={et} value={et}>{et}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Row 2 */}
            <div className="grid gap-1.5">
              <label htmlFor="teacher-select" className="text-sm font-medium">Učitel:</label>
              <Select>
                <SelectTrigger id="teacher-select">
                  <SelectValue placeholder="Vyberte učitele" />
                </SelectTrigger>
                <SelectContent>
                  {teachers?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="classroom-select" className="text-sm font-medium">Učebna:</label>
              <Select>
                <SelectTrigger id="classroom-select">
                  <SelectValue placeholder="Vyberte učebnu" />
                </SelectTrigger>
                <SelectContent>
                  {classrooms.map(cr => <SelectItem key={cr} value={cr}>{cr}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="date-picker" className="text-sm font-medium">Datum konání:</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-picker"
                    variant={"outline"}
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP', { locale: cs }) : <span>Vyberte datum</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex gap-4 pt-4 border-t">
            <Button>Zobrazit</Button>
            <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nová hodina
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

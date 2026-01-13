'use client';
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { addDays, eachDayOfInterval, format, getDay, startOfWeek } from 'date-fns';
import { cs } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, getDoc, writeBatch } from 'firebase/firestore';
import type { Trida, ScheduleTemplate, Rozvrh } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { MultiSelect } from './ui/multi-select';

interface ScheduleGeneratorProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ScheduleGenerator({ isOpen, onOpenChange }: ScheduleGeneratorProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }),
    to: addDays(startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }), 4),
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: classes } = useCollection<Trida>(
    useMemoFirebase(() => (firestore ? collection(firestore, 'tridy') : null), [firestore])
  );

  const classOptions = useMemo(
    () => classes?.map((c) => ({ value: c.id, label: c.nazev })) || [],
    [classes]
  );

  const handleGenerate = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Chyba připojení k databázi.' });
      return;
    }
    if (selectedClassIds.length === 0) {
      toast({ variant: 'destructive', title: 'Vyberte alespoň jednu třídu.' });
      return;
    }
    if (!dateRange?.from || !dateRange?.to) {
      toast({ variant: 'destructive', title: 'Vyberte platné časové období.' });
      return;
    }

    setIsGenerating(true);

    try {
      const batch = writeBatch(firestore);
      const daysToGenerate = eachDayOfInterval({
        start: dateRange.from,
        end: dateRange.to,
      });
      let generatedCount = 0;

      for (const classId of selectedClassIds) {
        const templateRef = doc(firestore, 'scheduleTemplates', classId);
        const templateSnap = await getDoc(templateRef);

        if (!templateSnap.exists()) {
          console.warn(`Šablona pro třídu ${classId} nebyla nalezena.`);
          continue;
        }

        const template = templateSnap.data() as ScheduleTemplate;

        for (const day of daysToGenerate) {
          const dayIndex = (getDay(day) + 6) % 7; // Monday = 0
          const templateDay = template.days.find((d) => d.dayIndex === dayIndex);
          const lessonsForDay = templateDay ? templateDay.lessons : Array(template.timeSlots.length).fill(null);

          const dayString = format(day, 'yyyy-MM-dd');
          const scheduleId = `${classId}-${dayString}`;
          const scheduleRef = doc(firestore, 'rozvrhy', scheduleId);

          const newSchedule: Omit<Rozvrh, 'id'> = {
            tridaId: classId,
            datum: dayString,
            timeSlots: template.timeSlots,
            hodiny: lessonsForDay,
          };
          batch.set(scheduleRef, newSchedule);
          generatedCount++;
        }
      }

      await batch.commit();

      toast({
        title: 'Rozvrhy úspěšně vygenerovány',
        description: `Bylo vytvořeno/aktualizováno ${generatedCount} denních rozvrhů.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Chyba při generování rozvrhů:', error);
      toast({ variant: 'destructive', title: 'Chyba při generování rozvrhů.' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generovat rozvrh z šablon</DialogTitle>
          <DialogDescription>
            Vyberte třídy a období pro které chcete vygenerovat nebo přepsat denní rozvrhy na základě
            aktuálních šablon.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Třídy</Label>
            <MultiSelect
              options={classOptions}
              onValueChange={setSelectedClassIds}
              defaultValue={selectedClassIds}
              placeholder="Vyberte třídy..."
            />
          </div>
          <div className="space-y-2">
            <Label>Období</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={'outline'}
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dateRange && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'd. M. yyyy', { locale: cs })} -{' '}
                        {format(dateRange.to, 'd. M. yyyy', { locale: cs })}
                      </>
                    ) : (
                      format(dateRange.from, 'd. M. yyyy', { locale: cs })
                    )
                  ) : (
                    <span>Vyberte období</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={cs}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generovat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

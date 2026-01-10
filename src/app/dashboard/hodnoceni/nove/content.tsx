'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, Timestamp, addDoc } from 'firebase/firestore';
import type { Trida, User, Predmet, Rozvrh, Grading } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Printer } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';


const gradingSchema = z.object({
  predmetId: z.string().min(1),
  tridaId: z.string().min(1),
  datum: z.date(),
  hodina: z.string().min(1),
  tema: z.string().optional(),
  komentar: z.string().optional(),
  zverejneni: z.enum(['ihned', 'odlozit']),
  zpusobHodnoceni: z.enum(['znamky', 'body', 'procenta']),
  studenti: z.array(z.object({
    studentId: z.string(),
    studentName: z.string(),
    zahrnout: z.boolean(),
    znamka: z.string().optional(),
    slovniHodnoceni: z.string().optional(),
  })).min(1, "Musíte vybrat alespoň jednoho studenta.").refine(studenti => studenti.some(s => s.zahrnout), {
    message: "Musíte zahrnout alespoň jednoho studenta."
  })
});

type GradingFormData = z.infer<typeof gradingSchema>;

function NewGradingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user: teacherUser } = useAuth();

  const tridaIdParam = searchParams.get('tridaId');
  const predmetIdParam = searchParams.get('predmetId');
  const datumParam = searchParams.get('datum');
  const hodinaParam = searchParams.get('hodina');
  
  // Fetch data
  const tridyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]);
  const { data: tridy } = useCollection<Trida>(tridyCollection);

  const predmetyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'predmety') : null, [firestore]);
  const { data: predmety, isLoading: predmetyLoading } = useCollection<Predmet>(predmetyCollection);

  const [selectedClassId, setSelectedClassId] = useState(tridaIdParam || '');

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !selectedClassId) return null;
    return query(collection(firestore, "users"), where("tridaId", "==", selectedClassId), where("roles", "array-contains", "ziak"));
  }, [firestore, selectedClassId]);
  const { data: studentDocs, isLoading: studentsLoading } = useCollection<User>(studentsQuery);
  
  const rozvrhId = selectedClassId ? `${selectedClassId}-${format(new Date(), 'yyyy-MM-dd')}` : null;
  const rozvrhRef = useMemoFirebase(() => rozvrhId ? doc(firestore, 'rozvrhy', rozvrhId) : null, [firestore, rozvrhId]);
  const { data: rozvrhData } = useDoc<Rozvrh>(rozvrhRef);
  
  const timeSlots = useMemo(() => rozvrhData?.timeSlots || [], [rozvrhData]);

  const { control, handleSubmit, watch, setValue, trigger } = useForm<GradingFormData>({
    resolver: zodResolver(gradingSchema),
    defaultValues: {
      predmetId: predmetIdParam || '',
      tridaId: tridaIdParam || '',
      datum: datumParam ? parseISO(datumParam) : new Date(),
      hodina: hodinaParam || '',
      tema: '',
      komentar: '',
      zverejneni: 'ihned',
      zpusobHodnoceni: 'znamky',
      studenti: []
    }
  });

  const { fields, replace } = useFieldArray({
    control,
    name: "studenti",
  });

  useEffect(() => {
    if (studentDocs) {
      const studentFields = studentDocs.map(s => ({
        studentId: s.id,
        studentName: s.name,
        zahrnout: false,
        znamka: '',
        slovniHodnoceni: ''
      }));
      replace(studentFields);
    } else {
      replace([]);
    }
  }, [studentDocs, replace]);
  
  useEffect(() => {
    setValue("predmetId", predmetIdParam || '');
    setValue("tridaId", tridaIdParam || '');
    setSelectedClassId(tridaIdParam || '');
    setValue("datum", datumParam ? parseISO(datumParam) : new Date());
    setValue("hodina", hodinaParam || '');
  }, [predmetIdParam, tridaIdParam, datumParam, hodinaParam, setValue]);


  const onSubmit = async (data: GradingFormData) => {
    if (!teacherUser || !firestore) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Nejste přihlášeni.' });
        return;
    }

    const includedStudents = data.studenti.filter(s => s.zahrnout && s.znamka);

    if (includedStudents.length === 0) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Musíte zadat známku alespoň jednomu studentovi.' });
        return;
    }

    try {
        const newGrading: Omit<Grading, 'id'> = {
            ucitelId: teacherUser.id,
            tridaId: data.tridaId,
            predmetId: data.predmetId,
            predmetNazev: predmety?.find(p => p.id === data.predmetId)?.name || 'Neznámý',
            datum: Timestamp.fromDate(data.datum),
            hodina: data.hodina,
            tema: data.tema,
            znamky: includedStudents.map(s => ({
                studentId: s.studentId,
                znamka: s.znamka!,
                slovniHodnoceni: s.slovniHodnoceni,
            }))
        };

        await addDoc(collection(firestore, 'gradings'), newGrading);
        
        toast({
            title: 'Hodnocení uloženo',
            description: 'Nové hodnocení bylo úspěšně uloženo.',
        });
        router.push('/dashboard/hodnoceni/prehled-hodnoceni');

    } catch (error) {
        console.error("Error saving grades: ", error);
        toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se uložit hodnocení.' });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    const updatedStudents = watch('studenti').map(s => ({ ...s, zahrnout: checked }));
    setValue('studenti', updatedStudents);
  };
  
  const selectedCount = watch('studenti').filter(s => s.zahrnout).length;

  const handleClassChange = (classId: string) => {
    setValue('tridaId', classId);
    setSelectedClassId(classId);
    trigger('tridaId');
  }

  if (predmetyLoading) {
    return <div>Načítání dat...</div>
  }

  return (
    <div className="p-4 md:p-6">
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Zadání hodnocení</h1>
        <Button variant="ghost" size="icon" onClick={() => window.print()}>
          <Printer className="h-6 w-6" />
        </Button>
      </div>
      
      <Card>
        <CardContent className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-4 items-end">
            {/* Třída */}
            <div className="grid gap-1.5 col-span-1">
                <Label>Třída:</Label>
                <Controller
                    name="tridaId"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={handleClassChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Vyberte třídu" /></SelectTrigger>
                            <SelectContent>{tridy?.map(t => <SelectItem key={t.id} value={t.id}>{t.nazev}</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                />
            </div>
            {/* Předmět */}
            <div className="grid gap-1.5 col-span-1">
                <Label>Předmět:</Label>
                <Controller
                    name="predmetId"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Vyberte předmět" /></SelectTrigger>
                            <SelectContent>{predmety?.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.shortcut})</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                />
            </div>
            
            {/* Datum */}
            <div className="grid gap-1.5 col-span-1">
                <Label>Datum:</Label>
                <Controller
                    name="datum"
                    control={control}
                    render={({ field }) => (
                         <Popover>
                            <PopoverTrigger asChild>
                            <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, 'dd.MM.yyyy') : <span>Vyberte datum</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={cs}/>
                            </PopoverContent>
                        </Popover>
                    )}
                />
            </div>

            {/* Vyučovací hodina */}
            <div className="grid gap-1.5 col-span-1">
                <Label>Vyučovací hodina:</Label>
                <Controller
                    name="hodina"
                    control={control}
                    render={({ field }) => (
                         <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Vyberte hodinu" /></SelectTrigger>
                            <SelectContent>
                                {timeSlots.map((slot, index) => <SelectItem key={index} value={(index + 1).toString()}>{index + 1} ({slot})</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
            
            {/* Téma */}
            <div className="md:col-span-2 lg:col-span-2 xl:col-span-4 grid gap-1.5">
                <Label>Téma:</Label>
                 <div className="flex flex-col sm:flex-row gap-2">
                    <Controller name="tema" control={control} render={({ field }) => <Input {...field} />} />
                </div>
            </div>
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
          <CardTitle>Seznam žáků</CardTitle>
          <CardDescription>Vyberte žáky a zadejte jim hodnocení.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-16 text-center">
                                <div className="flex flex-col items-center gap-1">
                                    <Label htmlFor="selectAll">Zahr.</Label>
                                    <Checkbox id="selectAll" onCheckedChange={(checked) => handleSelectAll(Boolean(checked))} />
                                </div>
                            </TableHead>
                            <TableHead>Příjmení a jméno</TableHead>
                            <TableHead className="w-24">Známka</TableHead>
                            <TableHead>Slovní hodnocení</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {studentsLoading && (
                          <TableRow><TableCell colSpan={4} className="h-24 text-center">Načítání žáků...</TableCell></TableRow>
                        )}
                        {!studentsLoading && fields.map((field, index) => (
                           <TableRow key={field.id}>
                                <TableCell className="text-center">
                                    <Controller
                                        name={`studenti.${index}.zahrnout`}
                                        control={control}
                                        render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />}
                                    />
                                </TableCell>
                                <TableCell>{field.studentName}</TableCell>
                                <TableCell>
                                    <Controller
                                        name={`studenti.${index}.znamka`}
                                        control={control}
                                        render={({ field }) => <Input {...field} type="text" />}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Controller
                                        name={`studenti.${index}.slovniHodnoceni`}
                                        control={control}
                                        render={({ field }) => <Input {...field} />}
                                    />
                                </TableCell>
                           </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
        <CardFooter className="p-3 flex flex-col sm:flex-row sm:flex-wrap justify-between items-center bg-muted/50 gap-4">
             <p className="text-sm text-muted-foreground">Počet dětí/žáků/studentů: {fields.length} (Zahrnuto: {selectedCount})</p>
            <div className="flex flex-wrap gap-2">
                <Button type="submit">Uložit</Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>Zpět</Button>
            </div>
        </CardFooter>
      </Card>
    </form>
    </div>
  );
}

export default NewGradingContent;

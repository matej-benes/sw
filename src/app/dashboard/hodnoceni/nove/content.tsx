'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useFirestore, useCollection, useDoc, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, Timestamp } from 'firebase/firestore';
import type { Trida, User, Predmet, Rozvrh, Znamka } from '@/lib/types';
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
  }))
});

type GradingFormData = z.infer<typeof gradingSchema>;

function NewGradingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user: teacherUser } = useAuth();

  const tridaId = searchParams.get('tridaId');
  const predmetId = searchParams.get('predmetId');
  const datum = searchParams.get('datum');
  const hodina = searchParams.get('hodina');
  
  // Fetch data
  const predmetyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'predmety') : null, [firestore]);
  const { data: predmety, isLoading: predmetyLoading } = useCollection<Predmet>(predmetyCollection);

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !tridaId) return null;
    return query(collection(firestore, "users"), where("tridaId", "==", tridaId), where("roles", "array-contains", "ziak"));
  }, [firestore, tridaId]);
  const { data: studentDocs, isLoading: studentsLoading } = useCollection<User>(studentsQuery);
  
  const tridaRef = useMemoFirebase(() => tridaId ? doc(firestore, 'tridy', tridaId) : null, [firestore, tridaId]);
  const { data: tridaData } = useDoc<Trida>(tridaRef);
  const rozvrhId = tridaId ? `${tridaId}-${format(new Date(), 'yyyy-MM-dd')}` : null;
  const rozvrhRef = useMemoFirebase(() => rozvrhId ? doc(firestore, 'rozvrhy', rozvrhId) : null, [firestore, rozvrhId]);
  const { data: rozvrhData } = useDoc<Rozvrh>(rozvrhRef);
  
  const timeSlots = useMemo(() => rozvrhData?.timeSlots || [], [rozvrhData]);

  const { control, handleSubmit, watch, setValue } = useForm<GradingFormData>({
    resolver: zodResolver(gradingSchema),
    defaultValues: {
      predmetId: predmetId || '',
      datum: datum ? parseISO(datum) : new Date(),
      hodina: hodina || '',
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
    }
  }, [studentDocs, replace]);
  
  useEffect(() => {
    setValue("predmetId", predmetId || '');
    setValue("datum", datum ? parseISO(datum) : new Date());
    setValue("hodina", hodina || '');
  }, [predmetId, datum, hodina, setValue]);


  const onSubmit = async (data: GradingFormData) => {
    if (!teacherUser || !firestore) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Nejste přihlášeni.' });
        return;
    }

    try {
        for (const student of data.studenti) {
            if (student.zahrnout && student.znamka) {
                const newZnamka: Omit<Znamka, 'id'> = {
                    studentId: student.studentId,
                    predmet: predmety?.find(p => p.id === data.predmetId)?.name || 'Neznámý',
                    hodnota: parseInt(student.znamka, 10),
                    datum: Timestamp.fromDate(data.datum), // Correct format for Firestore
                    ucitelId: teacherUser.id,
                    slovniHodnoceni: student.slovniHodnoceni,
                    tema: data.tema,
                    druhHodnoceni: 'písemné', // example
                };
                // Correct path to subcollection
                const znamkyCollectionRef = collection(firestore, 'users', student.studentId, 'znamky');
                await addDocumentNonBlocking(znamkyCollectionRef, newZnamka);
            }
        }
        
        toast({
            title: 'Hodnocení uloženo',
            description: 'Nové známky byly úspěšně uloženy.',
        });
        router.back();

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


  if (predmetyLoading || studentsLoading) {
    return <div>Načítání dat...</div>
  }

  return (
    <div className="p-4 md:p-6">
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Zadání hodnocení</h1>
        <Button variant="ghost" size="icon">
          <Printer className="h-6 w-6" />
        </Button>
      </div>
      
      <Card>
        <CardContent className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-4 items-end">
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
            
             <Button className="col-span-1">Vybrat hodinu z rozvrhu</Button>
            
            {/* Druh hodnocení */}
            <div className="grid gap-1.5 col-span-1">
                <Label>Druh hodnocení:</Label>
                <Select defaultValue="0.7">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">1 [1.00]</SelectItem>
                        <SelectItem value="0.7">0,7 [0.70]</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            {/* Téma */}
            <div className="md:col-span-2 lg:col-span-2 xl:col-span-2 grid gap-1.5">
                <Label>Téma:</Label>
                 <div className="flex flex-col sm:flex-row gap-2">
                    <Controller name="tema" control={control} render={({ field }) => <Input {...field} />} />
                    <Button type="button" variant="outline">Vybrat z témat</Button>
                </div>
            </div>

            {/* Komentář */}
            <div className="md:col-span-2 lg:col-span-full grid gap-1.5">
                <Label>Komentář k hodnocení:</Label>
                <Controller name="komentar" control={control} render={({ field }) => <Textarea {...field} rows={2}/>} />
            </div>
            
            {/* Započítáváno do */}
            <div className="grid gap-1.5 col-span-1">
                <Label>Započítáváno do:</Label>
                <Select defaultValue="2">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">1. pololetí</SelectItem>
                        <SelectItem value="2">2. pololetí</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Zveřejnění */}
            <div className="md:col-span-2 grid gap-1.5">
                <Label>Zveřejnění:</Label>
                <Controller
                    name="zverejneni"
                    control={control}
                    render={({ field }) => (
                         <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center space-x-4 pt-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="ihned" id="ihned" />
                                <Label htmlFor="ihned">Ihned</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="odlozit" id="odlozit" />
                                <Label htmlFor="odlozit">Odložit</Label>
                            </div>
                        </RadioGroup>
                    )}
                />
            </div>
            
            {/* Způsob hodnocení */}
            <div className="md:col-span-2 grid gap-1.5">
                <Label>Způsob hodnocení:</Label>
                <Controller
                    name="zpusobHodnoceni"
                    control={control}
                    render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center space-x-4 pt-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="znamky" id="znamky" />
                                <Label htmlFor="znamky">Známky</Label>
                            </div>
                             <div className="flex items-center space-x-2">
                                <RadioGroupItem value="body" id="body" />
                                <Label htmlFor="body">Body</Label>
                            </div>
                             <div className="flex items-center space-x-2">
                                <RadioGroupItem value="procenta" id="procenta" />
                                <Label htmlFor="procenta">Procenta</Label>
                            </div>
                        </RadioGroup>
                    )}
                />
            </div>
        </CardContent>
      </Card>
      
       <Card>
        <CardContent className="p-0">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12 text-center hidden sm:table-cell">ČVTV</TableHead>
                            <TableHead className="w-16 text-center">
                                <div className="flex flex-col items-center gap-1">
                                    <Label htmlFor="selectAll">Zahr.</Label>
                                    <Checkbox id="selectAll" onCheckedChange={(checked) => handleSelectAll(Boolean(checked))} />
                                </div>
                            </TableHead>
                            <TableHead>Příjmení a jméno</TableHead>
                            <TableHead className="w-24">Známka</TableHead>
                            <TableHead>Slovní hodnocení</TableHead>
                             <TableHead className="w-20 text-center hidden sm:table-cell">
                                <div className="flex flex-col items-center">
                                    <Label>Hromadný výběr</Label>
                                    <Checkbox />
                                </div>
                             </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((field, index) => (
                           <TableRow key={field.id}>
                                <TableCell className="text-center text-muted-foreground hidden sm:table-cell">{index + 1}</TableCell>
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
                                        render={({ field }) => <Input {...field} type="number" min="1" max="5" />}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Controller
                                        name={`studenti.${index}.slovniHodnoceni`}
                                        control={control}
                                        render={({ field }) => <Input {...field} />}
                                    />
                                </TableCell>
                                <TableCell className="text-center hidden sm:table-cell"><Checkbox /></TableCell>
                           </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
        <CardFooter className="p-3 flex flex-col sm:flex-row sm:flex-wrap justify-between items-center bg-muted/50 gap-4">
             <p className="text-sm text-muted-foreground">Počet dětí/žáků/studentů: {fields.length} (Zahrnuto: {selectedCount})</p>
            <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm">Vybrat všechny pro hrom. nastavení</Button>
                <Button type="button" size="sm">Nastavit stejnou známku</Button>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button type="submit">Uložit a zůstat</Button>
                <Button type="submit">Uložit a nové</Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>Zpět</Button>
            </div>
        </CardFooter>
      </Card>
    </form>
    </div>
  );
}

export default NewGradingContent;

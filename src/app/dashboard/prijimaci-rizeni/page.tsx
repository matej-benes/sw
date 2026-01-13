'use client';
import React, { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, writeBatch } from 'firebase/firestore';
import type { PrijimaciRizeni } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, PlusCircle, Search, Download, UserCheck, CheckCircle, AlertCircle, Clock, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PrijimaciRizeniPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('applications');
    const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

    const applicationsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'prijimaci-rizeni'));
    }, [firestore]);
    const { data: applications, isLoading: applicationsLoading } = useCollection<PrijimaciRizeni>(applicationsQuery);

    const selectedApplication = useMemo(() => {
        return applications?.find(app => app.id === selectedApplicationId) || null;
    }, [applications, selectedApplicationId]);
    
    const handleStatusChange = async (newStatus: 'Přijato' | 'Odklad' | 'Nepřijato') => {
        if (!firestore || !selectedApplication) return;
        
        try {
            const docRef = doc(firestore, 'prijimaci-rizeni', selectedApplication.id);
            await updateDocumentNonBlocking(docRef, { status: newStatus });
            toast({
                title: 'Stav aktualizován',
                description: `Stav přihlášky pro ${selectedApplication.jmenoDitete} byl změněn na "${newStatus}".`,
            });
        } catch (error) {
             toast({
                variant: 'destructive',
                title: 'Chyba',
                description: 'Nepodařilo se aktualizovat stav přihlášky.',
            });
        }
    };
    
    const handleTransferToMatrika = async () => {
        if (!firestore || !selectedApplication) return;

        try {
            const batch = writeBatch(firestore);

            // 1. Create Student User
            const studentPin = Math.floor(100000 + Math.random() * 900000).toString();
            const studentUserRef = doc(collection(firestore, 'users'));
            const studentEmail = `${selectedApplication.jmenoDitete.toLowerCase().replace(/\s/g, '.')}@skolaweb.cz`; // Temporary email
            batch.set(studentUserRef, {
                name: selectedApplication.jmenoDitete,
                email: studentEmail,
                datumNarozeni: selectedApplication.datumNarozeniDitete,
                roles: ['ziak'],
                pin: studentPin,
            });

            // 2. Create Parent User
            const parentPin = Math.floor(100000 + Math.random() * 900000).toString();
            const parentUserRef = doc(collection(firestore, 'users'));
            batch.set(parentUserRef, {
                name: selectedApplication.jmenoZastupce,
                email: selectedApplication.emailZastupce,
                roles: ['rodic'],
                pin: parentPin,
                studentId: studentUserRef.id,
            });

            // 3. Update application status
            const appRef = doc(firestore, 'prijimaci-rizeni', selectedApplication.id);
            batch.update(appRef, { status: 'Převedeno do matriky' });

            await batch.commit();
            
            toast({
                title: 'Dítě převedeno do matriky',
                description: `${selectedApplication.jmenoDitete} a zákonný zástupce byli přidáni do systému.`,
            });

        } catch (error) {
            console.error("Error transferring to matrika: ", error);
            toast({
                variant: 'destructive',
                title: 'Chyba',
                description: 'Nepodařilo se převést dítě do matriky.',
            });
        }
    }

    const handleRowClick = (appId: string) => {
        setSelectedApplicationId(appId);
        setActiveTab('details');
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Přijímací řízení</h1>
                <p className="text-muted-foreground">Komplexní agenda pro přijímání dětí ke studiu.</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="applications">Seznam přihlášek</TabsTrigger>
                    <TabsTrigger value="details" disabled={!selectedApplicationId}>Detail dítěte a rozhodnutí</TabsTrigger>
                </TabsList>
                <TabsContent value="applications">
                    <Card>
                        <CardHeader>
                            <CardTitle>Přehled podaných přihlášek</CardTitle>
                            <CardDescription>Spravujte přihlášky, komunikujte s rodiči a tiskněte potřebné dokumenty.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="flex flex-wrap items-center gap-4 mb-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Hledat v přihláškách..." className="pl-8" />
                                </div>
                                <Button variant="outline">
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportovat data
                                </Button>
                            </div>
                            <div className="border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Jméno dítěte</TableHead>
                                            <TableHead>Zákonný zástupce</TableHead>
                                            <TableHead>Datum podání</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {applicationsLoading ? (
                                            <TableRow><TableCell colSpan={4} className="text-center h-24">Načítání přihlášek...</TableCell></TableRow>
                                        ) : applications && applications.length > 0 ? (
                                            applications.map((app) => (
                                                <TableRow key={app.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(app.id)}>
                                                    <TableCell className="font-medium">{app.jmenoDitete}</TableCell>
                                                    <TableCell>{app.jmenoZastupce}</TableCell>
                                                    <TableCell>{app.datumPodani}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={
                                                            app.status === "Přijato" ? "default" :
                                                            app.status === "Odklad" ? "secondary" : 
                                                            app.status === "Převedeno do matriky" ? "default" : "outline"
                                                        } className={app.status === "Přijato" ? "bg-green-500" : app.status === 'Převedeno do matriky' ? 'bg-blue-500' : ''}>
                                                            {app.status === 'Přijato' && <CheckCircle className="h-3 w-3 mr-1" />}
                                                            {app.status === 'Převedeno do matriky' && <Send className="h-3 w-3 mr-1" />}
                                                            {app.status === 'Odklad' && <Clock className="h-3 w-3 mr-1" />}
                                                            {app.status === 'Podáno' && <FileText className="h-3 w-3 mr-1" />}
                                                            {app.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={4} className="text-center h-24">Nebyly nalezeny žádné přihlášky.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="details">
                     <Card>
                        <CardHeader>
                            <CardTitle>Detail žádosti: {selectedApplication?.jmenoDitete}</CardTitle>
                            <CardDescription>Komplexní evidence údajů o dítěti a správa rozhodnutí.</CardDescription>
                        </CardHeader>
                        {selectedApplication ? (
                        <>
                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <h4 className="font-semibold">Údaje o dítěti</h4>
                                    <p className="text-sm"><strong className="text-muted-foreground">Jméno:</strong> {selectedApplication.jmenoDitete}</p>
                                    <p className="text-sm"><strong className="text-muted-foreground">Datum narození:</strong> {selectedApplication.datumNarozeniDitete}</p>
                                    <p className="text-sm"><strong className="text-muted-foreground">Bydliště:</strong> {selectedApplication.bydlisteDitete}</p>
                                </div>
                                <div className="space-y-3">
                                    <h4 className="font-semibold">Údaje o zákonném zástupci</h4>
                                    <p className="text-sm"><strong className="text-muted-foreground">Jméno:</strong> {selectedApplication.jmenoZastupce}</p>
                                    <p className="text-sm"><strong className="text-muted-foreground">Email:</strong> {selectedApplication.emailZastupce}</p>
                                    <p className="text-sm"><strong className="text-muted-foreground">Telefon:</strong> {selectedApplication.telefonZastupce}</p>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <h4 className="font-semibold mb-4">Správa rozhodnutí</h4>
                                <div className="flex flex-wrap gap-4">
                                     <Button onClick={() => handleStatusChange('Přijato')}>
                                        <CheckCircle className="mr-2 h-4 w-4"/>
                                        Vytvořit rozhodnutí o přijetí
                                    </Button>
                                     <Button variant="secondary" onClick={() => handleStatusChange('Odklad')}>
                                        <Clock className="mr-2 h-4 w-4"/>
                                        Vytvořit rozhodnutí o odkladu
                                    </Button>
                                    <Button variant="destructive" onClick={() => handleStatusChange('Nepřijato')}>
                                        <AlertCircle className="mr-2 h-4 w-4"/>
                                        Vytvořit rozhodnutí o nepřijetí
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                         <CardFooter className="flex justify-end">
                            <Button onClick={handleTransferToMatrika} disabled={selectedApplication.status !== 'Přijato'}>
                                <UserCheck className="mr-2 h-4 w-4"/>
                                Převést přijaté dítě do školní matriky
                            </Button>
                        </CardFooter>
                        </>
                        ) : (
                            <CardContent>
                                <p className="text-center text-muted-foreground py-10">Vyberte přihlášku ze seznamu pro zobrazení detailů.</p>
                            </CardContent>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

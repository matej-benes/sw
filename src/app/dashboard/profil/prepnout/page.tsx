'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, Loader2, LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useState } from "react";

function getInitials(name: string) {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}


export default function SwitchProfilePage() {
    const router = useRouter();
    const { accounts, activeAccount, switchUser, removeUser, loading } = useAuth();
    const { toast } = useToast();
    const [isSwitching, setIsSwitching] = useState<string | null>(null);

    const handleSwitch = async (uid: string) => {
        setIsSwitching(uid);
        try {
            await switchUser(uid);
            toast({ title: "Účet přepnut", description: "Byli jste úspěšně přepnuti na jiný účet."});
            router.push('/dashboard');
        } catch (error) {
            toast({ variant: "destructive", title: "Chyba přepnutí", description: (error as Error).message });
        } finally {
            setIsSwitching(null);
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Přepnout účet</h1>
                    <p className="text-muted-foreground">Vyberte účet, na který se chcete přihlásit.</p>
                </div>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Spravovat účty</CardTitle>
                    <CardDescription>Přepínejte mezi přihlášenými účty nebo odeberte ty, které již nepoužíváte.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {accounts.map(acc => (
                        <div key={acc.uid} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={`https://picsum.photos/seed/${acc.uid}/100/100`} />
                                    <AvatarFallback>{getInitials(acc.email)}</AvatarFallback>
                                </Avatar>
                                <div className="text-sm">
                                    <p className="font-semibold">{acc.email}</p>
                                    {activeAccount?.uid === acc.uid && <p className="text-primary text-xs flex items-center gap-1"><CheckCircle className="h-3 w-3"/>Aktivní</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {activeAccount?.uid !== acc.uid && (
                                     <Button 
                                        variant="outline"
                                        size="sm" 
                                        onClick={() => handleSwitch(acc.uid)}
                                        disabled={loading || !!isSwitching}
                                     >
                                         {isSwitching === acc.uid ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LogOut className="mr-2 h-4 w-4" />}
                                         Přepnout
                                     </Button>
                                )}
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="icon" disabled={loading}><Trash2 className="h-4 w-4" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Opravdu odebrat účet?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Účet {acc.email} bude odebrán z tohoto zařízení. Pro opětovné použití se budete muset znovu přihlásit.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Zrušit</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => removeUser(acc.uid)}>Odebrat</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    ))}
                    <Button className="w-full" onClick={() => router.push('/dashboard/profil/pridat')}>
                        Přidat další účet
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}

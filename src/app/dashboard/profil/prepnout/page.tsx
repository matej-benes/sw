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
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getInitials(name: string) {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function SwitchPasswordDialog({
    isOpen,
    onClose,
    onConfirm,
    email,
    isLoading
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password: string) => void;
    email: string;
    isLoading: boolean;
}) {
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setPassword('');
        }
    }, [isOpen]);

    const handleConfirm = () => {
        onConfirm(password);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Přepnout na účet {email}</DialogTitle>
                    <DialogDescription>
                        Pro přepnutí zadejte heslo k tomuto účtu.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label htmlFor="password-switch">Heslo</Label>
                    <Input
                        id="password-switch"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Zrušit</Button>
                    <Button onClick={handleConfirm} disabled={isLoading}>
                         {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LogOut className="mr-2 h-4 w-4" />}
                        Přepnout
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function SwitchProfilePage() {
    const router = useRouter();
    const { accounts, activeAccount, switchUser, removeUser, loading } = useAuth();
    const { toast } = useToast();
    const [isSwitching, setIsSwitching] = useState<string | null>(null);
    const [accountToSwitch, setAccountToSwitch] = useState<{uid: string, email: string} | null>(null);
    const isMobile = useIsMobile();
    
    useEffect(() => {
        if (isMobile === false) { 
            router.replace('/dashboard/profil');
        }
    }, [isMobile, router]);

    const handleSwitch = async (password: string) => {
        if (!accountToSwitch) return;

        setIsSwitching(accountToSwitch.uid);
        try {
            await switchUser(accountToSwitch.email, password);
            toast({ title: "Účet přepnut", description: "Byli jste úspěšně přepnuti na jiný účet."});
            setAccountToSwitch(null);
            router.push('/dashboard');
        } catch (error) {
            toast({ variant: "destructive", title: "Chyba přepnutí", description: (error as Error).message });
        } finally {
            setIsSwitching(null);
        }
    };
    
    if (isMobile === undefined || isMobile === false) {
        return null;
    }
    
    return (
        <>
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
                                            onClick={() => setAccountToSwitch({uid: acc.uid, email: acc.email})}
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
             <SwitchPasswordDialog 
                isOpen={!!accountToSwitch}
                onClose={() => setAccountToSwitch(null)}
                onConfirm={handleSwitch}
                email={accountToSwitch?.email || ''}
                isLoading={!!isSwitching}
             />
        </>
    )
}

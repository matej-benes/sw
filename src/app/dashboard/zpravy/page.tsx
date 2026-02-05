
'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Send, UserPlus, Inbox, Send as SendIcon, Pencil, CheckCircle, Reply } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, Timestamp, arrayUnion, onSnapshot } from 'firebase/firestore';
import type { Trida, User, Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

function getInitials(name: string) {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function RecipientDialog({ 
    isOpen, 
    onOpenChange, 
    allUsers, 
    allClasses, 
    selectedRecipients, 
    onToggleRecipient, 
    hasRole,
    isLoading
}: { 
    isOpen: boolean, 
    onOpenChange: (open: boolean) => void, 
    allUsers: User[] | null, 
    allClasses: Trida[] | null, 
    selectedRecipients: string[], 
    onToggleRecipient: (id: string) => void, 
    hasRole: (role: any) => boolean,
    isLoading: boolean
}) {
  const { user } = useAuth();
  const users = allUsers || [];
  const classes = allClasses || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl h-auto max-h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0"><DialogTitle>Vybrat příjemce</DialogTitle></DialogHeader>
        <Command className="flex-grow overflow-hidden pointer-events-auto" shouldFilter={true}>
          <CommandInput placeholder="Hledat..." />
          <CommandList className="max-h-full">
            {isLoading ? <div className="p-10 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div> : (
                <>
                <CommandEmpty>Nenalezeno.</CommandEmpty>
                {hasRole('ucitel') && classes.length > 0 && (
                    <CommandGroup heading="Třídy">
                        {classes.map(c => (
                        <CommandItem key={c.id} onSelect={() => onToggleRecipient(c.id)} className="cursor-pointer">
                            <Checkbox checked={selectedRecipients.includes(c.id)} className="mr-2" /><span>Třída {c.nazev}</span>
                        </CommandItem>
                        ))}
                    </CommandGroup>
                )}
                <CommandGroup heading="Učitelé a správa">
                    {users.filter(u => u.roles?.some(r => ['ucitel', 'administrator'].includes(r))).map(u => (
                        <CommandItem key={u.id} onSelect={() => onToggleRecipient(u.id)} className="cursor-pointer">
                        <Checkbox checked={selectedRecipients.includes(u.id)} className="mr-2" />
                        <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6"><AvatarImage src={u.avatarUrl} /><AvatarFallback className="text-[8px]">{getInitials(u.name)}</AvatarFallback></Avatar>
                            <span>{u.name}</span>
                        </div>
                        </CommandItem>
                    ))}
                </CommandGroup>
                </>
            )}
          </CommandList>
        </Command>
        <DialogFooter className="p-6 pt-0 border-t mt-auto"><Button onClick={() => onOpenChange(false)}>Hotovo</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MessageDetailDialog({ message, isOpen, onOpenChange, allUsers, onReply }: { message: Message | null, isOpen: boolean, onOpenChange: (open: boolean) => void, allUsers: User[], onReply: (recipientId: string, replyText: string) => Promise<void> }) {
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const { toast } = useToast();
  if (!message) return null;
  const sender = allUsers.find(u => u.id === message.senderId);
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Detail zprávy</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
                <p><span className="font-semibold">Od:</span> {sender?.name || 'Neznámý'}</p>
                <Separator />
                <p className="whitespace-pre-wrap">{message.text}</p>
                <Separator />
                <Textarea placeholder="Odpovědět..." value={replyText} onChange={e => setReplyText(e.target.value)} />
            </div>
             <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Zavřít</Button>
                <Button onClick={async () => { if(!sender) return; setIsReplying(true); await onReply(sender.id, replyText); setIsReplying(false); onOpenChange(false); }} disabled={isReplying}>Odeslat</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}

export default function ZpravyPage() {
  const { user, hasRole } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [messageText, setMessageText] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [isRecipientDialogOpen, setIsRecipientDialogOpen] = useState(false);
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: allUsers } = useCollection<User>(useMemoFirebase(() => firestore && user?.organizationId ? query(collection(firestore, "users"), where("organizationId", "==", user.organizationId)) : null, [firestore, user?.organizationId]));
  const { data: allClasses } = useCollection<Trida>(useMemoFirebase(() => firestore && user?.organizationId ? query(collection(firestore, 'tridy'), where('organizationId', '==', user.organizationId)) : null, [firestore, user?.organizationId]));

  useEffect(() => {
    if (!firestore || !user?.id) return;
    const rQuery = query(collection(firestore, 'messages'), where('recipientIds', 'array-contains', user.id));
    const sQuery = query(collection(firestore, 'messages'), where('senderId', '==', user.id));
    const unsubR = onSnapshot(rQuery, s => setReceivedMessages(s.docs.map(d => ({...d.data(), id: d.id} as Message))));
    const unsubS = onSnapshot(sQuery, s => setSentMessages(s.docs.map(d => ({...d.data(), id: d.id} as Message))));
    return () => { unsubR(); unsubS(); };
  }, [firestore, user?.id]);

  const handleSendMessage = async () => {
    if (!user || !firestore || !messageText.trim() || selectedRecipients.length === 0) return;
    const newMessage = { senderId: user.id, recipientIds: selectedRecipients, text: messageText, createdAt: Timestamp.now(), readBy: [], organizationId: user.organizationId || '' };
    await addDocumentNonBlocking(collection(firestore, 'messages'), newMessage);
    setMessageText(''); setSelectedRecipients([]); toast({ title: 'Odesláno' });
  };

  return (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold">Komunikace</h1>
        <Tabs defaultValue="inbox">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="new">Nová zpráva</TabsTrigger>
                <TabsTrigger value="inbox">Doručené</TabsTrigger>
                <TabsTrigger value="sent">Odeslané</TabsTrigger>
            </TabsList>
            <TabsContent value="new">
                <Card>
                    <CardContent className="space-y-4 pt-6">
                        <Button variant="outline" className="w-full" onClick={() => setIsRecipientDialogOpen(true)}>Příjemci: {selectedRecipients.length}</Button>
                        <Textarea rows={8} value={messageText} onChange={e => setMessageText(e.target.value)} placeholder="Zpráva..." />
                        <Button onClick={handleSendMessage}>Odeslat</Button>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="inbox">
                <Table>
                    <TableBody>
                        {receivedMessages.map(m => (
                            <TableRow key={m.id} className="cursor-pointer" onClick={() => { setSelectedMessage(m); setIsDetailOpen(true); }}>
                                <TableCell>{allUsers?.find(u => u.id === m.senderId)?.name}</TableCell>
                                <TableCell className="max-w-md truncate">{m.text}</TableCell>
                                <TableCell className="text-right">{m.createdAt ? format(m.createdAt.toDate(), 'd.M.') : ''}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TabsContent>
        </Tabs>
        <RecipientDialog isOpen={isRecipientDialogOpen} onOpenChange={setIsRecipientDialogOpen} allUsers={allUsers} allClasses={allClasses} selectedRecipients={selectedRecipients} onToggleRecipient={id => setSelectedRecipients(p => p.includes(id) ? p.filter(x => x!==id) : [...p, id])} hasRole={hasRole} isLoading={!allUsers} />
        {allUsers && <MessageDetailDialog message={selectedMessage} isOpen={isDetailOpen} onOpenChange={setIsDetailOpen} allUsers={allUsers} onReply={async (rid, txt) => { await addDocumentNonBlocking(collection(firestore, 'messages'), { senderId: user!.id, recipientIds: [rid], text: txt, createdAt: Timestamp.now(), readBy: [], organizationId: user!.organizationId || '' }); toast({ title: 'Odesláno' }); }} />}
    </div>
  );
}

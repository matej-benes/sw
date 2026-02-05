'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, UserPlus, Inbox, Send as SendIcon } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, Timestamp, onSnapshot, orderBy } from 'firebase/firestore';
import type { Trida, User, Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

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

function MessageDetailDialog({ message, isOpen, onOpenChange, allUsers, onReply, currentUser }: { message: Message | null, isOpen: boolean, onOpenChange: (open: boolean) => void, allUsers: User[], onReply: (recipientId: string, replyText: string) => Promise<void>, currentUser: User | null }) {
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  
  useEffect(() => { if (isOpen) setReplyText(''); }, [isOpen]);

  if (!message) return null;
  const sender = allUsers.find(u => u.id === message.senderId);
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Detail zprávy</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10"><AvatarImage src={sender?.avatarUrl} /><AvatarFallback>{getInitials(sender?.name || '?')}</AvatarFallback></Avatar>
                    <div>
                        <p className="font-semibold">{sender?.name || 'Neznámý odesílatel'}</p>
                        <p className="text-xs text-muted-foreground">{m.createdAt ? format(m.createdAt.toDate(), 'd.M.yyyy HH:mm') : ''}</p>
                    </div>
                </div>
                <Separator />
                <div className="bg-muted/30 p-4 rounded-lg">
                    <p className="whitespace-pre-wrap text-sm">{message.text}</p>
                </div>
                <Separator />
                <Textarea placeholder="Napsat odpověď..." value={replyText} onChange={e => setReplyText(e.target.value)} />
            </div>
             <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Zavřít</Button>
                <Button onClick={async () => { if(!sender) return; setIsReplying(true); await onReply(sender.id, replyText); setIsReplying(false); onOpenChange(false); }} disabled={isReplying || !replyText.trim()}>Odeslat odpověď</Button>
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

  // Fetch all users in organization for mapping names and recipient selection
  const { data: allUsers } = useCollection<User>(useMemoFirebase(() => firestore && user?.organizationId ? query(collection(firestore, "users"), where("organizationId", "==", user.organizationId)) : null, [firestore, user?.organizationId]));
  const { data: allClasses } = useCollection<Trida>(useMemoFirebase(() => firestore && user?.organizationId ? query(collection(firestore, 'tridy'), where('organizationId', '==', user.organizationId)) : null, [firestore, user?.organizationId]));

  useEffect(() => {
    if (!firestore || !user?.id) return;
    
    const studentIds = user.studentIds || (user.studentId ? [user.studentId] : []);
    const searchIds = [user.id, ...studentIds];

    const rQuery = query(collection(firestore, 'messages'), where('recipientIds', 'array-contains-any', searchIds), orderBy('createdAt', 'desc'));
    const sQuery = query(collection(firestore, 'messages'), where('senderId', '==', user.id), orderBy('createdAt', 'desc'));
    
    const unsubR = onSnapshot(rQuery, s => setReceivedMessages(s.docs.map(d => ({...d.data(), id: d.id} as Message))));
    const unsubS = onSnapshot(sQuery, s => setSentMessages(s.docs.map(d => ({...d.data(), id: d.id} as Message))));
    
    return () => { unsubR(); unsubS(); };
  }, [firestore, user?.id, user?.studentIds, user?.studentId]);

  const handleSendMessage = async () => {
    if (!user || !firestore || !messageText.trim() || selectedRecipients.length === 0) return;
    const newMessage = { 
        senderId: user.id, 
        recipientIds: selectedRecipients, 
        text: messageText, 
        createdAt: Timestamp.now(), 
        readBy: [], 
        organizationId: user.organizationId || '' 
    };
    await addDocumentNonBlocking(collection(firestore, 'messages'), newMessage);
    setMessageText(''); 
    setSelectedRecipients([]); 
    toast({ title: 'Zpráva byla odeslána' });
  };

  const getRecipientLabel = (msg: Message) => {
      if (!user) return null;
      const studentIds = user.studentIds || (user.studentId ? [user.studentId] : []);
      const targetId = msg.recipientIds.find(id => studentIds.includes(id));
      if (targetId) {
          const student = allUsers?.find(u => u.id === targetId);
          return student ? <Badge variant="outline" className="ml-2 bg-primary/5 text-primary border-primary/20">Pro: {student.name}</Badge> : null;
      }
      return null;
  };

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">Komunikace</h1>
        </div>
        <Tabs defaultValue="inbox" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
                <TabsTrigger value="inbox" className="flex items-center gap-2"><Inbox className="h-4 w-4" />Doručené</TabsTrigger>
                <TabsTrigger value="sent" className="flex items-center gap-2"><SendIcon className="h-4 w-4" />Odeslané</TabsTrigger>
                <TabsTrigger value="new" className="flex items-center gap-2"><UserPlus className="h-4 w-4" />Nová zpráva</TabsTrigger>
            </TabsList>
            
            <TabsContent value="inbox" className="mt-6">
                <Card>
                    <Table>
                        <TableBody>
                            {receivedMessages.length === 0 ? (
                                <TableRow><TableCell className="text-center py-10 text-muted-foreground">Žádné doručené zprávy.</TableCell></TableRow>
                            ) : (
                                receivedMessages.map(m => (
                                    <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedMessage(m); setIsDetailOpen(true); }}>
                                        <TableCell className="w-12">
                                            <Avatar className="h-8 w-8"><AvatarImage src={allUsers?.find(u => u.id === m.senderId)?.avatarUrl} /><AvatarFallback>{getInitials(allUsers?.find(u => u.id === m.senderId)?.name || '?')}</AvatarFallback></Avatar>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {allUsers?.find(u => u.id === m.senderId)?.name || 'Načítání...'}
                                            {getRecipientLabel(m)}
                                        </TableCell>
                                        <TableCell className="max-w-md truncate text-muted-foreground">{m.text}</TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">{m.createdAt ? format(m.createdAt.toDate(), 'd.M.') : ''}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </TabsContent>

            <TabsContent value="sent" className="mt-6">
                <Card>
                    <Table>
                        <TableBody>
                            {sentMessages.length === 0 ? (
                                <TableRow><TableCell className="text-center py-10 text-muted-foreground">Žádné odeslané zprávy.</TableCell></TableRow>
                            ) : (
                                sentMessages.map(m => (
                                    <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedMessage(m); setIsDetailOpen(true); }}>
                                        <TableCell className="font-medium">
                                            Komu: {m.recipientIds.length > 1 ? `${m.recipientIds.length} příjemců` : (allUsers?.find(u => u.id === m.recipientIds[0])?.name || allClasses?.find(c => c.id === m.recipientIds[0])?.nazev || 'Načítání...')}
                                        </TableCell>
                                        <TableCell className="max-w-md truncate text-muted-foreground">{m.text}</TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">{m.createdAt ? format(m.createdAt.toDate(), 'd.M.') : ''}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </TabsContent>

            <TabsContent value="new" className="mt-6">
                <Card>
                    <CardContent className="space-y-4 pt-6">
                        <div className="flex flex-wrap gap-2 items-center">
                            <Button variant="outline" onClick={() => setIsRecipientDialogOpen(true)}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                {selectedRecipients.length === 0 ? 'Vybrat příjemce' : `Vybráno příjemců: ${selectedRecipients.length}`}
                            </Button>
                            <div className="flex flex-wrap gap-1">
                                {selectedRecipients.slice(0, 3).map(id => (
                                    <Badge key={id} variant="secondary" className="flex items-center gap-1">
                                        {allUsers?.find(u => u.id === id)?.name || allClasses?.find(c => c.id === id)?.nazev || id}
                                        <Checkbox checked className="h-3 w-3 pointer-events-none" />
                                    </Badge>
                                ))}
                                {selectedRecipients.length > 3 && <Badge variant="secondary">+{selectedRecipients.length - 3}</Badge>}
                            </div>
                        </div>
                        <Textarea rows={10} value={messageText} onChange={e => setMessageText(e.target.value)} placeholder="Zde napište text vaší zprávy..." className="resize-none" />
                        <div className="flex justify-end">
                            <Button onClick={handleSendMessage} disabled={!messageText.trim() || selectedRecipients.length === 0}>
                                <SendIcon className="mr-2 h-4 w-4" />
                                Odeslat zprávu
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        <RecipientDialog 
            isOpen={isRecipientDialogOpen} 
            onOpenChange={setIsRecipientDialogOpen} 
            allUsers={allUsers} 
            allClasses={allClasses} 
            selectedRecipients={selectedRecipients} 
            onToggleRecipient={id => setSelectedRecipients(p => p.includes(id) ? p.filter(x => x!==id) : [...p, id])} 
            hasRole={hasRole} 
            isLoading={!allUsers} 
        />

        {allUsers && (
            <MessageDetailDialog 
                message={selectedMessage} 
                isOpen={isDetailOpen} 
                onOpenChange={setIsDetailOpen} 
                allUsers={allUsers} 
                currentUser={user}
                onReply={async (rid, txt) => { 
                    await addDocumentNonBlocking(collection(firestore, 'messages'), { 
                        senderId: user!.id, 
                        recipientIds: [rid], 
                        text: txt, 
                        createdAt: Timestamp.now(), 
                        readBy: [], 
                        organizationId: user!.organizationId || '' 
                    }); 
                    toast({ title: 'Odpověď byla odeslána' }); 
                }} 
            />
        )}
    </div>
  );
}

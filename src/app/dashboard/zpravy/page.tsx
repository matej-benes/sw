'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Send, UserPlus, Inbox, Send as SendIcon, Pencil, CheckCircle, Eye, Reply } from 'lucide-react';
import { useFirestore, useCollection, useDoc, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, Timestamp, updateDoc, arrayUnion } from 'firebase/firestore';
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
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function RecipientDialog({ isOpen, onOpenChange, allUsers, allClasses, selectedRecipients, onToggleRecipient, hasRole }: { isOpen: boolean, onOpenChange: (open: boolean) => void, allUsers: User[], allClasses: Trida[], selectedRecipients: string[], onToggleRecipient: (id: string) => void, hasRole: (role: any) => boolean }) {
  const { user } = useAuth();

  const studentRecipientOptions = useMemo(() => {
    if (!user || !hasRole('ziak') || !allClasses || !allUsers) return [];
    
    const studentClass = allClasses.find(c => c.id === user.tridaId);
    if(!studentClass) return [];
    
    const classTeacher = allUsers.find(u => u.id === studentClass.ucitelId);
    const substitutes = studentClass.zastupciIds?.map(id => allUsers.find(u => u.id === id)).filter(Boolean) as User[];
    const assistants = studentClass.asistentiIds?.map(id => allUsers.find(u => u.id === id)).filter(Boolean) as User[];
    
    const specialRoles: { user: User, role: string }[] = [];
    if(classTeacher) specialRoles.push({ user: classTeacher, role: 'Třídní učitel'});
    substitutes.forEach(sub => specialRoles.push({ user: sub, role: 'Zástupce třídního' }));
    assistants.forEach(as => specialRoles.push({ user: as, role: 'Asistent pedagoga ve vaší třídě' }));

    const specialRoleIds = specialRoles.map(r => r.user.id);
    
    const specialRoleOptions = specialRoles.map(r => ({
      ...r.user,
      label: `${r.user.name} (${r.role})`,
    }));
    
    const otherTeachers = allUsers
      .filter(u => u.roles.includes('ucitel') && !specialRoleIds.includes(u.id))
      .map(t => ({
        ...t,
        label: `${t.name} (Učitel)`
      }));

    return [...specialRoleOptions, ...otherTeachers];
  }, [user, hasRole, allUsers, allClasses]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl h-auto max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Vybrat příjemce</DialogTitle>
        </DialogHeader>
        <Command className="flex-grow overflow-hidden">
          <CommandInput placeholder="Hledat..." />
          <CommandList className="max-h-full">
            <CommandEmpty>Nenalezeno.</CommandEmpty>
            {hasRole('ucitel') && (
              <CommandGroup heading="Třídy">
                {allClasses.map(c => (
                  <CommandItem key={c.id} onSelect={() => onToggleRecipient(c.id)}>
                    <Checkbox checked={selectedRecipients.includes(c.id)} className="mr-2" />
                    <span>Třída {c.nazev}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading={hasRole('ucitel') ? 'Uživatelé' : 'Učitelé'}>
              {(hasRole('ucitel') ? allUsers.filter(u => u.id !== user?.id) : studentRecipientOptions).map(u => (
                <CommandItem key={u.id} onSelect={() => onToggleRecipient(u.id)}>
                  <Checkbox checked={selectedRecipients.includes(u.id)} className="mr-2" />
                  <span>{(u as any).label || u.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Hotovo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MessageDetailDialog({ message, isOpen, onOpenChange, allUsers, onReply }: { message: Message | null, isOpen: boolean, onOpenChange: (open: boolean) => void, allUsers: User[], onReply: (recipientId: string, replyText: string) => Promise<void> }) {
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
        setReplyText('');
    }
  }, [isOpen]);
    
  if (!message) return null;

  const sender = allUsers.find(u => u.id === message.senderId);
  const recipients = message.recipientIds.map(id => allUsers.find(u => u.id === id)?.name || 'Neznámý').join(', ');
  
  const handleReply = async () => {
    if (!sender || !replyText.trim()) {
        toast({ variant: 'destructive', title: 'Text odpovědi nesmí být prázdný.' });
        return;
    }
    setIsReplying(true);
    await onReply(sender.id, replyText);
    setIsReplying(false);
    setReplyText('');
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Detail zprávy</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                <div className="text-sm">
                    <p><span className="font-semibold text-muted-foreground">Odesílatel:</span> {sender?.name}</p>
                    <p><span className="font-semibold text-muted-foreground">Příjemci:</span> {recipients}</p>
                    <p><span className="font-semibold text-muted-foreground">Datum:</span> {format((message.createdAt as Timestamp).toDate(), 'PPP p', { locale: cs })}</p>
                </div>
                <Separator />
                <p className="whitespace-pre-wrap">{message.text}</p>
                
                {message.readBy && message.readBy.length > 0 && (
                  <div>
                    <h4 className="font-semibold mt-4 mb-2">Přečteno příjemci:</h4>
                    <div className="flex flex-wrap gap-2">
                        {message.readBy.map(userId => (
                           <Badge key={userId} variant="secondary" className="font-normal">
                            <CheckCircle className="mr-1.5 h-3 w-3 text-green-500" />
                            {allUsers.find(u => u.id === userId)?.name || 'Neznámý'}
                           </Badge>
                        ))}
                    </div>
                  </div>
                )}

                <Separator />
                <div className="space-y-2 pt-4">
                    <Label htmlFor="quick-reply">Rychlá odpověď</Label>
                    <Textarea 
                        id="quick-reply"
                        rows={4}
                        placeholder={`Napsat odpověď pro ${sender?.name}...`}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                    />
                </div>
            </div>
             <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Zavřít</Button>
                </DialogClose>
                <Button onClick={handleReply} disabled={isReplying}>
                    {isReplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Reply className="mr-2 h-4 w-4" />}
                    Odeslat odpověď
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}


export default function ZpravyPage() {
  const { user, hasRole, loading: userLoading } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [isRecipientDialogOpen, setIsRecipientDialogOpen] = useState(false);
  
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // --- Data Fetching ---
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(useMemoFirebase(() => firestore ? collection(firestore, "users") : null, [firestore]));
  const { data: allClasses, isLoading: classesLoading } = useCollection<Trida>(useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]));
  
  const receivedMessagesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'messages'), where('recipientIds', 'array-contains', user.id));
  }, [firestore, user]);

  const sentMessagesQuery = useMemoFirebase(() => {
      if (!firestore || !user) return null;
      return query(collection(firestore, 'messages'), where('senderId', '==', user.id));
  }, [firestore, user]);
  
  const { data: receivedMessagesData, isLoading: receivedLoading } = useCollection<Message>(receivedMessagesQuery);
  const { data: sentMessagesData, isLoading: sentLoading } = useCollection<Message>(sentMessagesQuery);

  const receivedMessages = useMemo(() => 
    receivedMessagesData?.sort((a, b) => (b.createdAt as Timestamp).toMillis() - (a.createdAt as Timestamp).toMillis()) || [], 
  [receivedMessagesData]);

  const sentMessages = useMemo(() => 
    sentMessagesData?.sort((a, b) => (b.createdAt as Timestamp).toMillis() - (a.createdAt as Timestamp).toMillis()) || [],
  [sentMessagesData]);

  const unreadMessagesCount = useMemo(() => {
    if (!user || !receivedMessages) return 0;
    return receivedMessages.filter(msg => !msg.readBy.includes(user.id)).length;
  }, [user, receivedMessages]);


  const handleSendMessage = async () => {
    if (!user || !firestore || !allClasses) return;
    if (!messageText.trim()) {
      toast({ variant: "destructive", title: "Prázdná zpráva" });
      return;
    }
    if (selectedRecipients.length === 0) {
      toast({ variant: "destructive", title: "Vyberte příjemce" });
      return;
    }

    setIsSending(true);

    let finalRecipientIds: string[] = [];
    selectedRecipients.forEach(id => {
      const classInfo = allClasses.find(c => c.id === id);
      if (classInfo) {
        // It's a class ID, add all students
        finalRecipientIds.push(...(classInfo.ziaciIds || []));
      } else {
        // It's a user ID
        finalRecipientIds.push(id);
      }
    });

    finalRecipientIds = [...new Set(finalRecipientIds)].filter(id => id !== user.id);

    if(finalRecipientIds.length === 0) {
      toast({ variant: "destructive", title: "Nemůžete poslat zprávu sami sobě." });
      setIsSending(false);
      return;
    }

    const newMessage: Omit<Message, 'id'> = {
      senderId: user.id,
      recipientIds: finalRecipientIds,
      text: messageText,
      createdAt: Timestamp.now(),
      readBy: [],
    };

    try {
      await addDocumentNonBlocking(collection(firestore, 'messages'), newMessage);
      toast({ title: 'Zpráva odeslána' });
      setMessageText('');
      setSelectedRecipients([]);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Chyba při odesílání' });
    } finally {
      setIsSending(false);
    }
  };

  const handleReplyMessage = async (recipientId: string, replyText: string) => {
    if (!user || !firestore) return;

    const newMessage: Omit<Message, 'id'> = {
        senderId: user.id,
        recipientIds: [recipientId],
        text: replyText,
        createdAt: Timestamp.now(),
        readBy: [],
    };
    try {
        await addDocumentNonBlocking(collection(firestore, 'messages'), newMessage);
        toast({ title: 'Odpověď odeslána' });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Chyba při odesílání odpovědi' });
    }
  };


  const handleToggleRecipient = (recipientId: string) => {
    setSelectedRecipients(prev =>
      prev.includes(recipientId)
        ? prev.filter(id => id !== recipientId)
        : [...prev, recipientId]
    );
  };
  
  const handleRowClick = (message: Message) => {
    setSelectedMessage(message);
    setIsDetailOpen(true);
    // Mark as read if it's a received message and not already read
    if (user && firestore && message.recipientIds.includes(user.id) && !message.readBy.includes(user.id)) {
      const messageRef = doc(firestore, 'messages', message.id);
      updateDocumentNonBlocking(messageRef, {
        readBy: arrayUnion(user.id)
      });
    }
  };

  const isDataLoading = userLoading || usersLoading || classesLoading || receivedLoading || sentLoading;

  const getSenderName = useCallback((senderId: string) => {
    return allUsers?.find(u => u.id === senderId)?.name || 'Neznámý';
  }, [allUsers]);

  const hasUserReadMessage = useCallback((message: Message) => {
    if (!user) return false;
    return message.readBy.includes(user.id);
  }, [user]);
  
  const getRecipientNames = useCallback((recipientIds: string[]) => {
      if (!allUsers) return '';
      return recipientIds.map(id => allUsers.find(u => u.id === id)?.name || 'Neznámý').join(', ');
  }, [allUsers]);


  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Komunikace</h1>
          <p className="text-muted-foreground">Posílejte a přijímejte zprávy.</p>
        </div>

        <Tabs defaultValue="inbox" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="new"><Pencil className="mr-2 h-4 w-4" />Nová zpráva</TabsTrigger>
                <TabsTrigger value="inbox" className="relative">
                    <Inbox className="mr-2 h-4 w-4" />Doručené
                    {unreadMessagesCount > 0 && (
                        <Badge className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{unreadMessagesCount}</Badge>
                    )}
                </TabsTrigger>
                <TabsTrigger value="sent"><SendIcon className="mr-2 h-4 w-4" />Odeslané</TabsTrigger>
            </TabsList>
            
            <TabsContent value="new">
                <Card>
                    <CardHeader><CardTitle>Nová zpráva</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Příjemci:</Label>
                            <Button variant="outline" className="w-full justify-start mt-2" onClick={() => setIsRecipientDialogOpen(true)}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                {selectedRecipients.length > 0 ? `Vybráno příjemců: ${selectedRecipients.length}` : 'Vybrat příjemce'}
                            </Button>
                        </div>
                        <div>
                            <Label htmlFor="message-text">Text zprávy:</Label>
                            <Textarea
                                id="message-text"
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                rows={8}
                                placeholder="Napište zprávu..."
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSendMessage} disabled={isSending}>
                            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Odeslat
                        </Button>
                    </CardFooter>
                </Card>
            </TabsContent>
            
            <TabsContent value="inbox">
                 <Card>
                    <CardHeader><CardTitle>Doručené zprávy</CardTitle></CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>Odesílatel</TableHead>
                                    <TableHead>Zpráva</TableHead>
                                    <TableHead>Datum</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isDataLoading ? (
                                    <TableRow><TableCell colSpan={4} className="text-center">Načítání...</TableCell></TableRow>
                                ) : receivedMessages?.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="text-center">Žádné doručené zprávy.</TableCell></TableRow>
                                ) : (
                                    receivedMessages?.map(msg => (
                                        <TableRow key={msg.id} onClick={() => handleRowClick(msg)} className={cn("cursor-pointer", !hasUserReadMessage(msg) && "font-bold")}>
                                            <TableCell className="text-center">
                                                {!hasUserReadMessage(msg) && <div className="h-2 w-2 rounded-full bg-primary"></div>}
                                            </TableCell>
                                            <TableCell>{getSenderName(msg.senderId)}</TableCell>
                                            <TableCell className="max-w-sm truncate">{msg.text}</TableCell>
                                            <TableCell className="text-right">{format((msg.createdAt as Timestamp).toDate(), 'd. M. yyyy', { locale: cs })}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="sent">
                 <Card>
                    <CardHeader><CardTitle>Odeslané zprávy</CardTitle></CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Příjemci</TableHead>
                                    <TableHead>Zpráva</TableHead>
                                    <TableHead>Datum</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                 {isDataLoading ? (
                                    <TableRow><TableCell colSpan={3} className="text-center">Načítání...</TableCell></TableRow>
                                ) : sentMessages?.length === 0 ? (
                                    <TableRow><TableCell colSpan={3} className="text-center">Žádné odeslané zprávy.</TableCell></TableRow>
                                ) : (
                                    sentMessages?.map(msg => (
                                        <TableRow key={msg.id} onClick={() => handleRowClick(msg)} className="cursor-pointer">
                                            <TableCell className="max-w-[200px] truncate">{getRecipientNames(msg.recipientIds)}</TableCell>
                                            <TableCell className="max-w-sm truncate">{msg.text}</TableCell>
                                            <TableCell className="text-right">{format((msg.createdAt as Timestamp).toDate(), 'd. M. yyyy', { locale: cs })}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

      </div>
      
      {allUsers && allClasses && (
        <RecipientDialog 
          isOpen={isRecipientDialogOpen}
          onOpenChange={setIsRecipientDialogOpen}
          allClasses={allClasses}
          allUsers={allUsers}
          selectedRecipients={selectedRecipients}
          onToggleRecipient={handleToggleRecipient}
          hasRole={hasRole}
        />
      )}

      {allUsers && (
        <MessageDetailDialog 
          message={selectedMessage}
          isOpen={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          allUsers={allUsers}
          onReply={handleReplyMessage}
        />
      )}
    </>
  );
}

    
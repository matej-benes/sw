
'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Send, UserPlus, Inbox, Send as SendIcon, Pencil, CheckCircle, Eye, Reply } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, Timestamp, arrayUnion, onSnapshot, documentId } from 'firebase/firestore';
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

  const recipientOptions = useMemo(() => {
    // Group users by role
    const teachers = users.filter(u => u.roles?.some(r => ['ucitel', 'administrator'].includes(r)));
    const others = users.filter(u => !u.roles?.some(r => ['ucitel', 'administrator'].includes(r)) && u.id !== user?.id);
    
    let priorityTeachers: { user: User, label: string }[] = [];
    
    if (user && hasRole('rodic')) {
        const myClassIds = new Set<string>();
        // Add classes of all children
        const childrenIds = user.studentIds || (user.studentId ? [user.studentId] : []);
        childrenIds.forEach(cid => {
            const child = users.find(u => u.id === cid);
            if (child?.tridaId) myClassIds.add(child.tridaId);
        });

        priorityTeachers = teachers.map(t => {
            const relevantClass = Array.from(myClassIds).find(cid => {
                const cls = classes.find(c => c.id === cid);
                return cls && (cls.ucitelId === t.id || cls.zastupciIds?.includes(t.id) || cls.asistentiIds?.includes(t.id));
            });
            if (relevantClass) {
                const cls = classes.find(c => c.id === relevantClass);
                return { user: t, label: `${t.name} (Vyučující třídy ${cls?.nazev})` };
            }
            return { user: t, label: t.name };
        });
    } else {
        priorityTeachers = teachers.map(t => ({ user: t, label: t.name }));
    }

    return { teachers: priorityTeachers, others };
  }, [user, hasRole, users, classes]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl h-auto max-h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Vybrat příjemce</DialogTitle>
        </DialogHeader>
        <Command className="flex-grow overflow-hidden pointer-events-auto" shouldFilter={true}>
          <CommandInput placeholder="Hledat jméno nebo třídu..." />
          <CommandList className="max-h-full">
            {isLoading ? (
                <div className="p-10 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Načítání seznamu osob...</p>
                </div>
            ) : (
                <>
                <CommandEmpty>Nebyly nalezeny žádné shody.</CommandEmpty>
                {hasRole('ucitel') && classes.length > 0 && (
                    <CommandGroup heading="Třídy">
                        {classes.map(c => (
                        <CommandItem key={c.id} onSelect={() => onToggleRecipient(c.id)} className="cursor-pointer">
                            <Checkbox checked={selectedRecipients.includes(c.id)} className="mr-2" />
                            <span>Třída {c.nazev}</span>
                        </CommandItem>
                        ))}
                    </CommandGroup>
                )}
                {recipientOptions.teachers.length > 0 && (
                    <CommandGroup heading="Učitelé a správa">
                        {recipientOptions.teachers.map(opt => (
                            <CommandItem key={opt.user.id} onSelect={() => onToggleRecipient(opt.user.id)} className="cursor-pointer">
                            <Checkbox checked={selectedRecipients.includes(opt.user.id)} className="mr-2" />
                            <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={opt.user.avatarUrl} />
                                    <AvatarFallback className="text-[8px]">{getInitials(opt.user.name)}</AvatarFallback>
                                </Avatar>
                                <span>{opt.label}</span>
                            </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}
                {hasRole('ucitel') && recipientOptions.others.length > 0 && (
                    <CommandGroup heading="Ostatní uživatelé">
                        {recipientOptions.others.map(u => (
                            <CommandItem key={u.id} onSelect={() => onToggleRecipient(u.id)} className="cursor-pointer">
                            <Checkbox checked={selectedRecipients.includes(u.id)} className="mr-2" />
                            <span>{u.name} ({u.roles?.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')})</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}
                </>
            )}
          </CommandList>
        </Command>
        <DialogFooter className="p-6 pt-0 border-t mt-auto">
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
                    <p><span className="font-semibold text-muted-foreground">Odesílatel:</span> {sender?.name || 'Neznámý'}</p>
                    <p><span className="font-semibold text-muted-foreground">Příjemci:</span> {recipients}</p>
                    <p><span className="font-semibold text-muted-foreground">Datum:</span> {message.createdAt ? format((message.createdAt as Timestamp).toDate(), 'PPP p', { locale: cs }) : '...'}</p>
                </div>
                <Separator />
                <p className="whitespace-pre-wrap">{message.text}</p>
                
                {message.readBy && message.readBy.length > 0 && (
                  <div>
                    <h4 className="font-semibold mt-4 mb-2 text-sm">Přečteno příjemci:</h4>
                    <div className="flex flex-wrap gap-2">
                        {message.readBy.map(userId => (
                           <Badge key={userId} variant="secondary" className="font-normal text-[10px]">
                            <CheckCircle className="mr-1 h-3 w-3 text-green-500" />
                            {allUsers.find(u => u.id === userId)?.name || 'Neznámý'}
                           </Badge>
                        ))}
                    </div>
                  </div>
                )}

                <Separator />
                <div className="space-y-2 pt-4">
                    <Label htmlFor="quick-reply" className="text-xs">Rychlá odpověď</Label>
                    <Textarea 
                        id="quick-reply"
                        rows={4}
                        placeholder={`Napsat odpověď pro ${sender?.name || 'odesílatele'}...`}
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
  
  // 1. Fetch users from same organization
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !user?.organizationId) return null;
    return query(collection(firestore, "users"), where("organizationId", "==", user.organizationId));
  }, [firestore, user?.organizationId]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);

  // 2. Fetch classes
  const classesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.organizationId) return null;
    return query(collection(firestore, 'tridy'), where('organizationId', '==', user.organizationId));
  }, [firestore, user?.organizationId]);
  const { data: allClasses, isLoading: classesLoading } = useCollection<Trida>(classesQuery);
  
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user?.id) {
      setMessagesLoading(false);
      return;
    }
    setMessagesLoading(true);

    const studentIds = user.studentIds || (user.studentId ? [user.studentId] : []);
    const searchIds = [user.id, ...studentIds];

    const receivedQuery = query(collection(firestore, 'messages'), where('recipientIds', 'array-contains-any', searchIds));
    const sentQuery = query(collection(firestore, 'messages'), where('senderId', '==', user.id));

    const unsubscribeReceived = onSnapshot(receivedQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Message[];
      setReceivedMessages(messages.sort((a, b) => {
          const timeA = (a.createdAt as Timestamp)?.toMillis() || 0;
          const timeB = (b.createdAt as Timestamp)?.toMillis() || 0;
          return timeB - timeA;
      }));
      setMessagesLoading(false);
    }, (error) => {
      console.error("Error fetching received messages: ", error);
      setMessagesLoading(false);
    });

    const unsubscribeSent = onSnapshot(sentQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Message[];
      setSentMessages(messages.sort((a, b) => {
          const timeA = (a.createdAt as Timestamp)?.toMillis() || 0;
          const timeB = (b.createdAt as Timestamp)?.toMillis() || 0;
          return timeB - timeA;
      }));
    }, (error) => {
        console.error("Error fetching sent messages: ", error);
    });

    return () => {
      unsubscribeReceived();
      unsubscribeSent();
    };
  }, [firestore, user?.id, user?.studentIds, user?.studentId]);

  const unreadMessagesCount = useMemo(() => {
    if (!user || !receivedMessages) return 0;
    return receivedMessages.filter(msg => !msg.readBy.includes(user.id)).length;
  }, [user, receivedMessages]);


  const handleSendMessage = async () => {
    if (!user || !firestore) return;
    if (!messageText.trim()) {
      toast({ variant: "destructive", title: "Prázdná zpráva" });
      return;
    }
    if (selectedRecipients.length === 0) {
      toast({ variant: "destructive", title: "Vyberte příjemce" });
      return;
    }

    setIsSending(true);

    try {
        let finalRecipientIds: string[] = [];
        selectedRecipients.forEach(id => {
          const classInfo = allClasses?.find(c => c.id === id);
          if (classInfo) {
            finalRecipientIds.push(...(classInfo.ziaciIds || []));
          } else {
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
          organizationId: user.organizationId || '',
        };

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
        organizationId: user.organizationId || '',
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
    if (user && firestore && !message.readBy.includes(user.id)) {
      const messageRef = doc(firestore, 'messages', message.id);
      updateDocumentNonBlocking(messageRef, {
        readBy: arrayUnion(user.id)
      });
    }
  };

  const isDataLoading = userLoading || usersLoading || classesLoading || messagesLoading;

  const getSenderName = useCallback((senderId: string) => {
    const sender = allUsers?.find(u => u.id === senderId);
    return sender?.name || 'Načítání...';
  }, [allUsers]);

  const hasUserReadMessage = useCallback((message: Message) => {
    if (!user) return false;
    return message.readBy.includes(user.id);
  }, [user]);
  
  const getRecipientNames = useCallback((recipientIds: string[]) => {
      if (!allUsers) return '...';
      return recipientIds.map(id => allUsers.find(u => u.id === id)?.name || 'Neznámý').join(', ');
  }, [allUsers]);

  const getRelevantChildren = useCallback((message: Message) => {
    if (!user || !hasRole('rodic') || !allUsers) return [];
    const studentIds = user.studentIds || (user.studentId ? [user.studentId] : []);
    const matchingIds = message.recipientIds.filter(id => studentIds.includes(id));
    return matchingIds.map(id => allUsers.find(u => u.id === id)).filter(Boolean) as User[];
  }, [user, hasRole, allUsers]);


  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Komunikace</h1>
          <p className="text-muted-foreground">Posílejte a přijímejte zprávy v rámci školy.</p>
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
                            <Label className="text-xs">Příjemci:</Label>
                            <Button 
                                type="button"
                                variant="outline" 
                                className="w-full justify-start mt-2 border-dashed h-12" 
                                onClick={() => setIsRecipientDialogOpen(true)}
                            >
                                <UserPlus className="mr-2 h-5 w-5 text-primary" />
                                {selectedRecipients.length > 0 ? (
                                    <span className="font-semibold text-primary">Vybráno příjemců: {selectedRecipients.length}</span>
                                ) : (
                                    <span className="text-muted-foreground">Klikněte pro výběr příjemců...</span>
                                )}
                            </Button>
                        </div>
                        <div>
                            <Label htmlFor="message-text" className="text-xs">Text zprávy:</Label>
                            <Textarea
                                id="message-text"
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                rows={8}
                                placeholder="Napište svou zprávu zde..."
                                className="mt-2"
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSendMessage} disabled={isSending || selectedRecipients.length === 0} className="w-full sm:w-auto">
                            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Odeslat zprávu
                        </Button>
                    </CardFooter>
                </Card>
            </TabsContent>
            
            <TabsContent value="inbox">
                 <Card>
                    <CardHeader><CardTitle>Doručené zprávy</CardTitle></CardHeader>
                    <CardContent className="p-0">
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>Odesílatel</TableHead>
                                    <TableHead>Zpráva</TableHead>
                                    <TableHead className="text-right">Datum</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isDataLoading ? (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                                ) : receivedMessages?.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Žádné doručené zprávy.</TableCell></TableRow>
                                ) : (
                                    receivedMessages?.map(msg => (
                                        <TableRow key={msg.id} onClick={() => handleRowClick(msg)} className={cn("cursor-pointer hover:bg-muted/50 transition-colors", !hasUserReadMessage(msg) && "bg-primary/5 font-bold")}>
                                            <TableCell className="text-center">
                                                {!hasUserReadMessage(msg) && <div className="h-2 w-2 rounded-full bg-primary mx-auto"></div>}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={allUsers?.find(u => u.id === msg.senderId)?.avatarUrl} />
                                                        <AvatarFallback className="text-[8px]">{getInitials(getSenderName(msg.senderId))}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs sm:text-sm">{getSenderName(msg.senderId)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="max-w-[150px] md:max-w-md truncate text-xs sm:text-sm">{msg.text}</span>
                                                    {hasRole('rodic') && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {getRelevantChildren(msg).map(child => (
                                                                <Badge key={child.id} variant="outline" className="text-[9px] h-4 px-1 py-0 border-primary/30 text-primary font-normal bg-primary/5">
                                                                    Pro: {child.name}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap text-muted-foreground text-[10px] sm:text-xs">
                                                {msg.createdAt ? format((msg.createdAt as Timestamp).toDate(), 'd. M. yyyy', { locale: cs }) : '...'}
                                            </TableCell>
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
                    <CardContent className="p-0">
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Příjemci</TableHead>
                                    <TableHead>Zpráva</TableHead>
                                    <TableHead className="text-right">Datum</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                 {isDataLoading ? (
                                    <TableRow><TableCell colSpan={3} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                                ) : sentMessages?.length === 0 ? (
                                    <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">Žádné odeslané zprávy.</TableCell></TableRow>
                                ) : (
                                    sentMessages?.map(msg => (
                                        <TableRow key={msg.id} onClick={() => handleRowClick(msg)} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                            <TableCell className="max-w-[120px] sm:max-w-[200px] truncate text-xs sm:text-sm">{getRecipientNames(msg.recipientIds)}</TableCell>
                                            <TableCell className="max-w-[150px] md:max-w-md truncate text-xs sm:text-sm">{msg.text}</TableCell>
                                            <TableCell className="text-right whitespace-nowrap text-muted-foreground text-[10px] sm:text-xs">{msg.createdAt ? format((msg.createdAt as Timestamp).toDate(), 'd. M. yyyy', { locale: cs }) : '...'}</TableCell>
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
      
      <RecipientDialog 
        isOpen={isRecipientDialogOpen}
        onOpenChange={setIsRecipientDialogOpen}
        allClasses={allClasses || []}
        allUsers={allUsers || []}
        selectedRecipients={selectedRecipients}
        onToggleRecipient={handleToggleRecipient}
        hasRole={hasRole}
        isLoading={usersLoading || classesLoading}
      />

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

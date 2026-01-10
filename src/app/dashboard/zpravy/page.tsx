'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { generateCommunicationMessage } from '@/ai/flows/generate-communication-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Send, Wand2, X, UserPlus, Check, Users, School } from 'lucide-react';
import { useFirestore, useCollection, useDoc, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDocs, Timestamp, orderBy, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { Trida, User, Conversation, Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}


export default function ZpravyPage() {
  const { user, hasRole } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [isRecipientDialogOpen, setIsRecipientDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Data Fetching ---
  const usersCollection = useMemoFirebase(() => firestore ? collection(firestore, "users") : null, [firestore]);
  const { data: allUsers } = useCollection<User>(usersCollection);

  const tridyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]);
  const { data: allClasses } = useCollection<Trida>(tridyCollection);

  const conversationsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'conversations'), where('participantIds', 'array-contains', user.id));
  }, [firestore, user]);
  const { data: conversations, isLoading: conversationsLoading } = useCollection<Conversation>(conversationsQuery);
  
  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !activeConversationId) return null;
    return query(collection(firestore, 'conversations', activeConversationId, 'messages'), orderBy('createdAt', 'asc'));
  }, [firestore, activeConversationId]);
  const { data: messages, isLoading: messagesLoading } = useCollection<Message>(messagesQuery);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const activeConversation = useMemo(() => {
      return conversations?.find(c => c.id === activeConversationId);
  }, [conversations, activeConversationId]);


  const handleSendMessage = async () => {
    if (!user || !firestore) return;
    if (!message.trim()) {
        toast({ variant: "destructive", title: "Prázdná zpráva" });
        return;
    }
    
    setIsSending(true);

    let conversationId = activeConversationId;
    let finalRecipients = recipients;

    // If we have an active conversation, send to its participants
    if (conversationId && activeConversation) {
        finalRecipients = activeConversation.participantIds;
    } 
    // If we have selected recipients but no active conversation
    else if (finalRecipients.length > 0) {
        const allParticipantIds = [...new Set([user.id, ...finalRecipients])].sort();

        // Check if a conversation with these participants already exists
        const conversationsRef = collection(firestore, 'conversations');
        const q = query(conversationsRef, where('participantIds', '==', allParticipantIds));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            conversationId = querySnapshot.docs[0].id;
        } else {
            // Create a new conversation
            const conversationData = {
                participantIds: allParticipantIds,
                lastMessage: message.substring(0, 50),
                lastMessageAt: serverTimestamp(),
            };
            const newConversationDoc = await addDoc(conversationsRef, conversationData);
            conversationId = newConversationDoc.id;
        }
        setActiveConversationId(conversationId);
    } else {
        toast({ variant: 'destructive', title: 'Chybí příjemce' });
        setIsSending(false);
        return;
    }

    if (!conversationId) {
        toast({ variant: 'destructive', title: 'Chyba při odesílání' });
        setIsSending(false);
        return;
    }

    // Add the message to the conversation
    const messagesColRef = collection(firestore, 'conversations', conversationId, 'messages');
    await addDoc(messagesColRef, {
        senderId: user.id,
        text: message,
        createdAt: serverTimestamp(),
    });
    
    // Update the last message on the conversation
    await addDocumentNonBlocking(doc(firestore, 'conversations', conversationId), {
        lastMessage: message.substring(0, 50),
        lastMessageAt: serverTimestamp(),
    });

    setMessage('');
    setRecipients([]);
    setIsSending(false);
  };
  
  const recipientOptions = useMemo(() => {
    const users = allUsers?.map(u => ({ id: u.id, label: u.name, type: 'user' as const, avatarUrl: u.avatarUrl, role: u.roles.join(', ') })) || [];
    const classes = allClasses?.map(c => ({ id: c.id, label: c.nazev, type: 'class' as const })) || [];
    return [...users, ...classes];
  }, [allUsers, allClasses]);

  const toggleRecipient = (recipientId: string) => {
    setRecipients(prev => 
        prev.includes(recipientId) 
            ? prev.filter(id => id !== recipientId) 
            : [...prev, recipientId]
    );
  };

  const selectedRecipientDetails = useMemo(() => {
    return recipients.map(id => {
      const user = allUsers?.find(u => u.id === id);
      if (user) return { id: user.id, label: user.name, type: 'user' };
      
      const classInfo = allClasses?.find(c => c.id === id);
      if (classInfo) return { id: classInfo.id, label: `Třída ${classInfo.nazev}`, type: 'class' };
      
      return null;
    }).filter(Boolean);
  }, [recipients, allUsers, allClasses]);
  

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Komunikace</h1>
          <p className="text-muted-foreground">Posílejte a přijímejte zprávy.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          <div className="md:col-span-1">
              <Card className="h-full flex flex-col">
                  <CardHeader>
                      <CardTitle>Konverzace</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow overflow-y-auto">
                      {conversationsLoading ? <p>Načítání...</p> : (
                          <div className="space-y-2">
                              {conversations?.map(convo => {
                                  const otherParticipants = allUsers?.filter(u => convo.participantIds.includes(u.id) && u.id !== user?.id);
                                  const conversationName = otherParticipants?.map(p => p.name).join(', ') || 'Konverzace';
                                  
                                  return (
                                       <div 
                                          key={convo.id} 
                                          className={cn("p-3 rounded-lg cursor-pointer transition-colors", activeConversationId === convo.id ? "bg-muted" : "hover:bg-muted/50")}
                                          onClick={() => { setActiveConversationId(convo.id); setRecipients([]); }}
                                      >
                                          <p className="font-semibold">{conversationName}</p>
                                          <p className="text-sm text-muted-foreground truncate">{convo.lastMessage}</p>
                                      </div>
                                  )
                              })}
                          </div>
                      )}
                  </CardContent>
              </Card>
          </div>

          <div className="md:col-span-2">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle>{activeConversation ? allUsers?.filter(u => activeConversation.participantIds.includes(u.id) && u.id !== user?.id).map(p => p.name).join(', ') : 'Nová zpráva'}</CardTitle>
                <CardDescription>
                  {activeConversation ? `Poslední aktivita: ${activeConversation.lastMessageAt ? format((activeConversation.lastMessageAt as Timestamp).toDate(), 'Pp', { locale: cs }) : 'N/A'}` : 'Napište novou zprávu.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow overflow-y-auto space-y-4">
                  {messagesLoading && <p>Načítání zpráv...</p>}
                  {!messagesLoading && messages?.map(msg => {
                      const sender = allUsers?.find(u => u.id === msg.senderId);
                      const isMe = sender?.id === user?.id;
                      return (
                           <div key={msg.id} className={cn("flex items-end gap-2", isMe ? "justify-end" : "justify-start")}>
                               {!isMe && (
                                   <Avatar className="h-8 w-8">
                                       <AvatarImage src={sender?.avatarUrl} />
                                       <AvatarFallback>{sender ? getInitials(sender.name) : '?'}</AvatarFallback>
                                   </Avatar>
                               )}
                                <div className={cn("max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg", isMe ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                  <p className="text-sm">{msg.text}</p>
                                   <p className="text-xs text-right mt-1 opacity-70">
                                      {msg.createdAt ? format((msg.createdAt as Timestamp).toDate(), 'HH:mm') : ''}
                                  </p>
                                </div>
                                {isMe && (
                                   <Avatar className="h-8 w-8">
                                       <AvatarImage src={sender?.avatarUrl} />
                                       <AvatarFallback>{sender ? getInitials(sender.name) : '?'}</AvatarFallback>
                                   </Avatar>
                               )}
                           </div>
                      )
                  })}
                   <div ref={messagesEndRef} />
              </CardContent>
               <CardContent className="border-t pt-4">
                 {!activeConversation && (
                     <div className="space-y-2 mb-4">
                        <Label>Příjemce:</Label>
                        <Button type="button" variant="outline" className="w-full justify-start" onClick={() => { setActiveConversationId(null); setIsRecipientDialogOpen(true); }}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Přidat příjemce
                        </Button>
                        {selectedRecipientDetails.length > 0 && (
                            <div className="pt-2 flex flex-wrap gap-2">
                                {selectedRecipientDetails.map(r => (
                                    <Badge key={r!.id} variant="secondary">
                                        {r!.label}
                                        <button onClick={() => toggleRecipient(r!.id)} className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                            <X className="h-3 w-3" />
                                            <span className="sr-only">Odstranit příjemce</span>
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                 )}
                <div className="relative">
                  <Textarea
                    id="message-content"
                    placeholder="Napište svou zprávu zde..."
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                  />
                  <Button size="icon" className="absolute bottom-2 right-2" onClick={handleSendMessage} disabled={isSending}>
                    {isSending ? <Loader2 className="animate-spin"/> : <Send/>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
       <Dialog open={isRecipientDialogOpen} onOpenChange={setIsRecipientDialogOpen}>
            <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Vybrat příjemce</DialogTitle>
                </DialogHeader>
                <Command className="flex-grow overflow-hidden">
                    <CommandInput placeholder="Hledat uživatele nebo třídy..." />
                    <CommandList className="max-h-full">
                        <CommandEmpty>Žádní uživatelé nenalezeni.</CommandEmpty>
                        <CommandGroup heading="Třídy">
                           {allClasses?.map(c => {
                                const isSelected = recipients.includes(c.id);
                                return (
                                    <CommandItem key={c.id} onSelect={() => toggleRecipient(c.id)} className="cursor-pointer">
                                        <Checkbox checked={isSelected} className="mr-2" />
                                        <School className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <span>Třída {c.nazev}</span>
                                    </CommandItem>
                                )
                           })}
                        </CommandGroup>
                        <CommandGroup heading="Uživatelé">
                            {allUsers?.filter(u => u.id !== user?.id).map((option) => {
                                const isSelected = recipients.includes(option.id);
                                return (
                                    <CommandItem
                                        key={option.id}
                                        onSelect={() => toggleRecipient(option.id)}
                                        className="cursor-pointer"
                                    >
                                        <Checkbox checked={isSelected} className="mr-2" />
                                        <Avatar className="h-6 w-6 mr-2">
                                            <AvatarImage src={option.avatarUrl} />
                                            <AvatarFallback>{getInitials(option.name)}</AvatarFallback>
                                        </Avatar>
                                        <span>{option.name} <span className="text-xs text-muted-foreground">({option.roles.join(', ')})</span></span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
                <DialogFooter>
                    <Button onClick={() => setIsRecipientDialogOpen(false)}>
                        <Check className="mr-2 h-4 w-4" />
                        Potvrdit ({recipients.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}

'use client';
import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where } from 'firebase/firestore';
import type { Message } from '@/lib/types';


export function useUnreadMessages() {
    const { user } = useAuth();
    const firestore = useFirestore();

    const receivedMessagesQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        return query(collection(firestore, 'messages'), where('recipientIds', 'array-contains', user.id));
    }, [firestore, user?.id]);
    
    const { data: receivedMessages, isLoading } = useCollection<Message>(receivedMessagesQuery);

    const unreadCount = useMemo(() => {
        if (!user || !receivedMessages) return 0;
        return receivedMessages.filter(msg => !msg.readBy.includes(user.id)).length;
    }, [user, receivedMessages]);

    return { unreadCount, isLoading };
}

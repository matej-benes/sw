
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import type { Message } from '@/lib/types';


export function useUnreadMessages() {
    const { user } = useAuth();
    const firestore = useFirestore();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !user?.id) {
            setIsLoading(false);
            setUnreadCount(0);
            return;
        }
        
        setIsLoading(true);
        const studentIds = user.studentIds || (user.studentId ? [user.studentId] : []);
        const searchIds = [user.id, ...studentIds];

        const q = query(collection(firestore, 'messages'), where('recipientIds', 'array-contains-any', searchIds));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => doc.data() as Message);
            const count = messages.filter(msg => !msg.readBy.includes(user.id!)).length;
            setUnreadCount(count);
            setIsLoading(false);
        }, (error) => {
            // Firestore permission errors or other errors will be caught here.
            console.error("Error fetching unread messages count:", error);
            setIsLoading(false);
            setUnreadCount(0); 
        });

        return () => unsubscribe();

    }, [firestore, user?.id, user?.studentIds, user?.studentId]);

    return { unreadCount, isLoading };
}

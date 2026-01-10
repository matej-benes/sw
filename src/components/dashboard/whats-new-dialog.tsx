'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, ClipboardCheck, ArrowRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '../ui/separator';

const SESSION_STORAGE_KEY = 'whatsNewDialogShown';

interface WhatsNewDialogProps {
  unreadMessagesCount: number;
  pendingExcusesCount: number;
  isClassTeacher: boolean;
}

export function WhatsNewDialog({ 
    unreadMessagesCount, 
    pendingExcusesCount,
    isClassTeacher
}: WhatsNewDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const isMobile = useIsMobile();

  const hasUnreadMessages = unreadMessagesCount > 0;
  const hasPendingExcuses = isClassTeacher && pendingExcusesCount > 0;
  const shouldShow = hasUnreadMessages || hasPendingExcuses;

  useEffect(() => {
    const hasBeenShown = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (shouldShow && !hasBeenShown && !isMobile) {
      setIsOpen(true);
      sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
    }
  }, [shouldShow, isMobile]);

  const handleGoToMessages = () => {
    router.push('/dashboard/zpravy');
    setIsOpen(false);
  };
  
  const handleGoToExcuses = () => {
    router.push('/dashboard/omluvenky');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">Vítejte zpět!</DialogTitle>
          <DialogDescription>
            Zde je rychlý přehled toho, co je nového od vaší poslední návštěvy.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {hasUnreadMessages && (
            <div 
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={handleGoToMessages}
            >
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                        <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <p className="font-semibold">Nepřečtené zprávy</p>
                        <p className="text-sm text-muted-foreground">Máte {unreadMessagesCount} {unreadMessagesCount === 1 ? 'novou zprávu' : (unreadMessagesCount > 1 && unreadMessagesCount < 5 ? 'nové zprávy' : 'nových zpráv')}.</p>
                    </div>
                </div>
                 <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          {hasUnreadMessages && hasPendingExcuses && <Separator />}

          {hasPendingExcuses && (
             <div 
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={handleGoToExcuses}
            >
                <div className="flex items-center gap-4">
                    <div className="bg-accent/10 p-3 rounded-full">
                        <ClipboardCheck className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                        <p className="font-semibold">Nevyřízené omluvenky</p>
                        <p className="text-sm text-muted-foreground">Čeká na vás {pendingExcusesCount} {pendingExcusesCount === 1 ? 'nová žádost' : (pendingExcusesCount > 1 && pendingExcusesCount < 5 ? 'nové žádosti' : 'nových žádostí')}.</p>
                    </div>
                </div>
                 <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => setIsOpen(false)}>Zavřít</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useUnreadMessages } from './use-unread-messages';

const ORIGINAL_TITLE = 'Škola Online';

export function usePageTitleUpdater() {
    const { unreadCount } = useUnreadMessages();
    const [originalTitle, setOriginalTitle] = useState(ORIGINAL_TITLE);

    useEffect(() => {
        // Store the original title when the component mounts
        if (document.title !== originalTitle) {
            setOriginalTitle(document.title.includes('Škola Online') ? ORIGINAL_TITLE : document.title);
        }
    }, []);

    useEffect(() => {
        if (unreadCount > 0) {
            document.title = `(${unreadCount}) ${originalTitle}`;
        } else {
            document.title = originalTitle;
        }

        // Cleanup function to restore the original title when the component unmounts
        // or before the effect runs again for a different title.
        return () => {
            document.title = originalTitle;
        };
    }, [unreadCount, originalTitle]);

    return null; // This hook does not render anything
}

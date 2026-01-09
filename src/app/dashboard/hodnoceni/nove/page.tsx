'use client';
import { Suspense } from 'react';
import NewGradingContent from './content';

export default function NewGradingPage() {
    return (
        <Suspense fallback={<div>Načítání...</div>}>
            <NewGradingContent />
        </Suspense>
    );
}

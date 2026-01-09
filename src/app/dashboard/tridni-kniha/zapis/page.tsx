'use client';
import { Suspense } from 'react';
import TridniKnihaZapisContent from './content';

export default function TridniKnihaZapisPage() {
    return (
        <Suspense fallback={<div>Načítání...</div>}>
            <TridniKnihaZapisContent />
        </Suspense>
    );
}

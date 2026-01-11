'use client';
import { useState, useEffect } from 'react';

const MOBILE_USER_AGENT_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    // This effect runs only on the client side
    const userAgent = navigator.userAgent;
    setIsMobile(MOBILE_USER_AGENT_REGEX.test(userAgent));
  }, []);

  return isMobile;
}

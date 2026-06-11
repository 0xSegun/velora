'use client';

import { useEffect, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { authAPI } from '@/lib/api';

export default function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    authAPI
      .getGoogleConfig()
      .then(({ data }) => {
        if (data?.enabled && data?.client_id) setClientId(data.client_id);
      })
      .catch(() => {});
  }, []);

  if (!clientId) return <>{children}</>;

  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>;
}
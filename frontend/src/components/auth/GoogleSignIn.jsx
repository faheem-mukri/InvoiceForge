'use client';

import { useEffect, useRef } from 'react';

// Renders Google's official "Sign in with Google" button via Google Identity
// Services. Calls onCredential(idToken) when the user authenticates.
// Hidden entirely if NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't configured.
export default function GoogleSignIn({ onCredential, text = 'continue_with' }) {
  const ref = useRef(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !ref.current) return undefined;

    let cancelled = false;
    function init() {
      if (cancelled || !window.google?.accounts?.id || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => resp?.credential && onCredential(resp.credential),
      });
      ref.current.innerHTML = '';
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        text,
        width: 320,
      });
    }

    if (window.google?.accounts?.id) {
      init();
      return undefined;
    }

    let script = document.getElementById('gsi-script');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.id = 'gsi-script';
      document.body.appendChild(script);
    }
    script.addEventListener('load', init);
    return () => {
      cancelled = true;
      script.removeEventListener('load', init);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) return null;
  return <div ref={ref} className="flex justify-center" />;
}

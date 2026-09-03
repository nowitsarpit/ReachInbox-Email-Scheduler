'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30s
            retry: (failureCount, error: unknown) => {
              // Don't retry 401/403 errors
              if (error instanceof Error && error.message.includes('401')) return false;
              if (error instanceof Error && error.message.includes('403')) return false;
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1d24',
            color: '#e8eaf0',
            border: '1px solid #2d323d',
            borderRadius: '8px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#052e16' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#2d0808' },
          },
        }}
      />
    </QueryClientProvider>
  );
}

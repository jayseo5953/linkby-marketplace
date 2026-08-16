import { QueryClient } from '@tanstack/react-query';

// §4.1 accepts refresh-driven updates, so nothing polls or refetches in the background.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: false },
  },
});

import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { PreferencesProvider } from "@/shared/hooks/preferences";

import { createQueryClient } from "./query-client";

const queryClient = createQueryClient();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>{children}</PreferencesProvider>
    </QueryClientProvider>
  );
}

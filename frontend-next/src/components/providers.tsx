"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren } from "react";

import { queryClient } from "@/lib/query-client";
import { AppFeedbackProvider, AppThemeProvider } from "@/components/ui";

export function Providers({ children }: PropsWithChildren) {
  return (
    <AppThemeProvider>
      <AppFeedbackProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AppFeedbackProvider>
    </AppThemeProvider>
  );
}

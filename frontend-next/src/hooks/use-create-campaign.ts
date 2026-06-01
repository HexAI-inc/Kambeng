"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post("/campaigns/", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["public-campaigns"] });
    },
  });
}

export default useCreateCampaign;

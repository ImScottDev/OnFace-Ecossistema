"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type PipelineConfig,
  type PipelineStage,
  type Pipeline,
  buildPipelineConfig,
  getAllStatuses,
  getStatusInfo as _getStatusInfo,
  getSlaHours,
} from "@/lib/crm/pipeline";

export function usePipelineConfig() {
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useQuery<PipelineConfig>({
    queryKey: ["pipeline-config"],
    queryFn: async () => {
      const res = await fetch("/api/configuracoes/pipeline");
      if (!res.ok) throw new Error("Failed to load pipeline config");
      return res.json();
    },
    staleTime: 60000,
    gcTime: 5 * 60000,
  });

  const config = buildPipelineConfig(data);

  return {
    config,
    stages: config.stages,
    closedStages: config.closedStages,
    allStatuses: getAllStatuses(config),
    slaHours: getSlaHours(config),
    lossReasons: config.lossReasons,
    setores: config.setores,
    origens: config.origens,
    servicos: config.servicos,
    getStatusInfo: (status: string): PipelineStage => _getStatusInfo(status, config),
    isLoading,
    error,
    mutate: () => queryClient.invalidateQueries({ queryKey: ["pipeline-config"] }),
  };
}

export function usePipelines() {
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useQuery<Pipeline[]>({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const res = await fetch("/api/pipelines");
      if (!res.ok) throw new Error("Failed to load pipelines");
      const json = await res.json();
      return json.pipelines || [];
    },
    staleTime: 60000,
    gcTime: 5 * 60000,
  });

  return {
    pipelines: data || [],
    isLoading,
    error,
    mutate: () => queryClient.invalidateQueries({ queryKey: ["pipelines"] }),
  };
}

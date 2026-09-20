-- Índices que existem em dev e nenhuma migration cria (mesmo achado do 0012a,
-- ensaio de carga de 18/09). Separados num arquivo no fim da cadeia porque
-- parte das tabelas só nasce depois de 0012 — e índice não tem dependência de
-- ordem com nada que venha depois.
--
-- Em dev é no-op. Todos são `IF NOT EXISTS`: onde o ambiente já tem um índice
-- de mesmo nome (`idx_stripe_webhook_events_status`, que em prod é
-- `(status, received_at)`, e `idx_assinatura_itens_stripe_id`, que em prod é
-- parcial), o índice do ambiente é mantido — é superconjunto do de dev.

CREATE INDEX IF NOT EXISTS idx_ai_analysis_entity ON public.ai_analysis USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_org ON public.ai_analysis USING btree (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_atividades_lead_created ON public.atividades USING btree (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log USING btree (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_org ON public.audit_log USING btree (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_automacao_execucoes_automacao ON public.automacao_execucoes USING btree (automacao_id);
CREATE INDEX IF NOT EXISTS idx_automacao_execucoes_executed ON public.automacao_execucoes USING btree (executed_at);
CREATE INDEX IF NOT EXISTS idx_automacao_execucoes_org ON public.automacao_execucoes USING btree (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_cadence_enrollment_events_enrollment ON public.cadence_enrollment_events USING btree (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_cadence_enrollments_entity ON public.cadence_enrollments USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cadence_enrollments_org ON public.cadence_enrollments USING btree (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_cadence_enrollments_scheduled ON public.cadence_enrollments USING btree (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON public.clientes USING btree (empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_org ON public.clientes USING btree (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_comercial_evidencia_negocio ON public.comercial_evidencia USING btree (negocio_id);
CREATE INDEX IF NOT EXISTS idx_comercial_evidencia_org ON public.comercial_evidencia USING btree (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_communications_canal ON public.communications USING btree (canal);
CREATE INDEX IF NOT EXISTS idx_communications_ocorrido ON public.communications USING btree (ocorrido_em);
CREATE INDEX IF NOT EXISTS idx_communications_org ON public.communications USING btree (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_communications_pessoa ON public.communications USING btree (pessoa_id);
CREATE INDEX IF NOT EXISTS idx_event_outbox_aggregate ON public.event_outbox USING btree (aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_event_outbox_org ON public.event_outbox USING btree (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_event_outbox_status ON public.event_outbox USING btree (status);
CREATE INDEX IF NOT EXISTS idx_notas_cliente ON public.notas USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_notas_reuniao ON public.notas USING btree (reuniao_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_empresa ON public.oportunidades USING btree (empresa_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_org ON public.oportunidades USING btree (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_pessoa ON public.oportunidades USING btree (pessoa_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_responsavel ON public.oportunidades USING btree (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_pontos_contato_empresa ON public.pontos_contato USING btree (empresa_id);
CREATE INDEX IF NOT EXISTS idx_pontos_contato_pessoa_first ON public.pontos_contato USING btree (pessoa_id, is_first_touch);
CREATE INDEX IF NOT EXISTS idx_pontos_contato_pessoa_last ON public.pontos_contato USING btree (pessoa_id, is_last_touch);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status ON public.stripe_webhook_events USING btree (status);
CREATE INDEX IF NOT EXISTS idx_teams_org ON public.teams USING btree (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_team ON public.usuarios USING btree (team_id);
CREATE INDEX IF NOT EXISTS idx_won_evidence_policies_org ON public.won_evidence_policies USING btree (organizacao_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assinatura_itens_stripe_id ON public.assinatura_itens USING btree (stripe_subscription_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_labels_dedup ON public.lead_labels USING btree (lead_id, label_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_listas_dedup ON public.lead_listas USING btree (lead_id, lista_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_skill_versions_org_name_number ON public.ai_skill_versions USING btree (organizacao_id, name, version_number);

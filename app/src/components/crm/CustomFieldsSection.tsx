"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Settings2 } from "lucide-react";

interface CustomFieldDef {
  id: string;
  nome: string;
  label: string;
  tipo: string;
  opcoes: string[] | null;
  obrigatorio: boolean;
}

interface CustomFieldsSectionProps {
  entidade: "lead" | "empresa" | "negocio";
  valores: Record<string, unknown> | null | undefined;
  onUpdate: (campos: Record<string, unknown>) => void;
  readOnly?: boolean;
}

export function CustomFieldsSection({ entidade, valores, onUpdate, readOnly }: CustomFieldsSectionProps) {
  const { data: fields } = useQuery<CustomFieldDef[]>({
    queryKey: ["custom-fields", entidade],
    queryFn: async () => {
      const res = await fetch(`/api/custom-fields?entidade=${entidade}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  if (!fields || fields.length === 0) return null;

  const currentValues = valores || {};

  const handleChange = (nome: string, value: unknown) => {
    onUpdate({ ...currentValues, [nome]: value });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-white/50 uppercase tracking-wider">
        <Settings2 className="w-3 h-3" />
        Campos Personalizados
      </div>
      <div className="space-y-2">
        {fields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={currentValues[field.nome]}
            onChange={(v) => handleChange(field.nome, v)}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: CustomFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (readOnly && !value) return null;

  const renderValue = () => {
    switch (field.tipo) {
      case "boolean":
        return (value as boolean) ? "Sim" : "Não";
      case "daterange": {
        const dr = value as { inicio?: string; fim?: string } | null;
        if (!dr?.inicio) return "—";
        return `${dr.inicio}${dr.fim ? ` → ${dr.fim}` : ""}`;
      }
      case "enum":
        return (value as string) || "—";
      default:
        return String(value ?? "—");
    }
  };

  if (readOnly) {
    return (
      <div className="flex justify-between items-center text-sm">
        <span className="text-white/50">{field.label}</span>
        <span className="text-white">{renderValue()}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-xs text-white/50">{field.label}</label>
      {field.tipo === "text" || field.tipo === "url" ? (
        <input
          type={field.tipo === "url" ? "url" : "text"}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="dark-input w-full text-sm"
          placeholder={field.label}
        />
      ) : field.tipo === "number" ? (
        <input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
          className="dark-input w-full text-sm"
          placeholder={field.label}
        />
      ) : field.tipo === "date" ? (
        <input
          type="date"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="dark-input w-full text-sm"
        />
      ) : field.tipo === "daterange" ? (
        <DateRangeField
          value={value as { inicio?: string; fim?: string } | null}
          onChange={onChange}
        />
      ) : field.tipo === "enum" ? (
        <select
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="dark-input w-full text-sm"
        >
          <option value="">Selecionar...</option>
          {(field.opcoes || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : field.tipo === "boolean" ? (
        <button
          type="button"
          onClick={() => onChange(!(value as boolean))}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            value ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.06] text-white/50"
          }`}
        >
          {value ? "Sim" : "Não"}
        </button>
      ) : null}
    </div>
  );
}

function DateRangeField({
  value,
  onChange,
}: {
  value: { inicio?: string; fim?: string } | null;
  onChange: (v: unknown) => void;
}) {
  const dr = value || { inicio: "", fim: "" };
  return (
    <div className="flex gap-2">
      <input
        type="date"
        value={dr.inicio || ""}
        onChange={(e) => onChange({ ...dr, inicio: e.target.value || undefined })}
        className="dark-input flex-1 text-sm"
        placeholder="Início"
      />
      <span className="text-white/30 self-center text-xs">→</span>
      <input
        type="date"
        value={dr.fim || ""}
        onChange={(e) => onChange({ ...dr, fim: e.target.value || undefined })}
        className="dark-input flex-1 text-sm"
        placeholder="Fim"
      />
    </div>
  );
}

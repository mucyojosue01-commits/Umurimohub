import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/features/ui/kit";

export type SearchSelectOption = {
  value: string;
  label: string;
  description?: string;
  avatarUrl?: string | null;
  initials?: string;
};

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Search and choose…",
  emptyText = "No matching options",
  disabled = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selected?.label ?? "");
  }, [selected?.label, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 20);
    return options
      .filter((option) => [option.label, option.description ?? ""].join(" ").toLowerCase().includes(q))
      .slice(0, 20);
  }, [options, query]);

  const choose = (option: SearchSelectOption) => {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        {selected?.avatarUrl || selected?.initials ? (
          <div className="absolute left-2 top-1/2 z-10 -translate-y-1/2">
            <Avatar initials={selected.initials ?? selected.label.slice(0, 2).toUpperCase()} src={selected.avatarUrl} alt={selected.label} size="sm" />
          </div>
        ) : null}
        <input
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (value) onChange("");
          }}
          className={cn(
            "h-11 w-full rounded-xl border bg-card px-3 pr-20 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10",
            selected && "pl-12",
          )}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear selection"
            className="absolute right-9 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(true);
            }}
          >
            <X className="size-4" />
          </button>
        )}
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-72 overflow-auto rounded-2xl border bg-popover p-1 shadow-xl">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {query.trim() ? "Matching options" : "Available options"}
          </div>
          {filtered.length ? (
            filtered.map((option) => (
              <button
                type="button"
                key={option.value}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                {option.avatarUrl || option.initials ? (
                  <Avatar initials={option.initials ?? option.label.slice(0, 2).toUpperCase()} src={option.avatarUrl} alt={option.label} size="sm" />
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
                    {option.label.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{option.label}</span>
                  {option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}
                </span>
                {value === option.value && <Check className="size-4 text-primary" />}
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
          )}
        </div>
      )}
    </div>
  );
}

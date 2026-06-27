import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const CURRENCIES = [
  { code: "USD", label: "US Dollar", symbol: "US$", locale: "en-US" },
  { code: "COP", label: "Colombian Peso", symbol: "CO$", locale: "es-CO" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

type Ctx = {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  symbol: string;
  /** Converts an amount stored in COP (the base currency) to the active currency and formats it. */
  format: (n: number, opts?: { decimals?: number }) => string;
};

const CurrencyContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "celeris.currency";
const RATE_KEY = "celeris.copPerUsd";
const FALLBACK_COP_PER_USD = 4000;

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");
  const [copPerUsd, setCopPerUsd] = useState<number>(FALLBACK_COP_PER_USD);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
      if (saved && CURRENCIES.some((c) => c.code === saved)) setCurrencyState(saved);
      const cached = localStorage.getItem(RATE_KEY);
      if (cached) {
        const { rate, ts } = JSON.parse(cached);
        if (rate > 0) setCopPerUsd(rate);
        if (Date.now() - ts < 24 * 60 * 60 * 1000) return; // fresh enough, skip refetch
      }
    } catch {}

    // Free, no-key FX API. On any failure we keep the cached/fallback rate.
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((r) => r.json())
      .then((d) => {
        const rate = d?.rates?.COP;
        if (typeof rate === "number" && rate > 0) {
          setCopPerUsd(rate);
          try { localStorage.setItem(RATE_KEY, JSON.stringify({ rate, ts: Date.now() })); } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const setCurrency = (c: CurrencyCode) => {
    setCurrencyState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch {}
  };

  const value = useMemo<Ctx>(() => {
    const def = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];
    const fmt = (n: number, opts?: { decimals?: number }) => {
      const base = Number.isFinite(n) ? n : 0;
      // Stored amounts are COP; convert to USD when that's the active currency.
      const amount = def.code === "USD" ? base / copPerUsd : base;
      const decimals = opts?.decimals ?? (def.code === "USD" ? 2 : 0);
      return new Intl.NumberFormat(def.locale, {
        style: "currency",
        currency: def.code,
        maximumFractionDigits: decimals,
        minimumFractionDigits: 0,
      }).format(amount);
    };
    return { currency, setCurrency, symbol: def.symbol, format: fmt };
  }, [currency, copPerUsd]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}

export function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency();
  return (
    <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
      <SelectTrigger className="h-8 w-[140px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code} className="text-xs">
            {c.symbol} {c.code} · {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

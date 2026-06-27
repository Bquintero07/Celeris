import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { useMyRoles } from "@/lib/use-my-roles";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

export function Chat() {
  const { isAdmin, isSuperAdmin } = useMyRoles();
  const { currency } = useCurrency();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No tenés permiso para acceder a esta función.
      </div>
    );
  }

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const { message } = await api.ai.chat(next, currency);
      setMessages([...next, { role: "assistant", content: message }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: `Error: ${e.message ?? "Algo salió mal"}` }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Bot className="h-10 w-10 opacity-30" />
            <p className="text-sm">Preguntá lo que quieras sobre tus eventos, clientes o finanzas.</p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                "¿Cuántos eventos tenemos aprobados?",
                "Resumen financiero del año",
                "¿Qué clientes tenemos?",
              ].map((hint) => (
                <button
                  key={hint}
                  onClick={() => setInput(hint)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3 max-w-3xl", m.role === "user" ? "ml-auto flex-row-reverse" : "")}>
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
            )}>
              {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={cn(
              "rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed max-w-[75vw]",
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-muted rounded-tl-sm",
            )}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 max-w-3xl">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/40 bg-background/60 backdrop-blur-md px-4 py-3">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Preguntá sobre tus eventos, clientes o finanzas… (Enter para enviar)"
            rows={1}
            className="resize-none min-h-[2.5rem] max-h-40"
            disabled={loading}
          />
          <Button onClick={send} disabled={loading || !input.trim()} size="icon" className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-center text-[0.65rem] text-muted-foreground mt-1.5">
          Shift+Enter para nueva línea · Enter para enviar
        </p>
      </div>
    </div>
  );
}

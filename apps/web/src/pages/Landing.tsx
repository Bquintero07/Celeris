import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles, Calendar, Package, Users, Receipt, Zap, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CelerisLogo } from "@/components/celeris-logo";

export function Landing() {
  return (
    <div className="min-h-screen bg-vignette text-foreground">
      {/* Top nav */}
      <header className="fixed top-0 inset-x-0 z-30 backdrop-blur-md bg-background/40 border-b border-border/40">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <CelerisLogo size={32} />
            <span className="font-display text-sm font-semibold tracking-[0.3em] uppercase">Celeris</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs tracking-[0.25em] uppercase text-muted-foreground">
            <a href="#capabilities" className="hover:text-foreground transition">Capabilities</a>
            <a href="#flow" className="hover:text-foreground transition">Flow</a>
            <a href="#metrics" className="hover:text-foreground transition">Metrics</a>
          </nav>
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="text-xs tracking-[0.2em] uppercase">
              Sign in <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="absolute w-[140vmin] h-[140vmin] rounded-full bg-conic opacity-50 blur-3xl animate-spin-slow" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-aurora animate-aurora" />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_30%,transparent_80%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,oklch(0.11_0.012_255)_90%)]" />

        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto animate-rise">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 backdrop-blur-md px-3.5 py-1.5 mb-8">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success pulse-dot" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            <span className="text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground">
              Live platform · v1.0
            </span>
          </div>

          <h1 className="font-display font-semibold text-5xl md:text-7xl lg:text-[5.25rem] leading-[0.98] tracking-[-0.04em]">
            <span className="text-gradient block">The operating system</span>
            <span className="block mt-2">
              for <span className="text-ember italic font-normal">event logistics</span>
            </span>
          </h1>
          <p className="mt-8 max-w-xl mx-auto text-[15px] leading-relaxed text-muted-foreground">
            Celeris replaces scattered spreadsheets with a single workspace: AI-powered planning,
            personnel, inventory, suppliers and budget — auditable, real-time and white-labeled.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="glow-primary rounded-md px-6 text-sm font-medium">
                Get started free <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="rounded-md px-6 text-sm font-medium border-border/60 bg-card/30 backdrop-blur">
                View demo
              </Button>
            </Link>
          </div>

          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground/70">
            <span>SOC-ready</span><span className="opacity-40">·</span>
            <span>Multi-role</span><span className="opacity-40">·</span>
            <span>COP · USD</span><span className="opacity-40">·</span>
            <span>Export PDF / Excel</span>
          </div>
        </div>

        <div className="absolute bottom-8 inset-x-0 flex justify-between items-end px-8 text-[0.6rem] tracking-[0.35em] uppercase text-muted-foreground/60">
          <span className="hidden md:block">— Built for ops teams</span>
          <span className="text-center mx-auto md:mx-0">Scroll ↓</span>
          <span className="hidden md:block">Celeris · 2026 —</span>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="relative py-32 px-6 border-t border-border/30">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-20">
            <div>
              <div className="text-[0.65rem] tracking-[0.4em] uppercase text-primary mb-4">01 — Capabilities</div>
              <h2 className="font-display text-4xl md:text-5xl font-medium max-w-2xl leading-[1.05]">
                A control room for every <span className="italic text-ember">production</span>.
              </h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              Replace scattered spreadsheets with a single flow: planning,
              resources, costs and deliverables — auditable and exportable.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-border/40 rounded-xl overflow-hidden">
            {[
              { icon: Sparkles, n: "01", title: "AI Agent", desc: "Generate a complete event from a prompt: personnel, equipment, catering, timeline and budget." },
              { icon: Calendar, n: "02", title: "Curated Templates", desc: "Concerts, talks, expos and private events — with built-in operational best practices." },
              { icon: Package, n: "03", title: "Inventory & Suppliers", desc: "Connected catalog of equipment and partners. Assign resources in seconds." },
              { icon: Receipt, n: "04", title: "Live Budget", desc: "Line-item costs, margins and profitability in real time. PDF and Excel ready for clients." },
            ].map((f, i) => (
              <div key={i} className="group bg-card/60 backdrop-blur p-10 hover:bg-card transition-colors">
                <div className="flex items-start justify-between mb-8">
                  <span className="text-[0.65rem] tracking-[0.3em] text-muted-foreground">{f.n}</span>
                  <f.icon className="h-5 w-5 text-primary opacity-70 group-hover:opacity-100 transition" />
                </div>
                <h3 className="font-display text-2xl font-medium mb-3">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Flow */}
      <section id="flow" className="relative py-32 px-6 border-t border-border/30 bg-gradient-to-b from-transparent via-card/20 to-transparent">
        <div className="container mx-auto max-w-6xl">
          <div className="text-[0.65rem] tracking-[0.4em] uppercase text-primary mb-4">02 — Flow</div>
          <h2 className="font-display text-4xl md:text-5xl font-medium max-w-3xl leading-[1.05] mb-20">
            From brief to deliverable event in <span className="italic text-ember">minutes</span>.
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "Describe", body: "Tell the agent the type, date, city, audience and target budget." },
              { step: "Generate", body: "The AI proposes a full plan with personnel, equipment, COP/USD costs and suppliers." },
              { step: "Execute", body: "Adjust, assign and export. Measure profitability as the event runs." },
            ].map((s, i) => (
              <div key={i} className="relative">
                <div className="text-[5rem] font-display font-light text-primary/30 leading-none">0{i + 1}</div>
                <div className="hairline-t mt-4 pt-6">
                  <h3 className="font-display text-xl font-medium mb-2">{s.step}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics strip */}
      <section id="metrics" className="relative py-24 px-6 border-t border-border/30">
        <div className="container mx-auto max-w-6xl grid md:grid-cols-4 gap-12">
          {[
            { icon: Zap, k: "10×", l: "faster planning" },
            { icon: BarChart3, k: "100%", l: "cost traceability" },
            { icon: Users, k: "Multi-role", l: "teams and suppliers" },
            { icon: Receipt, k: "COP · USD", l: "native multicurrency" },
          ].map((m, i) => (
            <div key={i} className="text-center">
              <m.icon className="h-5 w-5 text-primary mx-auto mb-4 opacity-80" />
              <div className="font-display text-3xl md:text-4xl font-medium text-gradient">{m.k}</div>
              <div className="mt-2 text-[0.7rem] tracking-[0.25em] uppercase text-muted-foreground">{m.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-32 px-6 border-t border-border/30 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-60" />
        <div className="relative z-10 container mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl md:text-6xl font-medium leading-[1.05]">
            <span className="text-gradient">Start your next event</span>
            <br />
            <span className="italic text-ember font-normal">tonight.</span>
          </h2>
          <p className="mt-8 text-sm text-muted-foreground max-w-md mx-auto">
            No card. No install. Instant access to Celeris.
          </p>
          <div className="mt-10 flex justify-center">
            <Link to="/auth">
              <Button size="lg" className="glow-primary rounded-full px-10 text-xs tracking-[0.2em] uppercase">
                Create my first event <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/30 py-10 px-6">
        <div className="container mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 text-[0.7rem] tracking-[0.25em] uppercase text-muted-foreground">
          <div className="flex items-center gap-2">
            <CelerisLogo size={18} />
            Celeris © 2026
          </div>
          <div>Event Logistics · AI Platform</div>
        </div>
      </footer>
    </div>
  );
}

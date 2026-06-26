import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { auth } from "./middleware/auth.js";
import { tenantRouter } from "./routes/tenant.routes.js";
import { eventsRouter } from "./routes/events.routes.js";
import { onboardingRouter } from "./routes/onboarding.routes.js";
import { rolesRouter } from "./routes/roles.routes.js";
import { orgRouter } from "./routes/org.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { equipmentRouter } from "./routes/equipment.routes.js";
import { suppliersRouter } from "./routes/suppliers.routes.js";
import { personnelRouter } from "./routes/personnel.routes.js";
import { teamRouter } from "./routes/team.routes.js";
import { superRouter } from "./routes/super.routes.js";
import { aiRouter } from "./routes/ai.routes.js";
import { quotesRouter }       from "./routes/quotes.routes.js";
import { clientsRouter }      from "./routes/clients.routes.js";
import { availabilityRouter } from "./routes/availability.routes.js";
import { analyticsRouter }    from "./routes/analytics.routes.js";
import { billingRouter }      from "./routes/billing.routes.js";
import { templatesRouter }    from "./routes/templates.routes.js";

const app = express();
// ponytail: strip trailing slash — browsers never send it in Origin, so a slash in CORS_ORIGIN would never match
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((o) => o.trim().replace(/\/+$/, ""));
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limit for invite-code guessing (onboarding/join) and super-admin actions.
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// All /api routes require a valid Supabase JWT.
app.use("/api", apiLimiter, auth);
app.use("/api/tenant",     tenantRouter);
app.use("/api/onboarding", sensitiveLimiter, onboardingRouter);
app.use("/api/roles",      rolesRouter);
app.use("/api/org",        orgRouter);
app.use("/api/dashboard",  dashboardRouter);
app.use("/api/equipment",  equipmentRouter);
app.use("/api/suppliers",  suppliersRouter);
app.use("/api/personnel",  personnelRouter);
app.use("/api/team",       teamRouter);
app.use("/api/events",     eventsRouter);
app.use("/api/quotes",       quotesRouter);
app.use("/api/clients",      clientsRouter);
app.use("/api/availability", availabilityRouter);
app.use("/api/analytics",    analyticsRouter);
app.use("/api/billing",      billingRouter);
app.use("/api/templates",    templatesRouter);
app.use("/api/super",        sensitiveLimiter, superRouter);
app.use("/api/ai",           aiRouter);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`API listening on :${port}`));

import { z, type ZodSchema } from "zod";
import type { Request, Response, NextFunction } from "express";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Datos inválidos",
        issues: result.error.issues.map((i) => ({
          field: i.path.join(".") || "body",
          message: i.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateUuidParams(...params: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const param of params) {
      if (!z.string().uuid().safeParse(req.params[param]).success) {
        return res.status(400).json({ error: `Invalid ${param}: must be a valid UUID` });
      }
    }
    next();
  };
}

// Shared enum schemas matching the DB types exactly
export const EventType = z.enum([
  "concierto", "charla", "exposicion", "privado",
  "publico", "corporativo", "boda", "otro",
]);
export const EventStatus = z.enum([
  "borrador", "planificacion", "confirmado", "en_curso", "finalizado", "cancelado",
]);
export const ItemCategory = z.enum([
  "personal", "catering", "equipo", "mobiliario", "audio_video",
  "iluminacion", "transporte", "seguridad", "permisos", "marketing", "extras",
]);
export const SupplierType = z.enum(["interno", "externo"]);
export const AppRole = z.enum([
  "admin", "comercial", "personal", "logistica", "viewer", "contable", "super_admin",
]);
export const OrgStatus = z.enum(["active", "inactive", "suspended"]);

/**
 * RBAC — can() function and PERMISSIONS table
 * Tests: role permissions, wildcard admin, super_admin bypass, multi-role aggregation
 */
import { describe, it, expect } from "vitest";
import { can, PERMISSIONS, type Role } from "@celeris/shared";

describe("can() — role permission lookup", () => {
  describe("admin wildcard", () => {
    it("admin can do anything", () => {
      expect(can(["admin"], "events.create")).toBe(true);
      expect(can(["admin"], "quotes.view_margin")).toBe(true);
      expect(can(["admin"], "analytics.view")).toBe(true);
      expect(can(["admin"], "inventory.edit")).toBe(true);
      expect(can(["admin"], "some.made.up.perm")).toBe(true);
    });
  });

  describe("comercial", () => {
    it("can view and edit events + quotes", () => {
      expect(can(["comercial"], "events.view_all")).toBe(true);
      expect(can(["comercial"], "events.create")).toBe(true);
      expect(can(["comercial"], "events.edit")).toBe(true);
      expect(can(["comercial"], "quotes.view")).toBe(true);
      expect(can(["comercial"], "quotes.view_margin")).toBe(true);
      expect(can(["comercial"], "quotes.export")).toBe(true);
    });
    it("can manage clients and view inventory", () => {
      expect(can(["comercial"], "clients.manage")).toBe(true);
      expect(can(["comercial"], "inventory.view")).toBe(true);
      expect(can(["comercial"], "analytics.view")).toBe(true);
    });
    it("cannot see crew_own restricted items or approve quotes", () => {
      expect(can(["comercial"], "crew.view_own")).toBe(false);
      expect(can(["comercial"], "events.approve")).toBe(false);
    });
  });

  describe("contable", () => {
    it("can view events, margins, and analytics", () => {
      expect(can(["contable"], "events.view_all")).toBe(true);
      expect(can(["contable"], "quotes.view")).toBe(true);
      expect(can(["contable"], "quotes.view_margin")).toBe(true);
      expect(can(["contable"], "quotes.export")).toBe(true);
      expect(can(["contable"], "analytics.view")).toBe(true);
      expect(can(["contable"], "clients.view")).toBe(true);
    });
    it("cannot edit events or create items", () => {
      expect(can(["contable"], "events.create")).toBe(false);
      expect(can(["contable"], "events.edit")).toBe(false);
      expect(can(["contable"], "inventory.edit")).toBe(false);
    });
  });

  describe("logistica", () => {
    it("can view assigned events, inventory, and export own", () => {
      expect(can(["logistica"], "events.view_assigned")).toBe(true);
      expect(can(["logistica"], "inventory.view")).toBe(true);
      expect(can(["logistica"], "quotes.view")).toBe(true);
      expect(can(["logistica"], "clients.view")).toBe(true);
    });
    it("cannot see margin or create events", () => {
      expect(can(["logistica"], "quotes.view_margin")).toBe(false);
      expect(can(["logistica"], "events.create")).toBe(false);
      expect(can(["logistica"], "events.view_all")).toBe(false);
    });
  });

  describe("personal", () => {
    it("can only see assigned events and own crew info", () => {
      expect(can(["personal"], "events.view_assigned")).toBe(true);
      expect(can(["personal"], "crew.view_own")).toBe(true);
    });
    it("cannot see quotes, inventory, or analytics", () => {
      expect(can(["personal"], "quotes.view")).toBe(false);
      expect(can(["personal"], "inventory.view")).toBe(false);
      expect(can(["personal"], "analytics.view")).toBe(false);
      expect(can(["personal"], "clients.view")).toBe(false);
    });
  });

  describe("viewer", () => {
    it("can view events and basic data", () => {
      expect(can(["viewer"], "events.view_all")).toBe(true);
      expect(can(["viewer"], "events.view")).toBe(true);
      expect(can(["viewer"], "quotes.view")).toBe(true);
      expect(can(["viewer"], "inventory.view")).toBe(true);
      expect(can(["viewer"], "analytics.view")).toBe(true);
      expect(can(["viewer"], "clients.view")).toBe(true);
    });
    it("cannot edit or see margins", () => {
      expect(can(["viewer"], "events.edit")).toBe(false);
      expect(can(["viewer"], "quotes.view_margin")).toBe(false);
      expect(can(["viewer"], "events.create")).toBe(false);
    });
  });

  describe("multi-role aggregation", () => {
    it("union of permissions: logistica + viewer = both sets", () => {
      expect(can(["logistica", "viewer"], "events.view_all")).toBe(true); // viewer has it
      expect(can(["logistica", "viewer"], "inventory.view")).toBe(true);  // both have it
      expect(can(["logistica", "viewer"], "events.create")).toBe(false);  // neither has it
    });

    it("any admin in the list grants wildcard", () => {
      expect(can(["personal", "admin"], "events.create")).toBe(true);
    });
  });

  describe("empty roles", () => {
    it("no roles = no permissions", () => {
      expect(can([], "events.view_all")).toBe(false);
      expect(can([], "quotes.view")).toBe(false);
    });
  });

  describe("PERMISSIONS completeness", () => {
    const roles: Role[] = ["admin", "comercial", "contable", "logistica", "personal", "viewer"];
    it("every role is defined in PERMISSIONS", () => {
      for (const role of roles) {
        expect(PERMISSIONS[role]).toBeDefined();
        expect(Array.isArray(PERMISSIONS[role])).toBe(true);
      }
    });
  });
});

import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ObjectStore, sha256Hex } from "@ndpa/storage";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { clientIp } from "../auth/http.js";
import { type AuthContext, CurrentAuth, SessionGuard } from "../auth/session.guard.js";
import { ProblemException } from "../common/problem.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { DbService } from "../db/db.service.js";
import { organisations } from "../db/schema.js";
import { type Branding, BrandingBody, checkLogo, LicenceBody } from "./branding.js";
import { CurrentOrg, OrgGuard, type OrgContext, OrgRole } from "./org.guard.js";

const EMPTY: Branding = { firmName: "", primaryColour: "#047857", contactBlock: "", showLicenceOnCover: true, logo: null };

/** ORG-02 licence submission and BRAND-01 white-label branding. */
@ApiTags("orgs")
@Controller("orgs/:orgId")
@UseGuards(SessionGuard, OrgGuard)
export class BrandingController {
  constructor(
    private readonly db: DbService,
    private readonly store: ObjectStore,
    private readonly audit: AuditService,
  ) {}

  /** ORG-02: submit the DPCO licence number; status becomes pending until a Platform Admin verifies it. */
  @Post("licence")
  @OrgRole("owner")
  @HttpCode(200)
  async submitLicence(@Body(new ZodPipe(LicenceBody)) body: z.infer<typeof LicenceBody>, @CurrentAuth() a: AuthContext, @CurrentOrg() o: OrgContext, @Req() req: Request) {
    return this.db.withOrg(o.id, async (tx) => {
      const [org] = await tx.select({ status: organisations.licenceStatus, no: organisations.dpcoLicenceNo }).from(organisations).where(eq(organisations.id, o.id));
      if (org?.status === "verified" && org.no === body.licenceNumber) return { licenceNumber: org.no, licenceStatus: org.status };
      if (org?.status === "verified") {
        throw new ProblemException(409, "conflict", "Your licence is already verified", "Contact support to change a verified licence number.");
      }
      await tx
        .update(organisations)
        .set({ dpcoLicenceNo: body.licenceNumber, licenceStatus: "pending", licenceNote: null, verifiedAt: null, verifiedBy: null })
        .where(eq(organisations.id, o.id));
      await this.audit.recordInOrg(tx, o.id, {
        action: "licence.submitted",
        actorUserId: a.user.id,
        ip: clientIp(req),
        metadata: { licenceNumber: body.licenceNumber },
      });
      return { licenceNumber: body.licenceNumber, licenceStatus: "pending" as const };
    });
  }

  /** Branding with a short-lived logo URL. */
  @Get("branding")
  async get(@CurrentOrg() o: OrgContext) {
    const branding = await this.read(o.id);
    const logoUrl = branding.logo ? await this.store.presignGet(branding.logo.key, { contentType: branding.logo.contentType }) : null;
    return { ...branding, logoUrl };
  }

  /** BRAND-01: firm name, colour, contact block. The logo has its own upload. */
  @Put("branding")
  @OrgRole("admin")
  async update(@Body(new ZodPipe(BrandingBody)) body: z.infer<typeof BrandingBody>, @CurrentAuth() a: AuthContext, @CurrentOrg() o: OrgContext, @Req() req: Request) {
    await this.db.withOrg(o.id, async (tx) => {
      const [org] = await tx.select({ branding: organisations.branding }).from(organisations).where(eq(organisations.id, o.id));
      const current = { ...EMPTY, ...(org?.branding as Partial<Branding>) };
      await tx.update(organisations).set({ branding: { ...current, ...body } }).where(eq(organisations.id, o.id));
      await this.audit.recordInOrg(tx, o.id, { action: "branding.updated", actorUserId: a.user.id, ip: clientIp(req), metadata: { fields: Object.keys(body) } });
    });
    return this.get(o);
  }

  /** BRAND-01: PNG or SVG, at most 1 MB, sent as the raw request body. */
  @Put("branding/logo")
  @OrgRole("admin")
  async uploadLogo(@CurrentAuth() a: AuthContext, @CurrentOrg() o: OrgContext, @Req() req: Request) {
    const contentType = (req.header("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const problem = checkLogo(bytes, contentType);
    if (problem) throw new ProblemException(400, "validation_failed", "That logo can't be used", problem, [{ path: "logo", message: problem }]);
    const ext = contentType === "image/png" ? "png" : "svg";
    const put = await this.store.put(`orgs/${o.id}/branding/logo-${sha256Hex(bytes)}.${ext}`, bytes, contentType);
    await this.db.withOrg(o.id, async (tx) => {
      const [org] = await tx.select({ branding: organisations.branding }).from(organisations).where(eq(organisations.id, o.id));
      const current = { ...EMPTY, ...(org?.branding as Partial<Branding>) };
      const logo: Branding["logo"] = { key: put.key, contentType: contentType as "image/png" | "image/svg+xml", sha256: put.sha256, bytes: put.bytes };
      await tx.update(organisations).set({ branding: { ...current, logo } }).where(eq(organisations.id, o.id));
      await this.audit.recordInOrg(tx, o.id, { action: "branding.logo_uploaded", actorUserId: a.user.id, ip: clientIp(req), metadata: { sha256: put.sha256, bytes: put.bytes, contentType } });
    });
    return this.get(o);
  }

  private async read(orgId: string): Promise<Branding> {
    const [org] = await this.db.withOrg(orgId, (tx) => tx.select({ branding: organisations.branding }).from(organisations).where(eq(organisations.id, orgId)));
    return { ...EMPTY, ...(org?.branding as Partial<Branding>) };
  }
}

import { Inject, Injectable, Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import { APP_CONFIG, type AppConfig } from "../config/config.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Outbound email. SMTP: Mailpit in dev, Resend's SMTP endpoint in production. */
export abstract class Mailer {
  abstract send(msg: MailMessage): Promise<void>;
}

export const MAILER = Mailer;

@Injectable()
export class SmtpMailer extends Mailer {
  private readonly transport: Transporter;
  private readonly logger = new Logger(SmtpMailer.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
    this.transport = nodemailer.createTransport(config.SMTP_URL);
  }

  async send(msg: MailMessage): Promise<void> {
    try {
      await this.transport.sendMail({ from: this.config.EMAIL_FROM, ...msg });
    } catch (err) {
      // Never let an email failure leak through an auth response (timing or errors).
      this.logger.error(`Email to ${msg.to.replace(/^(.).*@/, "$1***@")} failed: ${(err as Error).message}`);
    }
  }
}

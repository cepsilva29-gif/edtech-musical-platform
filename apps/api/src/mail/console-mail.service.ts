import { Injectable, Logger } from '@nestjs/common';
import { MailMessage, MailService } from './mail.service';

/**
 * Implementacao de desenvolvimento: registra o e-mail no log em vez de envia-lo de verdade.
 * Nenhum provedor SMTP/SES/Resend esta configurado ainda (env SMTP_* vazias) - trocar esta
 * implementacao por uma real e a unica mudanca necessaria (ver MailModule).
 */
@Injectable()
export class ConsoleMailService extends MailService {
  private readonly logger = new Logger(ConsoleMailService.name);

  async send(message: MailMessage): Promise<void> {
    this.logger.log(`[DEV MAIL] para=${message.to} assunto="${message.subject}"\n${message.text}`);
    await Promise.resolve();
  }
}

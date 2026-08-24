export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Abstracao de envio de e-mail, no mesmo espirito de PaymentGateway/StorageProvider/VideoProvider
 * (docs/ARCHITECTURE.md, decisao 3): nenhum modulo de dominio deve depender de um provedor
 * concreto (SMTP, SES, Resend...) diretamente.
 */
export abstract class MailService {
  abstract send(message: MailMessage): Promise<void>;
}

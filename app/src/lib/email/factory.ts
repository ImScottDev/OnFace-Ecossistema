import { EmailClient, EmailContaConfig } from "./types";
import { GoogleEmailClient } from "./google";
import { MicrosoftEmailClient } from "./microsoft";
import { ImapEmailClient } from "./imap";

export function createEmailClient(config: EmailContaConfig): EmailClient {
  switch (config.tipo) {
    case "google":
      return new GoogleEmailClient(config);
    case "microsoft":
      return new MicrosoftEmailClient(config);
    case "imap":
      return new ImapEmailClient(config);
    default:
      throw new Error(`Unknown email provider type: ${config.tipo}`);
  }
}

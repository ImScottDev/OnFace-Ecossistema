export type { EmailClient, EmailContaConfig, SendEmailParams, SendEmailResult, RawEmail } from "./types";
export { createEmailClient } from "./factory";
export { encrypt, decrypt } from "./encryption";
export { interpolateTemplate, extractVariables, type TemplateData } from "./template-engine";

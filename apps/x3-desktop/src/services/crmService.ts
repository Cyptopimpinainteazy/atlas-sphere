import { invoke } from '@tauri-apps/api/core';
/**
 * crmService.ts — Tauri invoke wrappers for the CRM backend.
 */
// Use a lazy, guarded tauri invoke helper to avoid runtime errors in browser dev
export async function fallbackInvoke<T>(cmd: string, args?: any): Promise<T> {
  if (typeof window === 'undefined' || (!(window as any).__TAURI_INTERNALS__ && !(window as any).__TAURI__)) {
    throw new Error('Tauri runtime not available');
  }
  const mod = await import('@tauri-apps/api/core');
  return mod.invoke<T>(cmd, args);
} 

/* ─── Types ──────────────────────────────────────── */

export interface Contact {
  id: string;
  ownerUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  avatarUrl: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  website: string;
  notes: string;
  tags: string;
  source: string;
  stage: string;
  priority: string;
  lastContacted: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactInput {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  website?: string;
  notes?: string;
  tags?: string;
  source?: string;
  stage?: string;
  priority?: string;
}

export interface UpdateContactInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  avatarUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  website?: string;
  notes?: string;
  tags?: string;
  source?: string;
  stage?: string;
  priority?: string;
}

export interface CalendarEvent {
  id: string;
  ownerUserId: string;
  title: string;
  description: string;
  location: string;
  eventType: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
  recurrence: string;
  reminderMins: number;
  contactId: string;
  dealId: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  location?: string;
  eventType?: string;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  color?: string;
  recurrence?: string;
  reminderMins?: number;
  contactId?: string;
  dealId?: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  location?: string;
  eventType?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  color?: string;
  recurrence?: string;
  reminderMins?: number;
  contactId?: string;
  dealId?: string;
  completed?: boolean;
}

export interface Deal {
  id: string;
  ownerUserId: string;
  contactId: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  probability: number;
  expectedClose: string;
  notes: string;
  won: boolean;
  lost: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDealInput {
  contactId?: string;
  title: string;
  value?: number;
  currency?: string;
  stage?: string;
  probability?: number;
  expectedClose?: string;
  notes?: string;
}

export interface UpdateDealInput {
  contactId?: string;
  title?: string;
  value?: number;
  currency?: string;
  stage?: string;
  probability?: number;
  expectedClose?: string;
  notes?: string;
  won?: boolean;
  lost?: boolean;
}

export interface Activity {
  id: string;
  ownerUserId: string;
  contactId: string;
  dealId: string;
  eventId: string;
  activityType: string;
  subject: string;
  body: string;
  createdAt: string;
}

export interface CreateActivityInput {
  contactId?: string;
  dealId?: string;
  eventId?: string;
  activityType: string;
  subject?: string;
  body?: string;
}

export interface EmailTemplate {
  id: string;
  ownerUserId: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailTemplateInput {
  name: string;
  subject: string;
  body: string;
}

export interface SmtpConfig {
  id: string;
  ownerUserId: string;
  host: string;
  port: number;
  username: string;
  fromName: string;
  fromEmail: string;
  useTls: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveSmtpConfigInput {
  host: string;
  port?: number;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  useTls?: boolean;
}

export interface SendEmailInput {
  toEmail: string;
  subject: string;
  body: string;
  contactId?: string;
  templateId?: string;
}

export interface SentEmail {
  id: string;
  ownerUserId: string;
  contactId: string;
  toEmail: string;
  subject: string;
  body: string;
  status: string;
  errorMessage: string;
  templateId: string;
  createdAt: string;
}

export interface CrmStats {
  contactCount: number;
  dealCount: number;
  openDealValue: number;
  wonDealCount: number;
  eventCount: number;
  upcomingEvents: number;
  emailSentCount: number;
  activityCount: number;
}

/* ─── Contacts ───────────────────────────────────── */
export const createContact = (userId: string, input: CreateContactInput) =>
  invoke<Contact>("crm_create_contact", { userId, input });

export const updateContact = (contactId: string, userId: string, input: UpdateContactInput) =>
  invoke<Contact>("crm_update_contact", { contactId, userId, input });

export const getContacts = (userId: string) =>
  invoke<Contact[]>("crm_get_contacts", { userId });

export const getContact = (contactId: string, userId: string) =>
  invoke<Contact>("crm_get_contact", { contactId, userId });

export const deleteContact = (contactId: string, userId: string) =>
  invoke<void>("crm_delete_contact", { contactId, userId });

/* ─── Calendar Events ────────────────────────────── */
export const createEvent = (userId: string, input: CreateEventInput) =>
  invoke<CalendarEvent>("crm_create_event", { userId, input });

export const updateEvent = (eventId: string, userId: string, input: UpdateEventInput) =>
  invoke<CalendarEvent>("crm_update_event", { eventId, userId, input });

export const getEvents = (userId: string, start?: string, end?: string) =>
  invoke<CalendarEvent[]>("crm_get_events", { userId, start: start ?? null, end: end ?? null });

export const deleteEvent = (eventId: string, userId: string) =>
  invoke<void>("crm_delete_event", { eventId, userId });

/* ─── Deals ──────────────────────────────────────── */
export const createDeal = (userId: string, input: CreateDealInput) =>
  invoke<Deal>("crm_create_deal", { userId, input });

export const updateDeal = (dealId: string, userId: string, input: UpdateDealInput) =>
  invoke<Deal>("crm_update_deal", { dealId, userId, input });

export const getDeals = (userId: string) =>
  invoke<Deal[]>("crm_get_deals", { userId });

export const deleteDeal = (dealId: string, userId: string) =>
  invoke<void>("crm_delete_deal", { dealId, userId });

/* ─── Activities ─────────────────────────────────── */
export const createActivity = (userId: string, input: CreateActivityInput) =>
  invoke<Activity>("crm_create_activity", { userId, input });

export const getActivities = (userId: string, contactId?: string) =>
  invoke<Activity[]>("crm_get_activities", { userId, contactId: contactId ?? null });

/* ─── Email Templates ────────────────────────────── */
export const createEmailTemplate = (userId: string, input: CreateEmailTemplateInput) =>
  invoke<EmailTemplate>("crm_create_email_template", { userId, input });

export const getEmailTemplates = (userId: string) =>
  invoke<EmailTemplate[]>("crm_get_email_templates", { userId });

export const deleteEmailTemplate = (templateId: string, userId: string) =>
  invoke<void>("crm_delete_email_template", { templateId, userId });

/* ─── SMTP ───────────────────────────────────────── */
export const saveSmtpConfig = (userId: string, input: SaveSmtpConfigInput) =>
  invoke<SmtpConfig>("crm_save_smtp_config", { userId, input });

export const getSmtpConfig = (userId: string) =>
  invoke<SmtpConfig | null>("crm_get_smtp_config", { userId });

/* ─── Send Email ─────────────────────────────────── */
export const sendEmail = (userId: string, input: SendEmailInput) =>
  invoke<SentEmail>("crm_send_email", { userId, input });

export const getSentEmails = (userId: string) =>
  invoke<SentEmail[]>("crm_get_sent_emails", { userId });

/* ─── Stats ──────────────────────────────────────── */
export const getCrmStats = (userId: string) =>
  invoke<CrmStats>("crm_get_stats", { userId });

<<<<<<< REPO
import nodemailer from 'nodemailer'

export type SmtpMessage = {
  to: string
  from?: string
  subject: string
  text?: string
  html?: string
}

export async function sendSmtp (message: SmtpMessage) {
  // Lightweight transporter that reads common env vars
  const host = process.env.SMTP_HOST ?? 'localhost'
  const port = +(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined
  })

  const result = await transporter.sendMail({
    from: message.from ?? process.env.SMTP_FROM ?? 'no-reply@example.com',
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html
  })

  return result
}

=======
import nodemailer from 'nodemailer'

export type SmtpMessage = {
  to: string
  from?: string
  subject: string
  text?: string
  html?: string
}

export async function sendSmtp (message: SmtpMessage) {
  // Lightweight transporter that reads common env vars
  const host = process.env.SMTP_HOST ?? 'localhost'
  const port = +(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined
  })

  const result = await transporter.sendMail({
    from: message.from ?? process.env.SMTP_FROM ?? 'no-reply@example.com',
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html
  })

  return result
}

>>>>>>> IMPORT (TEXT)

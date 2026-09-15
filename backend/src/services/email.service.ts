import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function emailEnabled(): boolean {
  return Boolean(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASS);
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
      port: Number(process.env.BREVO_SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER!,
        pass: process.env.BREVO_SMTP_PASS!,
      },
    });
  }
  return transporter;
}

const FROM_NAME = process.env.BREVO_FROM_NAME || 'Billing App';
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || process.env.BREVO_SMTP_USER;

/**
 * Sends the OTP email. Without Brevo credentials configured (e.g. local dev)
 * the code is logged to the console instead so the flow stays testable.
 */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const codeBlock = `\`${otp}\``;
  if (!emailEnabled()) {
    console.log(`[email] No SMTP configured — OTP for ${to}: ${otp}`);
    return;
  }
  await getTransporter().sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject: 'Your verification code',
    text: `Your Billing App verification code is ${otp}. It expires in 10 minutes.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px">
      <h2 style="color:#1e293b">Verify your email</h2>
      <p style="color:#475569">Use the code below to finish signing up:</p>
      <p style="font-size:28px;letter-spacing:8px;font-weight:700;color:#4f46e5">${otp}</p>
      <p style="color:#94a3b8;font-size:13px">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
    </div>`,
  });
}
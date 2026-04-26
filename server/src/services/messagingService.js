import sgMail from '@sendgrid/mail';
import twilio from 'twilio';
import { env } from '../config/env.js';

function secureLink(token) {
  return `${env.domain}/verify/${encodeURIComponent(token)}`;
}

function renderTemplate(template, { customer, token, expiryMinutes }) {
  const link = secureLink(token);
  const fallback = `Dear ${customer.name}, complete your loan verification: ${link}. Valid for ${expiryMinutes} minutes.`;
  return String(template || fallback)
    .replaceAll('{name}', customer.name || 'Customer')
    .replaceAll('{link}', link)
    .replaceAll('{expiry}', `${expiryMinutes} minutes`);
}

function textMessage({ customer, token, expiryMinutes, messageTemplate }) {
  return renderTemplate(messageTemplate, { customer, token, expiryMinutes });
}

function offerMessage({ customer, offer, offerUrl }) {
  return `Dear ${customer.name}, your Kredox AI loan offer is ready: INR ${Number(offer.amount).toLocaleString('en-IN')} at ${Number(offer.interest_rate)}% p.a. Review and accept here: ${offerUrl}`;
}

function brandedEmail({ customer, token, expiryMinutes, messageTemplate }) {
  const link = secureLink(token);
  const message = renderTemplate(messageTemplate, { customer, token, expiryMinutes });

  return `
    <div style="margin:0;background:#f4f5f6;padding:28px;font-family:Arial,sans-serif;color:#171717;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:auto;background:#ffffff;border:1px solid #d9dee3;">
        <tr>
          <td style="padding:24px 28px;border-bottom:4px solid #00a870;">
            <h1 style="margin:0;font-size:24px;color:#111111;">Kredox AI</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="font-size:16px;line-height:1.5;margin:0 0 22px;">${message}</p>
            <p style="margin:0 0 24px;">
              <a href="${link}" style="display:inline-block;background:#00a870;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:bold;">Complete verification</a>
            </p>
            <p style="font-size:14px;line-height:1.5;margin:0;color:#555b61;">This link is single-use and valid for ${expiryMinutes} minutes.</p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function twilioClient() {
  if (!env.twilio.accountSid || !env.twilio.authToken) {
    return null;
  }
  return twilio(env.twilio.accountSid, env.twilio.authToken);
}

function normalizeWhatsAppNumber(phone) {
  if (!phone) return phone;
  return phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
}

export function getMessagingStatus() {
  return {
    email: {
      configured: Boolean(env.sendgrid.apiKey && env.sendgrid.fromEmail),
      missing: [
        !env.sendgrid.apiKey ? 'SENDGRID_API_KEY' : null,
        !env.sendgrid.fromEmail ? 'SENDGRID_FROM_EMAIL' : null
      ].filter(Boolean)
    },
    sms: {
      configured: Boolean(env.twilio.accountSid && env.twilio.authToken && env.twilio.smsFrom),
      missing: [
        !env.twilio.accountSid ? 'TWILIO_ACCOUNT_SID' : null,
        !env.twilio.authToken ? 'TWILIO_AUTH_TOKEN' : null,
        !env.twilio.smsFrom ? 'TWILIO_SMS_FROM' : null
      ].filter(Boolean)
    },
    whatsapp: {
      configured: Boolean(env.twilio.accountSid && env.twilio.authToken && env.twilio.whatsappFrom),
      missing: [
        !env.twilio.accountSid ? 'TWILIO_ACCOUNT_SID' : null,
        !env.twilio.authToken ? 'TWILIO_AUTH_TOKEN' : null,
        !env.twilio.whatsappFrom ? 'TWILIO_WHATSAPP_FROM' : null
      ].filter(Boolean)
    }
  };
}

function sendGridErrorReason(error) {
  const details = error.response?.body?.errors?.map((item) => item.message).join('; ');
  return details || error.message || 'sendgrid_delivery_failed';
}

export async function sendCampaignMessage({ channel, customer, token, expiryMinutes, messageTemplate }) {
  if (channel === 'email') {
    if (!customer.email) {
      return { customer_id: customer.id, channel, status: 'skipped', reason: 'missing_email' };
    }

    if (!env.sendgrid.apiKey || !env.sendgrid.fromEmail) {
      return { customer_id: customer.id, channel, status: 'skipped', reason: 'sendgrid_not_configured' };
    }

    sgMail.setApiKey(env.sendgrid.apiKey);
    let response;
    try {
      [response] = await sgMail.send({
        to: customer.email,
        from: env.sendgrid.fromEmail,
        subject: 'Complete your Kredox AI loan verification',
        html: brandedEmail({ customer, token, expiryMinutes, messageTemplate })
      });
    } catch (error) {
      return {
        customer_id: customer.id,
        channel,
        status: 'failed',
        reason: sendGridErrorReason(error)
      };
    }

    return {
      customer_id: customer.id,
      channel,
      status: 'sent',
      provider_status: response.statusCode
    };
  }

  if (!customer.phone) {
    return { customer_id: customer.id, channel, status: 'skipped', reason: 'missing_phone' };
  }

  const client = twilioClient();
  const from = channel === 'whatsapp' ? env.twilio.whatsappFrom : env.twilio.smsFrom;

  if (!client || !from) {
    return { customer_id: customer.id, channel, status: 'skipped', reason: 'twilio_not_configured' };
  }

  const message = await client.messages.create({
    body: textMessage({ customer, token, expiryMinutes, messageTemplate }),
    from,
    to: channel === 'whatsapp' ? normalizeWhatsAppNumber(customer.phone) : customer.phone
  });

  return {
    customer_id: customer.id,
    channel,
    status: 'sent',
    provider_sid: message.sid
  };
}

export async function sendOfferSummary({ channel = 'sms', customer, offer, offerUrl }) {
  if (!['sms', 'whatsapp'].includes(channel)) {
    return { offer_id: offer.id, channel, status: 'skipped', reason: 'unsupported_channel' };
  }

  if (!customer.phone) {
    return { offer_id: offer.id, channel, status: 'skipped', reason: 'missing_phone' };
  }

  const client = twilioClient();
  const from = channel === 'whatsapp' ? env.twilio.whatsappFrom : env.twilio.smsFrom;

  if (!client || !from) {
    return { offer_id: offer.id, channel, status: 'skipped', reason: 'twilio_not_configured' };
  }

  const message = await client.messages.create({
    body: offerMessage({ customer, offer, offerUrl }),
    from,
    to: channel === 'whatsapp' ? normalizeWhatsAppNumber(customer.phone) : customer.phone
  });

  return {
    offer_id: offer.id,
    channel,
    status: 'sent',
    provider_sid: message.sid
  };
}

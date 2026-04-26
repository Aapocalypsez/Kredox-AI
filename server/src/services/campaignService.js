import { pool } from '../db/pool.js';
import { linkKey, redis } from '../redis/client.js';
import { sendCampaignMessage } from './messagingService.js';
import { logAuditEvent } from './auditService.js';
import { createSignedLinkToken } from './tokenService.js';
import { env } from '../config/env.js';

function addMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function defaultCampaignName(channel) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  return `Kredox AI ${channel.toUpperCase()} campaign ${timestamp}`;
}

function verificationUrl(token) {
  return `${env.domain}/verify/${encodeURIComponent(token)}`;
}

export async function markExpiredLinks(campaignId) {
  await pool.query(
    `UPDATE campaign_links
     SET status = 'expired'
     WHERE campaign_id = $1
       AND status = 'pending'
       AND expires_at <= NOW()`,
    [campaignId]
  );
}

export async function createCampaign({ lender_id, name, customer_list, channel, expiry_minutes, message_template }) {
  const client = await pool.connect();
  const expiresAt = addMinutes(expiry_minutes);
  const redisTtlSeconds = expiry_minutes * 60;

  try {
    await client.query('BEGIN');

    const campaignResult = await client.query(
      `INSERT INTO campaigns (lender_id, name, channel, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, lender_id, name, channel, created_at, expires_at`,
      [lender_id, name || defaultCampaignName(channel), channel, expiresAt]
    );
    const campaign = campaignResult.rows[0];
    const links = [];

    for (const customer of customer_list) {
      const customerResult = await client.query(
        `INSERT INTO customers (
           name,
           phone,
           email,
           declared_age,
           declared_monthly_income,
           employment_type,
           loan_purpose,
           city,
           declared_state,
           pincode,
           bureau_score,
           existing_loans,
           loan_amount_requested,
           lender_id
         )
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4, $5, NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''), $11, $12, $13, $14)
         RETURNING id, name, phone, email, declared_age, declared_monthly_income, employment_type, loan_purpose, city, declared_state, pincode, bureau_score, existing_loans, loan_amount_requested, lender_id`,
        [
          customer.name,
          customer.phone || '',
          customer.email || '',
          customer.declared_age || null,
          customer.declared_monthly_income || null,
          customer.employment_type || '',
          customer.loan_purpose || '',
          customer.city || '',
          customer.declared_state || '',
          customer.pincode || '',
          customer.bureau_score || null,
          customer.existing_loans ?? null,
          customer.loan_amount_requested || null,
          lender_id
        ]
      );
      const savedCustomer = customerResult.rows[0];
      const { token, sessionToken } = createSignedLinkToken({
        customerId: savedCustomer.id,
        campaignId: campaign.id,
        expiryMinutes: expiry_minutes
      });

      const linkResult = await client.query(
        `INSERT INTO campaign_links (campaign_id, customer_id, token, status, expires_at)
         VALUES ($1, $2, $3, 'pending', $4)
         RETURNING id, campaign_id, customer_id, token, status, created_at, expires_at`,
        [campaign.id, savedCustomer.id, token, expiresAt]
      );

      await redis.set(
        linkKey(token),
        JSON.stringify({
          customer_id: savedCustomer.id,
          campaign_id: campaign.id,
          session_token: sessionToken
        }),
        { EX: redisTtlSeconds }
      );

      links.push({
        ...linkResult.rows[0],
        customer: savedCustomer,
        session_token: sessionToken
      });
    }

    await client.query('COMMIT');

    const dispatchResults = [];
    for (const link of links) {
      try {
        const result = await sendCampaignMessage({
          channel,
          customer: link.customer,
          token: link.token,
          expiryMinutes: expiry_minutes,
          messageTemplate: message_template
        });
        dispatchResults.push(result);
        logAuditEvent({
          event_type: 'LINK_SENT',
          entity_type: 'campaign_link',
          entity_id: link.id,
          actor_id: campaign.lender_id,
          actor_type: 'agent',
          action: 'send_link',
          new_value: result
        }).catch((auditError) => {
          console.error('Link sent audit logging failed', { error: auditError.message });
        });
      } catch (error) {
        dispatchResults.push({
          customer_id: link.customer_id,
          channel,
          status: 'failed',
          reason: error.message
        });
      }
    }

    return {
      campaign,
      total_sent: links.length,
      links: links.map(({ token, session_token: _sessionToken, ...link }) => ({
        ...link,
        token_preview: `${token.slice(0, 16)}...`
      })),
      dispatch_results: dispatchResults
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getCampaignStats(campaignId) {
  await markExpiredLinks(campaignId);

  const result = await pool.query(
    `SELECT
       COUNT(*)::int AS total_sent,
       COUNT(*) FILTER (WHERE status = 'opened')::int AS opened,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE status = 'expired')::int AS expired,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
     FROM campaign_links
     WHERE campaign_id = $1`,
    [campaignId]
  );

  return result.rows[0];
}

export async function listCampaigns() {
  const result = await pool.query(
    `WITH stats AS (
       SELECT
         campaign_id,
         COUNT(*)::int AS total_sent,
         COUNT(*) FILTER (WHERE status = 'opened')::int AS opened,
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE status = 'expired' OR (status = 'pending' AND expires_at <= NOW()))::int AS expired,
         COUNT(*) FILTER (WHERE status = 'pending' AND expires_at > NOW())::int AS pending
       FROM campaign_links
       GROUP BY campaign_id
     )
     SELECT
       c.id,
       c.name,
       c.channel,
       c.created_at,
       c.expires_at,
       CASE WHEN c.expires_at <= NOW() THEN 'expired' ELSE 'active' END AS status,
       COALESCE(s.total_sent, 0) AS total_sent,
       COALESCE(s.opened, 0) AS opened,
       COALESCE(s.completed, 0) AS completed,
       COALESCE(s.expired, 0) AS expired,
       COALESCE(s.pending, 0) AS pending
     FROM campaigns c
     LEFT JOIN stats s ON s.campaign_id = c.id
     ORDER BY c.created_at DESC`
  );

  return result.rows;
}

export async function getCampaignLinks(campaignId) {
  await markExpiredLinks(campaignId);

  const result = await pool.query(
    `SELECT
       cl.id,
       cl.campaign_id,
       cl.customer_id,
       cl.status,
       cl.opened_at,
       cl.completed_at,
       cl.expires_at,
       cl.token,
       c.name,
       c.phone,
       c.email
     FROM campaign_links cl
     JOIN customers c ON c.id = cl.customer_id
     WHERE cl.campaign_id = $1
     ORDER BY cl.created_at DESC`,
    [campaignId]
  );

  return result.rows.map(({ token, ...row }) => ({
    ...row,
    verification_url: verificationUrl(token),
    token_preview: `${token.slice(0, 16)}...`
  }));
}

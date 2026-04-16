import "dotenv/config";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync, isStripeConfigured } from "./stripeClient";
import app from "./app";
import { logger } from "./lib/logger";

function isLocalOrUnsetWebhookHost(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  if (!d) return true;
  return (
    d.includes('localhost') ||
    d.startsWith('127.') ||
    d === '0.0.0.0' ||
    d.includes('192.168.') ||
    d.includes('10.')
  );
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    logger.warn('DATABASE_URL not set, skipping Stripe init');
    return;
  }

  if (!isStripeConfigured()) {
    logger.info(
      'Stripe not configured (no STRIPE_SECRET_KEY / Replit connector); skipping Stripe init',
    );
    return;
  }

  try {
    logger.info('Initializing Stripe schema...');
    await runMigrations({
      databaseUrl,
      schema: 'stripe'
    });
    logger.info('Stripe schema ready');

    const stripeSync = await getStripeSync();

    const domain =
      process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() ??
      process.env.REPLIT_DEV_DOMAIN?.split(',')[0]?.trim() ??
      '';
    const rawWebhookBase = process.env.STRIPE_WEBHOOK_BASE_URL?.replace(
      /\/$/,
      '',
    );
    const explicitWebhookBase = rawWebhookBase
      ? rawWebhookBase.startsWith('http')
        ? rawWebhookBase
        : `https://${rawWebhookBase}`
      : '';

    if (explicitWebhookBase) {
      logger.info('Setting up managed webhook (STRIPE_WEBHOOK_BASE_URL)...');
      const webhookResult = await stripeSync.findOrCreateManagedWebhook(
        `${explicitWebhookBase}/api/stripe/webhook`,
      );
      logger.info(
        { webhookUrl: webhookResult?.webhook?.url || 'setup complete' },
        'Webhook configured',
      );
    } else if (!isLocalOrUnsetWebhookHost(domain)) {
      logger.info('Setting up managed webhook...');
      const webhookBaseUrl = `https://${domain}`;
      const webhookResult = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`,
      );
      logger.info(
        { webhookUrl: webhookResult?.webhook?.url || 'setup complete' },
        'Webhook configured',
      );
    } else {
      logger.info(
        'Skipping managed Stripe webhook (local/private host; set STRIPE_WEBHOOK_BASE_URL for a public HTTPS URL)',
      );
    }

    stripeSync.syncBackfill()
      .then(() => {
        logger.info('Stripe data synced');
      })
      .catch((err: any) => {
        logger.error({ err }, 'Error syncing Stripe data');
      });
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize Stripe');
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

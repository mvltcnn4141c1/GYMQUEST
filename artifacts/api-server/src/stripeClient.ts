import Stripe from 'stripe';

let connectionSettings: any;

/** True when Stripe can be used: env keys (local) or Replit connector env. */
export function isStripeConfigured(): boolean {
  if (process.env.STRIPE_SECRET_KEY?.trim()) return true;
  const hasReplitToken = Boolean(
    process.env.REPL_IDENTITY?.trim() || process.env.WEB_REPL_RENEWAL?.trim(),
  );
  return Boolean(hasReplitToken && process.env.REPLIT_CONNECTORS_HOSTNAME?.trim());
}

async function getCredentials() {
  const secretFromEnv = process.env.STRIPE_SECRET_KEY?.trim();
  const publishableFromEnv = process.env.STRIPE_PUBLISHABLE_KEY?.trim();
  if (secretFromEnv) {
    return {
      publishableKey: publishableFromEnv ?? '',
      secretKey: secretFromEnv,
    };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error(
      'Stripe is not configured: set STRIPE_SECRET_KEY (local) or run on Replit with connector token',
    );
  }

  if (!hostname?.trim()) {
    throw new Error(
      'Stripe Replit connector: REPLIT_CONNECTORS_HOSTNAME is missing',
    );
  }

  const connectorName = 'stripe';
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Replit-Token': xReplitToken
    }
  });

  const data = await response.json();

  connectionSettings = data.items?.[0];

  if (!connectionSettings || (!connectionSettings.settings.publishable || !connectionSettings.settings.secret)) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret,
  };
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();

  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil' as any,
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}

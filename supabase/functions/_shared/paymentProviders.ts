export type PaymentProviderName = 'pesapal';

export interface PaymentCustomer {
  name?: string | null;
  email?: string | null;
  phoneNumber: string;
}

export interface StartPaymentRequest {
  amount: number;
  merchantReference: string;
  description: string;
  orderTrackingCode: string;
  customer: PaymentCustomer;
}

export interface StartPaymentResult {
  provider: PaymentProviderName;
  providerPaymentId: string;
  providerReference: string;
  redirectUrl: string;
  providerStatus: string;
  customerMessage: string;
  raw: Record<string, unknown>;
}

export interface ProviderPaymentStatus {
  provider: PaymentProviderName;
  providerPaymentId: string;
  providerReference?: string;
  providerStatus: string;
  appResultCode: number;
  resultDescription: string;
  amount?: number;
  confirmationCode?: string;
  paymentMethod?: string;
  payerPhoneNumber?: string;
  raw: Record<string, unknown>;
}

export interface PaymentProvider {
  name: PaymentProviderName;
  startPayment(request: StartPaymentRequest): Promise<StartPaymentResult>;
  getPaymentStatus(orderTrackingId: string): Promise<ProviderPaymentStatus>;
}

const PESAPAL_SANDBOX_BASE_URL = 'https://cybqa.pesapal.com/pesapalv3';
const PESAPAL_LIVE_BASE_URL = 'https://pay.pesapal.com/v3';

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function getPesapalBaseUrl(): string {
  const override = Deno.env.get('PESAPAL_API_BASE_URL')?.trim();
  if (override) return override.replace(/\/+$/, '');

  const environment = Deno.env.get('PESAPAL_ENVIRONMENT')?.toLowerCase();
  return environment === 'live' || environment === 'production'
    ? PESAPAL_LIVE_BASE_URL
    : PESAPAL_SANDBOX_BASE_URL;
}

function normalizeAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-+]/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = `254${cleaned.substring(1)}`;
  }

  if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    cleaned = `254${cleaned}`;
  }

  return cleaned;
}

export function isValidPhoneNumber(phone: string): boolean {
  return /^254[71]\d{8}$/.test(formatPhoneNumber(phone));
}

export function buildMerchantReference(orderTrackingCode: string): string {
  const source = `EW-${orderTrackingCode}-${crypto.randomUUID().slice(0, 8)}`;
  return truncate(source.replace(/[^A-Za-z0-9_.:-]/g, '-'), 50);
}

function splitName(name?: string | null): { firstName: string; lastName: string } {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: 'ExpressWash', lastName: 'Customer' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || 'Customer',
  };
}

function getCallbackUrl(orderTrackingCode: string): string {
  const configured = Deno.env.get('PESAPAL_CALLBACK_URL')?.trim();
  if (configured) return configured;

  const siteUrl = Deno.env.get('SITE_URL')?.trim()?.replace(/\/+$/, '');
  if (siteUrl) {
    return `${siteUrl}/portal/orders/${encodeURIComponent(orderTrackingCode)}`;
  }

  throw new Error('SITE_URL or PESAPAL_CALLBACK_URL is required for PesaPal callbacks');
}

function getCancellationUrl(orderTrackingCode: string): string | undefined {
  const configured = Deno.env.get('PESAPAL_CANCELLATION_URL')?.trim();
  if (configured) return configured;

  const siteUrl = Deno.env.get('SITE_URL')?.trim()?.replace(/\/+$/, '');
  return siteUrl ? `${siteUrl}/portal/orders/${encodeURIComponent(orderTrackingCode)}` : undefined;
}

function getStatusFromCode(statusCode: number): { providerStatus: string; appResultCode: number } {
  switch (statusCode) {
    case 1:
      return { providerStatus: 'completed', appResultCode: 0 };
    case 2:
      return { providerStatus: 'failed', appResultCode: 2 };
    case 3:
      return { providerStatus: 'reversed', appResultCode: 3 };
    case 0:
    default:
      return { providerStatus: 'invalid', appResultCode: 1 };
  }
}

function getStringField(source: Record<string, unknown>, names: string[]): string | undefined {
  const lowered = new Map(
    Object.entries(source).map(([key, value]) => [key.toLowerCase(), value]),
  );

  for (const name of names) {
    const value = source[name] ?? lowered.get(name.toLowerCase());
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }

  return undefined;
}

class PesapalProvider implements PaymentProvider {
  name: PaymentProviderName = 'pesapal';
  private readonly baseUrl = getPesapalBaseUrl();

  async startPayment(request: StartPaymentRequest): Promise<StartPaymentResult> {
    const token = await this.requestToken();
    const notificationId = requiredEnv('PESAPAL_IPN_ID');
    const { firstName, lastName } = splitName(request.customer.name);

    const payload: Record<string, unknown> = {
      id: request.merchantReference,
      currency: Deno.env.get('PAYMENT_CURRENCY')?.trim() || 'KES',
      amount: normalizeAmount(request.amount),
      description: truncate(request.description, 100),
      callback_url: getCallbackUrl(request.orderTrackingCode),
      redirect_mode: 'TOP_WINDOW',
      notification_id: notificationId,
      branch: Deno.env.get('PESAPAL_BRANCH')?.trim() || 'ExpressWash',
      billing_address: {
        email_address: request.customer.email || undefined,
        phone_number: request.customer.phoneNumber,
        country_code: 'KE',
        first_name: firstName,
        middle_name: '',
        last_name: lastName,
        line_1: '',
        line_2: '',
        city: 'Nairobi',
        state: '',
        postal_code: '',
        zip_code: '',
      },
    };

    const cancellationUrl = getCancellationUrl(request.orderTrackingCode);
    if (cancellationUrl) {
      payload.cancellation_url = cancellationUrl;
    }

    const response = await fetch(`${this.baseUrl}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await readJson(response);
    if (!response.ok || data.error || !data.order_tracking_id || !data.redirect_url) {
      throw new Error(getProviderErrorMessage(data, response.statusText));
    }

    return {
      provider: this.name,
      providerPaymentId: String(data.order_tracking_id),
      providerReference: String(data.merchant_reference || request.merchantReference),
      redirectUrl: String(data.redirect_url),
      providerStatus: 'submitted',
      customerMessage: 'Continue to PesaPal to complete payment.',
      raw: data,
    };
  }

  async getPaymentStatus(orderTrackingId: string): Promise<ProviderPaymentStatus> {
    const token = await this.requestToken();
    const url = new URL(`${this.baseUrl}/api/Transactions/GetTransactionStatus`);
    url.searchParams.set('orderTrackingId', orderTrackingId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await readJson(response);
    const providerError = data.error as { message?: string } | null | undefined;
    if (!response.ok || providerError?.message) {
      throw new Error(getProviderErrorMessage(data, response.statusText));
    }

    const statusCode = Number(data.status_code);
    const { providerStatus, appResultCode } = getStatusFromCode(Number.isFinite(statusCode) ? statusCode : 0);

    return {
      provider: this.name,
      providerPaymentId: orderTrackingId,
      providerReference: data.merchant_reference ? String(data.merchant_reference) : undefined,
      providerStatus,
      appResultCode,
      resultDescription: String(data.description || data.payment_status_description || data.message || providerStatus),
      amount: data.amount === undefined || data.amount === null ? undefined : Number(data.amount),
      confirmationCode: data.confirmation_code ? String(data.confirmation_code) : undefined,
      paymentMethod: data.payment_method ? String(data.payment_method) : undefined,
      payerPhoneNumber: getStringField(data, [
        'phone_number',
        'payer_phone_number',
        'customer_phone_number',
        'msisdn',
      ]),
      raw: data,
    };
  }

  private async requestToken(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/Auth/RequestToken`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        consumer_key: requiredEnv('PESAPAL_CONSUMER_KEY'),
        consumer_secret: requiredEnv('PESAPAL_CONSUMER_SECRET'),
      }),
    });

    const data = await readJson(response);
    if (!response.ok || data.error || !data.token) {
      throw new Error(getProviderErrorMessage(data, response.statusText));
    }

    return String(data.token);
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function getProviderErrorMessage(data: Record<string, unknown>, fallback: string): string {
  const error = data.error as { message?: string; code?: string } | null | undefined;
  if (error?.message) return error.message;
  if (data.message) return String(data.message);
  return fallback || 'Payment provider request failed';
}

export function getPaymentProvider(): PaymentProvider {
  const provider = Deno.env.get('PAYMENT_PROVIDER')?.toLowerCase() || 'pesapal';

  if (provider === 'pesapal') {
    return new PesapalProvider();
  }

  throw new Error(`Unsupported payment provider: ${provider}`);
}

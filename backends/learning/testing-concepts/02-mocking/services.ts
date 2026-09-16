/**
 * External service dependencies.
 *
 * These classes are boundaries where the code talks to the outside world: SMTP,
 * payment processors, third-party APIs. In production they do real work; in
 * tests we replace them with mocks.
 *
 * Each class also has an interface describing it. That interface is what makes a
 * mock checkable: a hand-rolled fake can be declared to satisfy `EmailSender`,
 * and then a misspelled method or a wrong argument type is a compile error
 * rather than a test that passes for the wrong reason.
 */

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface EmailSender {
  send(to: string, subject: string, body: string): Promise<boolean>;
  sendWelcome(userEmail: string): Promise<boolean>;
}

class EmailService implements EmailSender {
  async send(to: string, subject: string, _body: string): Promise<boolean> {
    await sleep(200); // real SMTP latency
    console.log(`[EMAIL] → ${to}: ${subject}`);
    return true;
  }

  async sendWelcome(userEmail: string): Promise<boolean> {
    return this.send(userEmail, "Welcome!", `Hi ${userEmail}, welcome to the platform.`);
  }
}

interface ChargeResult {
  status: string;
  chargeId: string | null;
}

interface PaymentProcessor {
  charge(amountCents: number, cardToken: string): Promise<ChargeResult>;
  refund(chargeId: string): Promise<ChargeResult>;
}

class PaymentService implements PaymentProcessor {
  async charge(_amountCents: number, _cardToken: string): Promise<ChargeResult> {
    await sleep(500); // real Stripe latency
    return { status: "success", chargeId: `ch_${Math.floor(Math.random() * 90000) + 10000}` };
  }

  async refund(chargeId: string): Promise<ChargeResult> {
    await sleep(300);
    return { status: "refunded", chargeId };
  }
}

interface WeatherSource {
  getTemperature(city: string): Promise<number>;
  isHot(city: string): Promise<boolean>;
}

class WeatherClient implements WeatherSource {
  async getTemperature(_city: string): Promise<number> {
    throw new Error("Requires a live API key and network access");
  }

  async isHot(city: string): Promise<boolean> {
    return (await this.getTemperature(city)) > 30;
  }
}

export { EmailService, PaymentService, WeatherClient };
export type { EmailSender, PaymentProcessor, WeatherSource, ChargeResult };

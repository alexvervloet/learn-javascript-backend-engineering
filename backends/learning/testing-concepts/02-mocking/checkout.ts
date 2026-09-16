/**
 * Business logic that uses the external services.
 *
 * These functions construct service instances internally. To mock them, the
 * tests replace the `services` module with `jest.unstable_mockModule`. Because
 * checkout imports the module by path, mocking that path swaps what checkout
 * sees.
 */

import { EmailService, PaymentService, WeatherClient } from "./services.js";

interface User {
  id: number;
  email: string;
  status: string;
}

interface Order {
  orderId: number;
  userId: number;
  chargeId: string | null;
}

async function registerUser(email: string): Promise<User> {
  const service = new EmailService();
  const user: User = { id: 1, email, status: "active" };
  await service.sendWelcome(email);
  return user;
}

async function completePurchase(
  userId: number,
  amountCents: number,
  cardToken: string
): Promise<Order> {
  const service = new PaymentService();
  const charge = await service.charge(amountCents, cardToken);
  if (charge.status !== "success") {
    throw new Error(`Payment failed: ${JSON.stringify(charge)}`);
  }
  return { orderId: 100, userId, chargeId: charge.chargeId };
}

async function getWeatherAlert(city: string): Promise<string | null> {
  const client = new WeatherClient();
  const temp = await client.getTemperature(city);
  if (temp > 40) return `Extreme heat warning for ${city}: ${temp}°C`;
  if (temp < -10) return `Extreme cold warning for ${city}: ${temp}°C`;
  return null;
}

export { registerUser, completePurchase, getWeatherAlert };
export type { User, Order };

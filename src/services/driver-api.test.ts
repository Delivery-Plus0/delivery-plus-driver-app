import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './api';
import { fetchCurrentDelivery, performDeliveryAction } from './deliveries';
import { fetchMyDriver, goOffline, goOnline, registerVehicle } from './drivers';
import { clearSession, setSession } from './session';
import { reportLocation } from './tracking';

const driverToken = [
  Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: 'driver-user-1', email: 'qa.driver@delivery-plus.test', role: 'DRIVER' })).toString('base64url'),
  'signature',
].join('.');

const respond = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('driver API', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await setSession(driverToken);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearSession();
  });

  const lastCall = () => {
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    return { url, method: init.method, auth: new Headers(init.headers).get('Authorization') };
  };

  it("reads the driver's own profile with the driver's token", async () => {
    fetchMock.mockResolvedValue(respond(200, { id: 'd1', userId: 'driver-user-1', vehicleType: 'Scooter', licensePlate: 'QA-1', status: 'OFFLINE' }));

    await expect(fetchMyDriver()).resolves.toMatchObject({ id: 'd1', status: 'OFFLINE' });
    expect(lastCall()).toMatchObject({ url: expect.stringMatching(/\/api\/drivers\/me$/), method: 'GET', auth: `Bearer ${driverToken}` });
  });

  it('returns null before the vehicle is registered (404)', async () => {
    fetchMock.mockResolvedValue(respond(404, { statusCode: 404, error: 'NotFound', message: 'Driver profile not found' }));
    await expect(fetchMyDriver()).resolves.toBeNull();
  });

  it('does not hide other failures as "no profile"', async () => {
    fetchMock.mockResolvedValue(respond(503, { statusCode: 503, error: 'ServiceUnavailable', message: 'down' }));
    await expect(fetchMyDriver()).rejects.toBeInstanceOf(ApiError);
  });

  it('registers the vehicle, and goes online and offline through the driver routes', async () => {
    fetchMock.mockImplementation(async () => respond(201, { id: 'd1', status: 'OFFLINE' }));

    await registerVehicle({ vehicleType: 'Scooter', licensePlate: 'QA-1' });
    expect(lastCall()).toMatchObject({ url: expect.stringMatching(/\/api\/drivers\/register$/), method: 'POST' });
    await goOnline();
    expect(lastCall().url).toMatch(/\/api\/drivers\/me\/online$/);
    await goOffline();
    expect(lastCall().url).toMatch(/\/api\/drivers\/me\/offline$/);
  });

  it("returns the driver's current delivery", async () => {
    fetchMock.mockResolvedValue(respond(200, { id: 'del-1', status: 'DRIVER_ASSIGNED', nextActions: ['pickup'] }));

    await expect(fetchCurrentDelivery()).resolves.toMatchObject({ id: 'del-1', nextActions: ['pickup'] });
    expect(lastCall().url).toMatch(/\/api\/deliveries\/me\/current$/);
  });

  it('returns null when there is no current delivery (204 No Content)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(fetchCurrentDelivery()).resolves.toBeNull();
  });

  it.each(['pickup', 'start', 'complete'] as const)('posts the %s action for the delivery', async (action) => {
    fetchMock.mockResolvedValue(respond(201, { id: 'del-1', status: 'PICKED_UP' }));

    await performDeliveryAction('del-1', action);
    expect(lastCall()).toMatchObject({ url: expect.stringMatching(new RegExp(`/api/deliveries/del-1/${action}$`)), method: 'POST' });
  });

  it("reports the driver's location with only the coordinates (the driver comes from the token)", async () => {
    fetchMock.mockResolvedValue(respond(201, { userId: 'driver-user-1', latitude: 30.0444, longitude: 31.2357 }));

    await reportLocation({ latitude: 30.0444, longitude: 31.2357, recordedAt: '2026-10-06T12:00:00.000Z' });
    expect(lastCall()).toMatchObject({ url: expect.stringMatching(/\/api\/tracking\/location$/), method: 'POST', auth: `Bearer ${driverToken}` });
    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    // Only the position and its capture time: no delivery id, ETA or geofence (the server derives those, #60).
    expect(JSON.parse(String(init.body))).toEqual({ latitude: 30.0444, longitude: 31.2357, recordedAt: '2026-10-06T12:00:00.000Z' });
  });

  it('omits recordedAt when the position has none', async () => {
    fetchMock.mockResolvedValue(respond(201, {}));
    await reportLocation({ latitude: 30.0444, longitude: 31.2357 });
    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ latitude: 30.0444, longitude: 31.2357 });
  });
});

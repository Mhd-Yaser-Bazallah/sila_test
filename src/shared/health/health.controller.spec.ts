import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('returns api health status', () => {
    const result = controller.getHealth();

    expect(result).toEqual({
      status: 'ok',
      service: 'sila-api',
      timestamp: expect.any(String),
    });
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/ai/provider.js', () => ({ generateJson: vi.fn() }));
import { generateJson } from '../src/services/ai/provider.js';
import { createPlan, breakdownTask } from '../src/services/ai/ai.service.js';

describe('AI output safeguards', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects malformed provider output rather than showing unvalidated data', async () => {
    generateJson.mockResolvedValue({ overview: 'A plan with no task phases' });
    await expect(createPlan('Build a useful team planning workspace')).rejects.toMatchObject({ name: 'ZodError' });
  });

  it('rejects invalid user inputs before calling the provider', async () => {
    await expect(breakdownTask('x')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('preserves provider failure as a visible error instead of inventing an answer', async () => {
    generateJson.mockRejectedValue(new Error('Provider unavailable'));
    await expect(createPlan('Build a useful team planning workspace')).rejects.toThrow('Provider unavailable');
  });
});

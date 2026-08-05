import { describe, expect, it } from 'vitest';
import { nextProjectNo } from './project-number.js';

describe('nextProjectNo', () => {
  it('increments the highest project sequence for the same creation date', () => {
    const projectNo = nextProjectNo('2026-07-17T08:30:00.000Z', [
      'PJ-20260717-001',
      'PJ-20260717-009',
      'PJ-20260716-003',
      'invalid-project-no',
    ]);

    expect(projectNo).toBe('PJ-20260717-010');
  });
});

import { describe, expect, it } from 'vitest';

describe('test environment', () => {
  it('provides a DOM for component tests', () => {
    const element = document.createElement('div');

    expect(element).toBeInstanceOf(HTMLDivElement);
  });
});

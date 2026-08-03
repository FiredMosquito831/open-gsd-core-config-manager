import { describe, expect, it } from 'vitest';
import { SecretField } from '../../web/src/components/specialized/SecretField';

describe('secret redaction boundaries', () => {
  it('does not include secret values in component source or normal copy affordances', () => {
    expect(SecretField.toString()).not.toContain('console.');
    expect(SecretField.toString()).not.toContain('clipboard');
    expect(SecretField.toString()).not.toContain('length');
  });
});

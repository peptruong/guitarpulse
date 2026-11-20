import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { absoluteUrl, normalizeBase, withBase } from '../lib/basePath';

describe('normalizeBase', () => {
  it('treats a missing, empty or root base path as no prefix', () => {
    assert.equal(normalizeBase(undefined), '');
    assert.equal(normalizeBase(''), '');
    assert.equal(normalizeBase('/'), '');
  });

  it('adds the leading slash and drops trailing slashes', () => {
    assert.equal(normalizeBase('guitarpulse'), '/guitarpulse');
    assert.equal(normalizeBase('/guitarpulse/'), '/guitarpulse');
  });
});

describe('withBase', () => {
  it('leaves app paths alone when there is no prefix', () => {
    assert.equal(withBase('/jam?s=abc', ''), '/jam?s=abc');
  });

  it('puts the prefix in front of app paths', () => {
    assert.equal(withBase('/jam?s=abc', '/guitarpulse'), '/guitarpulse/jam?s=abc');
  });
});

describe('absoluteUrl', () => {
  it('builds a full link that keeps the prefix', () => {
    assert.equal(absoluteUrl('https://example.github.io', '/jam?s=x', '/guitarpulse'), 'https://example.github.io/guitarpulse/jam?s=x');
  });
});

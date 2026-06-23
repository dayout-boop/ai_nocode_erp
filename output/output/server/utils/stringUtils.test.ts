// stringUtils 테스트
import { truncate, sanitize } from './stringUtils';

describe('truncate', () => {
  it('should return original string if length is within maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('should truncate with default ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('he...');
  });

  it('should use custom ellipsis', () => {
    expect(truncate('hello world', 6, '..')).toBe('hell..');
  });

  it('should handle empty string', () => {
    expect(truncate('', 5)).toBe('');
  });

  it('should handle maxLength zero', () => {
    expect(truncate('hello', 0)).toBe('');
  });

  it('should handle maxLength negative', () => {
    expect(truncate('hello', -1)).toBe('');
  });

  it('should handle maxLength smaller than ellipsis', () => {
    expect(truncate('hello world', 2, '...')).toBe('..');
  });

  it('should handle null or undefined input', () => {
    expect(truncate(null as unknown as string, 5)).toBe('');
    expect(truncate(undefined as unknown as string, 5)).toBe('');
  });
});

describe('sanitize', () => {
  it('should escape basic HTML characters', () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('should escape ampersand first', () => {
    expect(sanitize('a&b')).toBe('a&amp;b');
  });

  it('should handle empty string', () => {
    expect(sanitize('')).toBe('');
  });

  it('should handle null and undefined', () => {
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
  });

  it('should return safe string unchanged', () => {
    expect(sanitize('hello world')).toBe('hello world');
  });

  it('should escape single quote and slash', () => {
    expect(sanitize("it's a test/")).toBe("it&#x27;s a test&#x2F;");
  });
});

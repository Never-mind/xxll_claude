import { describe, expect, it } from 'vitest';
import { normalizeUploadedFileName } from './settlement-project.controller.js';

describe('settlement attachment upload file names', () => {
  it('keeps normal UTF-8 Chinese file names unchanged', () => {
    expect(normalizeUploadedFileName('中文附件.pdf')).toBe('中文附件.pdf');
  });

  it('repairs Chinese file names decoded as latin1', () => {
    const mojibake = Buffer.from('中文附件.pdf', 'utf8').toString('latin1');

    expect(normalizeUploadedFileName(mojibake)).toBe('中文附件.pdf');
  });
});

import { describe, it, expect } from 'vitest';
import { buildDraftMessage, draftKindForMessageType, firstNameOf } from './templates';
import { waPhoneFromE164, buildWaUrl } from './link';

describe('firstNameOf', () => {
  it('takes the first token', () => {
    expect(firstNameOf('Wong Mei Ling')).toBe('Wong');
    expect(firstNameOf('  Tan  ')).toBe('Tan');
  });
});

describe('buildDraftMessage — deterministic output', () => {
  const ctx = {
    clientFirstName: 'Mei',
    policyLabel: 'Car',
    dateText: '12 Aug 2026',
    insurer: 'AIA',
  };

  it('renewal (upcoming) includes name, insurer, type, and date', () => {
    const m = buildDraftMessage('renewal', ctx);
    expect(m).toContain('Hi Mei');
    expect(m).toContain('AIA car policy');
    expect(m).toContain('12 Aug 2026');
    // Deterministic: identical calls produce identical strings.
    expect(buildDraftMessage('renewal', ctx)).toBe(m);
  });

  it('renewal (overdue) changes phrasing honestly', () => {
    const m = buildDraftMessage('renewal', { ...ctx, overdue: true });
    expect(m).toContain('has passed');
    expect(m).not.toContain('due for renewal on');
  });

  it('premium_due mentions the premium and the date', () => {
    const m = buildDraftMessage('premium_due', { ...ctx, policyLabel: 'Life' });
    expect(m).toContain('premium');
    expect(m).toContain('AIA life policy');
    expect(m).toContain('12 Aug 2026');
  });

  it('anniversary thanks the client', () => {
    const m = buildDraftMessage('anniversary', { ...ctx, policyLabel: 'Life' });
    expect(m).toContain('thank you');
  });

  it('travel_departure uses destination when present, copes when absent', () => {
    const withDest = buildDraftMessage('travel_departure', {
      ...ctx,
      policyLabel: 'Travel',
      destination: 'Tokyo, Japan',
    });
    expect(withDest).toContain('Tokyo, Japan');
    const noDest = buildDraftMessage('travel_departure', {
      ...ctx,
      policyLabel: 'Travel',
      destination: null,
    });
    expect(noDest).toContain('your trip');
  });

  it('travel_return welcomes back and invites claims', () => {
    const m = buildDraftMessage('travel_return', { ...ctx, policyLabel: 'Travel' });
    expect(m).toContain('welcome back');
    expect(m.toLowerCase()).toContain('claims');
  });

  it('missing insurer falls back to plain type; blank name falls back to "there"', () => {
    const m = buildDraftMessage('renewal', { ...ctx, insurer: null });
    expect(m).toContain('car policy');
    expect(m).not.toContain('AIA');
    const m2 = buildDraftMessage('renewal', { ...ctx, clientFirstName: '  ' });
    expect(m2).toContain('Hi there');
  });
});

describe('draftKindForMessageType', () => {
  it('maps every automated type; renewal variants collapse', () => {
    expect(draftKindForMessageType('renewal_60')).toBe('renewal');
    expect(draftKindForMessageType('renewal_30')).toBe('renewal');
    expect(draftKindForMessageType('renewal_7')).toBe('renewal');
    expect(draftKindForMessageType('premium_due')).toBe('premium_due');
    expect(draftKindForMessageType('anniversary')).toBe('anniversary');
    expect(draftKindForMessageType('travel_departure')).toBe('travel_departure');
    expect(draftKindForMessageType('travel_return')).toBe('travel_return');
  });
  it('manual and unknown types have no draft', () => {
    expect(draftKindForMessageType('manual')).toBeNull();
    expect(draftKindForMessageType('whatever_future')).toBeNull();
  });
});

describe('waPhoneFromE164', () => {
  it('strips + and formatting from valid numbers', () => {
    expect(waPhoneFromE164('+6591234567')).toBe('6591234567');
    expect(waPhoneFromE164('+65 9123-4567')).toBe('6591234567');
  });
  it('rejects missing, short, long, or garbage numbers', () => {
    expect(waPhoneFromE164(null)).toBeNull();
    expect(waPhoneFromE164('')).toBeNull();
    expect(waPhoneFromE164('12345')).toBeNull();
    expect(waPhoneFromE164('1234567890123456')).toBeNull();
    expect(waPhoneFromE164('no digits here')).toBeNull();
  });
});

describe('buildWaUrl', () => {
  it('encodes spaces, punctuation, and emoji safely', () => {
    const url = buildWaUrl('6591234567', 'Hi Mei! Your policy renews on 12 Aug 2026 🙂');
    expect(url.startsWith('https://wa.me/6591234567?text=')).toBe(true);
    expect(url).toContain('Hi%20Mei!');
    expect(url).not.toContain(' ');
    // Emoji must be percent-encoded, not raw.
    expect(url).toContain('%F0%9F%99%82');
  });
});

import { buildDraftMessage as _bdm } from './templates';
import { daysUntilBirthday, nextBirthdayDate } from '../dates/birthday';

describe('birthday feature', () => {
  it('birthday template greets by first name and stays product-free', () => {
    const msg = _bdm('birthday', { clientFirstName: 'Mei Ling', policyLabel: '', dateText: '' });
    expect(msg).toContain('Happy birthday, Mei Ling!');
    expect(msg).toContain('review');
    expect(msg.toLowerCase()).not.toContain('buy');
  });
  it('daysUntilBirthday: today, upcoming, year wrap, 29 Feb', () => {
    expect(daysUntilBirthday('1995-07-19', '2026-07-19')).toBe(0);
    expect(daysUntilBirthday('1995-07-25', '2026-07-19')).toBe(6);
    expect(daysUntilBirthday('1995-01-02', '2026-12-30')).toBe(3);
    expect(daysUntilBirthday('1996-02-29', '2026-02-27')).toBe(1); // non-leap -> 28 Feb
  });
  it('nextBirthdayDate wraps the year correctly', () => {
    expect(nextBirthdayDate('1995-01-02', '2026-12-30')).toBe('2027-01-02');
    expect(nextBirthdayDate('1995-07-25', '2026-07-19')).toBe('2026-07-25');
  });
});

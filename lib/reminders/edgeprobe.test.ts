import { describe, it, expect } from 'vitest';
import { scheduleForPolicy, type PolicyInput } from './scheduler';

const base: PolicyInput = {
  id: 'p1', agentId: 'a', clientId: 'c', policyType: 'life', destination: null,
  startDate: '2026-07-18', endDate: '2026-07-18', renewalDate: null,
  paymentMode: 'monthly', status: 'active',
};

describe('QA edge probes', () => {
  it('policy starting TODAY: first premium due next month, nothing in past', () => {
    const now = new Date('2026-07-18T10:00:00Z');
    const planned = scheduleForPolicy(base, now);
    const premiums = planned.filter(p => p.messageType === 'premium_due');
    expect(premiums.length).toBeGreaterThanOrEqual(11); // 12 due dates, first fire = Aug 15 (due Aug 18 - 3d)
    for (const p of planned) expect(new Date(p.scheduledAt).getTime()).toBeGreaterThan(now.getTime());
  });

  it('anniversary exactly ~365d out: either scheduled or cleanly absent (no crash, no past)', () => {
    const now = new Date('2026-07-18T10:00:00Z');
    const planned = scheduleForPolicy({ ...base, paymentMode: 'single' }, now);
    const annivs = planned.filter(p => p.messageType === 'anniversary');
    expect(annivs.length).toBeLessThanOrEqual(1);
    if (annivs[0]) expect(new Date(annivs[0].scheduledAt).getTime()).toBeGreaterThan(now.getTime());
  });

  it('startDate on the 31st, monthly: every occurrence valid, no invalid dates thrown', () => {
    const now = new Date('2026-07-18T10:00:00Z');
    const planned = scheduleForPolicy({ ...base, startDate: '2026-01-31' }, now);
    expect(planned.filter(p => p.messageType === 'premium_due').length).toBe(12);
  });

  it('semi-annual: exactly 2 premium_due in horizon; quarterly monthly annual single all counted', () => {
    const now = new Date('2026-07-18T10:00:00Z');
    const count = (mode: PolicyInput['paymentMode']) =>
      scheduleForPolicy({ ...base, startDate: '2020-03-15', paymentMode: mode }, now)
        .filter(p => p.messageType === 'premium_due').length;
    expect(count('semi_annual')).toBe(2);
    expect(count('quarterly')).toBe(4);
    expect(count('monthly')).toBe(12);
    expect(count('annual')).toBe(1);
    expect(count('single')).toBe(0);
  });

  it('cancelled protection policy: zero reminders (cancel flow)', () => {
    expect(scheduleForPolicy({ ...base, status: 'cancelled' })).toEqual([]);
  });

  it('very old policy (2005): occurrences still anchor correctly, all future', () => {
    const now = new Date('2026-07-18T10:00:00Z');
    const planned = scheduleForPolicy({ ...base, startDate: '2005-02-28', paymentMode: 'quarterly' }, now);
    const premiums = planned.filter(p => p.messageType === 'premium_due');
    expect(premiums.length).toBe(4);
    for (const p of premiums) expect(new Date(p.scheduledAt).getTime()).toBeGreaterThan(now.getTime());
  });
});

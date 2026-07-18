import { describe, it, expect } from 'vitest';
import {
  scheduleForPolicy,
  reconcileReminders,
  remindersToCancelForDeactivation,
  buildSgtInstant,
  subtractDays,
  makeIdempotencyKey,
  type PolicyInput,
  type ExistingReminder,
} from './scheduler';

// A fixed clock well in the past so every future-dated policy schedules fully.
const NOW = new Date('2026-01-01T00:00:00.000Z');

function travelPolicy(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    id: 'pol-travel',
    agentId: 'agent-1',
    clientId: 'client-1',
    policyType: 'travel',
    destination: 'Tokyo',
    startDate: '2026-06-10',
    endDate: '2026-06-20',
    renewalDate: null,
    status: 'active',
    ...overrides,
  };
}

function carPolicy(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    id: 'pol-car',
    agentId: 'agent-1',
    clientId: 'client-1',
    policyType: 'car',
    destination: null,
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    renewalDate: '2026-12-01',
    status: 'active',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
describe('timezone helpers', () => {
  it('buildSgtInstant converts SGT wall-clock to the correct UTC instant', () => {
    // 08:00 SGT == 00:00 UTC the same day
    expect(buildSgtInstant('2026-06-10', 8).toISOString()).toBe('2026-06-10T00:00:00.000Z');
    // 18:00 SGT == 10:00 UTC
    expect(buildSgtInstant('2026-06-20', 18).toISOString()).toBe('2026-06-20T10:00:00.000Z');
    // 09:00 SGT == 01:00 UTC
    expect(buildSgtInstant('2026-10-02', 9).toISOString()).toBe('2026-10-02T01:00:00.000Z');
  });

  it('buildSgtInstant rolls to previous UTC day when SGT hour < 8', () => {
    // 04:00 SGT == 20:00 UTC the PREVIOUS day
    expect(buildSgtInstant('2026-06-10', 4).toISOString()).toBe('2026-06-09T20:00:00.000Z');
  });

  it('subtractDays handles month and year boundaries', () => {
    expect(subtractDays('2026-12-01', 60)).toBe('2026-10-02');
    expect(subtractDays('2026-12-01', 30)).toBe('2026-11-01');
    expect(subtractDays('2026-12-01', 7)).toBe('2026-11-24');
    expect(subtractDays('2026-01-05', 7)).toBe('2025-12-29'); // year boundary
  });

  it('subtractDays crosses a leap day correctly', () => {
    // 2028 is a leap year; 60 days before 2028-04-01 lands on 2028-02-01
    expect(subtractDays('2028-04-01', 60)).toBe('2028-02-01');
  });

  it('makeIdempotencyKey is deterministic', () => {
    const a = makeIdempotencyKey('pol-1', 'renewal_30', '2026-11-01T01:00:00.000Z');
    const b = makeIdempotencyKey('pol-1', 'renewal_30', '2026-11-01T01:00:00.000Z');
    expect(a).toBe(b);
    expect(a).toBe('pol-1:renewal_30:2026-11-01T01:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
describe('scheduleForPolicy — travel', () => {
  it('schedules departure and return at the right SGT times', () => {
    const r = scheduleForPolicy(travelPolicy(), NOW);
    expect(r.map((x) => x.messageType)).toEqual(['travel_departure', 'travel_return']);

    const dep = r.find((x) => x.messageType === 'travel_departure')!;
    const ret = r.find((x) => x.messageType === 'travel_return')!;
    expect(dep.scheduledAt).toBe('2026-06-10T00:00:00.000Z'); // 08:00 SGT
    expect(ret.scheduledAt).toBe('2026-06-20T10:00:00.000Z'); // 18:00 SGT
    expect(dep.templateName).toBe('travel_departure_v1');
    expect(ret.templateName).toBe('travel_return_v1');
  });

  it('sets a deterministic idempotency key per reminder', () => {
    const r = scheduleForPolicy(travelPolicy(), NOW);
    expect(r[0]!.idempotencyKey).toBe('pol-travel:travel_departure:2026-06-10T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
describe('scheduleForPolicy — car/home renewals', () => {
  it('schedules 60/30/7-day reminders at 09:00 SGT', () => {
    const r = scheduleForPolicy(carPolicy(), NOW);
    expect(r.map((x) => x.messageType)).toEqual(['renewal_60', 'renewal_30', 'renewal_7']);

    const byType = Object.fromEntries(r.map((x) => [x.messageType, x.scheduledAt]));
    expect(byType.renewal_60).toBe('2026-10-02T01:00:00.000Z'); // 60d before, 09:00 SGT
    expect(byType.renewal_30).toBe('2026-11-01T01:00:00.000Z');
    expect(byType.renewal_7).toBe('2026-11-24T01:00:00.000Z');
  });

  it('home policies behave identically to car', () => {
    const r = scheduleForPolicy(carPolicy({ id: 'pol-home', policyType: 'home' }), NOW);
    expect(r.map((x) => x.messageType)).toEqual(['renewal_60', 'renewal_30', 'renewal_7']);
  });

  it('throws if a car/home policy is missing a renewalDate (defensive guard)', () => {
    expect(() => scheduleForPolicy(carPolicy({ renewalDate: null }), NOW)).toThrow(/renewalDate/);
  });
});

// ---------------------------------------------------------------------------
describe('scheduleForPolicy — past-date skipping', () => {
  it('skips renewal reminders already in the past (policy added 20 days before renewal)', () => {
    // renewal 2026-12-01; "now" is 2026-11-15 -> only the 7-day (2026-11-24) is future.
    const now = new Date('2026-11-15T00:00:00.000Z');
    const r = scheduleForPolicy(carPolicy(), now);
    expect(r.map((x) => x.messageType)).toEqual(['renewal_7']);
  });

  it('skips a departure reminder in the past but keeps the future return', () => {
    // trip started yesterday, returns in the future
    const now = new Date('2026-06-15T00:00:00.000Z');
    const r = scheduleForPolicy(travelPolicy(), now);
    expect(r.map((x) => x.messageType)).toEqual(['travel_return']);
  });

  it('schedules nothing when every reminder is in the past', () => {
    const now = new Date('2027-01-01T00:00:00.000Z');
    expect(scheduleForPolicy(travelPolicy(), now)).toEqual([]);
    expect(scheduleForPolicy(carPolicy(), now)).toEqual([]);
  });

  it('treats an instant exactly equal to now as past (skipped)', () => {
    // renewal_7 fires 2026-11-24T01:00:00Z; set now to exactly that.
    const now = new Date('2026-11-24T01:00:00.000Z');
    const r = scheduleForPolicy(carPolicy(), now);
    expect(r.map((x) => x.messageType)).not.toContain('renewal_7');
  });
});

// ---------------------------------------------------------------------------
describe('scheduleForPolicy — inactive policies', () => {
  it('schedules nothing for a cancelled policy', () => {
    expect(scheduleForPolicy(travelPolicy({ status: 'cancelled' }), NOW)).toEqual([]);
  });
  it('schedules nothing for an expired policy', () => {
    expect(scheduleForPolicy(carPolicy({ status: 'expired' }), NOW)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('reconcileReminders — create (no existing rows)', () => {
  it('inserts every planned reminder', () => {
    const planned = scheduleForPolicy(carPolicy(), NOW);
    const res = reconcileReminders([], planned);
    expect(res.toInsert).toHaveLength(3);
    expect(res.toUpdate).toHaveLength(0);
    expect(res.toCancelIds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe('reconcileReminders — policy edit', () => {
  const planned = scheduleForPolicy(carPolicy(), NOW); // renewal 60/30/7 for 2026-12-01

  it('is a no-op when nothing changed', () => {
    const existing: ExistingReminder[] = planned.map((p, i) => ({
      id: `row-${i}`,
      policyId: p.policyId,
      messageType: p.messageType,
      scheduledAt: p.scheduledAt,
      status: 'pending',
    }));
    const res = reconcileReminders(existing, planned);
    expect(res.toInsert).toHaveLength(0);
    expect(res.toUpdate).toHaveLength(0);
    expect(res.toCancelIds).toHaveLength(0);
  });

  it('updates pending rows whose time shifted when the renewal date moves', () => {
    const existing: ExistingReminder[] = planned.map((p, i) => ({
      id: `row-${i}`,
      policyId: p.policyId,
      messageType: p.messageType,
      scheduledAt: p.scheduledAt,
      status: 'pending',
    }));
    // Renewal moves one month later -> all three times change.
    const moved = scheduleForPolicy(carPolicy({ renewalDate: '2027-01-01' }), NOW);
    const res = reconcileReminders(existing, moved);
    expect(res.toUpdate).toHaveLength(3);
    expect(res.toInsert).toHaveLength(0);
    expect(res.toCancelIds).toHaveLength(0);
    // update carries the fresh idempotency key
    const upd = res.toUpdate.find((u) => u.id === 'row-0')!;
    expect(upd.idempotencyKey).toContain('2026-11-02T01:00:00.000Z'); // 60d before 2027-01-01
  });

  it('never touches an already-sent reminder even if the time shifts', () => {
    const existing: ExistingReminder[] = [
      {
        id: 'row-sent',
        policyId: 'pol-car',
        messageType: 'renewal_60',
        scheduledAt: planned[0]!.scheduledAt,
        status: 'sent',
      },
      {
        id: 'row-pending',
        policyId: 'pol-car',
        messageType: 'renewal_30',
        scheduledAt: planned[1]!.scheduledAt,
        status: 'pending',
      },
    ];
    const moved = scheduleForPolicy(carPolicy({ renewalDate: '2027-01-01' }), NOW);
    const res = reconcileReminders(existing, moved);
    // sent row must NOT appear in updates
    expect(res.toUpdate.find((u) => u.id === 'row-sent')).toBeUndefined();
    // pending row is updated; renewal_7 has no existing row -> inserted
    expect(res.toUpdate.find((u) => u.id === 'row-pending')).toBeDefined();
    expect(res.toInsert.map((p) => p.messageType)).toContain('renewal_7');
  });

  it('cancels pending reminders that no longer apply after a travel->fewer-reminders edit', () => {
    // Existing travel policy had departure + return; edit shortens so departure is now past.
    const existing: ExistingReminder[] = [
      { id: 'dep', policyId: 'pol-travel', messageType: 'travel_departure', scheduledAt: '2026-06-10T00:00:00.000Z', status: 'pending' },
      { id: 'ret', policyId: 'pol-travel', messageType: 'travel_return', scheduledAt: '2026-06-20T10:00:00.000Z', status: 'pending' },
    ];
    const now = new Date('2026-06-15T00:00:00.000Z'); // departure now in the past
    const planned = scheduleForPolicy(travelPolicy(), now); // only travel_return survives
    const res = reconcileReminders(existing, planned);
    expect(res.toCancelIds).toEqual(['dep']);
    expect(res.toUpdate).toHaveLength(0); // return time unchanged
    expect(res.toInsert).toHaveLength(0);
  });

  it('revives a previously cancelled row via update rather than a duplicate insert', () => {
    // A reminder was cancelled, then the policy edit makes it valid again.
    const existing: ExistingReminder[] = [
      { id: 'row-cancelled', policyId: 'pol-car', messageType: 'renewal_60', scheduledAt: planned[0]!.scheduledAt, status: 'cancelled' },
    ];
    const res = reconcileReminders(existing, planned);
    // Must UPDATE the cancelled row (unique constraint forbids a 2nd insert), not insert.
    expect(res.toUpdate.map((u) => u.id)).toContain('row-cancelled');
    expect(res.toInsert.map((p) => p.messageType)).not.toContain('renewal_60');
  });
});

// ---------------------------------------------------------------------------
describe('reconcileReminders — policy cancellation', () => {
  it('cancels all pending reminders when the policy becomes inactive (planned=[])', () => {
    const existing: ExistingReminder[] = [
      { id: 'a', policyId: 'pol-car', messageType: 'renewal_60', scheduledAt: '2026-10-02T01:00:00.000Z', status: 'pending' },
      { id: 'b', policyId: 'pol-car', messageType: 'renewal_30', scheduledAt: '2026-11-01T01:00:00.000Z', status: 'sent' },
      { id: 'c', policyId: 'pol-car', messageType: 'renewal_7', scheduledAt: '2026-11-24T01:00:00.000Z', status: 'pending' },
    ];
    const planned = scheduleForPolicy(carPolicy({ status: 'cancelled' }), NOW); // []
    const res = reconcileReminders(existing, planned);
    expect(res.toCancelIds.sort()).toEqual(['a', 'c']); // 'b' already sent -> untouched
    expect(res.toInsert).toHaveLength(0);
    expect(res.toUpdate).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe('remindersToCancelForDeactivation — client deletion', () => {
  it('returns only pending reminder ids', () => {
    const existing: ExistingReminder[] = [
      { id: 'p1', policyId: 'x', messageType: 'renewal_60', scheduledAt: '', status: 'pending' },
      { id: 's1', policyId: 'x', messageType: 'renewal_30', scheduledAt: '', status: 'sent' },
      { id: 'f1', policyId: 'x', messageType: 'renewal_7', scheduledAt: '', status: 'failed' },
      { id: 'p2', policyId: 'y', messageType: 'travel_return', scheduledAt: '', status: 'pending' },
    ];
    expect(remindersToCancelForDeactivation(existing).sort()).toEqual(['p1', 'p2']);
  });

  it('returns nothing when there are no pending reminders', () => {
    const existing: ExistingReminder[] = [
      { id: 's1', policyId: 'x', messageType: 'renewal_30', scheduledAt: '', status: 'sent' },
    ];
    expect(remindersToCancelForDeactivation(existing)).toEqual([]);
  });
});

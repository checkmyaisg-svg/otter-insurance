import { z } from 'zod';

// A calendar date 'YYYY-MM-DD'. We keep dates as strings end-to-end (the DB
// columns are `date`), so no timezone ambiguity is introduced here.
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date (YYYY-MM-DD).');

const uuid = z.string().uuid();

// ----------------------------------------------------------------------------
// CLIENTS
// ----------------------------------------------------------------------------

export const clientCreateSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(200),
  // Raw phone; normalized to E.164 in the action via normalizeSgPhone.
  phone_number: z.string().trim().min(1, 'Phone number is required'),
  email: z
    .string()
    .trim()
    .email('Enter a valid email.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  birthday: dateString.optional().nullable(),
  preferred_platform: z
    .enum(['whatsapp', 'wechat', 'telegram'])
    .default('whatsapp'),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const clientUpdateSchema = clientCreateSchema.extend({
  id: uuid,
  expected_version: z.number().int().nonnegative(),
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

// ----------------------------------------------------------------------------
// POLICIES
// A discriminated union enforces the same shape the DB CHECK constraints do:
// travel carries a destination and NO renewal date; car/home carry a renewal
// date and NO destination. Validated here for friendly errors before the DB.
// ----------------------------------------------------------------------------

const travelPolicy = z.object({
  policy_type: z.literal('travel'),
  client_id: uuid,
  destination: z.string().trim().min(1, 'Destination is required for travel.'),
  start_date: dateString, // departure
  end_date: dateString, // return
});

const coveragePolicy = z.object({
  policy_type: z.enum(['car', 'home']),
  client_id: uuid,
  start_date: dateString, // policy start
  end_date: dateString, // policy end
  renewal_date: dateString, // required for car/home
});

const policyShape = z
  .discriminatedUnion('policy_type', [travelPolicy, coveragePolicy])
  .refine(
    (p) => p.end_date >= p.start_date,
    { message: 'End date cannot be before the start date.', path: ['end_date'] },
  );

export const policyCreateSchema = policyShape;

// For updates we also accept an explicit status (e.g. cancel a policy) plus the
// optimistic-lock version. Wrapped so the discriminated union still applies.
export const policyUpdateSchema = z.object({
  id: uuid,
  expected_version: z.number().int().nonnegative(),
  status: z.enum(['active', 'expired', 'cancelled']).default('active'),
  policy: policyShape,
});

export type PolicyCreateInput = z.infer<typeof policyCreateSchema>;
export type PolicyUpdateInput = z.infer<typeof policyUpdateSchema>;

// ----------------------------------------------------------------------------
// SCHEDULED MESSAGES (admin actions)
// ----------------------------------------------------------------------------

export const rescheduleSchema = z.object({
  id: uuid,
  scheduled_at: z.string().datetime({ message: 'Use an ISO datetime.' }),
});

export const cancelReminderSchema = z.object({ id: uuid });

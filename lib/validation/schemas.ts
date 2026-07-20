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
  occupation: z.string().trim().max(120).optional().nullable(),
  dependants: z.coerce.number().int().min(0).max(20).optional().nullable(),
});

export const interactionCreateSchema = z.object({
  client_id: uuid,
  interaction_type: z.enum(['call', 'meeting', 'whatsapp', 'email', 'note']),
  occurred_at: dateString.optional(), // defaults to today (SG) in the DB
  note: z.string().trim().max(1000).optional().nullable(),
});
export type InteractionCreateInput = z.infer<typeof interactionCreateSchema>;

export const clientUpdateSchema = clientCreateSchema.extend({
  id: uuid,
  expected_version: z.number().int().nonnegative(),
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

// ----------------------------------------------------------------------------
// POLICIES
// A discriminated union enforces the same shapes the DB CHECK constraints do,
// grouped by BEHAVIOR (see lib/policies/behavior.ts):
//   event (travel):              destination, no renewal
//   renewable (car/home/health): renewal required
//   protection (life/ci):        no renewal, optional end date
// Money fields are shared and OPTIONAL everywhere: partial data now beats
// perfect data never — reminders simply skip what they can't compute.
// ----------------------------------------------------------------------------

const riderSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sum_assured: z.number().positive().optional(),
});

// Shared, all-optional money/detail fields (V0.2).
const moneyFields = {
  insurer: z.string().trim().max(200).optional().or(z.literal('').transform(() => undefined)),
  policy_number: z.string().trim().max(100).optional().or(z.literal('').transform(() => undefined)),
  premium_amount: z.number().positive('Premium must be positive.').optional(),
  payment_mode: z.enum(['monthly', 'quarterly', 'semi_annual', 'annual', 'single']).optional(),
  sum_assured: z.number().positive('Sum assured must be positive.').optional(),
  riders: z.array(riderSchema).max(20).default([]),
};

const travelPolicy = z.object({
  policy_type: z.literal('travel'),
  client_id: uuid,
  destination: z.string().trim().min(1, 'Destination is required for travel.'),
  start_date: dateString, // departure
  end_date: dateString, // return
  ...moneyFields,
});

const renewablePolicy = z.object({
  policy_type: z.enum(['car', 'home', 'health']),
  client_id: uuid,
  start_date: dateString, // policy start
  end_date: dateString, // policy end
  renewal_date: dateString, // required for renewable behavior
  ...moneyFields,
});

const protectionPolicy = z.object({
  policy_type: z.enum(['life', 'ci']),
  client_id: uuid,
  start_date: dateString, // inception; anchors premium-due + anniversary
  end_date: dateString.optional(), // whole-life has none
  ...moneyFields,
});

const policyShape = z
  .discriminatedUnion('policy_type', [travelPolicy, renewablePolicy, protectionPolicy])
  .refine(
    (p) => !('end_date' in p) || !p.end_date || p.end_date >= p.start_date,
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

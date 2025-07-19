import { z } from 'zod';

// Schema for Address, a reusable component based on businessTypes.ts
const addressSchema = z.object({
  street: z.string().min(1, 'Street is required').max(255),
  city: z.string().min(1, 'City is required').max(100),
  state: z.literal('TX'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  county: z.string().min(1, 'County is required').max(100),
  type: z.enum(['residential', 'business', 'mailing']),
});

// Schema for Person, a reusable component
const personSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  address: addressSchema,
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().optional(),
});

// Schema for RegisteredAgent
const registeredAgentSchema = z.object({
  name: z.string().min(1, 'Registered agent name is required'),
  address: addressSchema,
  isIndividual: z.boolean(),
});

// Main schema for the BusinessFormationPayload
export const businessFormationPayloadSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(255),
  businessType: z.enum(['LLC', 'Corporation', 'Partnership']),
  owners: z.array(personSchema).min(1, 'At least one owner is required'),
  registeredAgent: registeredAgentSchema,
  businessAddress: addressSchema,
  mailingAddress: addressSchema.optional(),
  purpose: z.string().optional(),
  managementStructure: z.enum(['member_managed', 'manager_managed']).optional(),
  duration: z.string().optional(),
});


import { z } from 'zod';
import { Role, MembershipStatus } from '@prisma/client';

export const addMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name must not exceed 100 characters'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .toLowerCase(),
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'Please select a valid role (OWNER, ADMIN, MEMBER, or VIEWER)' }),
  }),
});

export const updateMemberRoleSchema = z.object({
  membershipId: z.string().min(1, 'Membership ID is required'),
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
});

export const updateMemberStatusSchema = z.object({
  membershipId: z.string().min(1, 'Membership ID is required'),
  status: z.nativeEnum(MembershipStatus, {
    errorMap: () => ({ message: 'Please select a valid membership status' }),
  }),
});

export const updateMemberSchema = z.object({
  membershipId: z.string().min(1, 'Membership ID is required'),
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(MembershipStatus).optional(),
});

export const removeMemberSchema = z.object({
  membershipId: z.string().min(1, 'Membership ID is required'),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type UpdateMemberStatusInput = z.infer<typeof updateMemberStatusSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

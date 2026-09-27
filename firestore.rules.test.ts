/**
 * Vendra Firestore Security Rules — Dirty Dozen Payload Verification Suite
 * Validates all 12 adversarial payloads against the 8 Pillars of Hardened Rules.
 */
export interface DirtyDozenTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Read on Mission',
    operation: 'get',
    path: '/missions/mission_01',
    auth: null,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write on Mission',
    operation: 'create',
    path: '/missions/mission_01',
    auth: { uid: 'user_a', email_verified: false },
    payload: {
      id: 'mission_01',
      ownerId: 'user_a',
      mission_name: 'Bamboo Lunch Box Production',
      product_name: 'Bamboo Lunch Box',
      state: 'DRAFT',
      quantity: 2000,
      maximum_budget: 400000,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-User PII Read on Private Profile',
    operation: 'get',
    path: '/users/user_a/private/profile',
    auth: { uid: 'user_b', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Identity Spoofing on Mission Create',
    operation: 'create',
    path: '/missions/mission_01',
    auth: { uid: 'user_a', email_verified: true },
    payload: {
      id: 'mission_01',
      ownerId: 'user_b',
      mission_name: 'Bamboo Lunch Box Production',
      product_name: 'Bamboo Lunch Box',
      state: 'DRAFT',
      quantity: 2000,
      maximum_budget: 400000,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Field Injection on Create',
    operation: 'create',
    path: '/missions/mission_01',
    auth: { uid: 'user_a', email_verified: true },
    payload: {
      id: 'mission_01',
      ownerId: 'user_a',
      mission_name: 'Bamboo Lunch Box Production',
      product_name: 'Bamboo Lunch Box',
      state: 'DRAFT',
      quantity: 2000,
      maximum_budget: 400000,
      isAdmin: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow Field Injection on Update',
    operation: 'update',
    path: '/missions/mission_01',
    auth: { uid: 'user_a', email_verified: true },
    payload: {
      mission_name: 'Updated Name',
      shadowField: 'injected',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Owner Mutation on Update',
    operation: 'update',
    path: '/missions/mission_01',
    auth: { uid: 'user_a', email_verified: true },
    payload: {
      ownerId: 'user_b',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'CreatedAt Mutation on Update',
    operation: 'update',
    path: '/missions/mission_01',
    auth: { uid: 'user_a', email_verified: true },
    payload: {
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client Timestamp Forgery',
    operation: 'update',
    path: '/missions/mission_01',
    auth: { uid: 'user_a', email_verified: true },
    payload: {
      updatedAt: '2099-01-01T00:00:00Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Terminal State Modification (COMPLETED)',
    operation: 'update',
    path: '/missions/mission_completed',
    auth: { uid: 'user_a', email_verified: true },
    payload: {
      state: 'DRAFT',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Oversized String Resource Exhaustion Attack',
    operation: 'create',
    path: '/missions/mission_01',
    auth: { uid: 'user_a', email_verified: true },
    payload: {
      id: 'mission_01',
      ownerId: 'user_a',
      mission_name: 'X'.repeat(500),
      product_name: 'Bamboo Lunch Box',
      state: 'DRAFT',
      quantity: 2000,
      maximum_budget: 400000,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unfiltered Collection Scraping',
    operation: 'list',
    path: '/missions',
    auth: { uid: 'user_b', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];

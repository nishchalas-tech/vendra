/**
 * Firebase Client & Firestore Error Handler (src/lib/firebase.ts)
 * Implements firebase-integration skill requirements:
 * - Static import of firebase-applet-config.json
 * - Boot connection validation via getDocFromServer
 * - Standardized handleFirestoreError with FirestoreErrorInfo JSON payload
 * - Optional Google Sign-In popup helper and Firestore mission/profile sync
 */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export async function syncUserProfileToFirestore(profile: {
  full_name: string;
  email: string;
  city: string;
  state: string;
}) {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;
  const path = `users/${currentUser.uid}/private/profile`;
  try {
    await setDoc(
      doc(db, 'users', currentUser.uid, 'private', 'profile'),
      {
        uid: currentUser.uid,
        full_name: profile.full_name.slice(0, 120),
        email: profile.email.slice(0, 254),
        city: (profile.city || 'Bengaluru').slice(0, 100),
        state: (profile.state || 'Karnataka').slice(0, 100),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('Missing or insufficient permissions'.toLowerCase())
    ) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function signInWithGooglePopup() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

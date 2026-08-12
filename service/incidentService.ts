import {
    addDoc,
    collection,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    Unsubscribe,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Incident } from '../types/schoolcom';

const INCIDENTS_COLLECTION = 'incidents';

// Helper internal untuk mengonversi Timestamp / String ke format jam YYYY-MM-DD HH:mm
const formatTimestamp = (rawTimestamp: any): string => {
  if (!rawTimestamp) return '';
  if (typeof rawTimestamp === 'string') return rawTimestamp;
  if (rawTimestamp instanceof Timestamp) {
    const date = rawTimestamp.toDate();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
  return '';
};

// Helper internal untuk mapping dokumen Firestore ke type Incident
const mapIncidentDoc = (docSnap: any): Incident => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    studentId: data.studentId || '',
    category: data.category || 'Incident',
    priority: data.priority || 'Low',
    description: data.description || '',
    actionTaken: data.actionTaken || '',
    status: data.status || 'Pending',
    createdAt: formatTimestamp(data.createdAt),
    teacherName: data.teacherName || '',
    followUpLogs: (data.followUpLogs || []).map((log: any) => ({
      ...log,
      updatedAt: formatTimestamp(log.updatedAt),
    })),
  };
};

/**
 * Realtime Listener untuk insiden terbaru (Dashboard)
 */
export const subscribeToRecentIncidents = (
  callback: (incidents: Incident[]) => void,
  limitCount: number = 20
): Unsubscribe => {
  const q = query(
    collection(db, INCIDENTS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const incidents = snapshot.docs.map(mapIncidentDoc);
      callback(incidents);
    },
    (error) => {
      console.error('Error in subscribeToRecentIncidents:', error);
    }
  );
};

/**
 * Realtime Listener untuk insiden berdasarkan Student ID
 */
export const subscribeToStudentIncidents = (
  studentId: string,
  callback: (incidents: Incident[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, INCIDENTS_COLLECTION),
    where('studentId', '==', studentId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const incidents = snapshot.docs.map(mapIncidentDoc);
      callback(incidents);
    },
    (error) => {
      console.error('Error in subscribeToStudentIncidents:', error);
    }
  );
};

/**
 * Mengambil insiden terbaru (One-time fetch)
 */
export const getRecentIncidents = async (
  limitCount: number = 10
): Promise<Incident[]> => {
  const q = query(
    collection(db, INCIDENTS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapIncidentDoc);
};

/**
 * Mengambil seluruh riwayat insiden siswa tertentu (One-time fetch)
 */
export const getIncidentsByStudent = async (
  studentId: string
): Promise<Incident[]> => {
  const q = query(
    collection(db, INCIDENTS_COLLECTION),
    where('studentId', '==', studentId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapIncidentDoc);
};

/**
 * Menambahkan insiden/catatan observasi baru
 */
export const addIncident = async (
  incidentData: Omit<Incident, 'id' | 'createdAt'>
): Promise<string> => {
  const docRef = await addDoc(collection(db, INCIDENTS_COLLECTION), {
    ...incidentData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Memperbarui status insiden, tindakan guru, atau menambah followUpLogs
 */
export const updateIncident = async (
  incidentId: string,
  data: Partial<Omit<Incident, 'id'>>
): Promise<void> => {
  const docRef = doc(db, INCIDENTS_COLLECTION, incidentId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};
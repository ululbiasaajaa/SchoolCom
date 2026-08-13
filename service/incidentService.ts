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
import { Incident, StatusType } from '../types/schoolcom';

const INCIDENTS_COLLECTION = 'incidents';

// Helper internal sanitasi status
const getSafeStatus = (raw: any): StatusType => {
  const s = (raw || '').toString();
  return ['Pending', 'Follow-up', 'Resolved'].includes(s) ? (s as StatusType) : 'Pending';
};

// Helper internal untuk mengonversi Timestamp / String / Null ke format YYYY-MM-DD HH:mm
const formatTimestamp = (rawTimestamp: any): string => {
  if (!rawTimestamp) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
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

// Helper internal untuk mapping dokumen Firestore ke type Incident (Safe Mapper)
const mapIncidentDoc = (docSnap: any): Incident => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    studentId: data.studentId || '',
    category: data.category || 'Incident',
    priority: data.priority || 'Low',
    description: data.description || '',
    actionTaken: data.actionTaken || '',
    status: getSafeStatus(data.status), // Pure & Clean Sanitized Status
    createdAt: formatTimestamp(data.createdAt),
    teacherName: data.teacherName || 'Guru',
    followUpLogs: (data.followUpLogs || [])
      .filter((log: any) => log.note && log.note.trim().length > 0) // Filter ghost log kosongan
      .map((log: any) => ({
        ...log,
        note: log.note || '',
        author: log.author || 'Guru',
        date: log.date || formatTimestamp(log.updatedAt || log.createdAt),
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
    { includeMetadataChanges: false },
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
    where('studentId', '==', studentId)
  );

  return onSnapshot(
    q,
    { includeMetadataChanges: false },
    (snapshot) => {
      const incidents = snapshot.docs
        .map(mapIncidentDoc)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    where('studentId', '==', studentId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(mapIncidentDoc)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/**
 * Menambahkan insiden/catatan observasi baru
 */
export const addIncident = async (
  incidentData: Omit<Incident, 'id' | 'createdAt'>
): Promise<string> => {
  const docRef = await addDoc(collection(db, INCIDENTS_COLLECTION), {
    ...incidentData,
    status: getSafeStatus(incidentData.status), // Kunci status agar selalu valid
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
  const payload: any = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  // Jika payload mengirim status, sanitasi dulu sebelum dikirim ke Firestore
  if (data.status) {
    payload.status = getSafeStatus(data.status);
  }

  await updateDoc(docRef, payload);
};
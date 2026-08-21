import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  DocumentData,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  FollowUpLog,
  Incident,
  NewIncidentInput,
  StatusType,
} from '../types/schoolcom';

const INCIDENTS_COLLECTION = 'incidents';

// Helper internal sanitasi status
const getSafeStatus = (raw: unknown): StatusType => {
  const s = (raw || '').toString();
  return ['Pending', 'Follow-up', 'Resolved'].includes(s) ? (s as StatusType) : 'Pending';
};

// Helper internal untuk mengonversi Timestamp / String / Null ke format YYYY-MM-DD HH:mm
const formatTimestamp = (rawTimestamp: unknown): string => {
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

// Helper internal untuk mengonversi ke format YYYY-MM-DD saja
const formatDateOnly = (rawTimestamp: unknown): string => {
  const full = formatTimestamp(rawTimestamp);
  return full.split(' ')[0] || full;
};

// Helper internal untuk mapping dokumen Firestore ke type Incident (Safe Mapper)
const mapIncidentDoc = (docSnap: QueryDocumentSnapshot<DocumentData>): Incident => {
  const data = docSnap.data();
  const rawFollowUps = (data.followUpLogs || []) as Partial<FollowUpLog>[];

  const sanitizedFollowUps: FollowUpLog[] = rawFollowUps
    .filter((log) => typeof log.note === 'string' && log.note.trim().length > 0)
    .map((log) => ({
      id: log.id || '',
      note: log.note || '',
      author: log.author || 'Guru',
      date: log.date || formatTimestamp(log.updatedAt || log.createdAt),
      createdAt: log.createdAt ? formatTimestamp(log.createdAt) : undefined,
      updatedAt: formatTimestamp(log.updatedAt),
    }));

  return {
    id: docSnap.id,
    studentId: data.studentId || '',
    studentName: data.studentName || undefined,
    className: data.className || undefined,
    date: data.date || formatDateOnly(data.createdAt),
    category: data.category || 'Incident',
    priority: data.priority || 'Low',
    description: data.description || '',
    actionTaken: data.actionTaken || '',
    status: getSafeStatus(data.status),
    createdAt: formatTimestamp(data.createdAt),
    updatedAt: data.updatedAt ? formatTimestamp(data.updatedAt) : undefined,
    teacherName: data.teacherName || 'Guru',
    followUpLogs: sanitizedFollowUps,
  };
};

/**
 * Realtime Listener untuk insiden terbaru (Dashboard Admin/Teacher) - Hardened 19.1 (Limit 50)
 */
export const subscribeToRecentIncidents = (
  callback: (incidents: Incident[]) => void,
  limitCount: number = 50
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
    (error: unknown) => {
      console.error('Error in subscribeToRecentIncidents:', error);
    }
  );
};

/**
 * Realtime Listener untuk insiden berdasarkan Single Student ID
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
    (error: unknown) => {
      console.error('Error in subscribeToStudentIncidents:', error);
    }
  );
};

/**
 * Realtime Listener Multi-Student untuk Parent Portal (Mendukung Parent dengan > 1 anak)
 */
export const subscribeToIncidentsByStudentIds = (
  studentIds: string[],
  callback: (incidents: Incident[]) => void
): Unsubscribe => {
  if (!studentIds || studentIds.length === 0) {
    callback([]);
    return () => {};
  }

  // Warning & Slice untuk limitasi Firestore 'in' query (maksimal 10 items)
  if (studentIds.length > 10) {
    console.warn(
      `[subscribeToIncidentsByStudentIds] Parent memiliki ${studentIds.length} anak. Hanya 10 anak pertama yang diproses oleh query Firestore.`
    );
  }

  const targetIds = studentIds.slice(0, 10);
  const q = query(
    collection(db, INCIDENTS_COLLECTION),
    where('studentId', 'in', targetIds)
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
    (error: unknown) => {
      console.error('Error in subscribeToIncidentsByStudentIds:', error);
      callback([]);
    }
  );
};

/**
 * Mengambil insiden terbaru (One-time fetch)
 */
export const getRecentIncidents = async (
  limitCount: number = 50
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
 * Menambahkan insiden/catatan observasi baru dengan Strict Payload Guard
 */
export const addIncident = async (
  inputData: NewIncidentInput
): Promise<string> => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const payload = {
    studentId: inputData.studentId,
    studentName: inputData.studentName,
    className: inputData.className, // Mandatory untuk Firestore Rules scoping
    date: inputData.date || todayStr,
    category: inputData.category,
    priority: inputData.priority,
    description: inputData.description,
    actionTaken: inputData.actionTaken || '',
    status: getSafeStatus(inputData.status || 'Pending'),
    teacherName: inputData.teacherName,
    followUpLogs: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, INCIDENTS_COLLECTION), payload);
  return docRef.id;
};

/**
 * Memperbarui status insiden saja secara eksplisit
 */
export const updateIncidentStatus = async (
  incidentId: string,
  status: StatusType
): Promise<void> => {
  const docRef = doc(db, INCIDENTS_COLLECTION, incidentId);
  await updateDoc(docRef, {
    status: getSafeStatus(status),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Menambahkan followUpLog baru secara ATOMIC menggunakan arrayUnion()
 * (Bisa sekaligus memperbarui status jika updatedStatus di-pass)
 */
export const addFollowUpLog = async (
  incidentId: string,
  newLog: FollowUpLog,
  updatedStatus?: StatusType
): Promise<void> => {
  const docRef = doc(db, INCIDENTS_COLLECTION, incidentId);
  const payload: Record<string, unknown> = {
    followUpLogs: arrayUnion(newLog),
    updatedAt: serverTimestamp(),
  };

  if (updatedStatus) {
    payload.status = getSafeStatus(updatedStatus);
  }

  await updateDoc(docRef, payload);
};
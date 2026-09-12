/**
 * FONDASI MULTI-SEKOLAH (disiapkan, belum diaktifkan sebagai fitur).
 *
 * Sekarang cuma ada 1 sekolah, jadi semua data distempel dengan ID tetap ini.
 * Begitu ada Sekolah B beneran mau pakai SchoolCom, langkahnya:
 * 1. Generate schoolId baru buat Sekolah B (bukan string hardcode lagi, misal dari
 *    dokumen 'schools/{schoolId}' yang baru).
 * 2. Ubah titik-titik yang sekarang pakai PILOT_SCHOOL_ID supaya ambil schoolId dari
 *    profil user yang login (currentUser.schoolId), bukan konstanta ini.
 * 3. BARU di titik itu, tambahin filter `where('schoolId', '==', ...)` di query-query
 *    yang sekarang masih baca collection secara global, dan tambahin pengecekan
 *    schoolId di firestore.rules.
 *
 * Sebelum ada Sekolah B beneran, JANGAN buru-buru ngerjain langkah 2-3 di atas —
 * itu nambah kompleksitas nyata buat masalah yang belum ada. Cukup pastikan field
 * `schoolId` konsisten ada di semua data BARU yang dibuat, biar migrasinya nanti
 * gampang (tinggal ganti sumber nilainya, bukan nambahin field baru ke jutaan
 * dokumen lama kayak yang kita alamin waktu `classId` kemarin).
 */
export const PILOT_SCHOOL_ID = 'pilot-school';
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Student } from '../../types/schoolcom';

interface StudentListViewProps {
  students: Student[];
  onSelectStudent?: (studentId: string) => void;
}

// 1. Komponen Item Row Terpisah yang Di-memoize untuk Mencegah Re-render Masif Saat Typing Search
const StudentListItem = React.memo(
  ({
    student,
    onSelectStudent,
  }: {
    student: Student;
    onSelectStudent?: (studentId: string) => void;
  }) => {
    const rawGender = student.gender;
    const genderText = rawGender ? (rawGender === 'M' ? 'Laki-laki' : 'Perempuan') : null;
    const classText = student.className ? `Kelas ${student.className}` : null;
    const subTextParts = [classText, genderText, `ID: ${student.id}`].filter(Boolean);

    return (
      <TouchableOpacity
        style={styles.studentCard}
        onPress={() => onSelectStudent && onSelectStudent(student.id)}
        activeOpacity={onSelectStudent ? 0.7 : 1}
      >
        <Text style={styles.studentAvatar}>{student.avatar || '👦'}</Text>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.studentSub}>{subTextParts.join(' • ')}</Text>
        </View>
        {onSelectStudent && <Text style={styles.chevron}>›</Text>}
      </TouchableOpacity>
    );
  }
);

StudentListItem.displayName = 'StudentListItem';

export default function StudentListView({
  students,
  onSelectStudent,
}: StudentListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter siswa berdasarkan nama secara realtime (case-insensitive)
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    return students.filter((s: Student) =>
      s.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
  }, [students, searchQuery]);

  return (
    <View style={styles.container}>
      {/* Search Bar Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Cari nama siswa..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List / Empty State */}
      <ScrollView style={styles.listContent} showsVerticalScrollIndicator={false}>
        {filteredStudents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>Siswa Tidak Ditemukan</Text>
            <Text style={styles.emptySub}>
              {searchQuery.trim()
                ? `Tidak ada siswa yang cocok dengan kata kunci "${searchQuery}"`
                : 'Belum ada data siswa terdaftar.'}
            </Text>
          </View>
        ) : (
          filteredStudents.map((student: Student) => (
            <StudentListItem
              key={student.id}
              student={student}
              onSelectStudent={onSelectStudent}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: '#111827',
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  listContent: {
    flex: 1,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  studentAvatar: {
    fontSize: 24,
    marginRight: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  studentSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  emptySub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
});
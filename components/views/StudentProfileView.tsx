import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { CategoryType, Incident, StatusType, Student } from '../../types/schoolcom';
import { getStatusBadgeStyle } from '../../utils/badges';

interface StudentProfileViewProps {
  student: Student;
  studentIncidents: Incident[];
  onBack: () => void;
  onOpenWaModal: (student: Student, incident: Incident | null) => void;
  onOpenNewIncident: (studentId: string) => void;
  onOpenFollowUpModal: (incident: Incident) => void;
}

const CATEGORIES: ('All' | CategoryType)[] = ['All', 'Behavior', 'Academic', 'Health', 'Other'];
const STATUSES: ('All' | StatusType)[] = ['All', 'Pending', 'Follow-up', 'Resolved'];

export default function StudentProfileView({
  student,
  studentIncidents,
  onBack,
  onOpenWaModal,
  onOpenNewIncident,
  onOpenFollowUpModal,
}: StudentProfileViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All' | StatusType>('All');
  const [selectedCategory, setSelectedCategory] = useState<'All' | CategoryType>('All');

  // Filter & Sorting Incident Khusus Siswa Ini
  const filteredIncidents = useMemo(() => {
    let result = [...studentIncidents];

    if (selectedStatus !== 'All') {
      result = result.filter((i) => i.status === selectedStatus);
    }

    if (selectedCategory !== 'All') {
      result = result.filter((i) => i.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((i) => i.description.toLowerCase().includes(q));
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [studentIncidents, selectedStatus, selectedCategory, searchQuery]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Navigation Back */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>← Kembali ke Daftar Siswa</Text>
      </TouchableOpacity>

      {/* Profile Header Card */}
      <View style={styles.profileCard}>
        <Text style={styles.avatar}>{student.avatar || '👦'}</Text>
        <Text style={styles.studentName}>{student.name}</Text>
        <Text style={styles.studentSub}>
          {student.gender === 'M' ? 'Laki-laki' : 'Perempuan'} • NISN: {student.id}
        </Text>

        {/* Quick Action Button WhatsApp Ortu */}
        <TouchableOpacity
          style={styles.waBtn}
          onPress={() => onOpenWaModal(student, null)}
        >
          <Text style={styles.waBtnText}>💬 Hubungi Orang Tua (WhatsApp)</Text>
        </TouchableOpacity>
      </View>

      {/* Button Tambah Incident Khusus Siswa Ini */}
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => onOpenNewIncident(student.id)}
      >
        <Text style={styles.primaryBtnText}>+ Buat Catatan untuk {student.name}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionHeader}>Riwayat Catatan Siswa ({filteredIncidents.length})</Text>

      {/* Search Bar Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Cari dalam riwayat catatan..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => setSearchQuery('')}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Status Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {STATUSES.map((status) => {
          const isActive = selectedStatus === status;
          return (
            <TouchableOpacity
              key={status}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {status === 'All' ? 'Semua Status' : status}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Filter Kategori Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, isActive && styles.filterChipActiveCategory]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {cat === 'All' ? 'Semua Kategori' : cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List / Empty State */}
      {filteredIncidents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyText}>Tidak Ada Catatan Ditemukan</Text>
          <Text style={styles.emptySubText}>
            Belum ada riwayat catatan yang sesuai dengan filter pilihan Anda.
          </Text>
        </View>
      ) : (
        filteredIncidents.map((item) => {
          // Validasi & Sanitasi Status agar tidak bocor ID Firestore
          const rawStatus = (item.status || '').toString();
          const isValidStatus = ['Pending', 'Follow-up', 'Resolved'].includes(rawStatus);
          const safeStatus: StatusType = isValidStatus ? (rawStatus as StatusType) : 'Pending';

          const badge = getStatusBadgeStyle(safeStatus);

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => onOpenFollowUpModal(item)}
            >
              <View style={styles.cardRowBetween}>
                <Text style={styles.categoryBadge}>{item.category || 'Incident'}</Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>
                    {badge.symbol} {safeStatus}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardDesc}>{item.description}</Text>
              <Text style={styles.cardMeta}>
                Oleh: {item.teacherName || 'Guru'} • {item.createdAt}
              </Text>

              {/* Status Log Count */}
              {item.followUpLogs && item.followUpLogs.length > 0 && (
                <View style={styles.logContainer}>
                  <Text style={styles.logText}>
                    💬 {item.followUpLogs.length} Catatan Tindak Lanjut
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  backBtn: {
    marginBottom: 12,
  },
  backBtnText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatar: {
    fontSize: 48,
    marginBottom: 8,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  studentSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 12,
  },
  waBtn: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  waBtnText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    color: '#111827',
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  filterScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
  },
  filterChipActiveCategory: {
    backgroundColor: '#059669',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 13,
    color: '#1F2937',
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 11,
    color: '#6B7280',
  },
  logContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  logText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubText: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
});
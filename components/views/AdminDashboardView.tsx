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

interface AdminDashboardViewProps {
  students: Student[];
  incidents: Incident[];
  metrics: {
    totalObs: number;
    pending: number;
    followUp: number;
    resolved: number;
  };
}

const CATEGORIES: ('All' | CategoryType)[] = ['All', 'Behavior', 'Academic', 'Health', 'Other'];
const STATUSES: ('All' | StatusType)[] = ['All', 'Pending', 'Follow-up', 'Resolved'];

export default function AdminDashboardView({
  students,
  incidents,
  metrics,
}: AdminDashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All' | StatusType>('All');
  const [selectedCategory, setSelectedCategory] = useState<'All' | CategoryType>('All');

  // Filter & Sorting Incident untuk Admin
  const filteredIncidents = useMemo(() => {
    let result = [...incidents];

    // 1. Filter Status
    if (selectedStatus !== 'All') {
      result = result.filter((i) => {
        const rawStatus = (i.status || '').toString();
        const isValidStatus = ['Pending', 'Follow-up', 'Resolved'].includes(rawStatus);
        const safeStatus = isValidStatus ? rawStatus : 'Pending';
        return safeStatus === selectedStatus;
      });
    }

    // 2. Filter Kategori
    if (selectedCategory !== 'All') {
      result = result.filter((i) => i.category === selectedCategory);
    }

    // 3. Search berdasarkan Nama Siswa / Nama Guru / Deskripsi
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((i) => {
        const student = students.find((s) => s.id === i.studentId);
        const studentName = student?.name.toLowerCase() || '';
        const teacherName = i.teacherName?.toLowerCase() || '';
        const desc = i.description.toLowerCase();

        return studentName.includes(q) || teacherName.includes(q) || desc.includes(q);
      });
    }

    // 4. Sort Latest First
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [incidents, students, selectedStatus, selectedCategory, searchQuery]);

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Banner Admin */}
      <View style={styles.adminCard}>
        <Text style={styles.adminTitle}>Dashboard Kepala Sekolah / Admin</Text>
        <Text style={styles.adminSub}>Monitoring Keseluruhan Laporan & Aktivitas Guru</Text>
      </View>

      {/* Ringkasan Metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricVal}>{students.length}</Text>
          <Text style={styles.metricLbl}>Total Siswa</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricVal}>{metrics.totalObs}</Text>
          <Text style={styles.metricLbl}>Total Insiden</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: '#FEF3C7' }]}>
          <Text style={[styles.metricVal, { color: '#D97706' }]}>{metrics.pending}</Text>
          <Text style={styles.metricLbl}>Pending</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.metricVal, { color: '#059669' }]}>{metrics.resolved}</Text>
          <Text style={styles.metricLbl}>Resolved</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Semua Laporan Guru (Recent Reports)</Text>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Cari nama siswa, guru, atau catatan..."
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
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>Tidak Ada Laporan Ditemukan</Text>
          <Text style={styles.emptySubText}>
            Tidak ada data yang sesuai dengan pencarian atau filter pilihan Anda.
          </Text>
        </View>
      ) : (
        filteredIncidents.map((item) => {
          const student = students.find((s) => s.id === item.studentId);

          // Sanitasi & Validasi Status agar tidak bocor ID Firestore
          const rawStatus = (item.status || '').toString();
          const isValidStatus = ['Pending', 'Follow-up', 'Resolved'].includes(rawStatus);
          const safeStatus: StatusType = isValidStatus ? (rawStatus as StatusType) : 'Pending';

          const badge = getStatusBadgeStyle(safeStatus);

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardRowBetween}>
                <Text style={styles.studentNameCard}>
                  {student?.avatar || '👦'} {student?.name || 'Siswa'}
                </Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>
                    {badge.symbol} {safeStatus}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                Guru: {item.teacherName || 'Guru'} • {item.createdAt}
              </Text>
              <Text style={styles.cardDesc}>{item.description}</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
    padding: 16,
  },
  adminCard: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  adminTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  adminSub: {
    color: '#C7D2FE',
    fontSize: 12,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginHorizontal: 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  metricLbl: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
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
    height: 42,
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
    backgroundColor: '#4F46E5',
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
  },
  studentNameCard: {
    fontWeight: '700',
    fontSize: 14,
    color: '#111827',
  },
  cardMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#374151',
    marginTop: 6,
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
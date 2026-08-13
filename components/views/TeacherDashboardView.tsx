import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { CategoryType, Incident, StatusType, Student } from '../../types/schoolcom';
import { getStatusBadgeStyle } from '../../utils/badges';

interface TeacherDashboardViewProps {
  teacherName?: string;
  metrics: {
    totalObs: number;
    pending: number;
    followUp: number;
    resolved: number;
  };
  incidents: Incident[];
  students: Student[];
  onOpenNewIncident: () => void;
  onSelectStudent: (studentId: string) => void;
}

const CATEGORIES: ('All' | CategoryType)[] = ['All', 'Behavior', 'Academic', 'Health', 'Other'];
const STATUSES: ('All' | StatusType)[] = ['All', 'Pending', 'Follow-up', 'Resolved'];

export default function TeacherDashboardView({
  teacherName = 'Guru',
  metrics,
  incidents,
  students,
  onOpenNewIncident,
  onSelectStudent,
}: TeacherDashboardViewProps) {
  const [selectedStatus, setSelectedStatus] = useState<'All' | StatusType>('All');
  const [selectedCategory, setSelectedCategory] = useState<'All' | CategoryType>('All');

  // Filter & Sorting Incident (Latest First)
  const filteredIncidents = useMemo(() => {
    let result = [...incidents];

    // Filter berdasarkan Status
    if (selectedStatus !== 'All') {
      result = result.filter((i) => {
        const rawStatus = (i.status || '').toString();
        const isValidStatus = ['Pending', 'Follow-up', 'Resolved'].includes(rawStatus);
        const safeStatus = isValidStatus ? rawStatus : 'Pending';
        return safeStatus === selectedStatus;
      });
    }

    // Filter berdasarkan Kategori
    if (selectedCategory !== 'All') {
      result = result.filter((i) => i.category === selectedCategory);
    }

    // Sort berdasarkan createdAt terbaru
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [incidents, selectedStatus, selectedCategory]);

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Welcome Card */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Selamat Pagi, {teacherName} 👋</Text>
        <Text style={styles.welcomeSub}>TK Bintang Ceria • Kelas TK-A</Text>
      </View>

      {/* Ringkasan Metrics */}
      <Text style={styles.sectionHeader}>Ringkasan Catatan Siswa</Text>
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCard, { backgroundColor: '#F8FAFC' }]}>
          <Text style={styles.metricVal}>{metrics.totalObs}</Text>
          <Text style={styles.metricLbl}>Total Catatan</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: '#FEF3C7' }]}>
          <Text style={[styles.metricVal, { color: '#D97706' }]}>{metrics.pending}</Text>
          <Text style={styles.metricLbl}>🟡 Pending</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: '#DBEAFE' }]}>
          <Text style={[styles.metricVal, { color: '#2563EB' }]}>{metrics.followUp}</Text>
          <Text style={styles.metricLbl}>🔵 Follow-Up</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.metricVal, { color: '#059669' }]}>{metrics.resolved}</Text>
          <Text style={styles.metricLbl}>🟢 Resolved</Text>
        </View>
      </View>

      {/* Tombol Buat Catatan */}
      <TouchableOpacity style={styles.primaryBtn} onPress={onOpenNewIncident}>
        <Text style={styles.primaryBtnText}>+ Buat Catatan / Observasi Baru</Text>
      </TouchableOpacity>

      {/* Filter Section */}
      <Text style={styles.sectionHeader}>Aktivitas Terkini</Text>
      
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

      {/* Incident List / Empty State */}
      {filteredIncidents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>Tidak Ada Catatan Siswa</Text>
          <Text style={styles.emptySubText}>
            Tidak ada laporan yang cocok dengan filter yang Anda pilih.
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
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => onSelectStudent(item.studentId)}
            >
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
              <Text style={styles.cardMeta}>{item.category} • {item.createdAt}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            </TouchableOpacity>
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
  welcomeCard: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  welcomeSub: {
    color: '#93C5FD',
    fontSize: 12,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
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
    borderRadius: 8,
    marginHorizontal: 2,
    alignItems: 'center',
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
  primaryBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
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
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { Incident, StatusType, Student } from '../../types/schoolcom';

interface TeacherDashboardViewProps {
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
  getStatusBadgeStyle: (status: StatusType) => {
    bg: string;
    text: string;
    symbol: string;
  };
}

export default function TeacherDashboardView({
  metrics,
  incidents,
  students,
  onOpenNewIncident,
  onSelectStudent,
  getStatusBadgeStyle,
}: TeacherDashboardViewProps) {
  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Selamat Pagi, Bu Guru Ana 👋</Text>
        <Text style={styles.welcomeSub}>TK Bintang Ceria • Kelas TK-A</Text>
      </View>

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

      <TouchableOpacity style={styles.primaryBtn} onPress={onOpenNewIncident}>
        <Text style={styles.primaryBtnText}>+ Buat Catatan / Observasi Baru</Text>
      </TouchableOpacity>

      <Text style={styles.sectionHeader}>Aktivitas Terkini</Text>
      {incidents.slice(0, 3).map((item) => {
        const student = students.find((s) => s.id === item.studentId);
        const badge = getStatusBadgeStyle(item.status);

        return (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => onSelectStudent(item.studentId)}
          >
            <View style={styles.cardRowBetween}>
              <Text style={styles.studentNameCard}>{student?.avatar} {student?.name}</Text>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.text }]}>
                  {badge.symbol} {item.status}
                </Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>{item.category} • {item.createdAt}</Text>
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          </TouchableOpacity>
        );
      })}
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
    marginBottom: 16,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
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
});
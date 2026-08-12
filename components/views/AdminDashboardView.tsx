import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { Incident, StatusType, Student } from '../../types/schoolcom';

interface AdminDashboardViewProps {
  students: Student[];
  incidents: Incident[];
  metrics: {
    totalObs: number;
    pending: number;
    followUp: number;
    resolved: number;
  };
  getStatusBadgeStyle: (status: StatusType) => {
    bg: string;
    text: string;
    symbol: string;
  };
}

export default function AdminDashboardView({
  students,
  incidents,
  metrics,
  getStatusBadgeStyle,
}: AdminDashboardViewProps) {
  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.welcomeCardAdmin}>
        <Text style={styles.welcomeTitle}>Dashboard Kepala Sekolah / Admin</Text>
        <Text style={styles.welcomeSub}>Monitoring Keseluruhan Laporan</Text>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCardAdmin}>
          <Text style={styles.metricVal}>{students.length}</Text>
          <Text style={styles.metricLbl}>Total Siswa</Text>
        </View>
        <View style={styles.metricCardAdmin}>
          <Text style={styles.metricVal}>1</Text>
          <Text style={styles.metricLbl}>Total Guru</Text>
        </View>
        <View style={styles.metricCardAdmin}>
          <Text style={styles.metricVal}>{incidents.length}</Text>
          <Text style={styles.metricLbl}>Total Insiden</Text>
        </View>
        <View style={styles.metricCardAdmin}>
          <Text style={[styles.metricVal, { color: '#D97706' }]}>{metrics.pending}</Text>
          <Text style={styles.metricLbl}>Pending</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Semua Laporan Guru (Recent Reports)</Text>

      {incidents.map((item) => {
        const student = students.find((s) => s.id === item.studentId);
        const badge = getStatusBadgeStyle(item.status);

        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardRowBetween}>
              <Text style={styles.studentNameCard}>{student?.avatar} {student?.name}</Text>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.text }]}>{badge.symbol} {item.status}</Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>Guru: {item.teacherName} • {item.createdAt}</Text>
            <Text style={styles.cardDesc}>{item.description}</Text>
          </View>
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
  welcomeCardAdmin: {
    backgroundColor: '#4F46E5',
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
  metricCardAdmin: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
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
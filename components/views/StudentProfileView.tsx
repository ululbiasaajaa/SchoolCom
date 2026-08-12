import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { Incident, Student } from '../../types/schoolcom';
import { getPriorityBadgeStyle, getStatusBadgeStyle } from '../../utils/badges';

interface StudentProfileViewProps {
  student: Student;
  studentIncidents: Incident[];
  onBack: () => void;
  onOpenWaModal: (student: Student, incident?: Incident | null) => void;
  onOpenNewIncident: (studentId: string) => void;
  onOpenFollowUpModal: (incident: Incident) => void;
}

export default function StudentProfileView({
  student,
  studentIncidents,
  onBack,
  onOpenWaModal,
  onOpenNewIncident,
  onOpenFollowUpModal,
}: StudentProfileViewProps) {
  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>← Kembali ke Daftar Siswa</Text>
      </TouchableOpacity>

      <View style={styles.profileHeaderCard}>
        <View style={styles.profileAvatar}>
          <Text style={{ fontSize: 36 }}>{student.avatar}</Text>
        </View>
        <Text style={styles.profileName}>{student.name}</Text>
        <Text style={styles.profileMeta}>{student.className} • Lahir: {student.dob}</Text>

        <View style={styles.divider} />

        <Text style={styles.subSectionTitle}>Informasi Wali / Orang Tua</Text>
        {student.parents.map((p, idx) => (
          <View key={idx} style={styles.parentRow}>
            <View>
              <Text style={styles.parentName}>{p.name} ({p.relationship})</Text>
              <Text style={styles.parentPhone}>{p.phone}</Text>
            </View>
            <TouchableOpacity
              style={styles.waBtnSmall}
              onPress={() => onOpenWaModal(student)}
            >
              <Text style={styles.waBtnTextSmall}>Hubungi WA</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => onOpenNewIncident(student.id)}
      >
        <Text style={styles.secondaryBtnText}>+ Tambah Catatan untuk Siswa Ini</Text>
      </TouchableOpacity>

      <Text style={styles.sectionHeader}>Riwayat Observasi & Insiden</Text>

      {studentIncidents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Belum ada catatan untuk siswa ini.</Text>
        </View>
      ) : (
        studentIncidents.map((inc) => {
          const badge = getStatusBadgeStyle(inc.status);
          const prioBadge = getPriorityBadgeStyle(inc.priority);

          return (
            <View key={inc.id} style={styles.timelineCard}>
              <View style={styles.cardRowBetween}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.badge, { backgroundColor: prioBadge.bg, marginRight: 6 }]}>
                    <Text style={[styles.badgeText, { color: prioBadge.text }]}>{inc.priority}</Text>
                  </View>
                  <Text style={styles.categoryTag}>{inc.category}</Text>
                </View>

                <TouchableOpacity onPress={() => onOpenFollowUpModal(inc)}>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.text }]}>
                      {badge.symbol} {inc.status} ✎
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <Text style={styles.timelineTime}>{inc.createdAt} oleh {inc.teacherName}</Text>
              <Text style={styles.timelineDesc}>{inc.description}</Text>

              {inc.actionTaken ? (
                <View style={styles.actionBox}>
                  <Text style={styles.actionLabel}>Tindakan Guru:</Text>
                  <Text style={styles.actionVal}>{inc.actionTaken}</Text>
                </View>
              ) : null}

              {inc.followUpLogs.length > 0 && (
                <View style={styles.followUpLogContainer}>
                  <Text style={styles.followUpLogTitle}>Catatan Tindak Lanjut:</Text>
                  {inc.followUpLogs.map((log) => (
                    <View key={log.id} style={styles.logItem}>
                      <Text style={styles.logNote}>• {log.note}</Text>
                      <Text style={styles.logTime}>{log.updatedAt}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.waLinkBtn}
                onPress={() => onOpenWaModal(student, inc)}
              >
                <Text style={styles.waLinkText}>💬 Laporkan Insiden Ini via WA</Text>
              </TouchableOpacity>
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
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 10,
  },
  secondaryBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 12,
  },
  secondaryBtnText: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 13,
  },
  cardRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  backBtn: {
    marginBottom: 12,
  },
  backBtnText: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 13,
  },
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  profileMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    width: '100%',
    marginVertical: 12,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  parentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  parentName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  parentPhone: {
    fontSize: 11,
    color: '#6B7280',
  },
  waBtnSmall: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  waBtnTextSmall: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryTag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  timelineTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  timelineDesc: {
    fontSize: 13,
    color: '#1F2937',
    marginTop: 8,
  },
  actionBox: {
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  actionVal: {
    fontSize: 12,
    color: '#1F2937',
  },
  followUpLogContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
  },
  followUpLogTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 4,
  },
  logItem: {
    marginBottom: 4,
  },
  logNote: {
    fontSize: 12,
    color: '#374151',
  },
  logTime: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  waLinkBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
  },
  waLinkText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
});
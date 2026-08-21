import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { CategoryType, PriorityType, Student } from '../../types/schoolcom';

interface NewIncidentModalProps {
  visible: boolean;
  students: Student[];
  initialStudentId?: string;
  onClose: () => void;
  onSave: (data: {
    studentId: string;
    category: CategoryType;
    priority: PriorityType;
    description: string;
    actionTaken: string;
  }) => Promise<void> | void;
}

const CATEGORIES: CategoryType[] = [
  'Observation',
  'Behavior',
  'Academic',
  'Social',
  'Incident',
  'Health',
  'Other',
];

const PRIORITIES: PriorityType[] = ['Low', 'Medium', 'High', 'Critical'];

export default function NewIncidentModal({
  visible,
  students,
  initialStudentId = '',
  onClose,
  onSave,
}: NewIncidentModalProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId);
  const [category, setCategory] = useState<CategoryType>('Behavior');
  const [priority, setPriority] = useState<PriorityType>('Medium');
  const [description, setDescription] = useState<string>('');
  const [actionTaken, setActionTaken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      setSelectedStudentId(initialStudentId || (students[0]?.id ?? ''));
      setCategory('Behavior');
      setPriority('Medium');
      setDescription('');
      setActionTaken('');
      setIsSubmitting(false);
    }
  }, [visible, initialStudentId, students]);

  const handleSave = async () => {
    if (!selectedStudentId) {
      Alert.alert('Peringatan', 'Pilih siswa terlebih dahulu.');
      return;
    }

    const trimmedDescription = description.trim();
    const trimmedAction = actionTaken.trim();

    if (!trimmedDescription) {
      Alert.alert('Peringatan', 'Deskripsi observasi/insiden wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        studentId: selectedStudentId,
        category,
        priority,
        description: trimmedDescription,
        actionTaken: trimmedAction,
      });
    } catch (error: unknown) {
      console.error('Error submitting incident:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityStyle = (prio: PriorityType, isSelected: boolean) => {
    if (!isSelected) return styles.gridChip;
    switch (prio) {
      case 'Critical':
        return [styles.gridChip, styles.chipCritical];
      case 'High':
        return [styles.gridChip, styles.chipHigh];
      case 'Medium':
        return [styles.gridChip, styles.chipMedium];
      case 'Low':
      default:
        return [styles.gridChip, styles.chipLow];
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>+ Buat Catatan / Observasi Baru</Text>

          <ScrollView style={styles.scrollForm} showsVerticalScrollIndicator={false}>
            {/* Pilih Siswa */}
            <Text style={styles.label}>Pilih Siswa *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
              {students.map((s: Student) => {
                const isSelected = s.id === selectedStudentId;
                return (
                  <TouchableOpacity
                    key={s.id}
                    disabled={isSubmitting}
                    style={[
                      styles.chip,
                      isSelected && styles.chipActive,
                      isSubmitting && styles.disabledOpacity,
                    ]}
                    onPress={() => setSelectedStudentId(s.id)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {s.avatar || '👦'} {s.name} ({s.className})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Kategori */}
            <Text style={styles.label}>Kategori *</Text>
            <View style={styles.rowGrid}>
              {CATEGORIES.map((cat) => {
                const isSelected = cat === category;
                return (
                  <TouchableOpacity
                    key={cat}
                    disabled={isSubmitting}
                    style={[
                      styles.gridChip,
                      isSelected && styles.gridChipActive,
                      isSubmitting && styles.disabledOpacity,
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Prioritas */}
            <Text style={styles.label}>Prioritas *</Text>
            <View style={styles.rowGrid}>
              {PRIORITIES.map((prio) => {
                const isSelected = prio === priority;
                return (
                  <TouchableOpacity
                    key={prio}
                    disabled={isSubmitting}
                    style={[
                      getPriorityStyle(prio, isSelected),
                      isSubmitting && styles.disabledOpacity,
                    ]}
                    onPress={() => setPriority(prio)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{prio}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Deskripsi (Hardened dengan maxLength 1000) */}
            <Text style={styles.label}>Deskripsi Observasi / Kejadian * (Maks. 1000 Karakter)</Text>
            <TextInput
              style={[styles.textArea, isSubmitting && styles.disabledOpacity]}
              placeholder="Contoh: Menangis karena rebutan mainan balok..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              maxLength={1000}
              value={description}
              onChangeText={setDescription}
              editable={!isSubmitting}
            />

            {/* Tindakan Awal (Hardened dengan maxLength 1000) */}
            <Text style={styles.label}>Tindakan Langsung Guru (Opsional - Maks. 1000 Karakter)</Text>
            <TextInput
              style={[styles.textArea, isSubmitting && styles.disabledOpacity]}
              placeholder="Contoh: Menenangkan dan mengajak bicara secara personal..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={2}
              maxLength={1000}
              value={actionTaken}
              onChangeText={setActionTaken}
              editable={!isSubmitting}
            />
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, isSubmitting && styles.disabledOpacity]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, isSubmitting && styles.disabledBtn]}
              onPress={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Simpan Catatan</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  scrollForm: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 10,
    marginBottom: 6,
  },
  pickerScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  rowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  gridChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipLow: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  chipMedium: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipHigh: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  chipCritical: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#111827',
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 13,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  disabledBtn: {
    backgroundColor: '#93C5FD',
  },
  disabledOpacity: {
    opacity: 0.6,
  },
});
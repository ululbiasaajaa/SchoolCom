import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import {
    CategoryType,
    PriorityType,
    Student,
} from '../../types/schoolcom';

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
  }) => void;
}

export default function NewIncidentModal({
  visible,
  students,
  initialStudentId = '',
  onClose,
  onSave,
}: NewIncidentModalProps) {
  const [formStudentId, setFormStudentId] = useState<string>('');
  const [formCategory, setFormCategory] = useState<CategoryType>('Observation');
  const [formPriority, setFormPriority] = useState<PriorityType>('Low');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formActionTaken, setFormActionTaken] = useState<string>('');

  // Reset form state saat modal dibuka
  useEffect(() => {
    if (visible) {
      setFormStudentId(initialStudentId || (students[0]?.id ?? ''));
      setFormCategory('Observation');
      setFormPriority('Low');
      setFormDescription('');
      setFormActionTaken('');
    }
  }, [visible, initialStudentId, students]);

  const handleSave = () => {
    if (!formDescription.trim()) {
      Alert.alert('Form Belum Lengkap', 'Mohon isi deskripsi catatan/insiden.');
      return;
    }

    onSave({
      studentId: formStudentId,
      category: formCategory,
      priority: formPriority,
      description: formDescription,
      actionTaken: formActionTaken,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Catatan Observasi / Insiden Baru</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>Pilih Siswa</Text>
            <View style={styles.pickerContainer}>
              {students.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, formStudentId === s.id && styles.chipActive]}
                  onPress={() => setFormStudentId(s.id)}
                >
                  <Text style={[styles.chipText, formStudentId === s.id && styles.chipTextActive]}>
                    {s.avatar} {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Kategori</Text>
            <View style={styles.pickerContainer}>
              {(['Observation', 'Behavior', 'Academic', 'Social', 'Incident', 'Other'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, formCategory === cat && styles.chipActive]}
                  onPress={() => setFormCategory(cat)}
                >
                  <Text style={[styles.chipText, formCategory === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Tingkat Prioritas</Text>
            <View style={styles.pickerContainer}>
              {(['Low', 'Medium', 'High'] as const).map((prio) => (
                <TouchableOpacity
                  key={prio}
                  style={[styles.chip, formPriority === prio && styles.chipActive]}
                  onPress={() => setFormPriority(prio)}
                >
                  <Text style={[styles.chipText, formPriority === prio && styles.chipTextActive]}>{prio}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Deskripsi Kejadian / Observasi</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Tuliskan catatan observasi atau insiden secara singkat..."
              multiline
              numberOfLines={3}
              value={formDescription}
              onChangeText={setFormDescription}
            />

            <Text style={styles.inputLabel}>Tindakan yang Sudah Dilakukan Guru</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Contoh: Menenangkan anak, memberi pertolongan pertama..."
              multiline
              numberOfLines={2}
              value={formActionTaken}
              onChangeText={setFormActionTaken}
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Simpan Catatan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 10,
    marginBottom: 6,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
  },
  chipActive: {
    backgroundColor: '#2563EB',
  },
  chipText: {
    fontSize: 12,
    color: '#4B5563',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  cancelBtnText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
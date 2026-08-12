import React, { useEffect, useState } from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { Incident, StatusType } from '../../types/schoolcom';

interface FollowUpModalProps {
  visible: boolean;
  incident: Incident | null;
  onClose: () => void;
  onSave: (updatedStatus: StatusType, updateNote: string) => void;
}

export default function FollowUpModal({
  visible,
  incident,
  onClose,
  onSave,
}: FollowUpModalProps) {
  const [updateStatus, setUpdateStatus] = useState<StatusType>('Pending');
  const [updateNote, setUpdateNote] = useState<string>('');

  // Set initial status dan clear note saat modal dibuka
  useEffect(() => {
    if (visible && incident) {
      setUpdateStatus(incident.status);
      setUpdateNote('');
    }
  }, [visible, incident]);

  const handleSave = () => {
    onSave(updateStatus, updateNote);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Update Status & Follow-Up</Text>

          <Text style={styles.inputLabel}>Ubah Status</Text>
          <View style={styles.pickerContainer}>
            {[
              { label: '🟡 Pending', val: 'Pending' as const },
              { label: '🔵 Follow-up', val: 'Follow-up' as const },
              { label: '🟢 Resolved', val: 'Resolved' as const },
            ].map((st) => (
              <TouchableOpacity
                key={st.val}
                style={[styles.chip, updateStatus === st.val && styles.chipActive]}
                onPress={() => setUpdateStatus(st.val)}
              >
                <Text style={[styles.chipText, updateStatus === st.val && styles.chipTextActive]}>
                  {st.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Tambah Catatan Tindak Lanjut Baru</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Tulis perkembangan terbaru atau hasil diskusi dengan orang tua..."
            multiline
            numberOfLines={3}
            value={updateNote}
            onChangeText={setUpdateNote}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Perbarui Status</Text>
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
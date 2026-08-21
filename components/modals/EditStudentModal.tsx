import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Import Types & Service
import { deleteStudent, updateStudent } from '../../service/studentService';
import { Student } from '../../types/schoolcom';

interface EditStudentModalProps {
  visible: boolean;
  student: Student | null;
  onClose: () => void;
}

const AVAILABLE_CLASSES = ['Kelas TK-A', 'Kelas TK-B', 'Kelas Playgroup'];

const EditStudentModal: React.FC<EditStudentModalProps> = ({ visible, student, onClose }) => {
  const [name, setName] = useState<string>('');
  const [className, setClassName] = useState<string>('Kelas TK-A');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [parentName, setParentName] = useState<string>('');
  const [parentPhone, setParentPhone] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Synchronize state when student object changes
  useEffect(() => {
    if (student) {
      setName(student.name || '');
      setClassName(student.className || 'Kelas TK-A');
      setGender(student.gender === 'F' ? 'F' : 'M');
      if (student.parents && student.parents.length > 0) {
        setParentName(student.parents[0].name || '');
        setParentPhone(student.parents[0].phone || '');
      } else {
        setParentName('');
        setParentPhone('');
      }
    }
  }, [student]);

  // UPDATE Siswa ke Cloud Firestore
  const handleUpdate = async () => {
    if (!student) return;
    if (!name.trim()) {
      Alert.alert('Validasi Gagal', 'Nama siswa wajib diisi!');
      return;
    }

    setIsLoading(true);
    try {
      await updateStudent(student.id, {
        name: name.trim(),
        className,
        avatar: gender === 'F' ? '👧' : '👦',
        gender,
        parents: parentName.trim()
          ? [{ name: parentName.trim(), phone: parentPhone.trim() || '-', relationship: 'Orang Tua / Wali' }]
          : [],
      });

      Alert.alert('Sukses', 'Data siswa berhasil diperbarui di database!');
      onClose();
    } catch (error: unknown) {
      console.error('Error updating student:', error);
      const err = error as { message?: string };
      Alert.alert('Gagal', err?.message || 'Terjadi kesalahan saat memperbarui data siswa.');
    } finally {
      setIsLoading(false);
    }
  };

  // DELETE Siswa dari Cloud Firestore
  const handleDelete = () => {
    if (!student) return;

    Alert.alert(
      'Konfirmasi Hapus Siswa',
      `Apakah Anda yakin ingin menghapus siswa "${student.name}"? Data yang dihapus tidak dapat dikembalikan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await deleteStudent(student.id);
              Alert.alert('Sukses', 'Data siswa berhasil dihapus dari database.');
              onClose();
            } catch (error: unknown) {
              console.error('Error deleting student:', error);
              const err = error as { message?: string };
              Alert.alert('Gagal', err?.message || 'Terjadi kesalahan saat menghapus data siswa.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!student) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header Modal & Tombol Hapus */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Data Siswa</Text>
            <TouchableOpacity 
              style={styles.deleteIconButton} 
              onPress={handleDelete} 
              disabled={isLoading}
            >
              <Text style={styles.deleteIconText}>🗑️ Hapus</Text>
            </TouchableOpacity>
          </View>

          {/* Form Inputs */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Nama Lengkap Siswa</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Contoh: Aisyah Putri"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Pindah / Alokasi Kelas</Text>
            <View style={styles.classRow}>
              {AVAILABLE_CLASSES.map((cls) => (
                <TouchableOpacity
                  key={cls}
                  style={[styles.classOptionBtn, className === cls && styles.classOptionBtnActive]}
                  onPress={() => setClassName(cls)}
                >
                  <Text style={[styles.classOptionText, className === cls && styles.classOptionTextActive]}>
                    {cls}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Jenis Kelamin</Text>
            <View style={styles.genderContainer}>
              <TouchableOpacity
                style={[styles.genderOptionBtn, gender === 'M' && styles.genderOptionBtnActive]}
                onPress={() => setGender('M')}
              >
                <Text style={[styles.genderOptionText, gender === 'M' && styles.genderOptionTextActive]}>
                  👦 Laki-laki
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.genderOptionBtn, gender === 'F' && styles.genderOptionBtnActive]}
                onPress={() => setGender('F')}
              >
                <Text style={[styles.genderOptionText, gender === 'F' && styles.genderOptionTextActive]}>
                  👧 Perempuan
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Nama Wali / Orang Tua</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Contoh: Ibu Aisyah"
              placeholderTextColor="#9CA3AF"
              value={parentName}
              onChangeText={setParentName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>No. WhatsApp Wali</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Contoh: 6281234567890"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={parentPhone}
              onChangeText={setParentPhone}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={onClose} 
              disabled={isLoading}
            >
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleUpdate} 
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default EditStudentModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  deleteIconButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteIconText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  formGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  classRow: {
    flexDirection: 'row',
    gap: 6,
  },
  classOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  classOptionBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  classOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  classOptionTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  genderOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  genderOptionBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  genderOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  genderOptionTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
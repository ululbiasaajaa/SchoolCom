import React, { useState } from 'react';
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
import { addStudent } from '../../service/studentService';

interface AddStudentModalProps {
  visible: boolean;
  onClose: () => void;
}

const AVAILABLE_CLASSES = ['Kelas TK-A', 'Kelas TK-B', 'Kelas Playgroup'];

const AddStudentModal: React.FC<AddStudentModalProps> = ({ visible, onClose }) => {
  const [name, setName] = useState('');
  const [className, setClassName] = useState('Kelas TK-A');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Validasi Gagal', 'Nama siswa wajib diisi!');
      return;
    }

    setLoading(true);
    try {
      await addStudent({
        name: name.trim(),
        className,
        avatar: gender === 'F' ? '👧' : '👦',
        gender,
        dob: '',
        parents: parentName
          ? [
              {
                name: parentName.trim(),
                phone: parentPhone.trim() || '-',
                relationship: 'Orang Tua / Wali',
              },
            ]
          : [],
      });

      Alert.alert('Sukses', 'Data siswa berhasil ditambahkan!');
      setName('');
      setParentName('');
      setParentPhone('');
      onClose();
    } catch (error: unknown) {
      const err = error as { message?: string };
      Alert.alert('Gagal', err?.message || 'Gagal menambahkan siswa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Tambah Siswa Baru</Text>

          <Text style={styles.label}>Nama Lengkap Siswa</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Budi Santoso"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Pilih Kelas</Text>
          <View style={styles.classRow}>
            {AVAILABLE_CLASSES.map((cls) => (
              <TouchableOpacity
                key={cls}
                style={[styles.classBtn, className === cls && styles.classActive]}
                onPress={() => setClassName(cls)}
              >
                <Text style={className === cls ? styles.textActive : styles.textInactive}>
                  {cls}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Jenis Kelamin</Text>
          <View style={styles.genderRow}>
            <TouchableOpacity
              style={[styles.genderBtn, gender === 'M' && styles.genderActive]}
              onPress={() => setGender('M')}
            >
              <Text style={gender === 'M' ? styles.textActive : styles.textInactive}>👦 Laki-laki</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.genderBtn, gender === 'F' && styles.genderActive]}
              onPress={() => setGender('F')}
            >
              <Text style={gender === 'F' ? styles.textActive : styles.textInactive}>👧 Perempuan</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Nama Wali / Orang Tua (Opsional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Bapak Budi"
            value={parentName}
            onChangeText={setParentName}
          />

          <Text style={styles.label}>No. WhatsApp Wali (Opsional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: 628123456789"
            keyboardType="phone-pad"
            value={parentPhone}
            onChangeText={setParentPhone}
          />

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Simpan</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AddStudentModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#1E293B',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  classRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  classBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    alignItems: 'center',
  },
  classActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 6,
  },
  genderBtn: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    alignItems: 'center',
  },
  genderActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  textActive: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  textInactive: {
    color: '#64748B',
    fontSize: 12,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    padding: 12,
    borderRadius: 8,
  },
  cancelText: {
    color: '#64748B',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
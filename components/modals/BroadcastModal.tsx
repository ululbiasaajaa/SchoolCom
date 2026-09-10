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
import { sendBroadcastNotification } from '../../service/pushNotificationService';
import { BroadcastTargetRole } from '../../types/schoolcom';

interface BroadcastModalProps {
  visible: boolean;
  onClose: () => void;
  adminName: string;
}

export default function BroadcastModal({ visible, onClose, adminName }: BroadcastModalProps) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState<BroadcastTargetRole>('all');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Form Belum Lengkap', 'Judul dan isi pengumuman wajib diisi.');
      return;
    }

    setIsSending(true);
    try {
      // FIX: sebelumnya fungsi ini gak pernah kasih tahu jumlah penerima asli,
      // jadi alert "Terkirim!" selalu muncul walau nyatanya 0 device yang nerima.
      const { recipientCount } = await sendBroadcastNotification(title.trim(), message.trim(), targetRole);

      if (recipientCount === 0) {
        Alert.alert(
          'Tidak Ada Penerima',
          'Pengumuman tidak terkirim ke siapa pun karena belum ada perangkat terdaftar untuk target ini.'
        );
      } else {
        Alert.alert(
          'Pengumuman Terkirim!',
          `Pengumuman "${title}" berhasil disiarkan ke ${recipientCount} perangkat pada target: ${
            targetRole === 'all' ? 'Semua Pengguna' : targetRole === 'parent' ? 'Orang Tua' : 'Guru'
          }.`
        );
      }

      // Reset form & tutup modal
      setTitle('');
      setMessage('');
      setTargetRole('all');
      onClose();
    } catch (error) {
      console.error('Gagal mengirim broadcast:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat mengirim pengumuman massal.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.modalTitle}>📢 Broadcast Pengumuman</Text>
          <Text style={styles.subTitle}>
            Kirim notifikasi pesan massal serentak ke seluruh aplikasi.
          </Text>

          {/* Form Judul */}
          <Text style={styles.label}>Judul Pengumuman</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Informasi Libur Semester"
            value={title}
            onChangeText={setTitle}
          />

          {/* Target Role Selector */}
          <Text style={styles.label}>Target Penerima</Text>
          <View style={styles.roleContainer}>
            {(['all', 'parent', 'teacher'] as BroadcastTargetRole[]).map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleChip,
                  targetRole === role && styles.roleChipActive,
                ]}
                onPress={() => setTargetRole(role)}
              >
                <Text
                  style={[
                    styles.roleChipText,
                    targetRole === role && styles.roleChipTextActive,
                  ]}
                >
                  {role === 'all' ? '🌐 Semua' : role === 'parent' ? '👨‍👩‍👧 Orang Tua' : '👨‍🏫 Guru'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form Pesan */}
          <Text style={styles.label}>Isi Pesan Pengumuman</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tuliskan detail pengumuman sekolah di sini..."
            multiline
            numberOfLines={4}
            value={message}
            onChangeText={setMessage}
          />

          {/* Action Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSending}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={isSending}>
              {isSending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.sendBtnText}>🚀 Kirim Sekarang</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  subTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1F2937',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  roleChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  roleChipTextActive: {
    color: '#2563EB',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#4B5563',
    fontWeight: '600',
  },
  sendBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
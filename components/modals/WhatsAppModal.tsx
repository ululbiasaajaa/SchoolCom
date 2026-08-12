import React, { useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { Incident, Parent, Student } from '../../types/schoolcom';

interface WhatsAppModalProps {
  visible: boolean;
  student: Student | null;
  incident: Incident | null;
  onClose: () => void;
}

export default function WhatsAppModal({
  visible,
  student,
  incident,
  onClose,
}: WhatsAppModalProps) {
  const [waSelectedParent, setWaSelectedParent] = useState<Parent | null>(null);
  const [waMessageDraft, setWaMessageDraft] = useState<string>('');

  // Auto-generate draft & set default parent saat modal dibuka
  useEffect(() => {
    if (visible && student && student.parents && student.parents.length > 0) {
      const defaultParent = student.parents[0];
      setWaSelectedParent(defaultParent);

      const now = new Date();
      const todayStr = `${now.getDate()} August ${now.getFullYear()}`;

      const defaultDraft = `Assalamu'alaikum Bapak/Ibu ${defaultParent.name}. Kami ingin menyampaikan informasi mengenai Ananda ${student.name} terkait kegiatan/kejadian pada ${todayStr}.\n\nCatatan: ${incident ? incident.description : 'Perkembangan harian di kelas.'}\n\nMohon dapat diperhatikan dan apabila diperlukan kami akan melakukan tindak lanjut. Terima kasih.`;

      setWaMessageDraft(defaultDraft);
    }
  }, [visible, student, incident]);

  const handleSendWhatsApp = () => {
    if (!waSelectedParent || !waSelectedParent.phone) {
      Alert.alert('Error', 'Nomor telepon wali tidak valid.');
      return;
    }

    let phone = waSelectedParent.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.slice(1);
    }

    const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(waMessageDraft)}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          const webUrl = `https://wa.me/${phone}?text=${encodeURIComponent(waMessageDraft)}`;
          return Linking.openURL(webUrl);
        }
      })
      .catch(() => Alert.alert('Error', 'Gagal membuka aplikasi WhatsApp.'));

    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Kirim Laporan via WhatsApp</Text>

          <Text style={styles.inputLabel}>Pilih Penerima (Orang Tua / Wali)</Text>
          {student?.parents.map((p, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.parentOption, waSelectedParent?.phone === p.phone && styles.parentOptionActive]}
              onPress={() => setWaSelectedParent(p)}
            >
              <Text style={styles.parentOptionText}>{p.name} ({p.relationship}) - {p.phone}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.inputLabel}>Draft Pesan (Dapat Diedit)</Text>
          <TextInput
            style={[styles.textArea, { height: 120 }]}
            multiline
            value={waMessageDraft}
            onChangeText={setWaMessageDraft}
          />

          <Text style={styles.waNotice}>
            * Aplikasi akan membuka WhatsApp. Anda tetap perlu menekan tombol Send di WhatsApp secara manual.
          </Text>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.waSubmitBtn} onPress={handleSendWhatsApp}>
              <Text style={styles.saveBtnText}>Buka WhatsApp</Text>
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
  waSubmitBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  parentOption: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 6,
  },
  parentOptionActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  parentOptionText: {
    fontSize: 12,
    color: '#111827',
  },
  waNotice: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 8,
  },
});
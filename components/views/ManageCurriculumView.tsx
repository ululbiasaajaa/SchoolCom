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

import {
  createCurriculumFramework,
  deleteCurriculumFramework,
  seedSDCurriculumTemplate,
  subscribeToAllCurriculum,
} from '../../service/curriculumService';
import { CurriculumDomainType, CurriculumFramework, EducationLevel } from '../../types/schoolcom';

const EDUCATION_LEVELS: EducationLevel[] = ['TK', 'SD', 'SMP', 'SMA'];
const DOMAIN_TYPES: { value: CurriculumDomainType; label: string }[] = [
  { value: 'aspek_perkembangan', label: 'Aspek Perkembangan (TK/PAUD)' },
  { value: 'mata_pelajaran', label: 'Mata Pelajaran (SD ke atas)' },
];

const LEVEL_BADGE_COLOR: Record<EducationLevel, { bg: string; text: string }> = {
  TK: { bg: '#FEF3C7', text: '#D97706' },
  SD: { bg: '#DBEAFE', text: '#2563EB' },
  SMP: { bg: '#E0E7FF', text: '#4338CA' },
  SMA: { bg: '#FCE7F3', text: '#BE185D' },
};

export default function ManageCurriculumView() {
  const [items, setItems] = useState<CurriculumFramework[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSeedingTemplate, setIsSeedingTemplate] = useState<boolean>(false);

  // Form Tambah CP
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [formLevel, setFormLevel] = useState<EducationLevel>('TK');
  const [formFase, setFormFase] = useState('Fase Fondasi');
  const [formDomainType, setFormDomainType] = useState<CurriculumDomainType>('aspek_perkembangan');
  const [formDomainName, setFormDomainName] = useState('');
  const [formCpDescription, setFormCpDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToAllCurriculum((fetchedItems) => {
      setItems(fetchedItems);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddCurriculum = async () => {
    if (!formDomainName.trim() || !formCpDescription.trim()) {
      Alert.alert('Form Belum Lengkap', 'Nama domain dan deskripsi CP wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createCurriculumFramework({
        educationLevel: formLevel,
        fase: formFase.trim(),
        domainType: formDomainType,
        domainName: formDomainName.trim(),
        cpDescription: formCpDescription.trim(),
      });
      setIsAddModalOpen(false);
      setFormDomainName('');
      setFormCpDescription('');
      Alert.alert('Sukses', 'Capaian Pembelajaran baru berhasil ditambahkan.');
    } catch (error) {
      console.error('Error creating curriculum framework:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat menambahkan CP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Phase 27: Load Template CP SD (Bukti Konsep)
  const handleLoadSDTemplate = () => {
    Alert.alert(
      'Muat Template CP Jenjang SD',
      'Ini akan menambahkan 7 mata pelajaran umum SD dengan deskripsi CP PLACEHOLDER (bukan CP resmi Kurikulum Merdeka) — tujuannya cuma bukti konsep bahwa struktur data siap menampung jenjang SD. Mata pelajaran yang sudah ada dengan nama sama TIDAK akan ditimpa/diduplikasi. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Muat Template',
          onPress: async () => {
            setIsSeedingTemplate(true);
            try {
              const result = await seedSDCurriculumTemplate();
              Alert.alert(
                'Template Dimuat',
                `${result.created} mata pelajaran SD baru ditambahkan.` +
                  (result.skippedExisting > 0
                    ? ` ${result.skippedExisting} dilewati karena sudah ada.`
                    : '') +
                  '\n\nPENTING: Deskripsi CP-nya masih placeholder — edit dulu isinya sesuai dokumen kurikulum resmi sebelum dipakai menilai siswa beneran.'
              );
            } catch (error) {
              console.error('Error loading SD template:', error);
              Alert.alert('Gagal', 'Terjadi kesalahan saat memuat template.');
            } finally {
              setIsSeedingTemplate(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (item: CurriculumFramework) => {
    Alert.alert(
      'Hapus Capaian Pembelajaran?',
      `Hapus CP "${item.domainName}" (${item.fase})? Mata pelajaran yang sudah ditautkan ke CP ini TIDAK ikut berubah, tapi tautannya jadi tidak valid.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCurriculumFramework(item.id);
            } catch (error) {
              console.error('Error deleting curriculum framework:', error);
              Alert.alert('Gagal', 'Terjadi kesalahan saat menghapus CP.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.tabContentFlex}>
      <View style={styles.actionHeaderRow}>
        <Text style={styles.sectionHeader}>Capaian Pembelajaran (CP)</Text>
        <TouchableOpacity style={styles.primaryActionBtn} onPress={() => setIsAddModalOpen(true)}>
          <Text style={styles.primaryActionBtnText}>+ Tambah CP</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.headerHint}>
        Daftar Capaian Pembelajaran per jenjang & domain. Setelah dibuat, CP bisa ditautkan
        ke mata pelajaran/aspek di menu "Konfigurasi Penilaian" supaya narasinya otomatis
        muncul di rapor PDF.
      </Text>

      <TouchableOpacity
        style={[styles.templateBtn, isSeedingTemplate && styles.templateBtnDisabled]}
        onPress={handleLoadSDTemplate}
        disabled={isSeedingTemplate}
      >
        {isSeedingTemplate ? (
          <ActivityIndicator color="#7C3AED" size="small" />
        ) : (
          <Text style={styles.templateBtnText}>
            📋 Muat Template CP Jenjang SD (Bukti Konsep)
          </Text>
        )}
      </TouchableOpacity>

      {isLoading ? (
        <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 24 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 8 }}>
          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Belum ada Capaian Pembelajaran terdaftar.</Text>
            </View>
          ) : (
            items.map((item) => {
              const badgeColor = LEVEL_BADGE_COLOR[item.educationLevel] || LEVEL_BADGE_COLOR.TK;
              return (
                <View key={item.id} style={styles.cpCard}>
                  <View style={styles.cardRowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.domainName}>{item.domainName}</Text>
                      <Text style={styles.faseText}>{item.fase}</Text>
                    </View>
                    <View style={[styles.levelBadge, { backgroundColor: badgeColor.bg }]}>
                      <Text style={[styles.levelBadgeText, { color: badgeColor.text }]}>
                        {item.educationLevel}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cpDescriptionText}>{item.cpDescription}</Text>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteBtnText}>Hapus</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* MODAL: TAMBAH CP BARU */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Tambah Capaian Pembelajaran</Text>

              <Text style={styles.inputLabel}>Jenjang Pendidikan:</Text>
              <View style={styles.levelSelectorRow}>
                {EDUCATION_LEVELS.map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[styles.levelSelectBtn, formLevel === level && styles.levelSelectBtnActive]}
                    onPress={() => setFormLevel(level)}
                  >
                    <Text
                      style={[
                        styles.levelSelectBtnText,
                        formLevel === level && styles.levelSelectBtnTextActive,
                      ]}
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Fase:</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Contoh: Fase Fondasi / Fase A"
                value={formFase}
                onChangeText={setFormFase}
              />

              <Text style={styles.inputLabel}>Tipe Domain:</Text>
              <View style={{ gap: 8, marginBottom: 8 }}>
                {DOMAIN_TYPES.map((dt) => (
                  <TouchableOpacity
                    key={dt.value}
                    style={[
                      styles.domainTypeOption,
                      formDomainType === dt.value && styles.domainTypeOptionActive,
                    ]}
                    onPress={() => setFormDomainType(dt.value)}
                  >
                    <Text
                      style={[
                        styles.domainTypeOptionText,
                        formDomainType === dt.value && styles.domainTypeOptionTextActive,
                      ]}
                    >
                      {formDomainType === dt.value ? '● ' : '○ '}
                      {dt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Nama Domain (Aspek/Mapel):</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Contoh: Nilai Agama dan Budi Pekerti / Matematika"
                value={formDomainName}
                onChangeText={setFormDomainName}
              />

              <Text style={styles.inputLabel}>Deskripsi Capaian Pembelajaran:</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                placeholder="Tuliskan narasi capaian pembelajaran sesuai fase & domain ini..."
                value={formCpDescription}
                onChangeText={setFormCpDescription}
                textAlignVertical="top"
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleAddCurriculum}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Simpan CP</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  templateBtn: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  templateBtnDisabled: {
    opacity: 0.6,
  },
  templateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
    textAlign: 'center',
  },
  tabContentFlex: {
    flex: 1,
    padding: 16,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerHint: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 16,
  },
  primaryActionBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cpCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  cardRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  domainName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  faseText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  cpDescriptionText: {
    fontSize: 12,
    color: '#374151',
    marginTop: 8,
    lineHeight: 17,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  deleteBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  deleteBtnText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 8,
    marginBottom: 4,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    color: '#111827',
    minHeight: 90,
  },
  levelSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  levelSelectBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  levelSelectBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  levelSelectBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  levelSelectBtnTextActive: {
    color: '#FFFFFF',
  },
  domainTypeOption: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F9FAFB',
  },
  domainTypeOptionActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  domainTypeOptionText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  domainTypeOptionTextActive: {
    color: '#2563EB',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: 'bold',
  },
  submitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
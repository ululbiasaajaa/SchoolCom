import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  saveAssessmentConfig,
  subscribeToAssessmentConfig,
} from '../../service/assessmentService';
import {
  AssessmentConfig,
  AssessmentPredicateConfig,
  AssessmentSubjectConfig,
} from '../../types/schoolcom';

interface AdminAssessmentConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

const ACADEMIC_YEARS = ['2025/2026', '2026/2027'];
const TERMS = ['Semester 1', 'Semester 2'];

export default function AdminAssessmentConfigModal({
  visible,
  onClose,
}: AdminAssessmentConfigModalProps) {
  // State Periode Aktif
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('2026/2027');
  const [selectedTerm, setSelectedTerm] = useState<string>('Semester 1');

  // State Data Config
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // State Draft Form Config
  const [predicates, setPredicates] = useState<AssessmentPredicateConfig[]>([]);
  const [subjects, setSubjects] = useState<AssessmentSubjectConfig[]>([]);

  // State Input Tambah Subject Baru
  const [newSubjectName, setNewSubjectName] = useState<string>('');
  const [newSubjectCategory, setNewSubjectCategory] = useState<string>('Akademik');
  const [newEnableNumeric, setNewEnableNumeric] = useState<boolean>(true);
  const [newEnablePredicate, setNewEnablePredicate] = useState<boolean>(true);
  const [newEnableNarrative, setNewEnableNarrative] = useState<boolean>(true);

  // State Input Tambah Predicate Baru
  const [newPredicateLabel, setNewPredicateLabel] = useState<string>('');

  // 1. Subscribe Realtime Config saat Modal Terbuka & Periode Berubah
  useEffect(() => {
    if (!visible) return;

    setIsLoading(true);
    const unsub = subscribeToAssessmentConfig(
      selectedAcademicYear,
      selectedTerm,
      (fetchedConfig) => {
        if (fetchedConfig) {
          setPredicates(fetchedConfig.predicates || []);
          setSubjects(fetchedConfig.subjects || []);
        } else {
          // Konfigurasi belum ada untuk periode ini -> set default kosong
          setPredicates([]);
          setSubjects([]);
        }
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [visible, selectedAcademicYear, selectedTerm]);

  // Handler Tambah Mata Pelajaran Baru
  const handleAddSubject = () => {
    if (!newSubjectName.trim()) {
      Alert.alert('Peringatan', 'Nama Mata Pelajaran / Aspek tidak boleh kosong.');
      return;
    }

    const newId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newSub: AssessmentSubjectConfig = {
      id: newId,
      name: newSubjectName.trim(),
      category: newSubjectCategory.trim() || 'General',
      fields: {
        enableNumeric: newEnableNumeric,
        enablePredicate: newEnablePredicate,
        enableNarrative: newEnableNarrative,
      },
    };

    setSubjects((prev) => [...prev, newSub]);
    setNewSubjectName('');
  };

  // Handler Hapus Subject dari Draft Config
  const executeRemoveSubject = (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  // Handler Confirmation Guard untuk Hapus Subject
  const handleRemoveSubject = (subject: AssessmentSubjectConfig) => {
    Alert.alert(
      'Hapus Mata Pelajaran?',
      `Apakah Anda yakin ingin menghapus mata pelajaran "${subject.name}" dari konfigurasi periode ${selectedAcademicYear} (${selectedTerm})?`,
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => executeRemoveSubject(subject.id),
        },
      ],
      { cancelable: true }
    );
  };

  // Handler Toggle Field Subject yang Sudah Ada
  const handleToggleSubjectField = (
    subjectId: string,
    fieldKey: 'enableNumeric' | 'enablePredicate' | 'enableNarrative'
  ) => {
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id === subjectId) {
          return {
            ...s,
            fields: {
              ...s.fields,
              [fieldKey]: !s.fields[fieldKey],
            },
          };
        }
        return s;
      })
    );
  };

  // Handler Tambah Predikat Baru
  const handleAddPredicate = () => {
    if (!newPredicateLabel.trim()) {
      Alert.alert('Peringatan', 'Label predikat tidak boleh kosong.');
      return;
    }

    const newId = `pred_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newPred: AssessmentPredicateConfig = {
      id: newId,
      label: newPredicateLabel.trim(),
    };

    setPredicates((prev) => [...prev, newPred]);
    setNewPredicateLabel('');
  };

  // Handler Hapus Predikat dari Draft Config
  const handleRemovePredicate = (id: string) => {
    setPredicates((prev) => prev.filter((p) => p.id !== id));
  };

  // Handler Simpan Konfigurasi ke Firestore
  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const docId = `${selectedAcademicYear}_${selectedTerm}`;
      const now = new Date();
      const timestampStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const configPayload: AssessmentConfig = {
        id: docId,
        academicYear: selectedAcademicYear,
        term: selectedTerm,
        predicates,
        subjects,
        updatedAt: timestampStr,
      };

      await saveAssessmentConfig(configPayload);
      Alert.alert('Sukses', `Konfigurasi penilaian ${selectedAcademicYear} (${selectedTerm}) berhasil disimpan!`);
      onClose();
    } catch (error: unknown) {
      console.error('Error saving assessment config:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan konfigurasi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header Modal */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>⚙️ Pengaturan Penilaian (Admin)</Text>
              <Text style={styles.modalSubTitle}>Kelola Matpel, Field, & Predikat Rapor</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Selector Periode */}
          <View style={styles.periodeContainer}>
            <Text style={styles.sectionLabel}>Pilih Periode Pengaturan:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {ACADEMIC_YEARS.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[styles.chip, selectedAcademicYear === year && styles.chipActive]}
                  onPress={() => setSelectedAcademicYear(year)}
                >
                  <Text style={[styles.chipText, selectedAcademicYear === year && styles.chipTextActive]}>
                    📅 {year}
                  </Text>
                </TouchableOpacity>
              ))}
              {TERMS.map((term) => (
                <TouchableOpacity
                  key={term}
                  style={[styles.chip, selectedTerm === term && styles.chipActiveTerm]}
                  onPress={() => setSelectedTerm(term)}
                >
                  <Text style={[styles.chipText, selectedTerm === term && styles.chipTextActive]}>
                    📌 {term}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Memuat data konfigurasi...</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
              {/* SECTION 1: DAFTAR PREDIKAT DINAMIS */}
              <View style={styles.cardSection}>
                <Text style={styles.sectionTitle}>1. Daftar Predikat Rapor Dinamis</Text>
                <Text style={styles.sectionSub}>Predikat yang dapat dipilih Guru saat mengisi rapor.</Text>

                {/* List Predikat Existing */}
                <View style={styles.predicateWrap}>
                  {predicates.length === 0 ? (
                    <Text style={styles.emptyText}>Belum ada predikat (Contoh: BSB, BSH, A, B, dll).</Text>
                  ) : (
                    predicates.map((p: AssessmentPredicateConfig) => (
                      <View key={p.id} style={styles.predicateTag}>
                        <Text style={styles.predicateTagText}>{p.label}</Text>
                        <TouchableOpacity onPress={() => handleRemovePredicate(p.id)}>
                          <Text style={styles.removeTagText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>

                {/* Input Tambah Predikat */}
                <View style={styles.addRow}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Tambah Predikat (misal: BSB / Sangat Baik)"
                    value={newPredicateLabel}
                    onChangeText={setNewPredicateLabel}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={handleAddPredicate}>
                    <Text style={styles.addBtnText}>+ Tambah</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* SECTION 2: DAFTAR MATA PELAJARAN / ASPEK */}
              <View style={styles.cardSection}>
                <Text style={styles.sectionTitle}>2. Mata Pelajaran & Config Field</Text>
                <Text style={styles.sectionSub}>Tentukan field yang aktif (Angka, Predikat, Narasi) per subjek.</Text>

                {/* List Subjek Existing */}
                {subjects.length === 0 ? (
                  <Text style={styles.emptyText}>Belum ada Mata Pelajaran / Aspek yang dikonfigurasi.</Text>
                ) : (
                  subjects.map((sub: AssessmentSubjectConfig) => (
                    <View key={sub.id} style={styles.subjectCard}>
                      <View style={styles.subjectHeaderRow}>
                        <View>
                          <Text style={styles.subjectName}>{sub.name}</Text>
                          <Text style={styles.subjectCategory}>Kategori: {sub.category}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.deleteSubBtn}
                          onPress={() => handleRemoveSubject(sub)}
                        >
                          <Text style={styles.deleteSubBtnText}>Hapus</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Toggles Field */}
                      <View style={styles.toggleRowContainer}>
                        <View style={styles.toggleItem}>
                          <Text style={styles.toggleLabel}>Angka</Text>
                          <Switch
                            value={sub.fields.enableNumeric}
                            onValueChange={() => handleToggleSubjectField(sub.id, 'enableNumeric')}
                            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                            thumbColor={sub.fields.enableNumeric ? '#2563EB' : '#F3F4F6'}
                          />
                        </View>
                        <View style={styles.toggleItem}>
                          <Text style={styles.toggleLabel}>Predikat</Text>
                          <Switch
                            value={sub.fields.enablePredicate}
                            onValueChange={() => handleToggleSubjectField(sub.id, 'enablePredicate')}
                            trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                            thumbColor={sub.fields.enablePredicate ? '#059669' : '#F3F4F6'}
                          />
                        </View>
                        <View style={styles.toggleItem}>
                          <Text style={styles.toggleLabel}>Narasi</Text>
                          <Switch
                            value={sub.fields.enableNarrative}
                            onValueChange={() => handleToggleSubjectField(sub.id, 'enableNarrative')}
                            trackColor={{ false: '#D1D5DB', true: '#DDD6FE' }}
                            thumbColor={sub.fields.enableNarrative ? '#7C3AED' : '#F3F4F6'}
                          />
                        </View>
                      </View>
                    </View>
                  ))
                )}

                {/* Form Tambah Subjek Baru */}
                <View style={styles.newSubjectBox}>
                  <Text style={styles.newSubjectBoxTitle}>+ Tambah Mata Pelajaran Baru</Text>

                  <TextInput
                    style={[styles.textInput, { marginBottom: 8 }]}
                    placeholder="Nama Matpel / Aspek (misal: Matematika / Motorik)"
                    value={newSubjectName}
                    onChangeText={setNewSubjectName}
                  />

                  <TextInput
                    style={[styles.textInput, { marginBottom: 10 }]}
                    placeholder="Kategori (misal: Akademik / Perkembangan)"
                    value={newSubjectCategory}
                    onChangeText={setNewSubjectCategory}
                  />

                  <Text style={styles.fieldToggleTitle}>Field Penilaian yang Aktif:</Text>
                  <View style={styles.toggleRowContainer}>
                    <TouchableOpacity
                      style={[styles.fieldOptionChip, newEnableNumeric && styles.fieldOptionChipActive]}
                      onPress={() => setNewEnableNumeric(!newEnableNumeric)}
                    >
                      <Text style={[styles.fieldOptionText, newEnableNumeric && styles.fieldOptionTextActive]}>
                        {newEnableNumeric ? '✓' : '+'} Angka
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.fieldOptionChip, newEnablePredicate && styles.fieldOptionChipActive]}
                      onPress={() => setNewEnablePredicate(!newEnablePredicate)}
                    >
                      <Text style={[styles.fieldOptionText, newEnablePredicate && styles.fieldOptionTextActive]}>
                        {newEnablePredicate ? '✓' : '+'} Predikat
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.fieldOptionChip, newEnableNarrative && styles.fieldOptionChipActive]}
                      onPress={() => setNewEnableNarrative(!newEnableNarrative)}
                    >
                      <Text style={[styles.fieldOptionText, newEnableNarrative && styles.fieldOptionTextActive]}>
                        {newEnableNarrative ? '✓' : '+'} Narasi
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.createSubBtn} onPress={handleAddSubject}>
                    <Text style={styles.createSubBtnText}>Tambahkan ke Daftar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}

          {/* Footer Save Button */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.saveConfigBtn, isSaving && styles.saveConfigBtnDisabled]}
              onPress={handleSaveConfig}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveConfigBtnText}>💾 Simpan Konfigurasi</Text>
              )}
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
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubTitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  closeBtnText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '700',
  },
  periodeContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: '#2563EB',
  },
  chipActiveTerm: {
    backgroundColor: '#059669',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
  },
  scrollArea: {
    padding: 16,
  },
  cardSection: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  sectionSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 10,
  },
  predicateWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  predicateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 6,
  },
  predicateTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  removeTagText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#111827',
  },
  addBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  subjectCard: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  subjectHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  subjectName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  subjectCategory: {
    fontSize: 11,
    color: '#6B7280',
  },
  deleteSubBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deleteSubBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  toggleRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  toggleItem: {
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 2,
  },
  newSubjectBox: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  newSubjectBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  fieldToggleTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
  },
  fieldOptionChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  fieldOptionChipActive: {
    backgroundColor: '#2563EB',
  },
  fieldOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  fieldOptionTextActive: {
    color: '#FFFFFF',
  },
  createSubBtn: {
    backgroundColor: '#059669',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  createSubBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  saveConfigBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveConfigBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  saveConfigBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
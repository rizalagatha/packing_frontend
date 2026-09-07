import React, {useState, useEffect} from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

const AddBazarCustomerModal = ({visible, onClose, onSaved, onSave}) => {
  const [nama, setNama] = useState('');
  const [hp, setHp] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setNama('');
      setHp('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!nama.trim()) {
      return Alert.alert('Perhatian', 'Nama pelanggan wajib diisi.');
    }

    setIsSaving(true);
    try {
      const newCustomer = await onSave(nama.trim(), hp.trim());
      onSaved(newCustomer);
      onClose();
    } catch (error) {
      Alert.alert(
        'Gagal',
        error.response?.data?.message || 'Gagal menyimpan pelanggan.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Pelanggan Baru</Text>
            <TouchableOpacity onPress={onClose} disabled={isSaving}>
              <Icon name="x" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Nama Pelanggan</Text>
          <TextInput
            style={styles.input}
            placeholder="Masukkan nama..."
            value={nama}
            onChangeText={setNama}
            editable={!isSaving}
          />

          <Text style={styles.label}>No. HP (opsional)</Text>
          <TextInput
            style={styles.input}
            placeholder="08xxxxxxxxxx"
            value={hp}
            onChangeText={setHp}
            keyboardType="phone-pad"
            editable={!isSaving}
          />

          <TouchableOpacity
            style={[styles.btnSave, isSaving && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnSaveText}>SIMPAN PELANGGAN</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {fontSize: 16, fontWeight: 'bold', color: '#333'},
  label: {fontSize: 12, color: '#666', marginBottom: 6, marginTop: 10},
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: '#333',
  },
  btnSave: {
    backgroundColor: '#E91E63',
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  btnDisabled: {opacity: 0.7},
  btnSaveText: {color: '#fff', fontWeight: 'bold', fontSize: 14},
});

export default AddBazarCustomerModal;

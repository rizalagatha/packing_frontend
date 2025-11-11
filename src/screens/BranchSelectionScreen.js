// File: src/screens/BranchSelectionScreen.js

import React, {useContext} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Feather';

const BranchSelectionScreen = () => {
  const {branches, finalizeLogin} = useContext(AuthContext);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F8" />
      <View style={styles.content}>
        <Icon name="briefcase" size={50} color="#616161" />
        <Text style={styles.title}>Pilih Cabang</Text>
        <Text style={styles.subtitle}>
          Pilih cabang tempat Anda akan bekerja untuk sesi ini.
        </Text>

        <FlatList
          data={branches}
          keyExtractor={item => item.kode}
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.branchButton}
              onPress={() => finalizeLogin(item.kode)}>
              <Text style={styles.branchCode}>{item.kode}</Text>
              <Text style={styles.branchName}>{item.nama}</Text>
            </TouchableOpacity>
          )}
          style={styles.list}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F4F6F8'},
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  title: {fontSize: 24, fontWeight: 'bold', color: '#212121', marginTop: 20},
  subtitle: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 30,
  },
  list: {width: '100%'},
  branchButton: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 2,
  },
  branchCode: {fontSize: 16, fontWeight: 'bold', color: '#212121'},
  branchName: {fontSize: 14, color: '#757575', marginTop: 4},
});

export default BranchSelectionScreen;

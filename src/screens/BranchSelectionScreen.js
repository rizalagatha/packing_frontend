import React, {useContext, useRef, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Feather';

const {width} = Dimensions.get('window');

// --- 1. BOUNCY BUTTON (FIXED useEffect Dependencies) ---
const BouncyButton = ({onPress, children, style, delay = 0, disabled}) => {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [delay, opacityAnim, slideAnim]); // <--- DEPENDENCY SUDAH DITAMBAHKAN

  const onPressIn = () => {
    if (!disabled)
      Animated.spring(scaleValue, {
        toValue: 0.96,
        useNativeDriver: true,
      }).start();
  };

  const onPressOut = () => {
    if (!disabled)
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }).start();
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={disabled ? null : onPress}>
      <Animated.View
        style={[
          style,
          {
            transform: [{scale: scaleValue}, {translateY: slideAnim}],
            opacity: opacityAnim,
          },
        ]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

// --- 2. BRANCH CARD ---
const BranchCard = ({item, onPress, index, isLoading, isOtherLoading}) => {
  const iconColors = ['#1E88E5', '#43A047', '#FB8C00', '#8E24AA'];
  const color = iconColors[index % iconColors.length];

  return (
    <BouncyButton
      style={[styles.cardContainer, isOtherLoading && {opacity: 0.5}]}
      onPress={onPress}
      delay={index * 100}
      disabled={isLoading || isOtherLoading}>
      <View style={[styles.iconContainer, {backgroundColor: `${color}15`}]}>
        <Icon name="map-pin" size={20} color={color} />
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.branchName}>{item.nama}</Text>
        <Text style={styles.branchCode}>Kode: {item.kode}</Text>
      </View>

      <View style={styles.arrowContainer}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#1565C0" />
        ) : (
          <Icon name="chevron-right" size={20} color="#B0BEC5" />
        )}
      </View>
    </BouncyButton>
  );
};

const BranchSelectionScreen = () => {
  // Pastikan 'logout' diambil dari sini
  const {branches, finalizeLogin, logout} = useContext(AuthContext);

  const [loadingBranchCode, setLoadingBranchCode] = useState(null);

  const handleSelectBranch = async kodeCabang => {
    setLoadingBranchCode(kodeCabang);
    try {
      await finalizeLogin(kodeCabang);
    } catch (error) {
      console.log('Error selecting branch:', error);
      Alert.alert('Gagal', 'Gagal memilih cabang. Silakan coba lagi.');
      setLoadingBranchCode(null);
    }
  };

  // Helper untuk memanggil logout dengan aman
  const handleLogout = () => {
    if (logout) {
      logout();
    } else {
      Alert.alert('Error', 'Fungsi logout tidak ditemukan di AuthContext.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      <View style={styles.header}>
        <View style={styles.headerIconBg}>
          <Icon name="briefcase" size={32} color="#1565C0" />
        </View>
        <Text style={styles.title}>Pilih Lokasi Kerja</Text>
        <Text style={styles.subtitle}>
          Tentukan cabang mana yang akan Anda kelola hari ini.
        </Text>
      </View>

      <FlatList
        data={branches}
        keyExtractor={item => item.kode}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        renderItem={({item, index}) => {
          const isThisLoading = loadingBranchCode === item.kode;
          const isAnyLoading = loadingBranchCode !== null;

          return (
            <BranchCard
              item={item}
              index={index}
              isLoading={isThisLoading}
              isOtherLoading={isAnyLoading && !isThisLoading}
              onPress={() => handleSelectBranch(item.kode)}
            />
          );
        }}
        ListFooterComponent={
          <View style={{marginTop: 40, alignItems: 'center'}}>
            <TouchableOpacity
              onPress={handleLogout} // Panggil fungsi wrapper
              style={styles.logoutBtn}
              disabled={loadingBranchCode !== null}>
              <Icon
                name="log-out"
                size={16}
                color="#D32F2F"
                style={{marginRight: 8}}
              />
              <Text style={styles.logoutText}>Bukan akun Anda? Keluar</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 30,
    paddingBottom: 20,
  },
  headerIconBg: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#1565C0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#37474F',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#78909C',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 10,
  },
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ECEFF1',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  branchName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#37474F',
    marginBottom: 4,
  },
  branchCode: {
    fontSize: 12,
    color: '#90A4AE',
    fontWeight: '500',
    backgroundColor: '#F5F7FA',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  arrowContainer: {
    marginLeft: 10,
    width: 20,
    alignItems: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15, // Padding diperbesar agar mudah diklik
  },
  logoutText: {
    color: '#D32F2F',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default BranchSelectionScreen;

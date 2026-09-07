import {useWindowDimensions} from 'react-native';

const TABLET_BREAKPOINT = 768;

export const useResponsive = () => {
  const {width, height} = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  return {
    width,
    height,
    isTablet,
    // Kolom grid: 2 di HP, 4 di tablet — dipakai di FlatList numColumns dsb
    columns: isTablet ? 4 : 2,
    // Skala font sederhana biar tidak kekecilan di layar besar
    scaleFont: size => (isTablet ? size * 1.15 : size),
    // Max width konten supaya tidak melebar penuh di tablet (biar tidak "kosong" di tengah)
    contentMaxWidth: isTablet ? 700 : '100%',
  };
};

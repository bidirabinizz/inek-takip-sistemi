import { useAuth } from '../context/AuthContext';

/**
 * Kullanıcının belirtilen izin anahtarına (permission_key)
 * sahip olup olmadığını kontrol eden özel hook.
 * 
 * @param {string} permissionKey - Kontrol edilecek izin anahtarı (örn: 'view_breeding')
 * @returns {boolean} - Yetkisi varsa true
 */
export function usePermission(permissionKey) {
    const { user, permissions } = useAuth();
    
    // Eğer kullanıcı yoksa izin de yoktur
    if (!user) return false;
    
    // Admin her zaman tam yetkilidir
    if (user.role === 'ADMIN') return true;
    
    // İzin listesinde var mı?
    return permissions.includes(permissionKey);
}

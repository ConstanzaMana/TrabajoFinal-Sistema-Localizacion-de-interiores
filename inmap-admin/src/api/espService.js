import { fetchConFallback } from './apiConfig.js';

export const espService = {
  /**
   * Obtiene el reporte en tiempo real de todos los dispositivos BLE
   * conectados al sistema.
   */
  getAll: async () => {
    try {
      // Realizam la petición al endpoint específico /reportWifi
      // fetchConFallback se encarga de adjuntar el token de administrador automáticamente
      return await fetchConFallback('/obtenerReporte', {
        method: 'GET'
      }, []);
    } catch (error) {
      console.error("Error al obtener el reporte de beacons:", error);
      // Retorna un arreglo vacío para que la tabla no se rompa si el servidor falla
      return [];
    }
  }
};
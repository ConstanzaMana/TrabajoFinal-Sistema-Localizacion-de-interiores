/**
 * Módulo que centraliza la comunicación con la api, gestionando
 * la seguridad mediante tokens y el control de sesiones activas.
 */
import axios from 'axios';
// URL base para las peticiones a la API del sistema en Render
export const API_BASE_URL = "https://restful-api-inmap.onrender.com";

axios.interceptors.response.use(
  function (response) {
    return response;
  },
  function (error) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("Sesión expirada o inválida. Redirigiendo al login...");
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// realiza peticiones http y usa datos locales en caso de fallo.
export const fetchConFallback = async (endpoint, options = {}, fallbackData = null) => {
  try {
    const controller = new AbortController();
    const idTiempo = setTimeout(() => controller.abort(), 15000);
    const method = (options.method || 'GET').toUpperCase();

    // Encabezados estándar para comunicación
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    /**
     * Inyecta token de seguridad en encabezados
     * se aplica automáticamente a métodos que modifican el estado del servidor.
     */
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
        const token = localStorage.getItem('adminToken');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        } else if (['POST', 'PUT', 'DELETE'].includes(method)) {
          console.warn(`petición ${method} sin credenciales de acceso.`);
        }

    }

    // ejecución de la petición a la api
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: headers
    });

    clearTimeout(idTiempo);

    /**
     * gestión de seguridad de la sesión.
     * si el servidor rechaza el acceso, se invalida el token local y se redirige al login.
     */
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
      throw new Error('sesión inválida o permisos insuficientes.');
    }

    // validación de respuesta exitosa del servidor
    if (!response.ok) {
      const errorDelServer = await response.text();
      throw new Error(errorDelServer || `error del servidor: ${response.status}`);
    }

    if (response.status === 204 || response.headers.get("content-length") === "0") {
        return null;
    }

    const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await response.json();
        } else {
          return await response.text();
        }

  } catch (error) {
    if (fallbackData !== null) {
        return fallbackData;
    }
    throw error;
  }
};
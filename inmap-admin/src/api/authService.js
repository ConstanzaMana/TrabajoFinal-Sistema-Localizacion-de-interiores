/**
 * servicios de autenticación y gestión de usuarios.
 * módulo que centraliza las peticiones de seguridad, incluyendo el
 * cambio de contraseña, registro y eliminación de perfiles.
 */
import axios from 'axios';
import { API_BASE_URL } from './apiConfig';

export const authService = {

  actualizarPassword: async (oldPassword, newPassword) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.post(`${API_BASE_URL}/actualizarPassword`, {
        oldPassword: oldPassword,
        newPassword: newPassword
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data && response.data.token) {
        localStorage.setItem('adminToken', response.data.token);
      }
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Error al actualizar la contraseña.');
    }
  },

  registrarUsuario: async (nuevoUsuario) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.post(`${API_BASE_URL}/register`, nuevoUsuario, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Error al crear el perfil de usuario.');
    }
  },

  eliminarUsuario: async (username) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.delete(`${API_BASE_URL}/eliminarUsuario/${username}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Error al eliminar el usuario.');
    }
  }
};
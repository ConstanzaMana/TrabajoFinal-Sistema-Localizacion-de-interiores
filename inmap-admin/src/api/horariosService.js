/**
 * Administra la lógica de Horarios, la asignación de materias
 * a espacios físicos y la vinculación de personal docente a dichas clases.
 */
import { fetchConFallback } from './apiConfig.js';

// almacenamiento temporal en memoria
let cacheAsignaciones = null;
let cacheHorariosBase = null;
let cacheEstas = null;

export const horariosService = {

  // Gestión de asignaciones (vínculo materia-horario-destino)
  getAll: async () => {
    if (cacheAsignaciones) return cacheAsignaciones;
    cacheAsignaciones = await fetchConFallback('/asignaciones', { method: 'GET' }, []);
    return cacheAsignaciones;
  },

  create: async (nuevo) => {
    const creado = await fetchConFallback('/guardarAsignacion', { method: 'POST', body: JSON.stringify(nuevo) }, null);
    cacheAsignaciones = null;
    return creado;
  },

  update: async (idAsignacion, datos) => {
    const actualizado = await fetchConFallback(`/actualizarAsignacion/${idAsignacion}`, { method: 'PUT', body: JSON.stringify(datos) }, null);
    cacheAsignaciones = null;
    return actualizado;
  },

  delete: async (idAsignacion) => {
    await fetchConFallback(`/eliminarAsignacion/${idAsignacion}`, { method: 'DELETE' }, null);
    cacheAsignaciones = null;
    return true;
  },

  // Gestión de horarios
  getAllHorariosBase: async () => {
    if (cacheHorariosBase) return cacheHorariosBase;
    cacheHorariosBase = await fetchConFallback('/horarios', { method: 'GET' }, []);
    return cacheHorariosBase;
  },

  createHorario: async (nuevo) => {
    const creado = await fetchConFallback('/guardarHorario', { method: 'POST', body: JSON.stringify(nuevo) }, null);
    cacheHorariosBase = null;
    return creado;
  },

  updateHorario: async (idHorario, datos) => {
    const actualizado = await fetchConFallback(`/actualizarHorario/${idHorario}`, { method: 'PUT', body: JSON.stringify(datos) }, null);
    cacheHorariosBase = null;
    return actualizado;
  },

  deleteHorario: async (idHorario) => {
    await fetchConFallback(`/eliminarHorario/${idHorario}`, { method: 'DELETE' }, null);
    cacheHorariosBase = null;
    return true;
  },

  // Gestión de vinculación con Personal
  createAsignacionProfesor: async (idAsignacion, idPersonal) => {
      const res = await fetchConFallback('/guardarEsta', { method: 'POST', body: JSON.stringify({ idAsignacion, idPersonal }) }, null);
      cacheAsignaciones = null;
      cacheEstas = null;
      return res;
    },

    deleteAsignacionProfesor: async (idAsignacion, idPersonal) => {
      const res = await fetchConFallback(`/eliminarEsta/${idPersonal}/${idAsignacion}`, { method: 'DELETE' }, null);
      cacheAsignaciones = null;
      cacheEstas = null;
      return res;
    },
  getEstas: async () => {
      if (cacheEstas) return cacheEstas;
      cacheEstas = await fetchConFallback('/esta', { method: 'GET' }, []);
      return cacheEstas;
    }
};
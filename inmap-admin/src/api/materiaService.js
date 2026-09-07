/**
 * Gestión de de Materias
 * Administra el registro, actualización y eliminación de las asignaturas disponibles
 */
import { fetchConFallback } from './apiConfig.js';

let mockMaterias = [
  { codMateria: "633", nombreMateria: "Análisis Matemático A" },
  { codMateria: "1BA", nombreMateria: "Química General I" }
];

let cacheMaterias = null;

export const materiasService = {
  
  // recupera la lista completa de materias
  getAll: async () => {
    if (cacheMaterias) return cacheMaterias;
    cacheMaterias = await fetchConFallback('/materias', { method: 'GET' }, [...mockMaterias]);
    return cacheMaterias;
  },

  // registra una nueva materia y sincroniza el estado local
  create: async (nueva) => {
    const creada = await fetchConFallback('/guardarMateria', {
      method: 'POST',
      body: JSON.stringify(nueva)
    }, null); 

    if (cacheMaterias && creada) cacheMaterias.push(creada);
    return creada;
  },

  // actualiza los datos de una materia existente mediante su código
  update: async (codMateria, datos) => {
    const payloadCompleto = { codMateria: codMateria, ...datos };
    const actualizada = await fetchConFallback(`/actualizarMateria/${codMateria}`, {
      method: 'PUT',
      body: JSON.stringify(payloadCompleto)
    }, null);

    if (cacheMaterias && actualizada) {
      cacheMaterias = cacheMaterias.map(m => m.codMateria === codMateria ? actualizada : m);
    }
    return actualizada;
  },

  // elimina una materia del sistema y limpia la referencia en memoria
  delete: async (codMateria) => {
    await fetchConFallback(`/eliminarMateria/${codMateria}`, { method: 'DELETE' }, null);

    if (cacheMaterias) {
      cacheMaterias = cacheMaterias.filter(m => m.codMateria !== codMateria);
    }
    return true;
  }
};
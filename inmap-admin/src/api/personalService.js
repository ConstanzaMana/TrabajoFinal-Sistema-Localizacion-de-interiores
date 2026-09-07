/**
 * Gestión del personal
 * Administra la información de los empleados, sus roles y la
 * vinculación con las aulas/laboratorios.
 */
import { fetchConFallback } from './apiConfig.js';

let cachePersonal = null;
let cacheAsociados = null;

export const personalService = {

  // recupera la lista completa de personal
  getAll: async () => {
    if (cachePersonal) return cachePersonal;
    cachePersonal = await fetchConFallback('/personalCompleto', { method: 'GET' }, []);
    return cachePersonal;
  },

  // obtiene las relaciones actuales entre el personal y aulas
  getAsociados: async () => {
    if (cacheAsociados) return cacheAsociados;
    cacheAsociados = await fetchConFallback('/asociados', { method: 'GET' }, []);
    return cacheAsociados;
  },

  // registra un nuevo empleado en el sistema y actualiza el estado local
  create: async (nuevo) => {
    const creado = await fetchConFallback('/guardarPersonal', {
      method: 'POST',
      body: JSON.stringify(nuevo)
    }, null);

    if (cachePersonal && creado) cachePersonal.push(creado);
    return creado;
  },

  // actualiza la información de un empleado existente mediante su ID
  update: async (id, datos) => {
    const actualizado = await fetchConFallback(`/actualizarPersonal/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ idPersonal: id, ...datos })
    }, null);

    if (cachePersonal && actualizado) {
      cachePersonal = cachePersonal.map(p => p.idPersonal === id ? actualizado : p);
    }
    return actualizado;
  },

  // elimina un personal y sincroniza la memoria local
  delete: async (id) => {
    await fetchConFallback(`/eliminarPersonal/${id}`, { method: 'DELETE' }, null);

    if (cachePersonal) {
      cachePersonal = cachePersonal.filter(p => p.idPersonal !== id);
    }
    cacheAsociados = null;
    return true;
  },

  // vincula a un empleado con destino
  createAsociacion: async (asociacion) => {
    const res = await fetchConFallback('/guardarTiene_asociado', {
      method: 'POST',
      body: JSON.stringify(asociacion)
    }, null);
    cacheAsociados = null;
    return res;
  },

  // elimina la vinculación entre un empleado y su destino asignada
  deleteAsociacion: async (idPersonal, idDestino) => {
    const res = await fetchConFallback(`/deleteTiene_asociado/${idPersonal}/${idDestino}`, {
      method: 'DELETE'
    }, null);
    cacheAsociados = null;
    return res;
  }
};
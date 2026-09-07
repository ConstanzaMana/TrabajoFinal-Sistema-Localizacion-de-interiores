/**
 * Gestión del plano y elementos espaciales.
 * administra la información de recintos, zonas y destinos,
 */
import { fetchConFallback } from './apiConfig.js';
import recintosData from '../assets/recintos.json';
import zonasData from '../assets/obtenerZonas2.json';
import destinosData from '../assets/destinos.json';

// almacenamiento temporal para optimizar el rendimiento y reducir peticiones
let cacheRecintos = null;
let cacheZonas = null;
let cacheDestinos = null;

export const mapaService = {

  // recupera la lista de recintos con soporte de datos locales
  getRecintos: async () => {
    if (cacheRecintos) return cacheRecintos;
    cacheRecintos = await fetchConFallback('/recintos', { method: 'GET' }, recintosData);
    return cacheRecintos;
  },

  // obtiene información de las zonas y su estado de bloqueo
  getZonas: async () => {
    if (cacheZonas) return cacheZonas;
    cacheZonas = await fetchConFallback('/obtenerZonas', { method: 'GET' }, zonasData);
    return cacheZonas;
  },

  // recupera los destinos registrados en el plano
  getDestinos: async () => {
    if (cacheDestinos) return cacheDestinos;
    cacheDestinos = await fetchConFallback('/destinos', { method: 'GET' }, destinosData);
    return cacheDestinos;
  },

  // registra un nuevo punto de destino en la base de datos
  saveDestino: async (datos) => {
    return await fetchConFallback('/guardarDestino', { method: 'POST', body: JSON.stringify(datos) }, null);
  },

  // actualiza la información o ubicación de un destino existente
  updateDestino: async (id, datos) => {
    return await fetchConFallback(`/actualizarDestino/${id}`, { method: 'PUT', body: JSON.stringify(datos) }, null);
  },

  // modifica el estado de disponibilidad para un conjunto de zonas
  updateEstadosZonas: async (idsZonas, bloqueado) => {
    return await fetchConFallback(`/actualizarEstadosZonas/${bloqueado}`, {
      method: 'PUT',
      body: JSON.stringify(idsZonas)
    }, null);
  },

  // cambia el estado de acceso de un recinto específico
  updateEstadoRecinto: async (idRecinto, bloqueado) => {
      return await fetchConFallback(`/actualizarEstadoRecinto/${idRecinto}`, {
        method: 'PUT',
        body: JSON.stringify(bloqueado)
      }, null);
    },

  // invalida la memoria temporal para forzar una nueva sincronización
  limpiarCache: () => {
    cacheRecintos = null;
    cacheZonas = null;
    cacheDestinos = null;
  }
};
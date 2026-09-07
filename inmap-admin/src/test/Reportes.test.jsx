import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import Reportes from '../pages/Reportes.jsx';


vi.mock('../api/espService.js', () => ({
  espService: {
    getAll: vi.fn()
  }
}));

import { espService } from '../api/espService.js';

describe('Módulo de Pruebas: <Reportes /> (Telemetría de Hardware)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CP-01: Validar motor de inferencia de estado operativo (Algoritmo de Diagnóstico)', async () => {
    console.log('\n--- EJECUTANDO CP-01: Lógica de Diagnóstico de Hardware ---');

    // Configura fechas para simular la pérdida de señal
    const ahora = new Date();
    const hace2Dias = new Date(ahora.getTime() - (48 * 60 * 60 * 1000)).toISOString();
    const hace1Hora = new Date(ahora.getTime() - (1 * 60 * 60 * 1000)).toISOString();

    console.log('► Paso 1: Inyección de vectores de prueba con parámetros de estrés...');
    espService.getAll.mockResolvedValueOnce([
      // Caso 1: Todo Óptimo
      { idBeacon: 1, deviceName: 'Nodo-A', isActive: true, batteryPercent: 90, lastReportAt: hace1Hora },
      // Caso 2: Batería Crítica (<= 15%)
      { idBeacon: 2, deviceName: 'Nodo-B', isActive: true, batteryPercent: 10, lastReportAt: hace1Hora },
      // Caso 3: Pérdida de Señal (> 24hs)
      { idBeacon: 3, deviceName: 'Nodo-C', isActive: true, batteryPercent: 80, lastReportAt: hace2Dias },
      // Caso 4: Baja Lógica Administrativa
      { idBeacon: 4, deviceName: 'Nodo-D', isActive: false, batteryPercent: 100, lastReportAt: hace1Hora }
    ]);

    render(<Reportes />);

    console.log('► Paso 2: Verificación de resolución de estados en el DOM Virtual...');
    await waitFor(() => {
      // Verifica que el algoritmo renderice los badges correctos para cada escenario
      expect(screen.getByText('ACTIVO')).toBeInTheDocument();
      expect(screen.getByText('BATERIA CRÍTICA')).toBeInTheDocument();
      expect(screen.getByText('SIN SEÑAL')).toBeInTheDocument();
      expect(screen.getByText('DESHABILITADO')).toBeInTheDocument();
    });

    console.log('✓ CP-01 Finalizado con éxito.\n');
  });

  it('CP-02: Validar renderizado de métricas de bajo nivel en panel de detalles', async () => {
    console.log('\n--- EJECUTANDO CP-02: Extracción y Formateo de Telemetría ---');

    const ahora = new Date().toISOString();

    console.log('► Paso 1: Inyección de datos crudos provenientes del microcontrolador...');
    espService.getAll.mockResolvedValueOnce([
      {
        idBeacon: 1,
        deviceName: 'ESP-Prueba',
        isActive: true,
        batteryPercent: 100,
        lastReportAt: ahora,
        // Datos específicos de hardware
        freeHeapBytes: 204800, // 200 KB
        bootCount: 42,
        resetReason: 'Deep-Sleep Wake',
        uptimeMs: 120000 // 2 minutos (120 segundos)
      }
    ]);

    render(<Reportes />);

    console.log('► Paso 2: Ejecución de apertura de panel de inspección de hardware...');
    await waitFor(() => {
      expect(screen.getByText('ESP-Prueba')).toBeInTheDocument();
    });

    // Busca el botón de detalle
    const btnDetalles = screen.getByTitle('Ver telemetría completa');
    fireEvent.click(btnDetalles);

    console.log('► Paso 3: Validación matemática de funciones de conversión (Bytes -> KB y MS -> Minutos)...');
    await waitFor(() => {
      // 204800 bytes / 1024 = 200.0 KB
      expect(screen.getByText('200.0 KB')).toBeInTheDocument();

      // 120000 ms = 2 min
      expect(screen.getByText('2 min')).toBeInTheDocument();

      // Verifica lectura plana
      expect(screen.getByText('42')).toBeInTheDocument(); // Boot count
      expect(screen.getByText('Deep-Sleep Wake')).toBeInTheDocument(); // Reset reason
    });

    console.log('✓ CP-02 Finalizado con éxito.\n');
  });

});
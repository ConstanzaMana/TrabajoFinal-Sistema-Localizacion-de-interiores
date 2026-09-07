import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import MapaEditor from '../pages/mapaEditor.jsx';


vi.mock('../api/mapaService.js', () => ({
  mapaService: {
    getRecintos: vi.fn(),
    getZonas: vi.fn(),
    getDestinos: vi.fn(),
    updateEstadoRecinto: vi.fn(),
    updateEstadosZonas: vi.fn(),
    updateDestino: vi.fn()
  }
}));

vi.mock('../api/espService.js', () => ({
  espService: { getAll: vi.fn() }
}));

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) }
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="mock-mapa">{children}</div>,
  useMapEvents: () => ({ invalidateSize: vi.fn() }),
  GeoJSON: ({ data }) => (
    <div data-testid="mock-capa-geojson">
      {data?.features?.map((f, i) => (
        <span key={i} data-testid={`geo-${f.properties?.id_recinto || f.properties?.id_esp}`}>Capa Geo</span>
      ))}
    </div>
  )
}));

import { mapaService } from '../api/mapaService.js';
import { espService } from '../api/espService.js';

describe('Módulo de Pruebas: <MapaEditor /> (Plano Interactivo)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('rol', 'ADMIN');
  });

  it('CP-01: Validar orquestación de APIs y conversión a formato GeoJSON', async () => {
    console.log('\n--- EJECUTANDO CP-01: Sincronización Cartográfica ---');
    console.log('► Paso 1: Inyectando datos simulados de Recintos, Zonas y Balizas BLE...');

    // Inyecta datos mínimos para que pase la conversión a GeoJSON
    mapaService.getRecintos.mockResolvedValueOnce([{ idRecinto: 'R1', geometria: { type: "Polygon", coordinates: [] } }]);
    mapaService.getZonas.mockResolvedValueOnce([{ idZona: 'Z1', geometria: { type: "Polygon", coordinates: [] } }]);
    mapaService.getDestinos.mockResolvedValueOnce([]);
    espService.getAll.mockResolvedValueOnce([{ idBeacon: 99, posicionX: 10, posicionY: 10 }]);

    render(<MapaEditor />);

    console.log('► Paso 2: Verificando pantalla de carga inicial...');
    expect(screen.getByText('Armando infraestructura del mapa...')).toBeInTheDocument();

    console.log('► Paso 3: Validando desaparición del loader y montaje del MapContainer virtual...');
    await waitFor(() => {
      // Si la carga termina, debe aparecer el checkbox de los ESP
      expect(screen.getByText('Ver Dispositivos ESP')).toBeInTheDocument();
      // Valida que se hayan renderizado las capas GeoJSON
      expect(screen.getAllByTestId('mock-capa-geojson').length).toBeGreaterThan(0);
    });

    console.log('✓ CP-01 Finalizado con éxito.\n');
  });

  it('CP-02: Validar alternancia dinámica de capas de telemetría de hardware', async () => {
    console.log('\n--- EJECUTANDO CP-02: Alternancia de Capas de Telemetría ---');

    mapaService.getRecintos.mockResolvedValueOnce([]);
    mapaService.getZonas.mockResolvedValueOnce([]);
    mapaService.getDestinos.mockResolvedValueOnce([]);

    // Inyecta 1 baliza ESP para verificar si se oculta/muestra
    espService.getAll.mockResolvedValueOnce([{ idBeacon: 42, posicionX: 0, posicionY: 0 }]);

    render(<MapaEditor />);

    await waitFor(() => {
      expect(screen.getByText('Ver Dispositivos ESP')).toBeInTheDocument();
    });

    console.log('► Paso 1: Verificando que la capa ESP está activa por defecto...');
    // Por defecto el checkbox está marcado
    const checkbox = screen.getByLabelText('Ver Dispositivos ESP');
    expect(checkbox).toBeChecked();

    // Verifica que el nodo simulado (geo-ESP-42) exista en el DOM
    expect(screen.getByTestId('geo-ESP-42')).toBeInTheDocument();

    console.log('► Paso 2: Simulando interacción de usuario (Apagar capa ESP)...');
    fireEvent.click(checkbox);

    console.log('► Paso 3: Evaluando actualización del DOM virtual...');
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByTestId('geo-ESP-42')).not.toBeInTheDocument();

    console.log('✓ CP-02 Finalizado con éxito.\n');
  });

  it('CP-03: Validar degradación arquitectónica del editor espacial (RBAC: Visualizador)', async () => {
    console.log('\n--- EJECUTANDO CP-03: Restricción de Mutación Espacial ---');
    console.log('► Paso 1: Configurando token de sesión con rol VISUALIZADOR...');

    localStorage.setItem('rol', 'VISUALIZADOR');

    mapaService.getRecintos.mockResolvedValueOnce([]);
    mapaService.getZonas.mockResolvedValueOnce([]);
    mapaService.getDestinos.mockResolvedValueOnce([]);
    espService.getAll.mockResolvedValueOnce([]);

    render(<MapaEditor />);

    await waitFor(() => {
      expect(screen.getByText('Ver Dispositivos ESP')).toBeInTheDocument();
    });

    console.log('► Paso 2: Verificando que no existan botones de guardado o bloqueo...');
    expect(screen.queryByRole('button', { name: /Guardar Nombre/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bloquear Aula/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bloquear todas/i })).not.toBeInTheDocument();

    console.log('✓ CP-03 Finalizado con éxito.\n');
  });

});
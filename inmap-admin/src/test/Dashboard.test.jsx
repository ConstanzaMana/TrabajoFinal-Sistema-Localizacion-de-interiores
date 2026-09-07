import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import Dashboard from '../pages/Dashboard.jsx';
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../api/materiaService.js', () => ({ materiasService: { getAll: vi.fn() } }));
vi.mock('../api/personalService.js', () => ({ personalService: { getAll: vi.fn() } }));
vi.mock('../api/horariosService.js', () => ({ horariosService: { getAll: vi.fn() } }));
vi.mock('../api/mapaService.js', () => ({ mapaService: { getRecintos: vi.fn(), getZonas: vi.fn() } }));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="mock-map">{children}</div>,
  GeoJSON: () => <div data-testid="mock-geojson" />
}));

import { materiasService } from '../api/materiaService.js';
import { personalService } from '../api/personalService.js';
import { horariosService } from '../api/horariosService.js';
import { mapaService } from '../api/mapaService.js';

describe('Módulo de Pruebas: <Dashboard /> (Panel Principal)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CP-01: Validar consumo de APIs concurrentes y renderizado de métricas en el Dashboard', async () => {
    console.log('\n--- EJECUTANDO CP-01: Carga de Métricas ---');
    console.log('► Paso 1: Simulando respuesta exitosa de los 5 microservicios (Materias, Personal, Horarios, Recintos, Zonas)...');

    materiasService.getAll.mockResolvedValueOnce([ { id: 1 }, { id: 2 }, { id: 3 } ]);
    personalService.getAll.mockResolvedValueOnce([ { id: 1 }, { id: 2 } ]);
    horariosService.getAll.mockResolvedValueOnce([ { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 } ]);
    mapaService.getRecintos.mockResolvedValueOnce([]);
    mapaService.getZonas.mockResolvedValueOnce([]);

    console.log('► Paso 2: Renderizando el componente en el DOM virtual...');
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    expect(screen.getByText(/Bienvenido al Sistema de Gestión de InMap/i)).toBeInTheDocument();

    console.log('► Paso 3: Verificando que el algoritmo de conteo muestre los valores exactos devueltos por la API...');
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // Materias
      expect(screen.getByText('2')).toBeInTheDocument(); // Personal
      expect(screen.getByText('4')).toBeInTheDocument(); // Clases
    });

    console.log('► Paso 4: Validando que los servicios HTTP fueron invocados correctamente.');
    expect(materiasService.getAll).toHaveBeenCalledTimes(1);
    expect(personalService.getAll).toHaveBeenCalledTimes(1);

    console.log('✓ CP-01 Finalizado con éxito.\n');
  });

  it('CP-02: Validar enrutamiento del administrador hacia el Editor Espacial (Mapa)', async () => {
    console.log('\n--- EJECUTANDO CP-02: Navegación al Mapa ---');

    materiasService.getAll.mockResolvedValueOnce([]);
    personalService.getAll.mockResolvedValueOnce([]);
    horariosService.getAll.mockResolvedValueOnce([]);
    mapaService.getRecintos.mockResolvedValueOnce([]);
    mapaService.getZonas.mockResolvedValueOnce([]);

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(materiasService.getAll).toHaveBeenCalled();
    });

    console.log('► Paso 1: Localizando el botón de interacción "Abrir Editor"...');
    const bannerMapa = screen.getByText(/Abrir Editor/i);

    console.log('► Paso 2: Simulando evento de Click del usuario sobre el banner...');
    fireEvent.click(bannerMapa);

    console.log('► Paso 3: Verificando que el router intercepte el evento y empuje la ruta "/mapa" al historial...');
    expect(mockNavigate).toHaveBeenCalledWith('/mapa');

    console.log('✓ CP-02 Finalizado con éxito.\n');
  });

});
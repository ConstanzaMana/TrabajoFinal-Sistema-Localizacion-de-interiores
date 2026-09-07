import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import Personal from '../pages/Personal.jsx';

vi.mock('../api/personalService.js', () => ({
  personalService: {
    getAll: vi.fn(),
    getAsociados: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createAsociacion: vi.fn(),
    deleteAsociacion: vi.fn()
  }
}));

vi.mock('../assets/destinos.json', () => ({
  default: [
    { idDestino: 'D14', nombreDestino: 'Laboratorio D14' },
    { idDestino: 'A210', nombreDestino: 'Aula 210' }
  ]
}));

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) }
}));

import { personalService } from '../api/personalService.js';

describe('Módulo de Pruebas: <Personal /> (Gestión Operativa)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('rol', 'ADMIN');
  });

  it('CP-01: Validar sincronización relacional entre Personal y Destinos', async () => {
    console.log('\n--- EJECUTANDO CP-01: Sincronización Relacional ---');
    console.log('► Paso 1: Inyectando datos simulados de empleados y asociaciones espaciales...');

    personalService.getAll.mockResolvedValueOnce([
      { idPersonal: 1, nombrePersonal: 'Alan', apellidoPersonal: 'Turing', cargoLaboral: 'Profesor titular', dni: '11222333' }
    ]);
    personalService.getAsociados.mockResolvedValueOnce([
      { idPersonal: 1, idDestino: 'D14' }
    ]);

    render(<Personal />);

    console.log('► Paso 2: Verificando que el algoritmo cruce el ID del destino con el JSON local...');
    await waitFor(() => {
      expect(screen.getByText(/Turing, Alan/i)).toBeInTheDocument();
      expect(screen.getByText('Laboratorio D14')).toBeInTheDocument();
    });

    console.log('✓ CP-01 Finalizado con éxito.\n');
  });

  it('CP-02: Validar algoritmo de búsqueda multicriterio (Filtro en vivo)', async () => {
    console.log('\n--- EJECUTANDO CP-02: Algoritmo de Búsqueda ---');

    personalService.getAll.mockResolvedValueOnce([
      { idPersonal: 1, nombrePersonal: 'Ada', apellidoPersonal: 'Lovelace', cargoLaboral: 'JTP', dni: '44555666' },
      { idPersonal: 2, nombrePersonal: 'Grace', apellidoPersonal: 'Hopper', cargoLaboral: 'Ayudante', dni: '99888777' }
    ]);
    personalService.getAsociados.mockResolvedValueOnce([]);

    render(<Personal />);

    await waitFor(() => {
      expect(screen.getByText(/Lovelace, Ada/i)).toBeInTheDocument();
      expect(screen.getByText(/Hopper, Grace/i)).toBeInTheDocument();
    });

    console.log('► Paso 1: Ejecutando consulta de búsqueda por apellido ("Lovelace")...');
    const inputBusqueda = screen.getByPlaceholderText(/Buscar por nombre/i);
    fireEvent.change(inputBusqueda, { target: { value: 'Lovelace' } });

    console.log('► Paso 2: Evaluando actualización del DOM virtual...');
    expect(screen.getByText(/Lovelace, Ada/i)).toBeInTheDocument();
    expect(screen.queryByText(/Hopper, Grace/i)).not.toBeInTheDocument();

    console.log('✓ CP-02 Finalizado con éxito.\n');
  });

  it('CP-03: Validar degradación de interfaz según el perfil (RBAC: Visualizador)', async () => {
    console.log('\n--- EJECUTANDO CP-03: Control de Acceso (RBAC) ---');
    console.log('► Paso 1: Configurando token de sesión con rol VISUALIZADOR...');

    localStorage.setItem('rol', 'VISUALIZADOR');

    personalService.getAll.mockResolvedValueOnce([]);
    personalService.getAsociados.mockResolvedValueOnce([]);

    render(<Personal />);

    console.log('► Paso 2: Comprobando que los elementos de mutación de estado (CRUD) estén bloqueados...');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Agregar Personal/i })).not.toBeInTheDocument();
    });

    console.log('✓ CP-03 Finalizado con éxito.\n');
  });

  it('CP-04: Validar integridad de datos en el formulario (Client-Side Validation)', async () => {
    console.log('\n--- EJECUTANDO CP-04: Validaciones Estrictas de Formulario ---');

    personalService.getAll.mockResolvedValueOnce([]);
    personalService.getAsociados.mockResolvedValueOnce([]);

    render(<Personal />);

    console.log('► Paso 1: Abriendo formulario transaccional...');
    await waitFor(() => {
      const btnAgregar = screen.getByRole('button', { name: /Agregar Personal/i });
      fireEvent.click(btnAgregar);
    });

    console.log('► Paso 2: Inyectando datos deliberadamente erróneos (DNI muy corto, nombre inválido)...');
    const inputNombre = screen.getByPlaceholderText(/Ej: Joaquín/i);
    const inputDni = screen.getByPlaceholderText(/Sin puntos/i);

    fireEvent.change(inputNombre, { target: { value: 'A' } });
    fireEvent.change(inputDni, { target: { value: '12' } });

    console.log('► Paso 3: Verificando disparadores visuales de error preventivo...');
    await waitFor(() => {
      expect(screen.getByText(/Mínimo 3 caracteres/i)).toBeInTheDocument();
      expect(screen.getByText(/DNI inválido/i)).toBeInTheDocument();

      const btnGuardar = screen.getByRole('button', { name: /Guardar/i });
      expect(btnGuardar).toBeDisabled();
    });

    console.log('✓ CP-04 Finalizado con éxito.\n');
  });

});
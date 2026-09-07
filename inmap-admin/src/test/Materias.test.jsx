import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import Materias from '../pages/Materias.jsx';

vi.mock('../api/materiaService.js', () => ({
  materiasService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) }
}));

import { materiasService } from '../api/materiaService.js';

describe('Módulo de Pruebas: <Materias /> (Catálogo Académico)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('rol', 'ADMIN');
  });

  it('CP-01: Validar renderizado y consumo de API del catálogo de materias', async () => {
    console.log('\n--- EJECUTANDO CP-01: Renderizado del Catálogo ---');
    console.log('► Paso 1: Inyectando 2 materias simuladas...');

    materiasService.getAll.mockResolvedValueOnce([
      { codMateria: '101', nombreMateria: 'Álgebra Lineal' },
      { codMateria: '102', nombreMateria: 'Física I' }
    ]);

    render(<Materias />);

    console.log('► Paso 2: Verificando desaparición del estado de carga y renderizado de la tabla...');
    await waitFor(() => {
      expect(screen.getByText('Álgebra Lineal')).toBeInTheDocument();
      expect(screen.getByText('Física I')).toBeInTheDocument();
      expect(screen.getByText('101')).toBeInTheDocument();
    });

    console.log('✓ CP-01 Finalizado con éxito.\n');
  });

  it('CP-02: Validar algoritmo de búsqueda (Filtro por código y nombre)', async () => {
    console.log('\n--- EJECUTANDO CP-02: Algoritmo de Búsqueda ---');

    materiasService.getAll.mockResolvedValueOnce([
      { codMateria: 'SYS1', nombreMateria: 'Sistemas Operativos' },
      { codMateria: 'DB2', nombreMateria: 'Bases de Datos' }
    ]);

    render(<Materias />);

    await waitFor(() => {
      expect(screen.getByText('Sistemas Operativos')).toBeInTheDocument();
    });

    console.log('► Paso 1: Ejecutando consulta de búsqueda por nombre ("Bases")...');
    const inputBusqueda = screen.getByPlaceholderText(/Buscar materia por nombre o código/i);
    fireEvent.change(inputBusqueda, { target: { value: 'Bases' } });

    console.log('► Paso 2: Evaluando actualización del DOM virtual...');
    expect(screen.getByText('Bases de Datos')).toBeInTheDocument();
    expect(screen.queryByText('Sistemas Operativos')).not.toBeInTheDocument();

    console.log('✓ CP-02 Finalizado con éxito.\n');
  });

  it('CP-03: Validar seguridad de interfaz por Control de Acceso (Rol: Visualizador)', async () => {
    console.log('\n--- EJECUTANDO CP-03: Control de Acceso (RBAC) ---');
    console.log('► Paso 1: Configurando sesión con rol VISUALIZADOR...');

    localStorage.setItem('rol', 'VISUALIZADOR');
    materiasService.getAll.mockResolvedValueOnce([
      { codMateria: '101', nombreMateria: 'Matemática' }
    ]);

    render(<Materias />);

    console.log('► Paso 2: Comprobando bloqueo de componentes transaccionales...');
    await waitFor(() => {
      // Confirma que la tabla cargó
      expect(screen.getByText('Matemática')).toBeInTheDocument();

      // El botón de "Nueva Materia" NO debe existir
      expect(screen.queryByRole('button', { name: /Nueva Materia/i })).not.toBeInTheDocument();

      // La columna "Acciones" NO debe existir
      expect(screen.queryByText('Acciones')).not.toBeInTheDocument();
    });

    console.log('✓ CP-03 Finalizado con éxito.\n');
  });

  it('CP-04: Validar prevención de colisiones (Código duplicado) y longitud mínima', async () => {
    console.log('\n--- EJECUTANDO CP-04: Prevención de Colisiones ---');

    // Inyecta una materia existente para probar el duplicado
    materiasService.getAll.mockResolvedValueOnce([
      { codMateria: 'INFO-1', nombreMateria: 'Informática Básica' }
    ]);

    render(<Materias />);

    await waitFor(() => {
      expect(screen.getByText('Informática Básica')).toBeInTheDocument();
    });

    console.log('► Paso 1: Abriendo formulario de nueva materia...');
    fireEvent.click(screen.getByRole('button', { name: /Nueva Materia/i }));

    console.log('► Paso 2: Inyectando código duplicado ("INFO-1") y nombre inválido ("ab")...');
    const inputCodigo = screen.getByLabelText(/Código de Materia/i);
    const inputNombre = screen.getByLabelText(/Nombre de la Materia/i);

    fireEvent.change(inputCodigo, { target: { value: 'INFO-1' } });
    fireEvent.change(inputNombre, { target: { value: 'ab' } });

    console.log('► Paso 3: Verificando disparadores de error y bloqueo de persistencia...');
    await waitFor(() => {
      expect(screen.getByText('este código ya está en uso.')).toBeInTheDocument();
      expect(screen.getByText('mínimo 3 caracteres.')).toBeInTheDocument();

      // El botón guardar debe estar deshabilitado
      const btnGuardar = screen.getByRole('button', { name: /Guardar/i });
      expect(btnGuardar).toBeDisabled();
    });

    console.log('✓ CP-04 Finalizado con éxito.\n');
  });

});
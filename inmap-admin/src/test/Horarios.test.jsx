import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import Horarios from '../pages/Horarios.jsx';


// Simulación de capa de red para evitar consumo de API real
vi.mock('../api/horariosService.js', () => ({
  horariosService: {
    getAll: vi.fn(),
    getAllHorariosBase: vi.fn(),
    getEstas: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createHorario: vi.fn(),
    deleteHorario: vi.fn(),
    createAsignacionProfesor: vi.fn(),
    deleteAsignacionProfesor: vi.fn()
  }
}));

vi.mock('../api/materiaService.js', () => ({
  materiasService: { getAll: vi.fn() }
}));

vi.mock('../api/personalService.js', () => ({
  personalService: { getAll: vi.fn() }
}));

// Simulación de catálogo espacial estático
vi.mock('../assets/destinos.json', () => ({
  default: [
    { idDestino: 'D14', nombreDestino: 'Laboratorio D14' },
    { idDestino: 'A210', nombreDestino: 'Aula 210' }
  ]
}));

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) }
}));

import { horariosService } from '../api/horariosService.js';
import { materiasService } from '../api/materiaService.js';
import { personalService } from '../api/personalService.js';


describe('Módulo de Pruebas: <Horarios /> (Planificación Relacional)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Inyección de credencial con nivel de privilegio ADMIN
    localStorage.setItem('rol', 'ADMIN');
  });

  it('CP-01: Validar agregación multidimensional de datos en la grilla temporal', async () => {
    console.log('\n--- EJECUTANDO CP-01: Agregación Multidimensional ---');
    console.log('► Paso 1: Inyección de entidad relacional simulada (Clase + Materia + Aula)...');

    materiasService.getAll.mockResolvedValueOnce([{ codMateria: '101', nombreMateria: 'Robótica' }]);
    personalService.getAll.mockResolvedValueOnce([]);
    horariosService.getAllHorariosBase.mockResolvedValueOnce([{ idHorario: 1, dias: 'Lunes', horaInicio: '08:00', horaFin: '10:00' }]);
    horariosService.getEstas.mockResolvedValueOnce([]);

    // Se define una asignación existente
    horariosService.getAll.mockResolvedValueOnce([
      {
        idAsignacion: 99,
        materia: { codMateria: '101', nombreMateria: 'Robótica' },
        horario: { idHorario: 1, dias: 'Lunes', horaInicio: '08:00', horaFin: '10:00' },
        destino: { idDestino: 'D14', nombreDestino: 'Laboratorio D14' }
      }
    ]);

    render(<Horarios />);

    console.log('► Paso 2: Verificación de renderizado de la entidad en el DOM virtual...');
    await waitFor(() => {
      // Se evalúa que la materia "Robótica" aparezca en la tarjeta de la grilla
      expect(screen.getByText('Robótica')).toBeInTheDocument();
      // Se comprueba la extracción del horario
      expect(screen.getByText('08:00 - 10:00')).toBeInTheDocument();
    });

    console.log('✓ CP-01 Finalizado con éxito.\n');
  });

  it('CP-02: Validar algoritmo de detección de colisiones (Conflicto Espacial)', async () => {
    console.log('\n--- EJECUTANDO CP-02: Motor de Prevención de Colisiones ---');

    materiasService.getAll.mockResolvedValueOnce([]);
    personalService.getAll.mockResolvedValueOnce([]);
    horariosService.getEstas.mockResolvedValueOnce([]);

    // Se establece el turno base existente
    horariosService.getAllHorariosBase.mockResolvedValueOnce([
      { idHorario: 1, dias: 'Lunes', horaInicio: '08:00', horaFin: '10:00' }
    ]);

    // Se ocupa el Laboratorio D14 en ese horario
    horariosService.getAll.mockResolvedValueOnce([
      { idAsignacion: 10, destino: { idDestino: 'D14' }, horario: { idHorario: 1 } }
    ]);

    render(<Horarios />);

    console.log('► Paso 1: Apertura de interfaz de transacción (Nueva Asignación)...');
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /Nueva Asignación/i }));
    });

    console.log('► Paso 2: Inyección de ubicación conflictiva en el selector espacial ("D14")...');
    const inputDestino = screen.getByPlaceholderText(/Ej: Aula 210/i);
    fireEvent.change(inputDestino, { target: { value: 'Laboratorio D14' } });

    // Simulación de selección desde el menú desplegable
    fireEvent.focus(inputDestino);
    const opcionD14 = screen.getByText('Laboratorio D14');
    fireEvent.mouseDown(opcionD14);

    console.log('► Paso 3: Verificación de bloqueo preventivo por colisión lógica...');
    await waitFor(() => {
      // El motor debe detectar la ocupación y renderizar la alerta restrictiva
      expect(screen.getByText('Aula Ocupada')).toBeInTheDocument();
    });

    console.log('✓ CP-02 Finalizado con éxito.\n');
  });

  it('CP-03: Validar indexación del calendario mediante filtro de búsqueda dinámico', async () => {
    console.log('\n--- EJECUTANDO CP-03: Indexación y Búsqueda Dinámica ---');

    materiasService.getAll.mockResolvedValueOnce([]);
    personalService.getAll.mockResolvedValueOnce([]);
    horariosService.getAllHorariosBase.mockResolvedValueOnce([]);
    horariosService.getEstas.mockResolvedValueOnce([]);

    horariosService.getAll.mockResolvedValueOnce([
      { idAsignacion: 1, materia: { nombreMateria: 'Física' }, horario: { dias: 'Lunes', horaInicio: '08:00' } },
      { idAsignacion: 2, materia: { nombreMateria: 'Química' }, horario: { dias: 'Martes', horaInicio: '10:00' } }
    ]);

    render(<Horarios />);

    await waitFor(() => {
      expect(screen.getByText('Física')).toBeInTheDocument();
      expect(screen.getByText('Química')).toBeInTheDocument();
    });

    console.log('► Paso 1: Ingreso de patrón de búsqueda ("Química")...');
    const inputBusqueda = screen.getByPlaceholderText(/Filtrar calendario/i);
    fireEvent.change(inputBusqueda, { target: { value: 'Química' } });

    console.log('► Paso 2: Evaluación de persistencia visual selectiva...');
    expect(screen.getByText('Química')).toBeInTheDocument();
    expect(screen.queryByText('Física')).not.toBeInTheDocument();

    console.log('✓ CP-03 Finalizado con éxito.\n');
  });

  it('CP-04: Validar restricción arquitectónica por perfil de acceso (Rol: Visualizador)', async () => {
    console.log('\n--- EJECUTANDO CP-04: Control de Acceso Perimetral ---');
    console.log('► Paso 1: Degradación de privilegios de sesión (VISUALIZADOR)...');

    localStorage.setItem('rol', 'VISUALIZADOR');

    materiasService.getAll.mockResolvedValueOnce([]);
    personalService.getAll.mockResolvedValueOnce([]);
    horariosService.getAllHorariosBase.mockResolvedValueOnce([]);
    horariosService.getEstas.mockResolvedValueOnce([]);
    horariosService.getAll.mockResolvedValueOnce([]);

    render(<Horarios />);

    console.log('► Paso 2: Comprobación de anulación de acceso a operaciones de mutación...');
    await waitFor(() => {
      // Se valida la ausencia de los componentes de escritura en el DOM
      expect(screen.queryByRole('button', { name: /Nueva Asignación/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Turnos/i })).not.toBeInTheDocument();
    });

    console.log('✓ CP-04 Finalizado con éxito.\n');
  });

});
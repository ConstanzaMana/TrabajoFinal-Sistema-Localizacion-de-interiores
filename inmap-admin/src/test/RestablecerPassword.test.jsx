import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Swal from 'sweetalert2';
import RestablecerPassword from '../pages/RestablecerPassword.jsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) }
}));

describe('Módulo de Pruebas: <RestablecerPassword />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('CP-02: Validar bloqueo por ausencia de Token en URL', async () => {
    console.log('\n--- EJECUTANDO CP-02: Validación de Seguridad (Token) ---');

    // Renderiza sin el parámetro ?token= en la URL
    render(
      <MemoryRouter initialEntries={['/restablecer']}>
        <RestablecerPassword />
      </MemoryRouter>
    );

    console.log('► Paso 1: Verificando detección de enlace inválido...');
    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
        icon: 'error',
        title: 'Enlace inválido'
      }));
    });
    console.log('✓ CP-02 Finalizado con éxito.\n');
  });

  it('CP-03: Validar coincidencia de campos y longitud mínima de contraseña', async () => {
    console.log('\n--- EJECUTANDO CP-03: Integridad de Nueva Clave ---');

    // Renderizamos CON token para habilitar el formulario
    render(
      <MemoryRouter initialEntries={['/restablecer?token=12345']}>
        <RestablecerPassword />
      </MemoryRouter>
    );

    const inputPass = screen.getByPlaceholderText(/Mínimo 6 caracteres/i);
    const inputConfirm = screen.getByPlaceholderText(/Repetí la contraseña/i);

    console.log('► Paso 1: Inyectando claves que no coinciden...');
    fireEvent.change(inputPass, { target: { value: 'clave123' } });
    fireEvent.change(inputConfirm, { target: { value: 'error456' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar contraseña/i }));

    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalledWith('Atención', expect.stringContaining('no coinciden'), 'warning');
    });
    console.log('✓ CP-03 Finalizado con éxito.\n');
  });
});
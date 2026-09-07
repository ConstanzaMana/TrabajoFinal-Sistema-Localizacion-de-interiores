import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Swal from 'sweetalert2';
import RecuperarPassword from '../pages/RecuperarPassword.jsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn() }
}));

describe('Módulo de Pruebas: <RecuperarPassword />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('CP-01: Validar envío exitoso de solicitud de recuperación', async () => {
    console.log('\n--- EJECUTANDO CP-01: Solicitud de Recuperación ---');
    global.fetch.mockResolvedValueOnce({ ok: true });

    render(<BrowserRouter><RecuperarPassword /></BrowserRouter>);

    const input = screen.getByPlaceholderText(/usuario@email.com/i);
    fireEvent.change(input, { target: { value: 'admin_test' } });

    console.log('► Paso 1: Enviando identificador "admin_test"...');
    fireEvent.click(screen.getByRole('button', { name: /Enviar enlace/i }));

    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
        icon: 'success',
        title: '¡Correo enviado!'
      }));
    });
    console.log('✓ CP-01 Finalizado con éxito.\n');
  });
});
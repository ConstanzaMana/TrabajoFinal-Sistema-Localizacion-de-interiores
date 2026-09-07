import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Swal from 'sweetalert2';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import Login from '../pages/Login.jsx';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn() },
}));


describe('Pruebas en el componente <Login />', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    localStorage.clear();
  });

  it('Debe renderizar los inputs y el botón de ingresar', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByLabelText('Nombre de usuario')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  });

  it('Debe permitir escribir en los campos de texto', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    const inputUsuario = screen.getByLabelText('Nombre de usuario');
    const inputPass = screen.getByLabelText('Contraseña');

    fireEvent.change(inputUsuario, { target: { value: 'admin_coni' } });
    fireEvent.change(inputPass, { target: { value: '123456' } });

    expect(inputUsuario.value).toBe('admin_coni');
    expect(inputPass.value).toBe('123456');
  });

  it('Debe guardar el token y navegar al inicio si el login es correcto', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'fake-jwt-token', rol: 'ADMINISTRADOR' }),
    });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(localStorage.getItem('adminToken')).toBe('fake-jwt-token');
      expect(localStorage.getItem('rol')).toBe('ADMINISTRADOR');

      expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Sesión iniciada correctamente',
        icon: 'success'
      }));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('Debe mostrar una alerta de error si las credenciales son inválidas', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Usuario no encontrado' }),
    });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'hacker' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'badpass' } });
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(localStorage.getItem('adminToken')).toBeNull();
      expect(Swal.fire).toHaveBeenCalledWith('Acceso denegado', 'Usuario no encontrado', 'error');
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
    it('Debe deshabilitar el botón y mostrar "ingresando..." mientras espera la respuesta', async () => {
        let resolverPeticion;
        global.fetch.mockImplementationOnce(() => new Promise((resolve) => {
          resolverPeticion = resolve;
        }));

        render(
          <BrowserRouter>
            <Login />
          </BrowserRouter>
        );

        fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'admin' } });
        fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: '123' } });

        const boton = screen.getByRole('button', { name: /ingresar/i });
        fireEvent.click(boton);

        expect(boton).toBeDisabled();
        expect(screen.getByRole('button', { name: /ingresando/i })).toBeInTheDocument();

        resolverPeticion({ ok: true, json: async () => ({ token: 'fake', rol: 'ADMINISTRADOR' }) });
      });

      it('Debe manejar un error de red o servidor caído', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

        render(
          <BrowserRouter>
            <Login />
          </BrowserRouter>
        );

        fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'admin' } });
        fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: '123' } });
        fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));

        await waitFor(() => {
          expect(Swal.fire).toHaveBeenCalledWith(
            expect.stringMatching(/error|denegado/i),
            expect.any(String),
            'error'
          );
          expect(mockNavigate).not.toHaveBeenCalled();
        });
      });

});
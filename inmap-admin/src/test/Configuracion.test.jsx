import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import Configuracion from '../pages/Configuracion.jsx';


const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../api/authService', () => ({
  authService: {
    actualizarPassword: vi.fn(),
    registrarUsuario: vi.fn(),
    eliminarUsuario: vi.fn()
  }
}));

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) }
}));

import { authService } from '../api/authService';


describe('Módulo de Pruebas: <Configuracion /> (Seguridad y Cuentas)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    // Inyección de rol de administrador por defecto
    localStorage.setItem('rol', 'ADMINISTRADOR');
    const fakePayloadBase64 = 'eyJzdWIiOiJhZG1pbl90ZXN0In0=';
    localStorage.setItem('adminToken', `header.${fakePayloadBase64}.signature`);
  });

  it('CP-01: Validar motor de coincidencia y rotación de credenciales', async () => {
    console.log('\n--- EJECUTANDO CP-01: Rotación de Credenciales ---');
    render(<Configuracion />);

    console.log('► Paso 1: Apertura de panel de configuración de contraseña...');
    const btnPass = screen.getByText('Cambiar mi contraseña');
    fireEvent.click(btnPass);

    console.log('► Paso 2: Inyección de secuencia de caracteres no coincidentes...');
    const inputActual = screen.getByLabelText(/Contraseña Actual/i);
    const inputNueva = screen.getByLabelText(/^Nueva Contraseña/i);
    const inputConf = screen.getByLabelText(/Confirmar Nueva/i);

    fireEvent.change(inputActual, { target: { value: 'claveVieja123' } });
    fireEvent.change(inputNueva, { target: { value: 'nuevaClave456' } });
    fireEvent.change(inputConf, { target: { value: 'nuevaClaveERROR' } });

    console.log('► Paso 3: Verificación de bloqueo preventivo de transacción (Botón deshabilitado)...');
    const btnActualizar = screen.getByRole('button', { name: /Actualizar Contraseña/i });
    expect(btnActualizar).toBeDisabled();

    console.log('► Paso 4: Rectificación de datos y emisión de solicitud HTTP simulada...');
    fireEvent.change(inputConf, { target: { value: 'nuevaClave456' } });
    expect(btnActualizar).not.toBeDisabled();

    fireEvent.click(btnActualizar);

    await waitFor(() => {
      expect(authService.actualizarPassword).toHaveBeenCalledWith('claveVieja123', 'nuevaClave456');
    });

    console.log('✓ CP-01 Finalizado con éxito.\n');
  });

  it('CP-02: Validar restricción arquitectónica por perfil de acceso (RBAC en Registro)', async () => {
    console.log('\n--- EJECUTANDO CP-02: Control de Privilegios Perimetral ---');
    console.log('► Paso 1: Verificación de disponibilidad de módulo de registro para perfil Administrador...');

    const { unmount } = render(<Configuracion />);
    expect(screen.getByText('Crear nuevo perfil')).toBeInTheDocument();

    unmount(); // Desmontaje de DOM virtual

    console.log('► Paso 2: Degradación de privilegios a perfil Visualizador...');
    localStorage.setItem('rol', 'VISUALIZADOR');
    render(<Configuracion />);

    console.log('► Paso 3: Comprobación de ocultación dinámica del componente restrictivo...');
    expect(screen.queryByText('Crear nuevo perfil')).not.toBeInTheDocument();

    console.log('✓ CP-02 Finalizado con éxito.\n');
  });

  it('CP-03: Validar extracción de payload JWT y proceso de baja definitiva', async () => {
    console.log('\n--- EJECUTANDO CP-03: Baja Lógica y Extracción JWT ---');
    render(<Configuracion />);

    console.log('► Paso 1: Despliegue de panel de eliminación de cuenta...');
    const btnEliminar = screen.getByText('Eliminar mi usuario');
    fireEvent.click(btnEliminar);

    console.log('► Paso 2: Simulación de ejecución de comando destructivo...');
    const btnConfirmar = screen.getByRole('button', { name: /Confirmar Eliminación Definitiva/i });
    fireEvent.click(btnConfirmar);

    console.log('► Paso 3: Verificación de decodificación Base64 y petición de baja en backend...');
    await waitFor(() => {
      // Se evalúa que el sistema haya leído 'admin_test' desde el token simulado
      expect(authService.eliminarUsuario).toHaveBeenCalledWith('admin_test');
    });

    console.log('► Paso 4: Comprobación de purga de estado local y redirección a login...');
    await waitFor(() => {
      expect(localStorage.getItem('adminToken')).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    console.log('✓ CP-03 Finalizado con éxito.\n');
  });

});
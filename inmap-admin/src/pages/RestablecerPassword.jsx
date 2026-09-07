/**
 * Restablecimiento de credenciales de acceso.
 * captura el token de seguridad desde la url y permite
 * al usuario definir una nueva contraseña para su cuenta.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import logo from "../assets/logo.png";
import { API_BASE_URL } from '../api/apiConfig';

export default function RestablecerPassword() {
  // extracción del token de seguridad desde los parámetros de la url
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  // validación inicial de seguridad: si no hay token, se bloquea el acceso
  useEffect(() => {
    if (!token) {
      Swal.fire({
        icon: 'error',
        title: 'Enlace inválido',
        text: 'Falta el token de seguridad en la URL. Por favor, solicitá un nuevo enlace de recuperación.',
        confirmButtonColor: '#4f46e5'
      }).then(() => {
        navigate('/login');
      });
    }
  }, [token, navigate]);

  // procesa la actualización de la contraseña contra la api
  // procesa la actualización de la contraseña contra la api y maneja errores reales
    const manejarRestablecimiento = async (e) => {
      e.preventDefault();

      if (password !== confirmPassword) {
        Swal.fire('Atención', 'Las contraseñas no coinciden. Verificalas e intentá de nuevo.', 'warning');
        return;
      }

      if (password.length < 6) {
        Swal.fire('Atención', 'La contraseña debe tener al menos 6 caracteres.', 'warning');
        return;
      }

      setCargando(true);

      try {
        // OJO ACÁ: si en el backend le sacaron la "ñ", cambialo acá también a /nuevaContrasena
        const response = await fetch(`${API_BASE_URL}/nuevaContraseña`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: token,
            newPassword: password
          })
        });

        const contentType = response.headers.get("content-type");

        if (!response.ok) {
          // Si el backend nos manda un JSON con su propio mensaje de error
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error desconocido en el servidor.');
          }
          // Si sigue saltando el error del "patovica" de Spring Security
          else if (response.status === 403) {
            throw new Error('Error 403 (Forbidden): El backend sigue pidiendo Token de sesión. Falta el permitAll() en Spring Security.');
          }
          // Si salta un error de ruta (muy común por la "ñ")
          else if (response.status === 404) {
            throw new Error('Error 404 (Not Found): No se encontró la ruta /nuevaContraseña en el backend. Revisar si la "ñ" está causando problemas.');
          }
          else {
            throw new Error('El servidor no responde correctamente.');
          }
        }

        Swal.fire({
          icon: 'success',
          title: '¡Contraseña actualizada!',
          text: 'Tu contraseña se cambió correctamente. Ya podés iniciar sesión.',
          confirmButtonColor: '#4f46e5'
        });

        navigate('/login');

      } catch (error) {
        console.error('error al restablecer:', error);
        // Ahora sí, mostramos el error EXACTO en pantalla
        Swal.fire('No se pudo guardar', error.message, 'error');
      } finally {
        setCargando(false);
      }
    };
  // si no hay token, renderizamos una pantalla blanca temporal mientras el useEffect redirige
  if (!token) return <div className="min-h-screen bg-slate-50"></div>;

  return (
    <div className="min-h-screen flex font-sans">

      {/* sección lateral de identidad visual (visible en escritorio) */}
      <div className="hidden md:flex w-1/2 bg-[#dcecf9] flex-col items-center justify-center p-12 text-center">
        <div className="mb-8">
          <img src={logo} alt="InMap Logo" className="w-48 h-48 object-contain drop-shadow-xl" />
        </div>
        <h1 className="text-2xl font-medium text-slate-700 max-w-sm leading-snug">
          Sistema de gestión de InMap
        </h1>
      </div>

      {/* formulario de actualización de credenciales */}
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8">

          <div>
            <h2 className="text-3xl font-bold text-slate-800">
              Creá tu nueva contraseña
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Ingresá tu nueva clave para acceder al sistema.
            </p>
          </div>

          <form onSubmit={manejarRestablecimiento} className="space-y-6 mt-8">

            {/* entrada principal de nueva clave */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">
                Nueva contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 transition-all font-medium text-slate-800"
              />
            </div>

            {/* entrada de confirmación de clave */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">
                Confirmar nueva contraseña
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repetí la contraseña"
                className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 transition-all font-medium text-slate-800"
              />
            </div>

            {/* acción de envío con validación de estado */}
            <button
              type="submit"
              disabled={cargando || password.length === 0}
              className={`w-full py-3 rounded-lg font-bold text-blue-900 transition-all ${
                cargando || password.length === 0
                  ? 'bg-blue-100 cursor-not-allowed opacity-70'
                  : 'bg-[#bfdbfe] hover:bg-[#93c5fd]'
              }`}
            >
              {cargando ? 'guardando...' : 'Guardar contraseña'}
            </button>

            {/* control de retorno de emergencia */}
            <div className="pt-2 text-center">
              <Link to="/login" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
                Volver al inicio de sesión
              </Link>
            </div>
          </form>

        </div>
      </div>

    </div>
  );
}
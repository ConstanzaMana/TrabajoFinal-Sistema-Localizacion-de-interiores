/**
 * acceso al sistema (login).
 * gestiona la autenticación de usuarios,
 * almacena el token de sesión y redirige al panel principal.
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import Swal from 'sweetalert2';
import logo from "../assets/logo.png";
import { API_BASE_URL } from '../api/apiConfig';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // procesa la validación de credenciales con el servidor
  // procesa la validación de credenciales con el servidor y maneja excepciones reales
    const manejarLogin = async (e) => {
      e.preventDefault();
      setCargando(true);

      try {
        const response = await fetch(`${API_BASE_URL}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: username,
            password: password
          })
        });

        if (!response.ok) {
          let mensajeError = 'Error desconocido al intentar iniciar sesión.';

          try {
            // 1. Leemos TODO lo que mandó el servidor como si fuera texto plano
            const textData = await response.text();

            try {
              // 2. Intentamos convertir ese texto a JSON
              const errorData = JSON.parse(textData);
              if (errorData && errorData.message) {
                mensajeError = errorData.message; // "Usuario no encontrado", etc.
              }
            } catch (parseError) {
              // 3. Si falla el parseo, es porque Spring Security mandó HTML o nada.
              if (response.status === 403) {
                mensajeError = 'Error 403: Spring Security bloqueó el acceso o devolvió un error genérico en lugar del JSON esperado.';
              } else if (response.status === 401) {
                mensajeError = 'Error 401: No autorizado.';
              } else {
                mensajeError = `El servidor devolvió un error ${response.status} sin formato JSON.`;
              }
            }
          } catch (e) {
            mensajeError = 'El servidor no responde o el túnel está inactivo.';
          }

          throw new Error(mensajeError);
        }

        const data = await response.json();
        console.log("Respuesta del Login:", data);

        if (data.token) {
          localStorage.setItem('adminToken', data.token);
          console.log("Respuesta del Login:", data.token);
          localStorage.setItem('rol', data.rol);

          Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: 'Sesión iniciada correctamente',
            showConfirmButton: false, timer: 2000
          });

          navigate('/');
        }

      } catch (error) {
        console.error('error en login:', error);

        let mensajeFinal = error.message;
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          mensajeFinal = 'No hay conexión con el servidor. Revisá tu internet o verificá el túnel ngrok.';
        }

        Swal.fire('Acceso denegado', mensajeFinal, 'error');
      } finally {
        setCargando(false);
      }
    };
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

      {/* formulario de ingreso y autenticación */}
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8">

          <div>
            <h2 className="text-3xl font-bold text-slate-800">
              Inicio de sesión
            </h2>
          </div>

          <form onSubmit={manejarLogin} className="space-y-6 mt-8">

{/* entrada de usuario */}
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-bold text-slate-700">
                Nombre de usuario
              </label>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 transition-all font-medium text-slate-800"
              />
            </div>

            {/* entrada de clave de acceso */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-bold text-slate-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 transition-all font-medium text-slate-800 pr-12" // Agregamos padding a la derecha para que el texto no pise el ojo
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-500 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* acción de envío con estado de carga */}
            <button
              type="submit"
              disabled={cargando}
              className={`w-full py-3 rounded-lg font-bold text-blue-900 transition-all ${
                cargando
                  ? 'bg-blue-100 cursor-not-allowed'
                  : 'bg-[#bfdbfe] hover:bg-[#93c5fd]'
              }`}
            >
              {cargando ? 'ingresando...' : 'Ingresar'}
            </button>

            {/* enlace para iniciar el flujo de recuperación de contraseña */}
            <div className="pt-2">
              <Link to="/recuperar-password" className="text-xs text-slate-500 hover:text-slate-700 transition-colors">
                ¿Olvidó su contraseña?
              </Link>
            </div>
          </form>

        </div>
      </div>

    </div>
  );
}

/**
 * solicitud de recuperación de credenciales.
 * permite al usuario ingresar su correo o nombre de usuario
 * para recibir un enlace de restablecimiento de contraseña.
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import logo from "../assets/logo.png";
import { API_BASE_URL } from '../api/apiConfig';

export default function RecuperarPassword() {
  const [inputData, setInputData] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  // procesa la solicitud de recuperación hacia el servidor
  // procesa la solicitud de recuperación hacia el servidor
    const manejarRecuperacion = async (e) => {
      e.preventDefault();
      setCargando(true);

      try {
        // Ojo acá también con la letra "ñ" si en el backend deciden sacarla
        const response = await fetch(`${API_BASE_URL}/recuperarContraseña?data=${encodeURIComponent(inputData)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          let mensajeError = 'No se pudo procesar la solicitud. Intente nuevamente más tarde.';

          try {
            // 1. Leemos la respuesta del servidor
            const textData = await response.text();

            // 2. Intentamos convertirla a JSON para extraer la excepción de tu amiga
            const errorData = JSON.parse(textData);
            if (errorData && errorData.message) {
              mensajeError = errorData.message; // Acá va a capturar "Usuario no encontrado" o "No existe un usuario asociado..."
            }
          } catch (parseError) {
            // 3. Si falla (por Spring Security o error 404), damos un mensaje más claro
            if (response.status === 403) {
              mensajeError = 'Error 403: El servidor bloqueó la solicitud (revisar permitAll en backend).';
            } else if (response.status === 404) {
              mensajeError = 'Error 404: Ruta no encontrada. Revisar si la "ñ" en la URL causa conflicto.';
            }
          }

          throw new Error(mensajeError);
        }

        Swal.fire({
          icon: 'success',
          title: '¡Correo enviado!',
          text: 'Si el dato ingresado es correcto, recibirás un enlace para cambiar tu contraseña.',
          confirmButtonColor: '#4f46e5'
        });

        // redirige al login tras una solicitud exitosa
        navigate('/login');

      } catch (error) {
        console.error('error en recuperación:', error);

        let mensajeFinal = error.message;
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          mensajeFinal = 'No hay conexión con el servidor. Revisá tu internet o verificá el túnel ngrok.';
        }

        // Mostramos el mensaje exacto en la alerta
        Swal.fire('Error', mensajeFinal, 'error');
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

      {/* formulario de solicitud de recuperación */}
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8">

          <div>
            <h2 className="text-3xl font-bold text-slate-800">
              Recuperar contraseña
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Ingrese su correo electrónico o nombre de usuario y enviaremos las instrucciones.
            </p>
          </div>

          <form onSubmit={manejarRecuperacion} className="space-y-6 mt-8">

            {/* entrada de dato identificatorio */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">
                Email o Nombre de usuario
              </label>
              <input
                type="text"
                required
                value={inputData}
                onChange={(e) => setInputData(e.target.value)}
                placeholder="Ej: usuario@email.com o nombre_usuario"
                className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 transition-all font-medium text-slate-800"
              />
            </div>

            {/* acción de envío con estado de carga */}
            <button
              type="submit"
              disabled={cargando || inputData.trim().length === 0}
              className={`w-full py-3 rounded-lg font-bold text-blue-900 transition-all ${
                cargando || inputData.trim().length === 0
                  ? 'bg-blue-100 cursor-not-allowed opacity-70'
                  : 'bg-[#bfdbfe] hover:bg-[#93c5fd]'
              }`}
            >
              {cargando ? 'enviando...' : 'Enviar enlace'}
            </button>

            {/* enlace de retorno al login */}
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
/**
 * panel de configuración general del sistema.
 * permite gestionar la seguridad de la cuenta actual (cambio de contraseña),
 * la administración de accesos y la eliminación definitiva de la cuenta.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Lock, UserPlus, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, UserX, Eye, EyeOff } from 'lucide-react';
import Swal from 'sweetalert2';
import { authService } from '../api/authService';

export default function Configuracion() {
  const navigate = useNavigate();
  const rolUsuario = localStorage.getItem('rol') || '';
  const esAdmin = rolUsuario.toUpperCase() === 'ADMINISTRADOR' || rolUsuario.toUpperCase() === 'ADMIN';
  const [mostrarPass, setMostrarPass] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(null);
  const [cargando, setCargando] = useState(false);

  // Formulario de actualización de credenciales
  const [formPass, setFormPass] = useState({ passActual: '', passNueva: '', confirmarPass: '' });

  // Formulario de alta de usuarios
  const [formRegistro, setFormRegistro] = useState({ username: '', email: '', password: '', confirmPassword: '', role: 'VISUAL' });

  const coincidenPass = formPass.passNueva === formPass.confirmarPass && formPass.confirmarPass !== '';
  const coincidenReg = formRegistro.password === formRegistro.confirmPassword && formRegistro.confirmPassword !== '';

const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!coincidenPass || formPass.passNueva.length < 6) return;
    setCargando(true);
    try {
      await authService.actualizarPassword(formPass.passActual, formPass.passNueva);
      Swal.fire({ icon: 'success', title: 'Contraseña actualizada', timer: 2000, showConfirmButton: false });
      setFormPass({ passActual: '', passNueva: '', confirmarPass: '' });
      setPanelAbierto(null);
    } catch (error) {
      Swal.fire({
        title: 'No se pudo actualizar',
        text: error.message || 'La contraseña actual es incorrecta. Por favor, intentalo de nuevo.',
        icon: 'error',
        confirmButtonColor: '#ef4444'
      });
    } finally { setCargando(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!coincidenReg || formRegistro.password.length < 6 || !formRegistro.email) return;
    setCargando(true);
    try {
      await authService.registrarUsuario({
        username: formRegistro.username,
        email: formRegistro.email,
        password: formRegistro.password,
        role: formRegistro.role
      });
      Swal.fire({ icon: 'success', title: 'Usuario creado', text: `Perfil ${formRegistro.username} listo.` });
      setFormRegistro({ username: '', email: '', password: '', confirmPassword: '', role: 'VISUAL' });
      setPanelAbierto(null);
    } catch (error) {
      Swal.fire('Error de registro', error.message || 'El email o el nombre de usuario ya se encuentran registrados.', 'error');
    } finally { setCargando(false); }
  };

  // Eliminación definitiva de la cuenta
  const handleEliminarCuenta = () => {
    Swal.fire({
      title: '¿Eliminar mi usuario?',
      text: "Esta acción es irreversible y perderás acceso al sistema de forma permanente.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#f1f5f9',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const token = localStorage.getItem('adminToken');
          if (!token) return;

          const payload = JSON.parse(atob(token.split('.')[1]));
          const username = payload.sub;

          await authService.eliminarUsuario(username);

          localStorage.clear();
          sessionStorage.clear();

          Swal.fire('Eliminado', 'Tu usuario ha sido borrado del sistema.', 'success');
          navigate('/login');
        } catch (error) {
          Swal.fire('Error', error.message, 'error');
        }
      }
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto mb-10">

      <div className="mb-8 text-center md:text-left">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center justify-center md:justify-start gap-2">
          <Settings className="text-indigo-600" /> Configuración del Sistema
        </h1>
        <p className="text-slate-500 text-sm">Gestiona tu seguridad y accesos de administrador.</p>
      </div>

      <div className="space-y-4">

        {/* Actualización de contraseña */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all">
          <button
            onClick={() => setPanelAbierto(panelAbierto === 'pass' ? null : 'pass')}
            className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Lock size={24} />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-slate-800">Cambiar mi contraseña</h3>
                <p className="text-xs text-slate-500">Actualiza tu clave personal</p>
              </div>
            </div>
            {panelAbierto === 'pass' ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
          </button>

          {panelAbierto === 'pass' && (
              <form onSubmit={handleUpdatePassword} className="p-8 pt-0 border-t border-slate-50 space-y-5 animate-in fade-in slide-in-from-top-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">

                        <div className="space-y-1.5">
                          <label htmlFor="passActual" className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña Actual</label>
                          <div className="relative">
                            <input
                              id="passActual"
                              type={mostrarPass ? "text" : "password"}
                              required
                              value={formPass.passActual}
                              onChange={e => setFormPass({...formPass, passActual: e.target.value})}
                              className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setMostrarPass(!mostrarPass)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                              title={mostrarPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                            >
                              {mostrarPass ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          </div>
                        </div>

                        <div className="hidden md:block"></div>

                    <div className="space-y-1.5">
                              <label htmlFor="passNueva" className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                              <div className="relative">
                                <input
                                  id="passNueva"
                                  type={mostrarPass ? "text" : "password"}
                                  required
                                  value={formPass.passNueva}
                                  onChange={e => setFormPass({...formPass, passNueva: e.target.value})}
                                  className={`w-full px-4 py-3 pr-12 border rounded-2xl outline-none focus:ring-2 transition-all ${
                                    formPass.passNueva.length > 0 && formPass.passNueva.length < 6
                                    ? 'bg-rose-50 border-rose-400 text-rose-900 focus:ring-rose-500'
                                    : 'bg-slate-50 border-slate-200 focus:ring-indigo-500'
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() => setMostrarPass(!mostrarPass)}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                  title={mostrarPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                                >
                                  {mostrarPass ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                              </div>
                              {formPass.passNueva.length > 0 && formPass.passNueva.length < 6 ? (
                                <p className="text-xs text-rose-500 mt-1 font-medium ml-1">La contraseña debe tener al menos 6 caracteres.</p>
                              ) : (
                                <p className="text-xs text-slate-400 mt-1 ml-1">Mínimo 6 caracteres.</p>
                              )}
                            </div>

                        <div className="space-y-1.5">
                          <label htmlFor="confirmarPass" className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar Nueva</label>
                          <div className="relative">
                            <input
                              id="confirmarPass"
                              type={mostrarPass ? "text" : "password"}
                              required
                              value={formPass.confirmarPass}
                              onChange={e => setFormPass({...formPass, confirmarPass: e.target.value})}
                              className={`w-full px-4 py-3 pr-20 border rounded-2xl outline-none transition-all ${
                                formPass.confirmarPass === '' ? 'bg-slate-50 border-slate-200' :
                                coincidenPass ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-100' : 'bg-rose-50 border-rose-500 ring-2 ring-rose-100'
                              }`}
                            />

                            <button
                              type="button"
                              onClick={() => setMostrarPass(!mostrarPass)}
                              className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                              title={mostrarPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                            >
                              {mostrarPass ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>

                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                              {formPass.confirmarPass !== '' && (coincidenPass ? <CheckCircle2 className="text-emerald-600" size={18} /> : <AlertCircle className="text-rose-600" size={18} />)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <button disabled={!coincidenPass || cargando} className="mt-4 bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all">
                        {cargando ? 'Guardando...' : 'Actualizar Contraseña'}
                      </button>
                    </form>
            )}
        </div>

        {/* Alta de perfiles (Oculto para visualizadores) */}
        {esAdmin && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all">
            <button
              onClick={() => setPanelAbierto(panelAbierto === 'registro' ? null : 'registro')}
              className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <UserPlus size={24} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-slate-800">Crear nuevo perfil</h3>
                  <p className="text-xs text-slate-500">Registra administradores o visualizadores</p>
                </div>
              </div>
              {panelAbierto === 'registro' ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
            </button>

            {panelAbierto === 'registro' && (
             <form onSubmit={handleRegister} className="p-8 pt-0 border-t border-slate-50 space-y-6 animate-in fade-in slide-in-from-top-2">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">

                 <div className="space-y-1.5">
                   <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Nombre de Usuario</label>
                   <input
                     type="text" name="new-user-name-inmap" autoComplete="new-username" required
                     value={formRegistro.username} onChange={e => setFormRegistro({...formRegistro, username: e.target.value})}
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                     placeholder="Ej: nuevo_admin"
                   />
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Correo Electrónico</label>
                   <input
                     type="email" required
                     value={formRegistro.email} onChange={e => setFormRegistro({...formRegistro, email: e.target.value})}
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                     placeholder="Ej: usuario@inmap.com"
                   />
                 </div>

                {/* Campo Contraseña*/}
                 <div className="space-y-1.5">
                   <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
                   <div className="relative">
                     <input
                       type={mostrarPass ? "text" : "password"}
                       name="new-user-password-inmap"
                       autoComplete="new-password"
                       required
                       value={formRegistro.password}
                       onChange={e => setFormRegistro({...formRegistro, password: e.target.value})}
                       className={`w-full px-4 py-3 pr-12 border rounded-2xl outline-none focus:ring-2 transition-all ${
                         formRegistro.password.length > 0 && formRegistro.password.length < 6
                         ? 'bg-rose-50 border-rose-400 text-rose-900 focus:ring-rose-500'
                         : 'bg-slate-50 border-slate-200 focus:ring-indigo-500'
                       }`}
                     />
                     <button
                       type="button"
                       onClick={() => setMostrarPass(!mostrarPass)}
                       className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                       title={mostrarPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                     >
                       {mostrarPass ? <EyeOff size={20} /> : <Eye size={20} />}
                     </button>
                   </div>
                   {/* Mensaje dinámico de ayuda o error */}
                   {formRegistro.password.length > 0 && formRegistro.password.length < 6 ? (
                     <p className="text-xs text-rose-500 mt-1 font-medium ml-1">La contraseña debe tener al menos 6 caracteres.</p>
                   ) : (
                     <p className="text-xs text-slate-400 mt-1 ml-1">Mínimo 6 caracteres.</p>
                   )}
                 </div>

                 {/* Campo Confirmar Contraseña  */}
                 <div className="space-y-1.5">
                   <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar Contraseña</label>
                   <div className="relative">
                     <input
                       type={mostrarPass ? "text" : "password"}
                       required
                       value={formRegistro.confirmPassword}
                       onChange={e => setFormRegistro({...formRegistro, confirmPassword: e.target.value})}
                       className={`w-full px-4 py-3 pr-20 border rounded-2xl outline-none focus:ring-2 transition-all ${
                         formRegistro.confirmPassword === '' ? 'bg-slate-50 border-slate-200 focus:ring-indigo-500' :
                         coincidenReg ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-100' : 'bg-rose-50 border-rose-500 ring-2 ring-rose-100'
                       }`}
                     />

                     <button
                       type="button"
                       onClick={() => setMostrarPass(!mostrarPass)}
                       className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                       title={mostrarPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                     >
                       {mostrarPass ? <EyeOff size={20} /> : <Eye size={20} />}
                     </button>

                     {/* Tilde de validación  */}
                     <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                       {formRegistro.confirmPassword !== '' && (coincidenReg ? <CheckCircle2 className="text-emerald-600" size={18} /> : <AlertCircle className="text-rose-600" size={18} />)}
                     </div>
                   </div>
                 </div>

                 <div className="space-y-1.5 md:col-span-2">
                   <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Nivel de Acceso (Rol)</label>
                   <select
                     value={formRegistro.role} onChange={e => setFormRegistro({...formRegistro, role: e.target.value})}
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                   >
                     <option value="VISUAL">Visualizador (Solo Lectura)</option>
                     <option value="ADMIN">Administrador (Acceso Total)</option>
                   </select>
                 </div>

               </div>

               <button
                 disabled={!coincidenReg || cargando || formRegistro.password.length < 6 || !formRegistro.email}
                 className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-2"
               >
                 <UserPlus size={18} /> {cargando ? 'Registrando...' : 'Registrar Perfil'}
               </button>
             </form>
            )}
          </div>
        )}

        {/* Eliminar cuenta */}
        <div className="bg-white rounded-3xl border border-rose-100 shadow-sm overflow-hidden transition-all mt-8">
          <button
            onClick={() => setPanelAbierto(panelAbierto === 'eliminar' ? null : 'eliminar')}
            className="w-full p-6 flex items-center justify-between hover:bg-rose-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                <UserX size={24} />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-rose-800">Eliminar mi usuario</h3>
                <p className="text-xs text-rose-500">Borra tu cuenta de forma permanente</p>
              </div>
            </div>
            {panelAbierto === 'eliminar' ? <ChevronUp className="text-rose-400" /> : <ChevronDown className="text-rose-400" />}
          </button>

          {panelAbierto === 'eliminar' && (
            <div className="p-8 pt-0 border-t border-rose-50 animate-in fade-in slide-in-from-top-2">
              <div className="pt-6">
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-rose-800 leading-relaxed">
                    <strong>¡Atención!</strong> Al eliminar tu cuenta perderás acceso al panel de administración de InMap de forma inmediata. Esta acción eliminará tu registro de la base de datos, <strong>no se puede deshacer</strong>.
                  </p>
                </div>
              </div>
              <button
                onClick={handleEliminarCuenta}
                className="mt-6 bg-rose-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-rose-700 transition-all flex items-center gap-2 shadow-sm"
              >
                <UserX size={18} /> Confirmar Eliminación Definitiva
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
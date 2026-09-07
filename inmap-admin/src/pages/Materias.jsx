/**
 * Gestión de materia:
 * Registro de nuevas materias, la edición de nombres y búsqueda filtrada por código o nombre.
 */
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, BookOpen, Hash, Search } from 'lucide-react';
import { materiasService } from '../api/materiaService.js';
import Swal from 'sweetalert2';

export default function Materias() {
  const [materias, setMaterias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [errorCodigo, setErrorCodigo] = useState('');
  const [errorNombre, setErrorNombre] = useState('');
  const rolUsuario = localStorage.getItem('rol') || '';
  const esAdmin = rolUsuario.toUpperCase() === 'ADMINISTRADOR' || rolUsuario.toUpperCase() === 'ADMIN';
  const estadoInicial = { codMateria: '', nombreMateria: '' };
  const [formData, setFormData] = useState(estadoInicial);

  // recuperación sincronizada de la lista de materias desde el servicio
  const cargarDatos = async () => {
    setCargando(true);
    const data = await materiasService.getAll();
    setMaterias(data);
    setCargando(false);
  };

  useEffect(() => { cargarDatos(); }, []);
  const normalizarTexto = (texto) => {
    if (!texto) return '';
    return texto
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };
  // lógica de filtrado para la tabla de resultados
  const materiasFiltradas = materias.filter(m => {
    const busquedaLimpia = normalizarTexto(busqueda);
    const nombreLimpio = normalizarTexto(m.nombreMateria);
    const codigoLimpio = normalizarTexto(m.codMateria);

    return nombreLimpio.includes(busquedaLimpia) || codigoLimpio.includes(busquedaLimpia);
  });


  // valida la disponibilidad del código de materia antes de registrar una nueva
  const manejarCambioCodigo = (e) => {
    const valor = e.target.value;
    setFormData({ ...formData, codMateria: valor });
    if (!editando) {
      const existe = materias.some(m => String(m.codMateria).toLowerCase() === String(valor).toLowerCase());
      setErrorCodigo(existe ? 'este código ya está en uso.' : '');
    }
  };

  // valida la extensión mínima del nombre de la asignatura
  const manejarCambioNombre = (e) => {
    const valor = e.target.value;
    setFormData({ ...formData, nombreMateria: valor });
    setErrorNombre(valor.length > 0 && valor.trim().length < 3 ? 'mínimo 3 caracteres.' : '');
  };

  // gestiona el envío de datos para creación o actualización de registros
    const handleSubmit = async (e) => {
      e.preventDefault();

      if (cargando) return;

      if (errorCodigo || errorNombre || formData.nombreMateria.trim().length < 3) return;

      setCargando(true);
      try {
        if (editando) {
          await materiasService.update(editando.codMateria, { nombreMateria: formData.nombreMateria });
        } else {
          await materiasService.create(formData);
        }

        Swal.fire({
                  title: '¡Éxito!',
                  text: `La materia se ha ${editando ? 'actualizado' : 'guardado'} correctamente.`,
                  icon: 'success',
                  confirmButtonColor: '#4f46e5',
                  timer: 2000
                });

        setMostrarModal(false);
        setEditando(null);
        setFormData(estadoInicial);
        cargarDatos();
      } catch (error) {
         let mensajeError = error.message || 'No se pudo completar la operación.';

         if (mensajeError.includes('{')) {
           try {
             const jsonPart = mensajeError.substring(mensajeError.indexOf('{'));
             const parsed = JSON.parse(jsonPart);

             if (parsed && parsed.message) {
               mensajeError = parsed.message;
             }
           } catch (e) {
           }
         }
        Swal.fire({ title: 'Atención', text: mensajeError, icon: 'warning' });
      } finally {
        setCargando(false);
      }
    };

  // Elimina una materia
    const handleEliminar = async (codMateria) => {
      Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        reverseButtons: true
      }).then(async (result) => {
        if (result.isConfirmed) {
          setCargando(true);
          try {
            await materiasService.delete(codMateria);
            Swal.fire({ title: 'Eliminado', text: 'Materia borrada.', icon: 'success', timer: 1500, showConfirmButton: false });
            cargarDatos();
          } catch (error) {
            Swal.fire('Error', 'Fallo al intentar eliminar.', 'error');
            setCargando(false);
          }
        }
      });
    };

  // prepara la interfaz para la modificación de una materia existente
  const abrirEdicion = (materia) => {
    setEditando(materia);
    setFormData({ ...materia });
    setErrorCodigo('');
    setErrorNombre('');
    setMostrarModal(true);
  };

  return (
      <div className="space-y-6 h-full flex flex-col p-2">

        {/* Cabecera */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="text-indigo-600" /> Gestión de Materias
            </h1>
          </div>

          {/* Boton Crear (Solo admin)*/}
          {esAdmin && (
            <button
              onClick={() => { setEditando(null); setFormData(estadoInicial); setErrorCodigo(''); setErrorNombre(''); setMostrarModal(true); }}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 flex items-center gap-2 transition-all shadow-md shadow-indigo-100 font-medium"
            >
              <Plus size={20} /> Nueva Materia
            </button>
          )}
        </div>

        {/* barra de búsqueda para filtrado rápido de registros */}
        <div className="flex justify-start">
          <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm w-full max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar materia por nombre o código..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm"
              />
            </div>
          </div>
        </div>

        {/* visualización de datos en formato de tabla */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1">
          {cargando ? (
            <div className="p-12 text-center text-slate-500 font-medium italic animate-pulse">Cargando lista de materias...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="p-4 font-bold text-slate-600 w-40 uppercase text-xs tracking-wider text-center">Código</th>
                    <th className="p-4 font-bold text-slate-600 uppercase text-xs tracking-wider">Nombre de la Materia</th>

                    {/* "Acciones" solo Admin */}
                    {esAdmin && <th className="p-4 font-bold text-slate-600 uppercase text-xs tracking-wider text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {materiasFiltradas.map((m) => (
                    <tr key={m.codMateria} className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors group">
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-mono text-sm font-bold group-hover:bg-white transition-colors">
                          <Hash size={14} className="text-slate-400" /> {m.codMateria}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-800 text-lg">
                        {m.nombreMateria}
                      </td>

                      {/* Oculta los botones de Editar/Eliminar si no es Admin */}
                      {esAdmin && (
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => abrirEdicion(m)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Editar">
                              <Edit2 size={20} />
                            </button>
                            <button onClick={() => handleEliminar(m.codMateria)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Eliminar">
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {materiasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={esAdmin ? 3 : 2} className="p-12 text-center text-slate-400 italic bg-slate-50/30">
                        No se encontraron materias que coincidan con "{busqueda}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {/* Formulario para la gestión de registros */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
              {editando ? <Edit2 className="text-indigo-500"/> : <Plus className="text-indigo-500"/>}
              {editando ? 'Editar Materia' : 'Nueva Materia'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* campo de identificación único */}
              <div>
                <label htmlFor="codMateria" className="block text-sm font-bold text-slate-700 mb-1">
                      Código de Materia
                 </label>
                 <input
                  id="codMateria"
                  type="text"
                  required
                  value={formData.codMateria}
                  disabled={!!editando}
                  maxLength={3}
                  onChange={manejarCambioCodigo}
                  className={`w-full p-2.5 border rounded-xl outline-none font-mono transition-colors ${
                    errorCodigo ? 'bg-rose-50 border-rose-400 text-rose-900' : 'bg-slate-50 border-slate-200'
                  }`}
                  placeholder="Ej: 633"
                />
                {errorCodigo ? (
                  <p className="text-xs text-rose-500 mt-1.5 font-medium">{errorCodigo}</p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1.5">Máximo 3 caracteres.</p>
                )}
              </div>

              {/* campo de nombre de la materia */}
              <div>
                <label htmlFor="nombreMateria" className="block text-sm font-bold text-slate-700 mb-1">
                      Nombre de la Materia
                </label><input
                id="nombreMateria"
                  type="text" required value={formData.nombreMateria}
                  onChange={manejarCambioNombre}
                  className={`w-full p-2.5 border rounded-xl outline-none transition-colors ${
                    errorNombre ? 'bg-rose-50 border-rose-400 text-rose-900' : 'bg-slate-50 border-slate-200'
                  }`}
                  placeholder="Ej: Análisis Matemático A"
                />
                {errorNombre ? <p className="text-xs text-rose-500 mt-1.5 font-medium">{errorNombre}</p> : <p className="text-xs text-slate-400 mt-1.5">Mínimo 3 caracteres.</p>}
              </div>

              {/* acciones de confirmación y cierre del formulario */}
              <div className="flex gap-3 pt-6 mt-2 border-t border-slate-100">
                <button type="button" onClick={() => setMostrarModal(false)} className="flex-1 px-4 py-2.5 text-slate-600 font-bold bg-slate-100 rounded-xl">Cancelar</button>
                <button type="submit" disabled={!!errorCodigo || !!errorNombre} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

}
/**
 * Gestión del personal:
 * Administrar informacion de los empleados, sus cargos
 * y la vinculación con las aulas/laboratorios.
 */
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users, IdCard, MapPin, Search } from 'lucide-react';
import Swal from 'sweetalert2';

import { personalService } from '../api/personalService.js';
import destinosData from '../assets/destinos.json';

const LISTA_CARGOS = [
  'Profesor con dedicación simple',
  'Profesor con dedicación exclusiva',
  'JTP',
  'Ayudante'
];
const normalizarTexto = (texto) => {
      if (!texto) return '';
      return texto
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};
export default function Personal() {
  const [personal, setPersonal] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [listaDestinos, setListaDestinos] = useState([]);
  const [focoOficina, setFocoOficina] = useState(false);
  const [focoCargo, setFocoCargo] = useState(false);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [errores, setErrores] = useState({});
  const rolUsuario = localStorage.getItem('rol') || '';
  const esAdmin = rolUsuario.toUpperCase() === 'ADMIN';

  const estadoInicial = {
    nombrePersonal: '',
    apellidoPersonal: '',
    cargoLaboral: '',
    dni: '',
    oficina: ''
  };
  const [formData, setFormData] = useState(estadoInicial);

  // sincronización de registros de personal, asociaciones y destinos
  const cargarDatos = async () => {
    setCargando(true);
    try {
      const dataPersonal = await personalService.getAll();
      const dataAsociados = await personalService.getAsociados();
      const personalConOficinas = dataPersonal.map(persona => {
        const asociacion = dataAsociados.find(a => String(a.idPersonal) === String(persona.idPersonal));
        let nombreOficina = '';

        if (asociacion) {
          const destinoInfo = destinosData.find(d => String(d.idDestino) === String(asociacion.idDestino));
          if (destinoInfo) {
            nombreOficina = destinoInfo.nombreDestino || destinoInfo.idDestino;
          }
        }
        return {
          ...persona,
          oficina: nombreOficina,
          oficinaOriginal: nombreOficina
        };
      });

      setPersonal(personalConOficinas);

      const opcionesDestinos = destinosData.map(d => d.nombreDestino || d.idDestino);
      setListaDestinos(opcionesDestinos);

    } catch (e) {
      console.error("error cargando datos:", e);
    }
    setCargando(false);
  };

  useEffect(() => { cargarDatos(); }, []);

const personalFiltrado = personal
    .filter(p => {
      const termino = normalizarTexto(busqueda);
      const nombreCompleto = normalizarTexto(`${p.nombrePersonal} ${p.apellidoPersonal}`);

      return (
        nombreCompleto.includes(termino) ||
        String(p.dni).includes(termino)
      );
    })
    .sort((a, b) => {
      return a.apellidoPersonal.localeCompare(b.apellidoPersonal, 'es', { sensitivity: 'base' });
    });

  const validarCampo = (campo, valor) => {
    let errorMsg = '';

    if (!valor.toString().trim()) {
      errorMsg = 'Este campo es obligatorio.';
    } else if ((campo === 'nombrePersonal' || campo === 'apellidoPersonal') && valor.trim().length < 3) {
      errorMsg = 'Mínimo 3 caracteres.';
    } else if (campo === 'dni' && valor.toString().length < 7) {
      errorMsg = 'DNI inválido (mínimo 7 dígitos).';
    }

    setErrores(prev => ({ ...prev, [campo]: errorMsg }));
  };

  const manejarCambio = (e, campo) => {
    const valor = e.target.value;
    setFormData({ ...formData, [campo]: valor });
    validarCampo(campo, valor);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nuevosErrores = {};
    if (!formData.nombrePersonal.trim()) nuevosErrores.nombrePersonal = 'El nombre es obligatorio.';
    if (!formData.apellidoPersonal.trim()) nuevosErrores.apellidoPersonal = 'El apellido es obligatorio.';
    if (!formData.cargoLaboral.trim()) nuevosErrores.cargoLaboral = 'Debe seleccionar un cargo.';
    if (!formData.dni.toString().trim()) nuevosErrores.dni = 'El DNI es obligatorio.';

    if (Object.keys(nuevosErrores).length > 0 || Object.values(errores).some(err => err !== '')) {
      setErrores(prev => ({ ...prev, ...nuevosErrores }));
      return;
    }

    setCargando(true);

    const destinoMatch = destinosData.find(d => d.nombreDestino === formData.oficina || d.idDestino === formData.oficina);
    const idDestinoFinal = destinoMatch ? destinoMatch.idDestino : null;

    const datosPersona = {
      nombrePersonal: formData.nombrePersonal,
      apellidoPersonal: formData.apellidoPersonal,
      cargoLaboral: formData.cargoLaboral,
      dni: formData.dni
    };

    try {
      if (editando) {
        await personalService.update(editando.idPersonal, datosPersona);
        if (formData.oficina !== editando.oficinaOriginal) {
           if (editando.oficinaOriginal) {
             const viejoDestino = destinosData.find(d => d.nombreDestino === editando.oficinaOriginal || d.idDestino === editando.oficinaOriginal);
             if (viejoDestino) {
               await personalService.deleteAsociacion(editando.idPersonal, viejoDestino.idDestino);
             }
           }
           if (idDestinoFinal) {
             await personalService.createAsociacion({ idPersonal: editando.idPersonal, idDestino: idDestinoFinal });
           }
        }
      } else {
        const nuevoPersonal = await personalService.create(datosPersona);

        if (idDestinoFinal && nuevoPersonal && nuevoPersonal.idPersonal) {
           await personalService.createAsociacion({ idPersonal: nuevoPersonal.idPersonal, idDestino: idDestinoFinal });
        }
      }

      Swal.fire({
        title: '¡Éxito!',
        text: `El personal se ha ${editando ? 'actualizado' : 'registrado'} correctamente.`,
        icon: 'success',
        confirmButtonColor: '#4f46e5',
        timer: 2000
      });

      setMostrarModal(false);
      setEditando(null);
      setFormData(estadoInicial);
      setErrores({});
      cargarDatos();
    } catch (error) {
      const mensaje = error.message || 'Error en la conexión con el servidor.';
      Swal.fire({ title: 'Atención', text: mensaje, icon: 'warning' });
    } finally {
      setCargando(false);
    }
  };

  const handleEliminar = async (id, oficinaActual) => {
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
          if (oficinaActual) {
             const destinoActual = destinosData.find(d => d.nombreDestino === oficinaActual || d.idDestino === oficinaActual);
             if (destinoActual) {
               try { await personalService.deleteAsociacion(id, destinoActual.idDestino); } catch(e){}
             }
          }
          await personalService.delete(id);
          Swal.fire({ title: 'Eliminado', text: 'El personal fue eliminado.', icon: 'success', timer: 1500, showConfirmButton: false });
          cargarDatos();
        } catch (error) {
          Swal.fire('Error', 'Fallo al intentar eliminar.', 'error');
          setCargando(false);
        }
      }
    });
  };

  const abrirEdicion = (persona) => {
    setEditando(persona);
    setFormData({ ...persona, oficina: persona.oficina || '' });
    setErrores({});
    setMostrarModal(true);
  };

  const getBadgeColor = (cargo) => {
    if (!cargo) return 'bg-slate-100 text-slate-700';
    const c = cargo.toLowerCase();
    if (c.includes('profesor')) return 'bg-indigo-100 text-indigo-700';
    if (c.includes('jtp')) return 'bg-emerald-100 text-emerald-700';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6 h-full flex flex-col p-2">

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="text-indigo-600" /> Gestión de Personal
          </h1>
        </div>

        {/* Botón Agregar Personal solo si es ADMIN */}
        {esAdmin && (
          <button
            onClick={() => { setEditando(null); setFormData(estadoInicial); setErrores({}); setMostrarModal(true); }}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 flex items-center gap-2 transition-all shadow-md shadow-indigo-100 font-medium"
          >
            <Plus size={20} /> Agregar Personal
          </button>
        )}
      </div>

      <div className="flex justify-start">
        <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm w-full max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre, apellido o DNI..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1">
        {cargando ? (
          <div className="p-12 text-center text-slate-500 font-medium italic animate-pulse">Cargando personal...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="p-4 font-bold text-slate-600 uppercase text-xs tracking-wider">Nombre Completo</th>
                  <th className="p-4 font-bold text-slate-600 uppercase text-xs tracking-wider">Cargo Laboral</th>
                  <th className="p-4 font-bold text-slate-600 uppercase text-xs tracking-wider">DNI</th>
                  <th className="p-4 font-bold text-slate-600 uppercase text-xs tracking-wider">Oficina / Lab</th>
                  {esAdmin && <th className="p-4 font-bold text-slate-600 uppercase text-xs tracking-wider text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {personalFiltrado.map((p) => (
                  <tr key={p.idPersonal} className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors group">
                    <td className="p-4 font-semibold text-slate-800 align-top pt-5">
                      {p.apellidoPersonal}, {p.nombrePersonal}
                    </td>
                    <td className="p-4 align-top pt-4">
                      <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold leading-snug max-w-[180px] border border-white group-hover:border-transparent transition-all ${getBadgeColor(p.cargoLaboral)}`}>
                        {p.cargoLaboral}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 align-top pt-4 flex flex-col gap-1">
                      <span className="flex items-center gap-1.5 font-mono text-sm bg-slate-50 px-2 py-1 rounded w-fit group-hover:bg-white transition-colors">
                        <IdCard size={14} className="text-slate-400" />
                        {p.dni ? Number(p.dni).toLocaleString('es-AR') : '-'}
                      </span>
                    </td>
                        <td className="p-4 text-slate-600 align-top pt-4">
                                {p.oficina ? (
                                  <span className="inline-flex items-start gap-1.5 text-sm bg-slate-50 px-3 py-2 rounded-lg leading-snug max-w-[250px] border border-slate-100 group-hover:bg-white transition-colors">
                                    <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                                    <span className="font-medium">{p.oficina}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-sm italic inline-block mt-1">
                                    {normalizarTexto(p.cargoLaboral).includes('dedicacion simple')
                                      ? 'Sin Oficina (Ded. Simple)'
                                      : 'Sin asignar'}
                                  </span>
                                )}
                              </td>

                    {esAdmin && (
                      <td className="p-4 text-right align-top pt-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => abrirEdicion(p)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Editar">
                            <Edit2 size={20} />
                          </button>
                          <button onClick={() => handleEliminar(p.idPersonal, p.oficina)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Eliminar">
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {personalFiltrado.length === 0 && (
                  <tr>
                    <td colSpan={esAdmin ? 5 : 4} className="p-12 text-center text-slate-400 italic bg-slate-50/30">
                      No se encontraron resultados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mostrarModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-slate-100">
            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
              {editando ? <Edit2 className="text-indigo-500"/> : <Plus className="text-indigo-500"/>}
              {editando ? 'Editar Personal' : 'Nuevo Miembro del Personal'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nombre</label>
                  <input
                    type="text" value={formData.nombrePersonal}
                    onChange={e => manejarCambio(e, 'nombrePersonal')}
                    className={`w-full p-2.5 border rounded-xl outline-none transition-colors ${errores.nombrePersonal ? 'bg-rose-50 border-rose-400 text-rose-900' : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500'}`}
                    placeholder="Ej: Joaquín"
                  />
                  {errores.nombrePersonal && <p className="text-xs text-rose-500 mt-1.5 font-medium">{errores.nombrePersonal}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Apellido</label>
                  <input
                    type="text" value={formData.apellidoPersonal}
                    onChange={e => manejarCambio(e, 'apellidoPersonal')}
                    className={`w-full p-2.5 border rounded-xl outline-none transition-colors ${errores.apellidoPersonal ? 'bg-rose-50 border-rose-400 text-rose-900' : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500'}`}
                    placeholder="Ej: Lucero"
                  />
                  {errores.apellidoPersonal && <p className="text-xs text-rose-500 mt-1.5 font-medium">{errores.apellidoPersonal}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">DNI</label>
                  <input
                    type="number" value={formData.dni}
                    onChange={e => manejarCambio(e, 'dni')}
                    className={`w-full p-2.5 border rounded-xl outline-none font-mono transition-colors ${errores.dni ? 'bg-rose-50 border-rose-400 text-rose-900' : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500'}`}
                    placeholder="Sin puntos"
                  />
                  {errores.dni && <p className="text-xs text-rose-500 mt-1.5 font-medium">{errores.dni}</p>}
                </div>

                <div className="relative">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Cargo Laboral</label>
                  <input
                    type="text" autoComplete="off"
                    value={formData.cargoLaboral}
                    onChange={e => {
                       setFormData({...formData, cargoLaboral: e.target.value});
                       setErrores(prev => ({...prev, cargoLaboral: !e.target.value.trim() ? 'Este campo es obligatorio.' : ''}));
                    }}
                    onFocus={() => setFocoCargo(true)}
                    onBlur={() => setTimeout(() => setFocoCargo(false), 200)}
                    className={`w-full p-2.5 border rounded-xl outline-none transition-colors ${errores.cargoLaboral ? 'bg-rose-50 border-rose-400 text-rose-900' : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500'}`}
                    placeholder="Seleccione un cargo..."
                  />
                  {errores.cargoLaboral && <p className="text-xs text-rose-500 mt-1.5 font-medium">{errores.cargoLaboral}</p>}

                  {focoCargo && (
                    <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                       {LISTA_CARGOS
                         .filter(c => {
                           const busquedaLimpia = normalizarTexto(formData.cargoLaboral);
                           const cargoLimpio = normalizarTexto(c);
                           return cargoLimpio.includes(busquedaLimpia);
                         })
                         .map((cargo, i) => (
                           <li
                             key={i}
                             onMouseDown={() => {
                                 setFormData({...formData, cargoLaboral: cargo});
                                 setErrores(prev => ({...prev, cargoLaboral: ''}));
                             }}
                             className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-slate-700 font-medium text-sm transition-colors"
                           >
                             {cargo}
                           </li>
                       ))}
                     </ul>
                  )}
                </div>
              </div>

              <div className="relative border-t border-slate-100 pt-4">
                <label className="block text-sm font-bold text-slate-700 mb-1">Oficina / Laboratorio (Opcional)</label>
                <input
                  type="text" autoComplete="off"
                  value={formData.oficina}
                  onChange={e => setFormData({...formData, oficina: e.target.value})}
                  onFocus={() => setFocoOficina(true)}
                  onBlur={() => setTimeout(() => setFocoOficina(false), 200)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ej: D14 o Aula 210"
                />
                {focoOficina && (
                  <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {listaDestinos
                      .filter(d => {
                        const busquedaLimpia = normalizarTexto(formData.oficina);
                        const destinoLimpio = normalizarTexto(d);
                        return destinoLimpio.includes(busquedaLimpia);
                      })
                      .map((destino, i) => (
                        <li
                          key={i}
                          onMouseDown={() => setFormData({...formData, oficina: destino})}
                          className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-slate-700 font-medium text-sm transition-colors"
                        >
                          {destino}
                        </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-3 pt-6 mt-2 border-t border-slate-100">
                <button type="button" onClick={() => setMostrarModal(false)} className="flex-1 px-4 py-3 text-slate-500 font-bold bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">Cancelar</button>
                <button
                  type="submit"
                  disabled={Object.values(errores).some(e => e !== '')}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
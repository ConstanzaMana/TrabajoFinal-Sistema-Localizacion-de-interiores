/**
 * gestión de horarios y asignaciones
 * Permite definir turnos, asignar materias
 * a destinos y vincular al personal responsable.
 */
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Clock, Calendar, MapPin, Users, Check, X, Search, Filter, Ban, Settings, ChevronUp, ChevronDown } from 'lucide-react';
import Swal from 'sweetalert2';
import { horariosService } from '../api/horariosService.js';
import { materiasService } from '../api/materiaService.js';
import { personalService } from '../api/personalService.js';
import destinosData from '../assets/destinos.json';

  const normalizarTexto = (texto) => {
      if (!texto) return '';
      return texto
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    };
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const SelectorTiempo = ({ valor, onChange }) => {
  const [hora24, minutos] = valor ? valor.split(':').map(Number) : [8, 0];

  const displayHora = hora24 % 12 === 0 ? 12 : hora24 % 12;
  const ampm = hora24 >= 12 ? 'PM' : 'AM';

  const handleChange = (h24, m) => {
    const hh = String(h24).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    onChange(`${hh}:${mm}`);
  };

  const mod = (n, m) => ((n % m) + m) % m;

  const cambiarHora = (delta) => handleChange(mod(hora24 + delta, 24), minutos);
  const cambiarMinutos = (delta) => handleChange(hora24, mod(minutos + delta * 30, 60));
  const cambiarAmPm = () => handleChange((hora24 + 12) % 24, minutos);

  return (
    <div className="flex items-center justify-center gap-1 bg-[#1e1e1e] text-white p-2 rounded-xl w-full border border-slate-700 shadow-inner select-none">
      <div className="flex flex-col items-center">
        <button type="button" onClick={() => cambiarHora(1)} className="text-slate-400 hover:text-white transition-colors leading-none"><ChevronUp size={16}/></button>
        <span className="text-lg font-bold font-mono w-6 text-center leading-none my-1.5">{String(displayHora).padStart(2, '0')}</span>
        <button type="button" onClick={() => cambiarHora(-1)} className="text-slate-400 hover:text-white transition-colors leading-none"><ChevronDown size={16}/></button>
      </div>
      <span className="text-base font-bold text-slate-500 pb-0.5">:</span>
      <div className="flex flex-col items-center">
        <button type="button" onClick={() => cambiarMinutos(1)} className="text-slate-400 hover:text-white transition-colors leading-none"><ChevronUp size={16}/></button>
        <span className="text-lg font-bold font-mono w-6 text-center text-slate-300 leading-none my-1.5">{String(minutos).padStart(2, '0')}</span>
        <button type="button" onClick={() => cambiarMinutos(-1)} className="text-slate-400 hover:text-white transition-colors leading-none"><ChevronDown size={16}/></button>
      </div>
      <div className="flex flex-col items-center ml-1.5">
        <button type="button" onClick={cambiarAmPm} className="text-slate-400 hover:text-white transition-colors leading-none"><ChevronUp size={16}/></button>
        <span className="text-xs font-black w-6 text-center text-indigo-400 tracking-wider leading-none my-1.5">{ampm}</span>
        <button type="button" onClick={cambiarAmPm} className="text-slate-400 hover:text-white transition-colors leading-none"><ChevronDown size={16}/></button>
      </div>
    </div>
  );
};

export default function Horarios() {
  const [asignaciones, setAsignaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busquedaGrilla, setBusquedaGrilla] = useState('');
  const [listaMaterias, setListaMaterias] = useState([]);
  const [listaHorariosDisponibles, setListaHorariosDisponibles] = useState([]);
  const [listaPersonal, setListaPersonal] = useState([]);
  const [claseDetalle, setClaseDetalle] = useState(null);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const [mostrarModalBase, setMostrarModalBase] = useState(false);
  const [editandoBase, setEditandoBase] = useState(null);
  const [formBase, setFormBase] = useState({ idHorario: '', dias: 'Lunes', horaInicio: '08:00', horaFin: '10:00' });
  const [filtroDiaBase, setFiltroDiaBase] = useState('');
  const [inputMateria, setInputMateria] = useState('');
  const [inputDestino, setInputDestino] = useState('');
  const [inputDocente, setInputDocente] = useState('');
  const [focoMateria, setFocoMateria] = useState(false);
  const [focoDestino, setFocoDestino] = useState(false);
  const [focoDocente, setFocoDocente] = useState(false);
  const [filtroDia, setFiltroDia] = useState('');
  const rolUsuario = localStorage.getItem('rol') || '';
  const esAdmin = rolUsuario.toUpperCase() === 'ADMINISTRADOR' || rolUsuario.toUpperCase() === 'ADMIN';

  const estadoInicial = { idAsignacion: '', codMateria: '', idHorarios: [], idDestino: '', docentes: [] };
  const [formData, setFormData] = useState(estadoInicial);

  const cargarDatos = async () => {
      setCargando(true);
      try {
        const [dataMaterias, dataAsignaciones, dataPersonal, dataHorariosBase, dataEstas] = await Promise.all([
          materiasService.getAll(),
          horariosService.getAll(),
          personalService.getAll(),
          horariosService.getAllHorariosBase(),
          horariosService.getEstas()
        ]);

        setListaMaterias(dataMaterias);
        setListaPersonal(dataPersonal);
        setListaHorariosDisponibles(dataHorariosBase);

        const asignacionesConDocentes = dataAsignaciones.map(asig => {
          const profesAsignados = dataEstas
            .filter(relacion => String(relacion.idAsignacion) === String(asig.idAsignacion))
            .map(relacion => String(relacion.idPersonal));

          return {
            ...asig,
            docentes: profesAsignados
          };
        });

        setAsignaciones(asignacionesConDocentes);

      } catch (e) {
        console.error("Error cargando datos:", e);
      }
      setCargando(false);
    };

  useEffect(() => { cargarDatos(); }, []);

  const handleSubmit = async (e) => {
      e.preventDefault();

      if (cargando) return;

      setCargando(true);

      const materiaCompleta = listaMaterias.find(m => String(m.codMateria) === String(formData.codMateria));
      const destinoCompleto = destinosData.find(d => String(d.idDestino) === String(formData.idDestino));

      try {
        if (editando) {
          const horarioCompleto = listaHorariosDisponibles.find(h => String(h.idHorario) === String(formData.idHorarios[0]));
          const payload = {
            idAsignacion: formData.idAsignacion,
            materia: materiaCompleta,
            horario: horarioCompleto,
            destino: destinoCompleto
          };

          await horariosService.update(formData.idAsignacion, payload);
          const docentesViejos = (editando.docentes || []).map(String);
          const docentesNuevos = formData.docentes.map(String);
          const aBorrar = docentesViejos.filter(id => !docentesNuevos.includes(id));
          const aAgregar = docentesNuevos.filter(id => !docentesViejos.includes(id));

          for (const idPersonal of aBorrar) {
              await horariosService.deleteAsignacionProfesor(formData.idAsignacion, idPersonal);
          }
          for (const idPersonal of aAgregar) {
              await horariosService.createAsignacionProfesor(formData.idAsignacion, idPersonal);
          }

          Swal.fire({ title: '¡Éxito!', text: 'Asignación actualizada.', icon: 'success', timer: 2000 });
        } else {
          for (const idHorario of formData.idHorarios) {
            const horarioCompleto = listaHorariosDisponibles.find(h => String(h.idHorario) === String(idHorario));
            const payload = { materia: materiaCompleta, horario: horarioCompleto, destino: destinoCompleto };

            const nuevaAsignacion = await horariosService.create(payload);

            if (nuevaAsignacion && nuevaAsignacion.idAsignacion) {
              for (const idPersonal of formData.docentes) {
                await horariosService.createAsignacionProfesor(nuevaAsignacion.idAsignacion, idPersonal);
              }
            }
          }

          Swal.fire({ title: '¡Éxito!', text: 'Clases asignadas.', icon: 'success', timer: 2000 });
        }
        cerrarModal();
        cargarDatos();
      } catch (error) {
         let mensajeError = error.message || 'No se pudo guardar la asignación.';

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

  const handleEliminar = async (clase) => {
    Swal.fire({
      title: '¿Estás seguro?', text: "Se eliminará esta asignación.", icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#ef4444', confirmButtonText: 'Sí, eliminar', reverseButtons: true
    }).then(async (result) => {
      if (result.isConfirmed) {
        setCargando(true);
        try {
          if (clase.docentes && clase.docentes.length > 0) {
             for (const idPersonal of clase.docentes) try { await horariosService.deleteAsignacionProfesor(clase.idAsignacion, idPersonal); } catch(e){}
          }
          await horariosService.delete(clase.idAsignacion);
          Swal.fire({ title: 'Eliminado', text: 'La clase ha sido borrada.', icon: 'success', timer: 1500 });
          cargarDatos();
        } catch (error) {
          Swal.fire('Error', 'Hubo un fallo al intentar eliminar.', 'error');
          setCargando(false);
        }
      }
    });
  };

  const abrirEdicion = (asig) => {
    setEditando(asig);
    setFormData({
      idAsignacion: asig.idAsignacion, codMateria: asig.materia?.codMateria || '',
      idHorarios: asig.horario?.idHorario ? [asig.horario.idHorario] : [], idDestino: asig.destino?.idDestino || '', docentes: asig.docentes || []
    });
    setInputMateria(asig.materia?.nombreMateria || '');
    setInputDestino(asig.destino?.nombreDestino || asig.destino?.idDestino || '');
    setInputDocente('');
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false); setEditando(null); setFormData(estadoInicial);
    setInputMateria(''); setInputDestino(''); setInputDocente(''); setFiltroDia('');
  };

  const toggleHorario = (idHorario, estaOcupado) => {
    if (estaOcupado) return;
    if (editando) { setFormData({ ...formData, idHorarios: [idHorario] }); }
    else {
      const seleccionado = formData.idHorarios.includes(idHorario);
      if (seleccionado) setFormData({ ...formData, idHorarios: formData.idHorarios.filter(id => id !== idHorario) });
      else setFormData({ ...formData, idHorarios: [...formData.idHorarios, idHorario] });
    }
  };

    const clasesDelDia = (dia) => {
        return asignaciones.filter(a => a.horario?.dias === dia || a.horario?.dia === dia).filter(a => {
            if (!busquedaGrilla) return true;
            const termino = normalizarTexto(busquedaGrilla);
            const matchMateria = normalizarTexto(a.materia?.nombreMateria).includes(termino) || normalizarTexto(a.materia?.codMateria).includes(termino);
            const matchDestino = normalizarTexto(a.destino?.nombreDestino).includes(termino) || normalizarTexto(a.destino?.idDestino).includes(termino);
            const matchDocente = a.docentes?.some(idDoc => {
               const p = listaPersonal.find(pers => pers.idPersonal === idDoc);
               return p && normalizarTexto(`${p.nombrePersonal} ${p.apellidoPersonal}`).includes(termino);
            });
            return matchMateria || matchDestino || matchDocente;
          }).sort((a, b) => (a.horario?.horaInicio || '').localeCompare(b.horario?.horaInicio || ''));
      };

  const horariosFiltrados = listaHorariosDisponibles.filter(h => filtroDia === '' || (h.dias === filtroDia || h.dia === filtroDia));
  const horariosBaseFiltrados = listaHorariosDisponibles.filter(h => filtroDiaBase === '' || (h.dias === filtroDiaBase || h.dia === filtroDiaBase));

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  };

 const handleGuardarBase = async (e) => {
     e.preventDefault();
     if (cargando) return;

     if (!formBase.horaInicio || !formBase.horaFin) return;

     setCargando(true);
     try {
       const payload = {
         dias: formBase.dias,
         horaInicio: formatTime(formBase.horaInicio),
         horaFin: formatTime(formBase.horaFin)
       };

       if (editandoBase) {
         payload.idHorario = formBase.idHorario;
         await horariosService.updateHorario(formBase.idHorario, payload);
       } else {
         await horariosService.createHorario(payload);
       }

       Swal.fire({ toast: true, position: 'bottom-end', icon: 'success', title: 'Turno guardado', showConfirmButton: false, timer: 2000 });
       setFormBase({ idHorario: '', dias: 'Lunes', horaInicio: '08:00', horaFin: '10:00' });
       setEditandoBase(null);
       cargarDatos();
     } catch (error) {
       let mensajeError = error.message || 'No se pudo guardar el turno.';

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
       Swal.fire('Atención', mensajeError, 'warning');
     } finally {
       setCargando(false);
     }
   };


  const handleEliminarBase = async (idHorario) => {
    if (asignaciones.some(a => a.horario?.idHorario === idHorario)) {
       Swal.fire('No permitido', 'Este turno base está siendo usado por una clase. Eliminala primero.', 'warning');
       return;
    }

    Swal.fire({ title: '¿Eliminar turno?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Eliminar' })
      .then(async (result) => {
        if (result.isConfirmed) {
          setCargando(true);
          try {
            await horariosService.deleteHorario(idHorario);
            Swal.fire({ toast: true, position: 'bottom-end', icon: 'success', title: 'Turno eliminado', showConfirmButton: false, timer: 1500 });
            cargarDatos();
          } catch(e) { Swal.fire('Error', 'No se pudo eliminar.', 'error'); setCargando(false); }
        }
    });
  };

const abrirEdicionBase = (hb) => {
    setEditandoBase(hb);
    let inicioStr = typeof hb.horaInicio === 'string'
      ? hb.horaInicio.substring(0, 5)
      : Array.isArray(hb.horaInicio)
        ? `${String(hb.horaInicio[0]).padStart(2, '0')}:${String(hb.horaInicio[1]).padStart(2, '0')}`
        : '08:00';

    let finStr = typeof hb.horaFin === 'string'
      ? hb.horaFin.substring(0, 5)
      : Array.isArray(hb.horaFin)
        ? `${String(hb.horaFin[0]).padStart(2, '0')}:${String(hb.horaFin[1]).padStart(2, '0')}`
        : '10:00';

    setFormBase({
      idHorario: hb.idHorario,
      dias: hb.dias || hb.dia,
      horaInicio: inicioStr,
      horaFin: finStr
    });
  };



  return (
    <div className="space-y-6 h-full flex flex-col p-2">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="text-indigo-600" /> Calendario de Asignaciones
          </h1>
          <p className="text-slate-500 text-sm">Vincula materias con horarios y aulas existentes.</p>
        </div>

        {/* Vista de edicion para Admins */}
        {esAdmin && (
          <div className="flex gap-3">
            <button
              onClick={() => setMostrarModalBase(true)}
              className="bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all"
            >
              <Settings size={18} /> Turnos
            </button>

            <button
              onClick={() => { cerrarModal(); setMostrarModal(true); }}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 flex items-center gap-2 shadow-md shadow-indigo-100 transition-all"
            >
              <Plus size={20} /> Nueva Asignación
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-start">
        <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm w-full max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Filtrar calendario por aula, materia o profesor..."
              value={busquedaGrilla}
              onChange={(e) => setBusquedaGrilla(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm"
            />
          </div>
        </div>
      </div>

      {/* Contenedor de la grilla con los nuevos límites (w-full min-w-0) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-x-auto w-full min-w-0">
              {cargando ? (
                <div className="flex items-center justify-center h-64 text-slate-500 font-medium animate-pulse">Cargando datos...</div>
              ) : (
                <div className="min-w-[900px] grid grid-cols-6 divide-x divide-slate-200">
                  {DIAS_SEMANA.map(dia => {
                    const clases = clasesDelDia(dia);
                    return (
                <div key={dia} className="flex flex-col bg-slate-50/50 min-h-[50vh]">
                  <div className="bg-slate-100 py-3 text-center border-b border-slate-200 sticky top-0 z-10">
                    <h3 className="font-bold text-slate-700 uppercase tracking-wide text-sm">{dia}</h3>
                    <span className="text-xs text-slate-500">{clases.length} clases</span>
                  </div>
                  <div className="p-3 flex flex-col gap-3">
                    {clases.map(clase => (
                      <div
                        key={clase.idAsignacion}
                        onClick={() => setClaseDetalle(clase)}
                        className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm border-l-4 border-l-indigo-500 hover:shadow-md hover:-translate-y-0.5 transition-all group relative cursor-pointer"
                      >
                        {esAdmin && (
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur rounded-lg p-1 shadow-sm border border-slate-100 z-10">
                            <button onClick={(e) => { e.stopPropagation(); abrirEdicion(clase); }} className="p-1 text-slate-400 hover:text-indigo-600 rounded bg-white"><Edit2 size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleEliminar(clase); }} className="p-1 text-slate-400 hover:text-rose-600 rounded bg-white"><Trash2 size={14} /></button>
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 w-fit px-2 py-0.5 rounded flex items-center gap-1">
                            <Clock size={12} />
                            {clase.horario?.horaInicio?.substring(0, 5)} - {clase.horario?.horaFin?.substring(0, 5)}
                          </span>
                          <h4 className="font-bold text-slate-800 leading-tight pr-8">
                            {clase.materia?.nombreMateria || 'Materia desconocida'}
                          </h4>
                        </div>
                      </div>
                    ))}
                    {clases.length === 0 && (
                      <div className="text-center p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm font-medium">
                        {busquedaGrilla ? 'Sin coincidencias' : 'Día libre'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Nueva Asignación  */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl border border-slate-100 max-h-[95vh] overflow-y-auto mt-4 sm:mt-0 relative">
            <div className="flex justify-between items-start mb-6 sticky top-0 bg-white z-20 pb-2 border-b border-slate-50">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {editando ? <Edit2 className="text-indigo-500" /> : <Plus className="text-indigo-500" />}
                {editando ? 'Editar Asignación' : 'Configurar Asignación'}
              </h2>
              <button onClick={cerrarModal} className="p-2 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-500 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Buscar Materia <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text" autoComplete="off" placeholder="Ej: Análisis..."
                      value={inputMateria}
                      onChange={e => { setInputMateria(e.target.value); setFormData({...formData, codMateria: ''}); }}
                      onFocus={() => setFocoMateria(true)}
                      onBlur={() => setTimeout(() => setFocoMateria(false), 200)}
                      className={`w-full pl-9 pr-3 p-3 bg-slate-50 border rounded-xl outline-none transition-all ${formData.codMateria ? 'border-emerald-300 ring-1 ring-emerald-100 bg-emerald-50/30' : 'border-slate-200 focus:ring-2 focus:ring-indigo-500'}`}
                    />
                  </div>
                    {/* Lógica del desplegable de Materia */}
                    {focoMateria && (
                      <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {listaMaterias
                          .filter(m => {
                            const busquedaLimpia = normalizarTexto(inputMateria);
                            const nombreLimpio = normalizarTexto(m.nombreMateria);
                            const codigoLimpio = normalizarTexto(m.codMateria);
                            return nombreLimpio.includes(busquedaLimpia) || codigoLimpio.includes(busquedaLimpia);
                          })
                          .map(m => (
                            <li key={m.codMateria} onMouseDown={() => { setInputMateria(m.nombreMateria); setFormData({...formData, codMateria: m.codMateria}); }} className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-slate-700 text-sm">
                              <span className="font-mono text-xs text-slate-400 mr-2">{m.codMateria}</span> {m.nombreMateria}
                            </li>
                        ))}
                      </ul>
                    )}
                </div>

                <div className="relative">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Buscar Aula / Laboratorio <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text" autoComplete="off" placeholder="Ej: Aula 210..."
                      value={inputDestino}
                      onChange={e => { setInputDestino(e.target.value); setFormData({...formData, idDestino: ''}); }}
                      onFocus={() => setFocoDestino(true)}
                      onBlur={() => setTimeout(() => setFocoDestino(false), 200)}
                      className={`w-full pl-9 pr-3 p-3 bg-slate-50 border rounded-xl outline-none transition-all ${formData.idDestino ? 'border-emerald-300 ring-1 ring-emerald-100 bg-emerald-50/30' : 'border-slate-200 focus:ring-2 focus:ring-indigo-500'}`}
                    />
                  </div>
                    {focoDestino && (
                      <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {destinosData
                          .filter(d => {
                            const busquedaLimpia = normalizarTexto(inputDestino);
                            const destinoLimpio = normalizarTexto(d.nombreDestino || d.idDestino);
                            return destinoLimpio.includes(busquedaLimpia);
                          })
                          .map(d => (
                            <li key={d.idDestino} onMouseDown={() => { setInputDestino(d.nombreDestino || d.idDestino); setFormData({...formData, idDestino: d.idDestino}); }} className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-slate-700 text-sm">
                              {d.nombreDestino || d.idDestino}
                            </li>
                        ))}
                      </ul>
                    )}
                </div>
              </div>

              <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
                    Seleccionar Horarios <span className="text-rose-500">*</span>
                    {!editando && <span className="text-xs font-normal text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">Podés elegir varios</span>}
                  </label>
                  <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200">
                    <Filter size={14} className="text-slate-400" />
                    <select value={filtroDia} onChange={e => setFiltroDia(e.target.value)} className="bg-transparent text-sm outline-none text-slate-600 font-medium cursor-pointer">
                      <option value="">Todos los días</option>
                      {DIAS_SEMANA.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {horariosFiltrados.map(h => {
                    const seleccionado = formData.idHorarios.includes(h.idHorario);
                    const ocupadoPorAula = formData.idDestino && asignaciones.some(
                      a => String(a.destino?.idDestino) === String(formData.idDestino) &&
                           String(a.horario?.idHorario) === String(h.idHorario) &&
                           String(a.idAsignacion) !== String(formData.idAsignacion)
                    );

                    const ocupadoPorMateria = formData.codMateria && asignaciones.some(
                      a => String(a.materia?.codMateria) === String(formData.codMateria) &&
                           String(a.horario?.idHorario) === String(h.idHorario) &&
                           String(a.idAsignacion) !== String(formData.idAsignacion)
                    );

                    const ocupadoPorDocente = formData.docentes && formData.docentes.length > 0 && asignaciones.some(
                      a => String(a.horario?.idHorario) === String(h.idHorario) &&
                           String(a.idAsignacion) !== String(formData.idAsignacion) &&
                           a.docentes?.some(idDoc => formData.docentes.map(String).includes(String(idDoc)))
                    );

                    const estaOcupado = ocupadoPorAula || ocupadoPorMateria || ocupadoPorDocente;

                    let motivoOcupacion = '';
                    if (ocupadoPorAula) motivoOcupacion = 'Aula Ocupada';
                    else if (ocupadoPorMateria) motivoOcupacion = 'Materia ya agendada';
                    else if (ocupadoPorDocente) motivoOcupacion = 'Profesor ocupado';

                    return (
                      <div
                        key={h.idHorario}
                        onClick={() => toggleHorario(h.idHorario, estaOcupado)}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col relative ${
                          estaOcupado ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed' : seleccionado ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100 cursor-pointer' : 'border-slate-200 bg-white hover:border-slate-300 cursor-pointer'
                        }`}
                      >
                        {seleccionado && !estaOcupado && <div className="absolute top-2 right-2 text-indigo-600"><Check size={16}/></div>}
                        {estaOcupado && (
                          <div className="absolute top-2 right-2 text-rose-500 bg-rose-50 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-rose-100">
                            <Ban size={10} /> {motivoOcupacion}
                          </div>
                        )}
                        <span className={`text-xs font-black uppercase mb-1 ${estaOcupado ? 'text-slate-500' : 'text-indigo-600'}`}>{h.dias || h.dia}</span>
                        <span className={`text-sm font-bold ${estaOcupado ? 'text-slate-500' : 'text-slate-700'}`}>
                          {h.horaInicio?.substring(0,5)} a {h.horaFin?.substring(0,5)}
                        </span>
                      </div>
                    )
                  })}
                  {horariosFiltrados.length === 0 && (
                      <p className="text-sm text-slate-400 italic col-span-2 text-center py-4">No hay horarios que coincidan con el filtro.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Users size={18} className="text-indigo-500" /> Profesores asignados a esta clase
                </label>

                {/* Profesores ya asignados*/}
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.docentes.map(id => {
                    const p = listaPersonal.find(pers => String(pers.idPersonal) === String(id));
                    return p ? (
                      <span key={id} className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-200 flex items-center gap-2">
                        {p.apellidoPersonal}, {p.nombrePersonal}
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, docentes: formData.docentes.filter(d => String(d) !== String(id))})}
                          className="hover:text-rose-600 text-emerald-500 font-black text-lg leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>

                <div className="relative">
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                     <input
                        type="text" autoComplete="off" placeholder="Buscar profesor por apellido o nombre..."
                        value={inputDocente}
                        onChange={e => setInputDocente(e.target.value)}
                        onFocus={() => setFocoDocente(true)}
                        onBlur={() => setTimeout(() => setFocoDocente(false), 200)}
                        className="w-full pl-9 pr-3 p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                     />
                  </div>

 {focoDocente && (
                     <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                       {listaPersonal
                         .filter(p => !formData.docentes.map(String).includes(String(p.idPersonal)))
                         .filter(p => {
                            // Aplicamos la normalización al buscador de docentes
                            const busquedaLimpia = normalizarTexto(inputDocente);
                            const nombreLimpio = normalizarTexto(`${p.apellidoPersonal} ${p.nombrePersonal}`);
                            return nombreLimpio.includes(busquedaLimpia);
                         })
                         .map(p => (
                           <li
                             key={p.idPersonal}
                             onMouseDown={() => {
                                setFormData({...formData, docentes: [...formData.docentes, p.idPersonal]});
                                setInputDocente('');
                             }}
                             className="px-4 py-2 hover:bg-emerald-50 cursor-pointer text-slate-700 text-sm flex justify-between"
                           >
                             <span><span className="font-bold">{p.apellidoPersonal}</span>, {p.nombrePersonal}</span>
                             <span className="text-xs text-slate-400">{p.cargoLaboral}</span>
                           </li>
                       ))}
                     </ul>
                   )}
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button type="button" onClick={cerrarModal} className="flex-1 px-6 py-3 text-slate-500 font-bold bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">Cancelar</button>
                <button
                  type="submit"
                  disabled={!formData.codMateria || !formData.idDestino || formData.idHorarios.length === 0}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:grayscale"
                >
                  Confirmar Asignación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Turnos */}
      {mostrarModalBase && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 flex flex-col md:flex-row overflow-hidden max-h-[90vh]">

            <div className="flex-1 bg-slate-50 p-6 flex flex-col h-full border-r border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3 relative">
                 <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                   <Settings className="text-indigo-500" /> Turnos
                 </h2>

                 <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
                    <Filter size={16} className="text-slate-400" />
                    <select value={filtroDiaBase} onChange={e => setFiltroDiaBase(e.target.value)} className="w-full bg-transparent text-sm outline-none text-slate-600 font-medium cursor-pointer">
                      <option value="">Todos los días</option>
                      {DIAS_SEMANA.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                 </div>

                 <button onClick={() => setMostrarModalBase(false)} className="md:hidden p-2 bg-slate-200 text-slate-500 rounded-full absolute top-0 right-0"><X size={16}/></button>
              </div>

              <div
                className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#cbd5e1 transparent',
                  overscrollBehavior: 'contain',
                  maxHeight: 'calc(100vh - 250px)'
                }}
              >
                 {horariosBaseFiltrados.map(hb => (
                    <div key={hb.idHorario} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center hover:border-indigo-300 transition-colors">
                      <div>
                        <span className="text-xs font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded mr-2">{hb.dias || hb.dia}</span>
                        <span className="font-bold text-slate-700">{hb.horaInicio.substring(0,5)} a {hb.horaFin.substring(0,5)}</span>
                        <div className="text-xs text-slate-400 font-mono mt-1">ID: {hb.idHorario}</div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => abrirEdicionBase(hb)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={16}/></button>
                        <button onClick={() => handleEliminarBase(hb.idHorario)} className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                      </div>
                    </div>
                 ))}

                 {horariosBaseFiltrados.length === 0 && (
                    <p className="text-slate-400 text-sm italic text-center py-6">
                      {filtroDiaBase ? `No hay turnos creados para el ${filtroDiaBase}.` : 'No hay turnos creados.'}
                    </p>
                 )}
              </div>
            </div>

            <div className="w-full md:w-80 p-6 bg-white flex flex-col relative">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-slate-800">{editandoBase ? 'Editar Turno' : 'Nuevo Turno'}</h3>
                 <button onClick={() => setMostrarModalBase(false)} className="hidden md:block p-2 hover:bg-rose-100 hover:text-rose-600 text-slate-400 rounded-full transition-colors"><X size={16}/></button>
               </div>

               <form onSubmit={handleGuardarBase} className="space-y-4 flex-1">

                 <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Día <span className="text-rose-500">*</span></label>
                    <select value={formBase.dias} onChange={e => setFormBase({...formBase, dias: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium">
                       {DIAS_SEMANA.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                   <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Inicio <span className="text-rose-500">*</span></label>
                      <SelectorTiempo
                         valor={formBase.horaInicio || '08:00'}
                         onChange={val => setFormBase({...formBase, horaInicio: val})}
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Fin <span className="text-rose-500">*</span></label>
                      <SelectorTiempo
                         valor={formBase.horaFin || '10:00'}
                         onChange={val => setFormBase({...formBase, horaFin: val})}
                      />
                   </div>
                 </div>

                 <div className="pt-6 mt-auto">
                    {editandoBase && (
                              <button type="button" onClick={() => { setEditandoBase(null); setFormBase({ idHorario: '', dias: 'Lunes', horaInicio: '08:00', horaFin: '10:00' }); }} className="w-full mb-2 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancelar Edición</button>
                    )}
                    <button
                      type="submit"
                      disabled={!formBase.horaInicio || !formBase.horaFin}
                      className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-all flex justify-center gap-2 items-center disabled:opacity-50 disabled:grayscale"
                    >
                       {editandoBase ? <Edit2 size={16}/> : <Plus size={16}/>}
                       {editandoBase ? 'Actualizar' : 'Crear Turno'}
                    </button>
                 </div>
               </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Clase*/}
      {claseDetalle && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setClaseDetalle(null)}>
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl border border-slate-100 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setClaseDetalle(null)} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-full transition-colors">
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-slate-800 mb-6 pr-8 leading-tight">
              {claseDetalle.materia?.nombreMateria || 'Materia desconocida'}
            </h3>

            <div className="space-y-5">
              <div className="flex items-center gap-4 text-slate-600">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Clock size={20} /></div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wide">Horario</p>
                  <p className="font-bold text-slate-700">{claseDetalle.horario?.dias || claseDetalle.horario?.dia} • {claseDetalle.horario?.horaInicio?.substring(0,5)} a {claseDetalle.horario?.horaFin?.substring(0,5)}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-slate-600">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><MapPin size={20} /></div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wide">Aula / Laboratorio</p>
                  <p className="font-bold text-slate-700">{claseDetalle.destino?.nombreDestino || claseDetalle.destino?.idDestino || 'Sin asignar'}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 text-slate-600">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0"><Users size={20} /></div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-1">Docentes Asignados</p>
                  {claseDetalle.docentes && claseDetalle.docentes.length > 0 ? (
                    <ul className="space-y-1">
                      {claseDetalle.docentes.map(idDoc => {
                        const p = listaPersonal.find(pers => String(pers.idPersonal) === String(idDoc));
                        return p ? (
                          <li key={idDoc} className="font-bold text-sm text-slate-700">
                            • {p.nombrePersonal} {p.apellidoPersonal}
                          </li>
                        ) : null;
                      })}
                    </ul>
                  ) : (
                    <p className="font-medium text-sm italic text-slate-400">Sin profesores asignados</p>
                  )}
                </div>
              </div>
            </div>

            {esAdmin && (
              <div className="mt-8 pt-4 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => {
                    const claseSeleccionada = claseDetalle;
                    setClaseDetalle(null);
                    abrirEdicion(claseSeleccionada);
                  }}
                  className="w-full bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors border border-slate-100"
                >
                  <Edit2 size={16} /> Editar esta clase
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
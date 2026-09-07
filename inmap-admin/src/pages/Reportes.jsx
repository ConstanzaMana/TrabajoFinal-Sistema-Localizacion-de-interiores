/**
 * Panel de Reportes:
 * Monitoreo del hardware de posicionamiento (Nodos ESP).
 * Muestra el nivel de batería, ubicación y estado de conexión en tiempo real.
 */
import React, { useState, useEffect } from 'react';
import { Activity, Search, Battery, BatteryWarning, BatteryMedium, Wifi, WifiOff, MapPin, Cpu, Eye, X, Clock, HardDrive, AlertTriangle } from 'lucide-react';
import { espService } from '../api/espService.js';

export default function Reportes() {
  const [dispositivos, setDispositivos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  // Estado para controlar el modal de detalles
  const [beaconSeleccionado, setBeaconSeleccionado] = useState(null);

  const cargarDatos = async () => {
    setCargando(true);
    const data = await espService.getAll();
    setDispositivos(data);
    setCargando(false);
  };

  useEffect(() => { cargarDatos(); }, []);

const dispositivosFiltrados = dispositivos
    .filter(d =>
      d.deviceName?.toLowerCase().includes(busqueda.toLowerCase()) ||
      d.description?.toLowerCase().includes(busqueda.toLowerCase()) ||
      String(d.idBeacon).includes(busqueda)
    )
    .sort((a, b) => {
      const nombreA = a.deviceName || '';
      const nombreB = b.deviceName || '';
      return nombreA.localeCompare(nombreB, undefined, { numeric: true, sensitivity: 'base' });
    });

  // Lógica inteligente para determinar el estado del Beacon
    const determinarEstado = (beacon) => {
      if (!beacon.isActive) return 'DESHABILITADO';
      if (beacon.batteryPercent <= 15) return 'BATERÍA BAJA';

      const fechaUltimoReporte = new Date(beacon.lastReportAt);
      const hace24hs = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (fechaUltimoReporte < hace24hs) return 'SIN SEÑAL';

      return 'ACTIVO';
    };

  const formatearMilisegundos = (ms) => {
    if (!ms && ms !== 0) return 'N/A';
    if (ms < 1000) return `${ms} ms`;

    const segundosTotales = Math.floor(ms / 1000);
    if (segundosTotales < 60) return `${segundosTotales} seg`;

    const minutos = Math.floor(segundosTotales / 60);
    const segundosRestantes = segundosTotales % 60;

    if (segundosRestantes === 0) return `${minutos} min`;
    return `${minutos} min ${segundosRestantes} seg`;
  };

  const getEstadoConfig = (estado) => {
    if (estado === 'ACTIVO') return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icono: <Wifi size={14} /> };
    if (estado === 'BATERÍA BAJA') return { color: 'bg-amber-100 text-amber-700 border-amber-200', icono: <BatteryWarning size={14} /> };
    if (estado === 'SIN SEÑAL') return { color: 'bg-rose-100 text-rose-700 border-rose-200', icono: <WifiOff size={14} /> };
    return { color: 'bg-slate-100 text-slate-700 border-slate-200', icono: <AlertTriangle size={14} /> }; // DESHABILITADO
  };

  const getBateriaIconoYColor = (nivel) => {
      // Si el valor es 85 o mayor (>= 4.06 V)
      if (nivel >= 85) {
        return { texto: 'Alta', colorTexto: 'text-emerald-700', icono: <Battery size={16} className="text-emerald-500" />, colorBarra: 'bg-emerald-500' };
      }
      // Si el valor es 50 (entre 3.95 V y 4.06 V)
      if (nivel >= 50) {
        return { texto: 'Media', colorTexto: 'text-amber-700', icono: <BatteryMedium size={16} className="text-amber-500" />, colorBarra: 'bg-amber-500' };
      }
      // Si el valor es 15 o menor (< 3.95 V)
      return { texto: 'Baja', colorTexto: 'text-rose-700', icono: <BatteryWarning size={16} className="text-rose-500 animate-pulse" />, colorBarra: 'bg-rose-500' };
    };

  const formatearFecha = (fechaIso) => {
    if (!fechaIso) return 'Sin datos';
    return new Date(fechaIso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 h-full flex flex-col p-2">

      {/* Cabecera */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="text-indigo-600" /> Monitoreo de los ESP32
          </h1>
          <p className="text-slate-500 text-sm mt-1">Estado de hardware y telemetría de la red iBeacon.</p>
        </div>
        <button
          onClick={cargarDatos}
          className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-50 flex items-center gap-2 shadow-sm font-bold transition-all"
        >
          <Activity size={18} /> Actualizar Datos
        </button>
      </div>

      {/* Buscador */}
      <div className="flex justify-start">
        <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm w-full max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por ID, nombre o ubicación..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Reportes Principal */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1">
        {cargando ? (
          <div className="p-12 text-center text-slate-500 font-medium italic animate-pulse">Recopilando telemetría...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="p-4 font-bold text-slate-600 uppercase text-xs tracking-wider">Dispositivo</th>
                  <th className="p-4 font-bold text-slate-600 uppercase text-xs tracking-wider">Ubicación</th>
                  <th className="p-4 font-bold text-slate-600 uppercase text-xs tracking-wider">Batería</th>
                  <th className="p-4 font-bold text-slate-600 uppercase text-xs tracking-wider">Estado Actual</th>
                  <th className="p-4 font-bold text-slate-600 uppercase text-xs tracking-wider text-right">Detalles</th>
                </tr>
              </thead>
              <tbody>
                {dispositivosFiltrados.map((beacon) => {
                  const estadoString = determinarEstado(beacon);
                  const estadoConfig = getEstadoConfig(estadoString);
                  const bateriaConfig = getBateriaIconoYColor(beacon.batteryPercent);

                  return (
                    <tr key={beacon.idBeacon} className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors group">

                      {/* Nombre y Minor */}
                      <td className="p-4 align-middle">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Cpu size={16} className="text-indigo-500" /> {beacon.deviceName}
                          </span>
                          <span className="text-xs text-slate-400 font-mono mt-0.5">ID: {beacon.idBeacon}</span>
                        </div>
                      </td>

                      {/* Ubicación */}
                      <td className="p-4 align-middle">
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                            <MapPin size={16} className="text-slate-400" /> {beacon.floorName || 'Sin piso'}
                          </span>
                          <span className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]" title={beacon.description}>
                            {beacon.description || 'Sin descripción'}
                          </span>
                        </div>
                      </td>

                    {/* Bateria */}
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-3 w-40">
                          {bateriaConfig.icono}
                          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${bateriaConfig.colorBarra}`}
                              style={{ width: `${Math.max(0, Math.min(100, beacon.batteryPercent))}%` }}
                            ></div>
                          </div>
                          <span className={`text-xs font-bold w-10 ${bateriaConfig.colorTexto}`}>
                            {bateriaConfig.texto}
                          </span>
                        </div>
                      </td>

                        {/* Estado */}
                           <td className="p-4 align-middle">
                             <div className="flex flex-col items-start gap-1.5">

                               <div className="flex items-center gap-2">
                                 <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black tracking-wide border ${estadoConfig.color}`}>
                                   {estadoConfig.icono}
                                   {estadoString}
                                 </span>

                                 {beacon.reportType === 'unexpected_reset' && (
                                   <span className="flex items-center gap-1 text-[9px] text-rose-600 font-bold bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 uppercase shadow-sm" title="El ESP32 se reinició de forma anómala">
                                     <AlertTriangle size={10} /> Alerta
                                   </span>
                                 )}
                               </div>

                               <span className="text-[10px] text-slate-400 font-medium">
                                 Últ. vez: {formatearFecha(beacon.lastReportAt)}
                               </span>

                             </div>
                           </td>

                      {/* Botón Detalles */}
                      <td className="p-4 align-middle text-right">
                        <button
                          onClick={() => setBeaconSeleccionado(beacon)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="Ver telemetría completa"
                        >
                          <Eye size={20} />
                        </button>
                      </td>

                    </tr>
                  );
                })}

                {dispositivosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-slate-400 italic bg-slate-50/30">
                      No se encontraron dispositivos BLE.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Telemetría Detallada */}
      {beaconSeleccionado && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">

            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Cpu className="text-indigo-600" /> {beaconSeleccionado.deviceName}
                </h2>
                <p className="text-sm text-slate-500 font-mono mt-1">UUID: {beaconSeleccionado.beaconUUID}</p>
              </div>
              <button onClick={() => setBeaconSeleccionado(null)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">

              {/* Sección: Identificación y Ubicación */}
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Identificación & Ubicación</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Major</span>
                    <span className="font-mono text-slate-800 font-bold">{beaconSeleccionado.major}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Minor</span>
                    <span className="font-mono text-slate-800 font-bold">{beaconSeleccionado.minor}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Coord X</span>
                    <span className="font-mono text-slate-800 font-bold">{beaconSeleccionado.posicionX}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Coord Y</span>
                    <span className="font-mono text-slate-800 font-bold">{beaconSeleccionado.posicionY}</span>
                  </div>
                </div>
              </div>

                {/* Sección: Diagnóstico de Hardware */}
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <HardDrive size={14} /> Telemetría del Sistema
                    </h3>

                    <div className={`mb-4 flex items-center justify-between p-3.5 border rounded-xl shadow-sm ${beaconSeleccionado.reportType === 'unexpected_reset' ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-slate-50'}`}>
                      <span className={`text-sm font-bold ${beaconSeleccionado.reportType === 'unexpected_reset' ? 'text-rose-800' : 'text-slate-700'}`}>Tipo de Último Reporte</span>
                      <span className={`font-mono text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${beaconSeleccionado.reportType === 'unexpected_reset' ? 'bg-rose-200 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {beaconSeleccionado.reportType === 'unexpected_reset' ? <AlertTriangle size={14} /> : <Clock size={14} />}
                        {beaconSeleccionado.reportType === 'unexpected_reset' ? 'REINICIO INESPERADO' : 'NORMAL (HEARTBEAT)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                        <span className="text-sm text-slate-600 font-medium">Reinicio (Reset Reason)</span>
                        <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded">{beaconSeleccionado.resetReason || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                        <span className="text-sm text-slate-600 font-medium">Motivo Despertar</span>
                        <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded">{beaconSeleccionado.wakeupCause || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                        <span className="text-sm text-slate-600 font-medium">Ciclos de Arranque</span>
                        <span className="font-mono text-xs font-bold text-indigo-600">{beaconSeleccionado.bootCount}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                        <span className="text-sm text-slate-600 font-medium">Memoria Heap Libre</span>
                        <span className="font-mono text-xs font-bold text-emerald-600">{(beaconSeleccionado.freeHeapBytes / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                  </div>

              {/* Sección: Tiempos */}
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Clock size={14} /> Tiempos de Ejecución
                </h3>
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 grid grid-cols-2 gap-4">
                   <div>
                    <span className="block text-[10px] uppercase text-indigo-500 font-bold mb-1">Uptime del Ciclo</span>
                    <span className="font-mono text-indigo-900 font-bold">
                      {formatearMilisegundos(beaconSeleccionado.uptimeMs)}
                    </span>
                    <p className="text-[10px] text-indigo-400 mt-1 leading-tight">Tiempo que tardó el chip en despertarse y mandar este reporte.</p>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-indigo-500 font-bold mb-1">Sueño Acumulado</span>
                    <span className="font-mono text-indigo-900 font-bold">
                      {formatearMilisegundos(beaconSeleccionado.accumulatedSleepSeconds)}
                    </span>
                    <p className="text-[10px] text-indigo-400 mt-1 leading-tight">Tiempo dormido en Deep Sleep antes de emitir.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
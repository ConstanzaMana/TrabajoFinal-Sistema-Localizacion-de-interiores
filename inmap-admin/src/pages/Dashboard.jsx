/**
 * componente principal del panel de control (dashboard).
 * presenta un resumen cuantitativo del sistema y proporciona un acceso
 * directo al editor del plano interactivo con una previsualización en vivo.
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Map, Users, BookOpen, Calendar,
  ArrowRight
} from 'lucide-react';

import { MapContainer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { materiasService } from '../api/materiaService.js';
import { personalService } from '../api/personalService.js';
import { horariosService } from '../api/horariosService.js';
import { mapaService } from '../api/mapaService.js';

// normaliza los datos recibidos de la api
const extraerArreglo = (datos) => {
  if (!datos) return [];
  if (Array.isArray(datos)) return datos;
  if (datos.recinto) return datos.recinto;
  if (datos.zona) return datos.zona;
  return Object.values(datos).find(Array.isArray) || [];
};

// transforma los datos planos en un formato geojson compatible con el mapa
const convertirParaFondo = (datos) => {
  const arreglo = extraerArreglo(datos);
  if (arreglo.length === 0) return null;
  return {
    type: "FeatureCollection",
    features: arreglo.map(item => ({
      type: "Feature",
      properties: { bloqueado: item.bloqueado || false },
      geometry: item.geometria
    }))
  };
};

export default function Dashboard() {
  const [conteos, setConteos] = useState({ materias: 0, personal: 0, clases: 0 });
  const [cargando, setCargando] = useState(true);
  const [geoRecintos, setGeoRecintos] = useState(null);
  const [geoZonas, setGeoZonas] = useState(null);
  const navigate = useNavigate();

  // sincronización inicial de métricas y datos geográficos del sistema
  useEffect(() => {
    const cargarDatosYMapa = async () => {
      setCargando(true);

      const [dataMaterias, dataPersonal, dataClases, recintos, zonas] = await Promise.all([
        materiasService.getAll(),
        personalService.getAll(),
        horariosService.getAll(),
        mapaService.getRecintos(),
        mapaService.getZonas()
      ]);

      setConteos({
        materias: dataMaterias.length,
        personal: dataPersonal.length,
        clases: dataClases.length
      });

      setGeoRecintos(convertirParaFondo(recintos));
      setGeoZonas(convertirParaFondo(zonas));
      setCargando(false);
    };

    cargarDatosYMapa();
  }, []);

  return (
    <div className="h-full flex flex-col space-y-4 overflow-hidden">

      {/* encabezado simplificado en una sola línea */}
      <div className="shrink-0 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-2000 tracking-tight">
          Bienvenido al Sistema de Gestión de InMap
        </h1>
      </div>

      {/* sección de tarjetas compactas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">

        <Link to="/materias" className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 hover:shadow-md hover:border-indigo-300 transition-all group cursor-pointer">
          <div className="p-3 rounded-lg bg-indigo-100 text-indigo-600 group-hover:scale-105 transition-transform">
            <BookOpen size={24} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Materias</p>
            <p className="text-2xl font-black text-slate-800">
              {cargando ? <span className="text-slate-200">...</span> : conteos.materias}
            </p>
          </div>
          <ArrowRight size={18} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
        </Link>

        <Link to="/personal" className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 hover:shadow-md hover:border-emerald-300 transition-all group cursor-pointer">
          <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600 group-hover:scale-105 transition-transform">
            <Users size={24} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-600 transition-colors">Personal</p>
            <p className="text-2xl font-black text-slate-800">
              {cargando ? <span className="text-slate-200">...</span> : conteos.personal}
            </p>
          </div>
          <ArrowRight size={18} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
        </Link>

        <Link to="/horarios" className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 hover:shadow-md hover:border-purple-300 transition-all group cursor-pointer">
          <div className="p-3 rounded-lg bg-purple-100 text-purple-600 group-hover:scale-105 transition-transform">
            <Calendar size={24} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-purple-600 transition-colors">Clases</p>
            <p className="text-2xl font-black text-slate-800">
              {cargando ? <span className="text-slate-200">...</span> : conteos.clases}
            </p>
          </div>
          <ArrowRight size={18} className="text-slate-300 group-hover:text-purple-500 transition-colors" />
        </Link>
      </div>

      {/* banner del mapa */}
      <div
        onClick={() => navigate('/mapa')}
        className="relative bg-slate-50 rounded-2xl overflow-hidden shadow-sm flex-1 group cursor-pointer hover:shadow-md transition-all duration-300 border border-slate-200 min-h-0"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 h-full relative z-10">

      {/* panel de información del editor (izquierda) */}
      <div className="relative p-6 md:p-8 flex flex-col justify-center items-start z-10 h-full bg-slate-800">
        <div className="relative">
          {/* icono con fondo más claro para resaltar */}
          <div className="bg-slate-700 w-fit p-2.5 rounded-xl mb-4 border border-slate-600 shadow-sm group-hover:scale-105 transition-transform duration-300">
            <Map className="text-blue-300" size={28} />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight tracking-tight">
            Editor del plano <br/>
            <span className="text-blue-400">del Campus</span>
          </h2>
          <p className="text-slate-400 font-medium mb-6 max-w-sm text-sm leading-relaxed">
            Gestioná aulas en tiempo real y bloqueá zonas directamente desde el mapa.
          </p>
          <div className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors hover:bg-blue-500">
            Abrir Editor <ArrowRight size={16} />
          </div>
        </div>
      </div>

      {/* visualización cartográfica con degradado (derecha) */}
      <div className="relative h-40 md:h-full overflow-hidden bg-slate-50">

        <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-slate-800 via-slate-800/70 to-transparent z-10 pointer-events-none hidden md:block" />

        <div className="absolute inset-0 z-0 pointer-events-none transition-transform duration-1000 group-hover:scale-105">
          {geoRecintos && (
            <MapContainer
              center={[519, 2874]}
              zoom={2}
              crs={L.CRS.Simple}
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              keyboard={false}
              attributionControl={false}
              className="w-full h-full"
              style={{ background: 'transparent' }}
            >
              <GeoJSON
                data={geoRecintos}
                style={{ fillColor: '#94a3b8', weight: 1.5, color: '#3b82f6', fillOpacity: 0.1 }}
              />
              {geoZonas && (
                <GeoJSON
                  data={geoZonas}
                  style={(f) => ({
                    fillColor: f.properties.bloqueado ? '#ef4444' : '#e2e8f0',
                    weight: 1.2,
                    color: '#94a3b8',
                    fillOpacity: f.properties.bloqueado ? 0.5 : 0.4
                  })}
                />
              )}
            </MapContainer>
          )}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
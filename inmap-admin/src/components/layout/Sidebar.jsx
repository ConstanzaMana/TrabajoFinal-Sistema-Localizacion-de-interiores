//Barra lateral de navegación

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Map, GraduationCap,
  Clock, Settings, LogOut, Users, Activity // 👇 NUEVO: Agregamos el ícono Activity
} from 'lucide-react';
import Swal from 'sweetalert2';

import logo from "../../assets/logo.png";


const SidebarItem = ({ icon: Icon, label, to }) => {
  const location = useLocation();
  const active = location.pathname === to;

  return (
    <Link to={to} className="block no-underline">
      <div className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
        active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}>
        <Icon size={20} />
        <span className="font-medium">{label}</span>
      </div>
    </Link>
  );
};

export default function Sidebar() {
  const navigate = useNavigate();

  // gestiona la salida del usuario eliminando credenciales y redirigiendo al login
  const handleLogout = () => {
    Swal.fire({
      title: '¿Cerrar sesión?',
      text: "Tendrás que volver a ingresar tus credenciales.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ef4444', // Rojo (equivalente a rose-500/red-500)
      cancelButtonColor: '#4f46e5',  // Azul/Indigo (el color principal de InMap)
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        // limpieza de persistencia local para invalidar la sesión
        localStorage.clear();
        sessionStorage.clear();
        navigate('/login');
      }
    });
  };

  return (
    // contenedor lateral
      <aside className="w-64 bg-slate-900 p-6 flex flex-col h-screen sticky top-0 shadow-xl select-none border-r border-slate-800 overflow-y-auto">
      <Link to="/" className="flex items-center gap-3 px-2 mb-10 shrink-0 hover:opacity-80 transition-opacity no-underline">
          <img src={logo} alt="InMap Logo" className="w-12 h-12 object-contain rounded-xl" />
          <h1 className="text-xl font-bold text-white tracking-tight">InMap Admin</h1>
      </Link>

      {/* navegación principal del panel de administración */}
      <nav className="flex flex-col gap-2 shrink">
        <SidebarItem icon={LayoutDashboard} label="Dashboard" to="/" />
        <SidebarItem icon={Map} label="Plano" to="/mapa" />
        <SidebarItem icon={GraduationCap} label="Materias" to="/materias" />
        <SidebarItem icon={Clock} label="Horarios" to="/horarios" />
        <SidebarItem icon={Users} label="Personal" to="/personal" />

        <SidebarItem icon={Activity} label="Reportes" to="/reportes" />
      </nav>

      {/* acciones de usuario y configuración*/}
      <div className="mt-auto pt-6 border-t border-slate-800 space-y-2 shrink-0">
        <SidebarItem icon={Settings} label="Configuración" to="/config" />

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all text-slate-400 hover:bg-rose-900/20 hover:text-rose-400 w-full group"
        >
          <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </div>

    </aside>
  );
}
//Cabecera superior
import React from 'react';

export default function Navbar() {
  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center px-8">
      <h2 className="text-sm font-medium text-slate-500">
        Sistema de Localización de Interiores / <span className="text-slate-900 font-semibold">Panel de Administración</span>
      </h2>

    </header>
  );
}
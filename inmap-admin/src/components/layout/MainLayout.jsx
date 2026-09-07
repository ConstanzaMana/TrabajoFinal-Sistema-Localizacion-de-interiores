/**
 * Estructura principal de la aplicación
 * define la organización visual, integrando la barra lateral, la cabecera y el contenedor dinámico.
 */
import React from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function MainLayout({ children }) {
  return (
    // contenedor principal
    <div className="flex min-h-screen bg-slate-50">
      {/* barra de navegación lateral fija */}
      <Sidebar />
      {/* área de contenido principal con scroll vertical independiente */}
      <div className="flex-1 flex flex-col">
        {/* barra de herramientas superior */}
        <Navbar />

        <main className="p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
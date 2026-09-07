/**
 * Configuración central de enrutamiento y seguridad.
 * Protege el acceso administrativo.
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard.jsx';
import MapaEditor from './pages/mapaEditor.jsx';
import Materias from './pages/Materias.jsx';
import Horarios from './pages/Horarios';
import Personal from './pages/Personal.jsx';
import Login from './pages/Login.jsx';
import Configuracion from './pages/Configuracion';
import RecuperarPassword from './pages/RecuperarPassword.jsx';
import RestablecerPassword from './pages/RestablecerPassword.jsx';
import Reportes from './pages/Reportes';

/**
 * Valida sesiones activas.
 * verifica la existencia del token en el almacenamiento local  para autorizar el acceso a las vistas privadas.
 */
const RutaPrivada = ({ children }) => {
  const token = localStorage.getItem('adminToken');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const tiempoExpiracion = payload.exp * 1000;

    if (Date.now() >= tiempoExpiracion) {
      localStorage.clear();
      return <Navigate to="/login" replace />;
    }
  } catch (error) {
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ruta pública: acceso al portal de autenticación */}
        <Route path="/login" element={<Login />} />
        <Route path="/recuperar-password" element={<RecuperarPassword />} />
        <Route path="/reset-password" element={<RestablecerPassword />} />

        {/* rutas privadas: protegidas y envueltas en la estructura principal */}
        <Route
          path="/*"
          element={
            <RutaPrivada>
              <MainLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/mapa" element={<MapaEditor />} />
                  <Route path="/materias" element={<Materias />} />
                  <Route path="/horarios" element={<Horarios />} />
                  <Route path="/personal" element={<Personal />} />
                  <Route path="/reportes" element={<Reportes />} />
                  <Route path="/config" element={<Configuracion />} />
                </Routes>
              </MainLayout>
            </RutaPrivada>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

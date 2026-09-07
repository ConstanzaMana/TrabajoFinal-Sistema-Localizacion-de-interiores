**InMap - Sistema de Localización y Navegación en Interiores**

Este repositorio contiene el ecosistema completo de software diseñado para el posicionamiento y la navegación en interiores.
Además de la aplicación móvil principal, el repositorio integra la plataforma web de gestión (Panel de Administradores en la carpeta inmap-admin) 
y un conjunto de herramientas y funciones auxiliares que fueron desarrolladas para probar, calibrar y validar los algoritmos de posicionamiento y enrutamiento durante la fase de investigación.

El sistema central utiliza señales Bluetooth Low Energy (BLE) emitidas por balizas de hardware (nodos ESP32) para estimar la ubicación del usuario en tiempo real. 
Esto se logra procesando la intensidad de la señal (RSSI) mediante el algoritmo matemático de Centroide Ponderado (WCL). A partir de esta estimación, el sistema traza rutas óptimas evitando obstáculos físicos dentro del edificio.

**Aplicacion InMap**

Arquitectura Híbrida (Flutter + Unity 3D): El proyecto cuenta con una integración bidireccional entre dos entornos:
-Capa Lógica y UI (Flutter/Dart): Se encarga de la interacción con el hardware del dispositivo (escáner BLE), la lógica de negocio y la mitigación de ruido espacial.
-Capa de Renderizado (Unity/C#): Motor gráfico embebido que virtualiza la topografía del edificio en 3D, ofreciendo manipulación de cámara, visualización de rutas dinámicas y marcadores interactivos.
Ambos entornos operan en sincronía, comunicándose de manera asíncrona mediante el intercambio de mensajes estructurados en formato JSON.

Estructura del Código Fuente:

Archivos DART
-mapa_screen.dart:
Actúa como el núcleo de la interfaz de usuario (UI) en Flutter. Gestiona la comunicación bidireccional con el motor gráfico 3D incrustado (Unity). 
Controla de forma asíncrona el buscador de entidades (Aulas, Docentes, Materias) y gestiona la actualización visual del estado de la navegación.
-ruta_utils.dart:
Implementa el algoritmo de búsqueda A* para la navegación en interiores. Incorpora filtros direccionales (Anti Zig-Zag) y heurísticas de penalización por proximidad a obstáculos. 
Además, traduce la trayectoria matemática resultante en instrucciones semánticas paso a paso.
-navegacion_controller.dart: 
Intercepta las coordenadas crudas estimadas y les aplica restricciones físicas: límite de velocidad humana, Snap topológico hacia zonas transitables 
(evitando atravesamiento de paredes) y adherencia magnética hacia la ruta ideal trazada.
-posicionamiento_nn.dart:
Módulo de cálculo espacial. Contiene la implementación del modelo matemático de producción basado en el algoritmo heurístico de Centroide Ponderado (WCL) para estimar la ubicación. 
También preserva (como deprecated para investigación) los ensayos de laboratorio realizados con modelos de Redes Neuronales Densas (MLP) en TensorFlow Lite.
-escaner_ble_nn.dart:
Gestiona la comunicación asíncrona con el hardware Bluetooth Low Energy (BLE) del dispositivo móvil. 
Implementa ventanas de tiempo para agrupar paquetes de datos y promedia la fuerza de la señal (RSSI) utilizando buffers de retención temporal, entregando vectores limpios al motor de posicionamiento.
-grid_manager.dart:
Convierte la geometría vectorial del mapa (polígonos 2D) en una matriz bidimensional navegable (grilla espacial). 
Genera mapas de costos aplicando campos de repulsión artificial alrededor de los obstáculos (paredes).
-coordenadas_utils.dart:
Gestiona la obtención de los destinos físicos del edificio. 
Aplica factores de escala paramétricos y offsets de calibración para traducir matemáticamente las coordenadas geográficas 2D al sistema espacial 3D requerido por el motor Unity. Implementa mecanismos de fallback (respaldo local) ante caídas de red.
-redUtils.dart:
Actúa como el cliente HTTP principal de la aplicación. 
Centraliza y gestiona de forma asíncrona todas las peticiones a la API RESTful para insertar información dinámica en tiempo real, como la geometría de los recintos, zonas bloqueadas temporalmente, materias y asignación de personal docente.

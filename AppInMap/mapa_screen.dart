import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_unity_widget/flutter_unity_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/gestures.dart';
import 'package:prueba_mapa_3d/redUtils.dart';
import 'package:prueba_mapa_3d/ruta_utils.dart';
import 'coordenadas_utils.dart';
import 'grid_manager.dart';
import 'dart:async';
import 'escaner_ble_nn.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'posicionamiento_nn.dart';
import 'navegacion_controller.dart';
import 'package:flutter_compass/flutter_compass.dart';
import 'package:http/http.dart' as http;
/*
Actúa como el núcleo de la interfaz de usuario (UI) en Flutter.
Gestiona la comunicación bidireccional con el motor gráfico 3D incrustado (Unity).
Controla de forma asíncrona el buscador de entidades (Aulas, Docentes, Materias) y
gestiona la actualización visual del estado de la navegación.
 */


class MapaInteractivoScreen extends StatefulWidget {
  const MapaInteractivoScreen({super.key});

  @override
  State<MapaInteractivoScreen> createState() => _MapaInteractivoScreenState();
}

class _MapaInteractivoScreenState extends State<MapaInteractivoScreen> {
  //Controladores Principales
  UnityWidgetController? _unityWidgetController; // Puente de comunicación con el motor 3D (Unity)
  late NavegacionController _navController;      // Gestiona filtros matemáticos (Snap, Velocidad)
  PosicionamientoNN? _iaNavegacion;              // Modelo de Red Neuronal para estimar ubicación
  final GridManager _gridManager = GridManager(cellSize: 0.2); // Discretización del plano (Grilla)
  StreamSubscription<CompassEvent>? _brujulaSubscription; // Escucha los giros del teléfono

  //Estado de la Ubicacion
  EscanerBleNN? _escanerBLE; // Módulo para leer Bluetooth
  double _usuarioX = 0.0; // Coordenada física real del usuario en X
  double _usuarioY = 0.0; // Coordenada física real del usuario en Y
  double _simMapX = 0.0; // Coordenada durante la simulacion del usuario en X
  double _simMapY = 0.0; // Coordenada durante la simulacion del usuario en Y
  List<dynamic> _destinosCortos = []; // Almacena los nombres cortos para el 3D

  double _ultimoAnguloEnviado = -999.0;
  String _ultimoPayloadPOIs = "";

  // Parámetros ajustables en pantalla
  double _devSuavizado = 0.0; // Cuánto promedia la posición (0 = nada, 1 = se clava)
  bool _usarFiltrosFisicos = true;
  DateTime _ultimoMensajeBrujula = DateTime.now();
  DateTime? _ultimoRecalculo;

  // Paleta de colores de la aplicacion
  final Color _cDarkBlue = const Color(0xFF193B59);
  final Color _cSlate = const Color(0xFF2F4659);
  final Color _cCyan = const Color(0xFF77F2F2);
  final Color _cLight = const Color(0xFFC4DDF2);

  //Base de datos y Cache
  List<dynamic> _recintos = []; // Geometría de las aulas (Polígonos GeoJSON)
  List<dynamic> _zonasBloqueadas = [];  // Zonas inhabilitadas para caminar
  List<Map<String, String>> _destinos = [
    {
      "id": "VISTA_GENERAL",
      "nombre": "Vista General",
      "target": "0m 0m 0m",
      "orbit": "0deg 45deg 80m",
      "hotspot": ""
    },
  ];
  List<Map<String, dynamic>> _cachePersonal = []; // Lista optimizada de profesores
  List<Map<String, dynamic>> _cacheMaterias = []; // Lista optimizada de materias

  //Interfaz
  String _modoBusqueda = "Aulas";         // Filtro activo en el buscador
  DateTime _horarioConsulta = DateTime.now(); // Selector de fecha/hora para clases
  bool _mostrarInfoBusqueda = false;      // Controla si se ve la tarjeta inferior de info
  String _tituloInfo = "";                // Título de la tarjeta inferior (Ej: "Aula 10")
  String _subtituloInfo = "";             // Subtítulo de la tarjeta
  String _idActual = "VISTA_GENERAL"; // ID del aula o elemento actualmente seleccionado

  //Estado de rutas y Navegacion
  bool _modoNavegacion = false;           // True si el usuario abrió el panel "Cómo llegar"
  bool _rutaLista = false;                // True si el algoritmo A* terminó de calcular la ruta
  bool _enGuiadoReal = false;             // True si el usuario ya tocó el botón "IR"
  bool _recalculando = false;             // Evita cálculos paralelos si ocurre un desvío

  String _idOrigenRuta = "UBICACION_ACTUAL";   // Desde dónde parte la ruta
  String _nombreOrigenDisplay = "Tu ubicación"; // Texto que se muestra en el buscador de origen
  bool _calculandoRuta = false;

  List<String> _rutaPuntos = [];               // Coordenadas crudas de la ruta en formato 3D
  List<Map<String, dynamic>> _puntosRutaDetalle = []; // Coordenadas con ángulos para la cámara
  List<InstruccionRuta> _instrucciones = [];   // Intrucciones para llegar a destino
  int _pasoActualSimulacion = 0;               // Índice de control para la simulación


  double _ajusteVisualX = -10.0;
  double _ajusteVisualY = 13.0;

  double _devUmbralLinea = 2.5;
  bool _devLineaAnclada = true;

  double _devOffsetNorte = -136; // Ajuste manual de la brújula


  @override
  void initState() {
    super.initState();

    _cargarDatos().then((_) {
      if (mounted) {
        _navController = NavegacionController(_gridManager);
        _iniciarBrujula();
        _verificarYArrancarNavegacion();
      }
    }).catchError((error) {
      debugPrint("Falló la carga de datos: $error");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Error al cargar el mapa. Verificá tu conexión.")),
        );
      }
    });
  }

  // Descarga y procesa en paralelo toda la información necesaria para el mapa:
  // Aulas, zonas prohibidas, profesores, materias y la geometría de los recintos.
  Future<void> _cargarDatos() async {
    var resultados = await Future.wait([
      CoordenadasUtils.cargarYProcesarDestinos(),
      redUtils.obtenerZonasBloqueadas(),
      redUtils.obtenerListaPersonal(),
      redUtils.obtenerListaMaterias(),
      redUtils.cargarRecintos(),
    ]);

    List<dynamic> zonasBloqueadas = resultados[1] as List<dynamic>;

    setState(() {
      _destinos = (resultados[0] as List<Map<String, String>>).map((d) {
        d['busqueda'] = d['nombre']!.toLowerCase();
        return d;
      }).toList();
      _zonasBloqueadas = zonasBloqueadas;
      _cachePersonal = (resultados[2] as List).map((p) {
        var map = p as Map<String, dynamic>;
        map['busqueda'] = map['nombreCompleto'].toString().toLowerCase();
        return map;
      }).toList();
      _cacheMaterias = (resultados[3] as List).map((m) {
        var map = m as Map<String, dynamic>;
        map['busqueda'] = map['nombreMateria'].toString().toLowerCase();
        return map;
      }).toList();
      _recintos = resultados[4] as List<dynamic>;
    });

    _precalcularCentroides();

    await Future.delayed(const Duration(milliseconds: 100));
    _gridManager.inicializarDesdeZonas(zonasBloqueadas);
    _enviarObstaculosAUnity();

    try {
      var response = await http.get(Uri.parse('https://restful-api-inmap.onrender.com/destinosAcortados'));
      if (response.statusCode == 200) {
        setState(() {
          _destinosCortos = jsonDecode(utf8.decode(response.bodyBytes));
        });
      }
    } catch (e) {
      debugPrint("Error cargando nombres cortos: $e");
    }
  }
  //Calcula el centro del recinto para mostrar el nombre del aula.
  void _precalcularCentroides() {
    for (var destino in _destinos) {
      try {
        var recinto = _recintos.firstWhere((r) => r["destino"]["idDestino"] == destino["id"]);
        if (recinto != null) {
          var coordenadasPoligono = recinto["geometria"]["coordinates"][0][0];
          var centro = obtenerCentroRecinto(coordenadasPoligono);

          destino["centroX"] = centro["centroX"].toString();
          destino["centroY"] = centro["centroY"].toString();
        }
      } catch (e) {
        // Si el aula no tiene recinto 2D, no hace nada
      }
    }
  }
  // Esta función intercepta todas las coordenadas y les suma el ajuste antes de enviarlas a Unity
  Map<String, String> _traducirConAjuste(double x, double y) {
    return CoordenadasUtils.traducirCoordenadasJsonAMapa(x + _ajusteVisualX, y + _ajusteVisualY);
  }

  void _seleccionarDestino(String id, {bool hacerZoom = false}) {
    setState(() {
      _idActual = id;

      if (id != "VISTA_GENERAL") {
        var destino = _destinos.firstWhere((d) => d["id"] == id);
        _mostrarInfoBusqueda = true;
        _unityWidgetController?.postMessage("Jugador", "ResaltarAula", id);

        String coordPuerta = "";
        if (destino.containsKey("x") && destino.containsKey("y")) {
          double dX = double.parse(destino["x"]!);
          double dY = double.parse(destino["y"]!);
          coordPuerta = _traducirConAjuste(dX, dY)["hotspotPos"]!.replaceAll('m', '').trim();
        } else if (destino["hotspot"] != null && destino["hotspot"]!.isNotEmpty) {
          coordPuerta = destino["hotspot"]!.replaceAll('m', '').trim();
        }

        String coordCentroVisual = coordPuerta;
        if (destino.containsKey("centroX") && destino.containsKey("centroY")) {
          double cX = double.parse(destino["centroX"]!);
          double cY = double.parse(destino["centroY"]!);
          coordCentroVisual = _traducirConAjuste(cX, cY)["hotspotPos"]!.replaceAll('m', '').trim();
        }

        if (coordCentroVisual.isNotEmpty) {
          String nombreParaMapa = destino["nombre"]!;

          if (destino.containsKey("x") && destino.containsKey("y")) {
            double destX = double.parse(destino["x"]!);
            double destY = double.parse(destino["y"]!);

            for (var corto in _destinosCortos) {
              if (corto["geometria"] != null && corto["geometria"]["coordinates"] != null) {
                double cx = (corto["geometria"]["coordinates"][0] as num).toDouble();
                double cy = (corto["geometria"]["coordinates"][1] as num).toDouble();

                if (math.sqrt(math.pow(destX - cx, 2) + math.pow(destY - cy, 2)) < 0.5) {
                  nombreParaMapa = corto["nombreDestino"];
                  break;
                }
              }
            }
          }

          _unityWidgetController?.postMessage("Jugador", "MostrarTextoFlotante", "$coordCentroVisual|$nombreParaMapa");

          if (hacerZoom) {
            _unityWidgetController?.postMessage("Jugador", "EnfocarDestino", coordCentroVisual);
          }
        }

      } else {
        _mostrarInfoBusqueda = false;
        _rutaPuntos = [];
        _rutaLista = false;
        _modoNavegacion = false;
        _enGuiadoReal = false;

        _unityWidgetController?.postMessage("Jugador", "FijarVelocidad", "20");
        _unityWidgetController?.postMessage("Jugador", "MostrarTextoFlotante", "OCULTAR");
        _unityWidgetController?.postMessage("Jugador", "MostrarBandera", "OCULTAR");
        _unityWidgetController?.postMessage("Jugador", "ResaltarAula", "VISTA_GENERAL");
        _unityWidgetController?.postMessage("Jugador", "CambiarVista", "GENERAL");
        _unityWidgetController?.postMessage("Jugador", "ActualizarDestinosCercanos", "OCULTAR");
      }
    });
  }

  @override
  // Construye la interfaz de la aplicación
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: false,
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          // CAPA 1: MOTOR UNITY
          SizedBox.expand(
            child: UnityWidget(
              onUnityCreated: (controller) async {
                _unityWidgetController = controller;
                await Future.delayed(const Duration(seconds: 2));
                _enviarZonasAUnity();
                _enviarObstaculosAUnity();
                await Future.delayed(const Duration(seconds: 1));
                _enviarZonasAUnity();
                _enviarObstaculosAUnity();
              },
              onUnityMessage: (mensaje) {
                // Ignora toques en las aulas si el usuario se encuentra navegando
                if (_modoNavegacion || _rutaLista) return;
                // Identifica el aula tocada en el modelo 3D y la selecciona en la interfaz
                var destinoTocado = _destinos.where((d) => d["id"] == mensaje.toString()).firstOrNull;
                if (destinoTocado != null) {
                  _seleccionarDestino(destinoTocado["id"]!);
                  setState(() {
                    _tituloInfo = destinoTocado["nombre"]!;
                    _subtituloInfo = "Aula seleccionada en el mapa";
                    _mostrarInfoBusqueda = true;
                  });
                }
              },
              useAndroidViewSurface: true,
              gestureRecognizers: <Factory<OneSequenceGestureRecognizer>>{
                Factory<OneSequenceGestureRecognizer>(() => EagerGestureRecognizer()),
              },
            ),
          ),

          // CAPA 2: INTERFAZ
          //Barra de busqueda y filtros superiores
          if (!_modoNavegacion && !_rutaLista)
            Positioned(
              top: 50, left: 15, right: 15,
              child: _buildBarraSuperiorCombinada(),
            ),

          //Panel de informacion del destino seleccionado
          if (_mostrarInfoBusqueda && !_modoNavegacion && !_rutaLista)
            _buildPanelInfoBusqueda(),

          // Boton de  "MI UBICACIÓN"
          // Centra la cámara en la posición actual
          if (!_modoNavegacion && !_rutaLista)
            Positioned(
              bottom: _mostrarInfoBusqueda ? 180 : 110,
              right: 20,
              child: FloatingActionButton.small(
                heroTag: "btn_mi_ubicacion",
                elevation: 4,
                backgroundColor: _cDarkBlue,
                foregroundColor: _cCyan,
                child: const Icon(Icons.my_location),
                onPressed: () {
                  _mostrarMiUbicacionActual();
                },
              ),
            ),

          //Boton de "CÓMO LLEGAR"
          // Inicia el flujo de cálculo de ruta hacia el destino seleccionado
          if (!_modoNavegacion && !_rutaLista && _idActual != "VISTA_GENERAL")
            Positioned(
              bottom: _mostrarInfoBusqueda ? 110 : 30,
              right: 20,
              child: FloatingActionButton.extended(
                backgroundColor: _cCyan,
                foregroundColor: _cDarkBlue,
                elevation: 6,
                icon: const Icon(Icons.directions_outlined),
                label: const Text("Cómo llegar", style: TextStyle(fontWeight: FontWeight.bold)),
                onPressed: () {
                  _prepararRutaIA();
                },
              ),
            ),

          // CAPA 3: PANELES DE NAVEGACIÓN ACTIVA
          //Panel inferior: Ruta calculada y lista para iniciar
          if (_rutaLista)
            Positioned(
              bottom: 20, left: 15, right: 15,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _cDarkBlue,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 10)],
                ),
                child: Row(
                  children: [
                    Icon(
                      _instrucciones.isEmpty ? Icons.location_on : Icons.directions_walk,
                      color: _cCyan, size: 30,
                    ),
                    const SizedBox(width: 15),

                    // Texto indicativo del siguiente paso a realizar por el usuario
                    Expanded(
                      child: Text(
                        _instrucciones.isEmpty ? "Ruta lista para iniciar" : _instrucciones.first.texto,
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ),

                    // Boton "IR"
                    if (!_enGuiadoReal)
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _cCyan,
                          foregroundColor: _cDarkBlue,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () {
                          _comenzarNavegacionReal();
                        },
                        child: const Text("IR", style: TextStyle(fontWeight: FontWeight.bold)),
                      ),

                    const SizedBox(width: 10),

                    // Boton "CERRAR": Cancela la ruta activa y restablece el entorno 3D
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white54),
                      onPressed: () {
                        _unityWidgetController?.postMessage("Jugador", "BorrarRuta", "");
                        _unityWidgetController?.postMessage("Jugador", "MostrarTextoFlotante", "OCULTAR");
                        _unityWidgetController?.postMessage("Jugador", "MostrarPin", "OCULTAR");
                        _unityWidgetController?.postMessage("Jugador", "CambiarVista", "GENERAL");
                        _unityWidgetController?.postMessage("Jugador", "MostrarBandera", "OCULTAR");
                        _unityWidgetController?.postMessage("Jugador", "ActualizarDestinosCercanos", "OCULTAR");
                        setState(() {
                          _rutaLista = false;
                          _enGuiadoReal = false;
                          _idActual = "VISTA_GENERAL";
                        });
                      },
                    ),
                  ],
                ),
              ),
            ),

          // Panel superior: seleccion manual de origen/destino
          if (_modoNavegacion)
            _buildPanelNavegacionModerno(),
        ],
      ),
    );
  }

  // Construye el panel superior de navegación que permite al usuario
  // verificar el origen y confirmar el inicio de la ruta.
  Widget _buildPanelNavegacionModerno() {
    // Obtiene el nombre del destino seleccionado para mostrarlo en la interfaz
    String nombreDestino = _destinos.firstWhere((d) => d["id"] == _idActual,
        orElse: () => {"nombre": "..."})["nombre"]!;

    return Align(
      alignment: Alignment.topCenter,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 50, 20, 25),
        decoration: BoxDecoration(
          color: _cDarkBlue,
          borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 20)],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Encabezado del panel
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("Planificar Ruta", style: TextStyle(color: _cLight, fontSize: 18, fontWeight: FontWeight.bold)),

                // Boton cerrar: Cancela la planificación y restaura la vista general
                IconButton(
                  icon: Icon(Icons.close, color: _cLight),
                  onPressed: () {
                    // Restablece el estado lógico en Flutter
                    setState(() {
                      _modoNavegacion = false;
                      _rutaPuntos = [];
                    });

                    // Limpia los elementos visuales superpuestos en el entorno 3D (Unity)
                    _unityWidgetController?.postMessage("Jugador", "MostrarPin", "OCULTAR");
                    _unityWidgetController?.postMessage("Jugador", "CambiarVista", "GENERAL");
                    _unityWidgetController?.postMessage("Jugador", "BorrarRuta", "");
                    _unityWidgetController?.postMessage("Jugador", "MostrarBandera", "OCULTAR");
                    _unityWidgetController?.postMessage("Jugador", "MostrarTextoFlotante", "OCULTAR");
                    _unityWidgetController?.postMessage("Jugador", "ActualizarDestinosCercanos", "OCULTAR");
                    _navController.limpiarMemoriaFisica();
                  },
                )
              ],
            ),
            const SizedBox(height: 15),

            // Tarjeta de Origen y Destino
            Container(
              decoration: BoxDecoration(color: _cSlate, borderRadius: BorderRadius.circular(15)),
              padding: const EdgeInsets.all(15),
              child: Column(
                children: [
                  Row(
                    children: [
                      Icon(Icons.my_location, color: _cCyan, size: 18),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Autocomplete<Map<String, String>>(
                          initialValue: TextEditingValue(text: _nombreOrigenDisplay),
                          optionsBuilder: (val) {
                            if (val.text.isEmpty) return const Iterable<Map<String, String>>.empty();
                            return _destinos.where((op) => op["nombre"]!.toLowerCase().contains(val.text.toLowerCase()));
                          },
                          displayStringForOption: (op) => op["nombre"]!,
                          onSelected: (sel) {
                            setState(() {
                              _idOrigenRuta = sel["id"]!;
                              _nombreOrigenDisplay = sel["nombre"]!;
                            });
                          },
                          fieldViewBuilder: (ctx, ctrl, focus, onEdit) {
                            return TextField(
                              controller: ctrl,
                              focusNode: focus,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                              decoration: InputDecoration(
                                isDense: true,
                                contentPadding: EdgeInsets.zero,
                                border: InputBorder.none,
                                hintText: "Origen...",
                                hintStyle: TextStyle(color: _cLight.withOpacity(0.5)),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                  Divider(color: _cLight.withOpacity(0.2), height: 25),

                  // Campo Destino
                  Row(
                    children: [
                      const Icon(Icons.location_on, color: Color(0xFFFF6B6B), size: 18),
                      const SizedBox(width: 12),
                      Expanded(child: Text(nombreDestino, style: TextStyle(color: _cLight, fontWeight: FontWeight.w600))),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Boton "INICIAR RUTA"
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () async {
                  FocusScope.of(context).unfocus();

                  // Inicia el proceso de cálculo de ruta
                  await _prepararRutaIA();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: _cCyan,
                  foregroundColor: _cDarkBlue,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                  elevation: 0,
                ),
                child: const Text("INICIAR RUTA", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Enlace de capa utilizado para superponer la lista de resultados de búsqueda
  // sobre el mapa 3D sin que sea recortada por otros widgets.
  final LayerLink _capaBuscadorLink = LayerLink();

  // Construye la barra superior de la interfaz, que integra el logotipo de la aplicación,
  // los selectores de filtros (Aulas/Profesores/Materias) y el selector de fecha y hora.
  Widget _buildBarraSuperiorCombinada() {
    bool filtrosActivos = _modoBusqueda != "Aulas";
    Color colorFiltros = filtrosActivos ? _cCyan : _cLight.withOpacity(0.3);
    return Listener(
      behavior: HitTestBehavior.opaque,
      onPointerDown: (_) => FocusScope.of(context).unfocus(),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Image.asset('assets/logo.png', height: 40, width: 40),
              const SizedBox(width: 10),
              Stack(
                children: [
                  Text(
                    "InMap",
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      foreground: Paint()
                        ..style = PaintingStyle.stroke
                        ..strokeWidth = 1.0
                        ..color = _cCyan,
                    ),
                  ),
                  Text(
                    "InMap",
                    style: TextStyle(
                      color: _cDarkBlue,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),

          //Barra de autocompletado para buscar aulas, profesores o materias
          _buildCajaAutocompleteDinamica(),
        ],
      ),
    );
  }

  // Aplica el tema visual personalizado de la aplicación a los cuadros de diálogo
  Widget _tematizarDialogo(Widget child) {
    return Theme(
      data: Theme.of(context).copyWith(
        colorScheme: ColorScheme.dark(
          primary: _cCyan,
          onPrimary: _cDarkBlue,
          surface: _cDarkBlue,
          onSurface: _cLight,
        ),
        textButtonTheme: TextButtonThemeData(
            style: TextButton.styleFrom(foregroundColor: _cCyan)),
      ),
      child: child,
    );
  }

  /// Construye un contenedor interactivo utilizado para unificar el diseño de los filtros en la barra superior.
  Widget _buildCapsulaFiltro({required Widget child, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 35,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: _cDarkBlue,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white10),
        ),
        alignment: Alignment.center,
        child: child,
      ),
    );
  }

  // Procesa la selección del usuario en la barra de búsqueda.
  // Ejecuta consultas asíncronas a la base de datos para resolver la ubicación
  // física de profesores o materias basándose en el filtro de fecha y hora activo.
  void _manejarSeleccionFiltro(dynamic seleccion) async {
    FocusManager.instance.primaryFocus?.unfocus();
    String? idDestinoFinal;
    String nombreSeleccionado = "";
    String diaStr = _obtenerNombreDia(_horarioConsulta);
    String horaStr = "${_horarioConsulta.hour.toString().padLeft(2, '0')}:${_horarioConsulta.minute.toString().padLeft(2, '0')}:00";

    //Evalua modo de bsuqueda
    if (_modoBusqueda == "Profesores") {
      final map = seleccion as Map<String, dynamic>;
      nombreSeleccionado = map['nombreCompleto'];
      idDestinoFinal = await redUtils.buscarUbicacionPersonal(map['idPersonal'].toString(), horaStr, diaStr);

    } else if (_modoBusqueda == "Materias") {
      final map = seleccion as Map<String, dynamic>;
      nombreSeleccionado = map['nombreMateria'];
      // Consulta en qué aula se dicta la materia en el horario indicado
      idDestinoFinal = await redUtils.buscarUbicacionMateria(map['codMateria'].toString(), horaStr, diaStr);

    } else {
      // Si la búsqueda es directa por "Aulas", no requiere cruce de horarios
      final map = seleccion as Map<String, String>;
      nombreSeleccionado = map['nombre']!;
      idDestinoFinal = map['id'];
    }

    //Resolucion de la interfaz segun el resultado de la consulta
    if (idDestinoFinal != null) {
      // Recupera los datos topográficos del destino resuelto
      final destinoData = _destinos.firstWhere((d) => d["id"] == idDestinoFinal, orElse: () => {"nombre": "Desconocido"});

      setState(() {
        _tituloInfo = nombreSeleccionado;

        // Genera subtítulos dinámicos y contextuales según el tipo de búsqueda
        if (_modoBusqueda == "Profesores") {
          _subtituloInfo = "Está dictando en el ${destinoData['nombre']}";
        } else if (_modoBusqueda == "Materias") {
          _subtituloInfo = "Se dicta en el ${destinoData['nombre']}";
        } else {
          _subtituloInfo = "Aula seleccionada";
        }
        _mostrarInfoBusqueda = true;
      });

      // Centra la cámara y resalta el destino en el modelo 3D
      _seleccionarDestino(idDestinoFinal, hacerZoom: true);

    } else {
      // Manejo de excepciones: Si el cruce de datos no devuelve un aula asignada
      setState(() => _mostrarInfoBusqueda = false);
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("No se encontró ubicación para el horario seleccionado"))
      );
    }
  }

  // Construye el panel informativo que se muestra en la parte inferior
  // de la pantalla cuando el usuario selecciona un destino (Aula, Profesor o Materia).
  Widget _buildPanelInfoBusqueda() {
    return Positioned(
      bottom: 20,
      left: 15,
      right: 15,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
        decoration: BoxDecoration(
          color: _cDarkBlue,
          borderRadius: BorderRadius.circular(20),
          boxShadow: const [
            BoxShadow(color: Colors.black45, blurRadius: 10, offset: Offset(0, 4))
          ],
          border: Border.all(color: _cCyan.withOpacity(0.3), width: 1),
        ),
        child: Row(
          children: [
            // Asigna una representación visual según la categoría de búsqueda
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: _cSlate, borderRadius: BorderRadius.circular(15)),
              child: Icon(
                _modoBusqueda == "Profesores" ? Icons.person :
                _modoBusqueda == "Materias"   ? Icons.book :
                Icons.room,
                color: _cCyan,
              ),
            ),
            const SizedBox(width: 15),

            // Informacion del Destino
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _tituloInfo,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                    maxLines: 3,
                    softWrap: true,
                  ),
                  Text(
                    _subtituloInfo,
                    style: TextStyle(color: _cLight.withOpacity(0.8), fontSize: 14),
                  ),
                ],
              ),
            ),

            // Boton de Cierre
            // Limpia la selección actual y devuelve la cámara al estado inicial
            IconButton(
              icon: const Icon(Icons.close, color: Colors.white54, size: 20),
              onPressed: () => _seleccionarDestino("VISTA_GENERAL"),
            ),
          ],
        ),
      ),
    );
  }

  // Construye el campo de entrada de texto con capacidades de
  // autocompletado dinámico, enlazado a los cachés locales de Aulas, Profesores y Materias.
  Widget _buildCajaAutocompleteDinamica() {
    // Calcula el ancho dinámico para que la lista desplegable coincida con la barra
    final double anchoLista = MediaQuery.of(context).size.width - 40;

    return CompositedTransformTarget(
      link: _capaBuscadorLink,
      child: Container(
        height: 50,
        decoration: BoxDecoration(
          color: _cDarkBlue,
          borderRadius: BorderRadius.circular(25),
          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 10, offset: Offset(0, 4))],
        ),
        padding: const EdgeInsets.symmetric(horizontal: 15),
        child: Autocomplete<Object>(

          // Define qué propiedad del objeto se muestra como texto en la lista
          displayStringForOption: (dynamic option) {
            if (_modoBusqueda == "Profesores") return option['nombreCompleto'];
            if (_modoBusqueda == "Materias") return option['nombreMateria'];
            return option['nombre'];
          },

          // Filtrado (Búsqueda en tiempo real)
          optionsBuilder: (TextEditingValue textValue) {
            if (textValue.text.isEmpty) return const Iterable<Object>.empty();

            final String busqueda = textValue.text.toLowerCase();

            // Se utiliza el campo 'busqueda' pre-procesado en caché para optimizar el rendimiento
            if (_modoBusqueda == "Profesores") {
              return _cachePersonal.where((p) => p['busqueda'].contains(busqueda));
            } else if (_modoBusqueda == "Materias") {
              return _cacheMaterias.where((m) => m['busqueda'].contains(busqueda));
            } else {
              return _destinos.where((d) => d['busqueda']!.contains(busqueda));
            }
          },

          //Accion de Seleccion
          onSelected: (sel) => _manejarSeleccionFiltro(sel),
          //Lista desplegable
          optionsViewBuilder: (context, onSelected, options) {
            return CompositedTransformFollower(
              link: _capaBuscadorLink,
              showWhenUnlinked: false,
              offset: const Offset(0, 55),
              child: Align(
                alignment: Alignment.topLeft,
                child: Material(
                  elevation: 8,
                  color: _cSlate,
                  borderRadius: BorderRadius.circular(20),
                  clipBehavior: Clip.antiAlias,
                  child: Container(
                    width: anchoLista,
                    constraints: const BoxConstraints(maxHeight: 250),
                    child: ListView.builder(
                      padding: EdgeInsets.zero,
                      shrinkWrap: true,
                      itemCount: options.length,
                      itemBuilder: (context, index) {
                        final option = options.elementAt(index) as Map<String, dynamic>;
                        String titulo = _modoBusqueda == "Profesores" ? option['nombreCompleto'] :
                        _modoBusqueda == "Materias"   ? option['nombreMateria'] :
                        option['nombre'];
                        return ListTile(
                          title: Text(titulo, style: TextStyle(color: _cLight, fontSize: 14)),
                          onTap: () => onSelected(option),
                        );
                      },
                    ),
                  ),
                ),
              ),
            );
          },

          // Campo de texto con autocompletado dinámico
          fieldViewBuilder: (ctx, ctrl, focus, onEdit) {
            return TextField(
              controller: ctrl,
              focusNode: focus,
              style: TextStyle(color: _cLight, fontSize: 14),
              cursorColor: _cCyan,

              // Evento lanzado cuando el usuario presiona "Enter" o "Buscar" en el teclado
              onSubmitted: (String textoIngresado) {
                if (textoIngresado.isEmpty) return;

                Iterable<dynamic> opciones;
                // Búsqueda de coincidencia exacta o parcial sin considerar mayúsculas
                if (_modoBusqueda == "Profesores") {
                  opciones = _cachePersonal.where((p) => p['nombreCompleto'].toString().toLowerCase().contains(textoIngresado.toLowerCase()));
                } else if (_modoBusqueda == "Materias") {
                  opciones = _cacheMaterias.where((m) => m['nombreMateria'].toString().toLowerCase().contains(textoIngresado.toLowerCase()));
                } else {
                  opciones = _destinos.where((d) => d['nombre']!.toLowerCase().contains(textoIngresado.toLowerCase()));
                }

                // Si hay coincidencias, auto-selecciona la primera opción de la lista
                if (opciones.isNotEmpty) {
                  var primeraOpcion = opciones.first;
                  ctrl.text = _modoBusqueda == "Profesores" ? primeraOpcion['nombreCompleto'] :
                  _modoBusqueda == "Materias"   ? primeraOpcion['nombreMateria'] :
                  primeraOpcion['nombre'];

                  _manejarSeleccionFiltro(primeraOpcion);
                  focus.unfocus();
                }
              },
              decoration: InputDecoration(
                hintText: "Buscar $_modoBusqueda...",
                hintStyle: TextStyle(color: _cLight.withOpacity(0.5)),
                border: InputBorder.none,
                icon: Icon(Icons.search, color: _cCyan, size: 20),

                // Renderiza un botón de "Limpiar" (X) únicamente si el campo contiene texto
                suffixIcon: ValueListenableBuilder<TextEditingValue>(
                  valueListenable: ctrl,
                  builder: (context, value, child) {
                    if (value.text.isEmpty) return const SizedBox.shrink();

                    return IconButton(
                      icon: Icon(Icons.close, color: _cLight.withOpacity(0.8), size: 18),
                      onPressed: () {
                        ctrl.clear();     // Vacía el campo de texto
                        focus.unfocus();  // Oculta el teclado

                        // Restaura el estado visual al modo de exploración libre
                        _seleccionarDestino("VISTA_GENERAL");
                        setState(() {
                          _mostrarInfoBusqueda = false;
                        });
                      },
                    );
                  },
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  // Transforma el índice numérico del día de la semana (1-7) provisto por la clase DateTime
  // en su representación textual en español, requerida por las consultas a la base de datos.
  String _obtenerNombreDia(DateTime fecha) {
    List<String> dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    return dias[fecha.weekday - 1];
  }

  // Calcula el centroide geométrico  de un polígono 2D. Recibe una lista de vértices y retorna el punto medio exacto de la figura.
  Map<String, double> obtenerCentroRecinto(List<dynamic> coordenadasPoligono) {
    double minX = double.infinity;
    double maxX = double.negativeInfinity;
    double minY = double.infinity;
    double maxY = double.negativeInfinity;

    for (var punto in coordenadasPoligono) {
      double x = punto[0].toDouble();
      double y = punto[1].toDouble();
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    return {
      "centroX": (minX + maxX) / 2,
      "centroY": (minY + maxY) / 2,
    };
  }

  // Transforma la geometría de los recintos (aulas) en zonas interactivas tridimensionales.
  // Calcula la ubicación espacial de cada aula y la envía a Unity para habilitar los toques táctiles.
  void _enviarZonasAUnity() {
    if (_unityWidgetController == null || _destinos.isEmpty) return;

    List<Map<String, String>> zonasUnity = [];

    for (var dest in _destinos) {
      if (dest["id"] == "VISTA_GENERAL") continue;

      String pos3D = "";
      var recinto;

      // Intenta vincular el destino lógico con su geometría física (Polígono)
      try {
        recinto = _recintos.firstWhere((r) => r["destino"]["idDestino"] == dest["id"]);
      } catch (e) {
        // Omite silenciosamente si el destino no posee geometría definida
      }

      // Si existe el polígono, calcula su centroide y lo traduce al sistema 3D
      if (recinto != null) {
        try {
          var coordenadasPoligono = recinto["geometria"]["coordinates"][0][0];
          var centro = obtenerCentroRecinto(coordenadasPoligono);
          pos3D = _traducirConAjuste(centro["centroX"]!, centro["centroY"]!)["hotspotPos"]!;
        } catch (e) {
          // Captura errores por posibles polígonos malformados en el GeoJSON
        }
      }

      // Fallback: Si no hay polígono, utiliza las coordenadas puntuales X e Y declaradas
      if (pos3D.isEmpty && dest.containsKey("x") && dest.containsKey("y")) {
        double dx = double.parse(dest["x"]!);
        double dy = double.parse(dest["y"]!);
        pos3D = _traducirConAjuste(dx, dy)["hotspotPos"]!;
      }

      // Si se logró obtener una posición válida, se empaqueta para enviar
      if (pos3D.isNotEmpty) {
        zonasUnity.add({
          "id": dest["id"]!,
          "pos": pos3D.replaceAll('m', '').trim()
        });
      }
    }

    // Serializa el arreglo de zonas y lo transmite al motor Unity mediante el puente de mensajes
    String jsonZonas = jsonEncode({"zonas": zonasUnity});
    _unityWidgetController!.postMessage("Jugador", "CrearZonasInteractivas", jsonZonas);
  }

  // Procesa las zonas inhabilitadas temporal o permanentemente y las proyecta en el entorno 3D.
  // Genera cajas rojas en Unity para advertir al usuario sobre los bloqueos físicos.
  void _enviarObstaculosAUnity() {
    if (_unityWidgetController == null || _zonasBloqueadas.isEmpty) return;

    List<Map<String, String>> obstaculosVisuales = [];

    for (var zona in _zonasBloqueadas) {
      bool estaBloqueada = zona['bloqueado'] == true;
      bool esPermanente = zona['bloqueo_permanente'] == true;

      if (estaBloqueada && !esPermanente) {
        try {
          String tipoGeo = zona['geometria']['type'] ?? 'Polygon';
          var puntosPoligono;

          if (tipoGeo == 'MultiPolygon') {
            puntosPoligono = zona['geometria']['coordinates'][0][0];
          } else {
            puntosPoligono = zona['geometria']['coordinates'][0];
          }

          double minX = double.infinity, maxX = double.negativeInfinity;
          double minY = double.infinity, maxY = double.negativeInfinity;

          for (var punto in puntosPoligono) {
            double pX = (punto[0] as num).toDouble();
            double pY = (punto[1] as num).toDouble();

            if (pX < minX) minX = pX;
            if (pX > maxX) maxX = pX;
            if (pY < minY) minY = pY;
            if (pY > maxY) maxY = pY;
          }

          double centroX = (minX + maxX) / 2;
          double centroY = (minY + maxY) / 2;


          var coords3D = _traducirConAjuste(centroX, centroY);

          obstaculosVisuales.add({
            "pos": coords3D["hotspotPos"]!.replaceAll('m', '').trim()
          });
        } catch (e) {
          debugPrint("Error procesando la geometría del obstáculo: $e");
        }
      }
    }

    String jsonEnvio = jsonEncode({"puntos": obstaculosVisuales});
    _unityWidgetController?.postMessage("Jugador", "DibujarObstaculos", jsonEnvio);
  }

  // Realiza el cálculo de la ruta óptima desde un punto de origen hacia el destino seleccionado.
  Future<void> _calcularRutaDesdePosicion(double xOrigen, double yOrigen) async {
    //Obtiene las coordenadas físicas del destino final
    final destinoData = _destinos.firstWhere((d) => d["id"] == _idActual);
    double dX = double.parse(destinoData["x"]!);
    double dY = double.parse(destinoData["y"]!);

    //Extrae la matriz de colisiones y penalizaciones actual
    var datosMapa = _gridManager.exportarDatos();

    //Ejecuta el algoritmo A* en un Isolate secundario (compute)
    // Esto evita bloquear el hilo principal de la interfaz (UI Thread) durante cálculos matemáticos pesados.
    List<Nodo> rutaReal = await compute(BuscadorRutas.encontrarRutaAislada, {
      'startX': xOrigen, 'startY': yOrigen,
      'endX': dX, 'endY': dY,
      'datosMapa': datosMapa,
    });

    // Evalúa el resultado del cálculo
    if (rutaReal.isNotEmpty) {
      _procesarNuevaRuta(rutaReal);
    } else {
      setState(() {
        _instrucciones = [InstruccionRuta(texto: "Desvío en pared. Vuelve al pasillo.", tipo: TipoGiro.recto, distancia: 0.0)];
      });
    }
  }

  // Transforma la ruta matemática generada por el algoritmo A* (lista de Nodos 2D)
  // en un formato compatible con el motor 3D y genera las instrucciones de navegación paso a paso.
  void _procesarNuevaRuta(List<Nodo> rutaReal) {
    // Sincroniza la ruta y genera instrucciones
    _navController.actualizarRutaReal(rutaReal);
    _instrucciones = BuscadorRutas.generarInstrucciones(rutaReal, _gridManager.cellSize);

    List<String> nuevaRutaVisual = [];
    List<Map<String, dynamic>> nuevaRutaDetalle = [];

    double minX = _gridManager.minX;
    double minY = _gridManager.minY;
    double cellSize = _gridManager.cellSize;

    List<Nodo> rutaOptimizada = [];
    if (rutaReal.isNotEmpty) {
      rutaOptimizada.add(rutaReal.first);

      for (int i = 1; i < rutaReal.length - 1; i++) {
        int dx1 = rutaReal[i].x - rutaReal[i-1].x;
        int dy1 = rutaReal[i].y - rutaReal[i-1].y;
        int dx2 = rutaReal[i+1].x - rutaReal[i].x;
        int dy2 = rutaReal[i+1].y - rutaReal[i].y;

        // Si el vector cambia, es una esquina pura.
        if (dx1 != dx2 || dy1 != dy2) {
          rutaOptimizada.add(rutaReal[i]);
        }
      }
      rutaOptimizada.add(rutaReal.last);
    }

    for (int i = 0; i < rutaOptimizada.length; i++) {
      double mundoX = minX + (rutaOptimizada[i].x * cellSize) + (cellSize / 2);
      double mundoY = minY + (rutaOptimizada[i].y * cellSize) + (cellSize / 2);

      if (i > 0 && i < rutaOptimizada.length - 1) {
        var puntoSnap = _navController.aplicarSnapAPasillo(mundoX, mundoY);
        mundoX = puntoSnap["x"]!;
        mundoY = puntoSnap["y"]!;
      }

      var coords3D = _traducirConAjuste(mundoX, mundoY);
      nuevaRutaVisual.add(coords3D["hotspotPos"]!);
      double anguloCamara = 0;
      if (i + 1 < rutaOptimizada.length) {
        int dx = rutaOptimizada[i + 1].x - rutaOptimizada[i].x;
        int dy = rutaOptimizada[i + 1].y - rutaOptimizada[i].y;
        anguloCamara = (math.atan2(dx.toDouble(), -dy.toDouble()) * 180 / math.pi) + 180;
      }
      nuevaRutaDetalle.add({'pos': coords3D["hotspotPos"]!, 'angle': anguloCamara});
    }

    setState(() {
      _rutaPuntos = nuevaRutaVisual;
      _puntosRutaDetalle = nuevaRutaDetalle;
      _rutaLista = true;
      _pasoActualSimulacion = 0;
    });

    if (_unityWidgetController != null) {
      String jsonRuta = jsonEncode({"puntos": _rutaPuntos});
      _unityWidgetController?.postMessage("Jugador", "DibujarRuta", jsonRuta);

      if (_rutaPuntos.isNotEmpty) {
        _unityWidgetController?.postMessage("Jugador", "MostrarBandera", _rutaPuntos.last);
      }

      if (!_enGuiadoReal) {
        _unityWidgetController?.postMessage("Jugador", "VerRutaCompleta", "");
      }
    }
  }

  Future<void> _prepararRutaIA() async {
    if (_calculandoRuta) return; // evita llamadas paralelas

    if (_usuarioX == 0.0 && _usuarioY == 0.0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Buscando señal de las balizas...")),
      );
      return;
    }

    setState(() => _calculandoRuta = true);

    _navController.limpiarMemoriaFisica();
    var coordsFrenadas = _navController.limitarVelocidadHumana(_usuarioX, _usuarioY);
    var coordsSeguras = _navController.aplicarSnapAPasillo(
        coordsFrenadas["x"]!, coordsFrenadas["y"]!
    );

    setState(() {
      _simMapX = coordsSeguras["x"]!;
      _simMapY = coordsSeguras["y"]!;
      _idOrigenRuta = "UBICACION_ACTUAL";
      _navController.setUltimaPosicionFisica(_simMapX, _simMapY);
    });

    var coords3D = _traducirConAjuste(_simMapX, _simMapY);
    String posUnity = coords3D["hotspotPos"]!.replaceAll('m', '').trim();
    _unityWidgetController?.postMessage("Jugador", "Teleportar", posUnity);

    await _calcularRutaDesdePosicion(_simMapX, _simMapY);

    // Solo habilita IR si la ruta tiene puntos reales
    setState(() {
      _calculandoRuta = false;
      _rutaLista = _rutaPuntos.isNotEmpty;
    });

    if (_rutaPuntos.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("No se pudo trazar la ruta. Movete unos pasos y reintentá."),
          backgroundColor: Colors.orange,
        ),
      );
    }
  }

  // Gestiona la re-ejecución dinámica del algoritmo de búsqueda de rutas
  // cuando el sistema detecta una desviación significativa respecto al camino trazado.
  Future<void> _activarRecalculo(double xActual, double yActual) async {
    if (_recalculando) return;

    if (_ultimoRecalculo != null) {
      final segundosDesde = DateTime.now().difference(_ultimoRecalculo!).inMilliseconds;
      if (segundosDesde < 1000) return;
    }

    setState(() {
      _recalculando = true;
      _instrucciones = [
        InstruccionRuta(texto: "Recalculando ruta...", tipo: TipoGiro.recto, distancia: 0.0)
      ];
    });

    _unityWidgetController?.postMessage("Jugador", "BorrarRuta", "");
    await Future.delayed(const Duration(milliseconds: 50));
    await _calcularRutaDesdePosicion(xActual, yActual);

    _ultimoRecalculo = DateTime.now();
    setState(() { _recalculando = false; });
  }

  Future<void> _comenzarNavegacionReal() async {
    setState(() {
      _enGuiadoReal = true;
      _mostrarInfoBusqueda = false;
    });

    _unityWidgetController?.postMessage("Jugador", "CambiarVista", "NAVEGACION");
    _unityWidgetController?.postMessage("Jugador", "FijarVelocidad", "6");

    while (_enGuiadoReal) {
      if (_navController.verificarDesvio(_usuarioX, _usuarioY)) {
        var origenSeguroParaAStar = _navController.aplicarSnapAPasillo(_usuarioX, _usuarioY);
        await _activarRecalculo(origenSeguroParaAStar["x"]!, origenSeguroParaAStar["y"]!);

        _navController.limpiarMemoriaFisica();
        _navController.setUltimaPosicionFisica(origenSeguroParaAStar["x"]!, origenSeguroParaAStar["y"]!);
      }

      var coordsBase = _navController.convertirGrillaRedAJson(
        _usuarioY,
        _usuarioX,
      );
      double crudoX = _usuarioX;
      double crudoY = _usuarioY;

      var coordsFrenadas = _navController.limitarVelocidadHumana(crudoX, crudoY);

      var coordsPasillo = _navController.aplicarSnapAPasillo(
          coordsFrenadas["x"]!, coordsFrenadas["y"]!
      );

      var coordsFinales = _navController.aplicarSnapARuta(
          coordsPasillo["x"]!, coordsPasillo["y"]!
      );

      double xFinal = coordsFinales["x"]!.clamp(2837.0, 2905.0);
      double yFinal = coordsFinales["y"]!.clamp(500.0, 542.0);

      setState(() {
        _simMapX = xFinal;
        _simMapY = yFinal;
        _navController.setUltimaPosicionFisica(_simMapX, _simMapY);
      });

      var destinoFinal = _destinos.firstWhere((d) => d["id"] == _idActual);
      double destX = double.parse(destinoFinal["x"]!);
      double destY = double.parse(destinoFinal["y"]!);
      double distanciaMetros = math.sqrt(
          math.pow(_simMapX - destX, 2) + math.pow(_simMapY - destY, 2)
      );

      if (distanciaMetros < 3.5) {
        setState(() {
          _enGuiadoReal = false; // Devuelve el control del avatar a la exploración libre
          _rutaLista = false;    // Oculta el panel inferior de navegación
          _idActual = "VISTA_GENERAL"; // Deselecciona el aula
        });

        _unityWidgetController?.postMessage("Jugador", "BorrarRuta", "");
        _unityWidgetController?.postMessage("Jugador", "MostrarTextoFlotante", "OCULTAR");
        _unityWidgetController?.postMessage("Jugador", "MostrarBandera", "OCULTAR");
        _unityWidgetController?.postMessage("Jugador", "CambiarVista", "GENERAL");

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(Icons.check_circle_outline, color: _cCyan),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    "¡Llegaste a tu destino!",
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ),
              ],
            ),
            backgroundColor: _cDarkBlue,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(15),
              side: BorderSide(color: _cCyan.withOpacity(0.4), width: 1),
            ),
            duration: const Duration(seconds: 4),
          ),
        );

        break;
      }

      var coords3D = _traducirConAjuste(xFinal, yFinal);
      String posUnity = coords3D["hotspotPos"]!.replaceAll('m', '').trim();

      _unityWidgetController?.postMessage("Jugador", "MoverHacia", posUnity);
      _actualizarPOIsCercanos();

      await Future.delayed(const Duration(milliseconds: 700));
    }
  }

  // Realiza un cálculo puntual de ubicación (arranque en frío) para posicionar al usuario en el mapa
  Future<void> _mostrarMiUbicacionActual() async {
    if (_usuarioX == 0.0 && _usuarioY == 0.0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Buscando señal de las balizas... movete unos pasos.")),
      );
      return;
    }

    _navController.limpiarMemoriaFisica();
    _navController.setUltimaPosicionFisica(_usuarioX, _usuarioY);

    var coords3DCalculadas = _traducirConAjuste(_usuarioX, _usuarioY);
    String posCalculada = coords3DCalculadas["hotspotPos"]!.replaceAll('m', '').trim();

    _unityWidgetController?.postMessage("Jugador", "FijarVelocidad", "6");
    _unityWidgetController?.postMessage("Jugador", "MoverHacia", posCalculada);
    _unityWidgetController?.postMessage("Jugador", "CambiarVista", "ZOOM");
  }

  void _iniciarBrujula() {
    _brujulaSubscription = FlutterCompass.events?.listen((CompassEvent event) {
      double? heading = event.heading;

      if (heading != null && _unityWidgetController != null) {

        if (DateTime.now().difference(_ultimoMensajeBrujula).inMilliseconds < 250) {
          return;
        }

        double headingCorregido = (heading + _devOffsetNorte + 360) % 360;
        double diferencia = (headingCorregido - _ultimoAnguloEnviado + 540) % 360 - 180;

        if (diferencia.abs() > 6.0) {
          _ultimoMensajeBrujula = DateTime.now();
          _ultimoAnguloEnviado = headingCorregido;

          _unityWidgetController?.postMessage(
              "Jugador",
              "ActualizarBrujula",
              headingCorregido.toStringAsFixed(2)
          );
        }
      }
    });
  }

  Future<bool?> _mostrarDialogoServicios(String titulo, String mensaje) {
    return showDialog<bool>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: _cDarkBlue,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              Icon(Icons.bluetooth_disabled, color: _cCyan),
              const SizedBox(width: 10),
              Text(titulo, style: TextStyle(color: _cCyan, fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
          content: Text(mensaje, style: TextStyle(color: _cLight, fontSize: 15)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text("Cancelar", style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: _cCyan,
                foregroundColor: _cDarkBlue,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text("Activar", style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  // Verifica que el Bluetooth esté prendido antes de iniciar la app
  Future<void> _verificarYArrancarNavegacion() async {
    // Lee el estado actual de la antena Bluetooth
    var estado = await FlutterBluePlus.adapterState.first;

    // Si está apagado, muestra el cartel
    if (estado != BluetoothAdapterState.on) {
      bool? quiereActivar = await _mostrarDialogoServicios(
          "Bluetooth apagado",
          "Para navegar por la facultad y saber tu ubicación exacta, necesitamos que enciendas el Bluetooth."
      );

      if (quiereActivar == true) {
        try {
          // Le pide a Android que prenda el Bluetooth automáticamente
          await FlutterBluePlus.turnOn();
          await Future.delayed(const Duration(seconds: 1));
        } catch (e) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("No pudimos encenderlo automáticamente. Por favor, prendelo desde los ajustes.")),
          );
          return;
        }
      } else {
        return;
      }
    }

    _iniciarPosicionamientoEnVivo();
  }

  void _iniciarPosicionamientoEnVivo() {
    _iaNavegacion ??= PosicionamientoNN();

    _escanerBLE = EscanerBleNN(
        onPosicionCalculada: (double metrosNN_X, double metrosNN_Y, double metrosTrila_X, double metrosTrila_Y) {
          _procesarPosicion(metrosNN_X, metrosNN_Y, metrosTrila_X, metrosTrila_Y);
        }
    );

    _escanerBLE?.iniciarNavegacion();
  }

  void _procesarPosicion(double metrosNN_X, double metrosNN_Y, double metrosTrila_X, double metrosTrila_Y) {

    if (metrosTrila_X == 0.0 && metrosTrila_Y == 0.0) return;

    double columnaTrila = metrosTrila_X;
    double filaTrila = metrosTrila_Y;
    var coordsTrilaJson = _navController.convertirGrillaRedAJson(filaTrila, columnaTrila);

    double xTrilaReal = coordsTrilaJson["x"]!.clamp(_gridManager.minX, _gridManager.maxX);
    double yTrilaReal = coordsTrilaJson["y"]!.clamp(_gridManager.minY, _gridManager.maxY);

    double xSeguro = xTrilaReal;
    double ySeguro = yTrilaReal;

    if (_usuarioX != 0.0 && _usuarioY != 0.0) {
      xSeguro = (_usuarioX * _devSuavizado) + (xSeguro * (1.0 - _devSuavizado));
      ySeguro = (_usuarioY * _devSuavizado) + (ySeguro * (1.0 - _devSuavizado));
    }

    if (_enGuiadoReal) {
      setState(() {
        _usuarioX = xSeguro;
        _usuarioY = ySeguro;
      });
      return;
    }

    double finalX = xSeguro;
    double finalY = ySeguro;

    if (_usarFiltrosFisicos) {
      var coordsCorregidas = _navController.aplicarSnapAPasillo(xSeguro, ySeguro);
      var coordsFrenadas = _navController.limitarVelocidadHumana(coordsCorregidas["x"]!, coordsCorregidas["y"]!);
      finalX = coordsFrenadas["x"]!;
      finalY = coordsFrenadas["y"]!;
    }

    setState(() {
      _usuarioX = finalX;
      _usuarioY = finalY;
    });

    _navController.setUltimaPosicionFisica(_usuarioX, _usuarioY);

    var coords3D = _traducirConAjuste(_usuarioX, _usuarioY);
    String posUnity = coords3D["hotspotPos"]!.replaceAll('m', '').trim();
    _unityWidgetController?.postMessage("Jugador", "MoverHacia", posUnity);
    _actualizarPOIsCercanos();
  }

  void _actualizarPOIsCercanos() {
    if (_unityWidgetController == null) return;

    double radioDeBusqueda = 10.0;
    List<String> aulasCercanas = [];

    double xDestinoFinal = -9999;
    double yDestinoFinal = -9999;
    if (_idActual != "VISTA_GENERAL") {
      var d = _destinos.firstWhere((d) => d["id"] == _idActual, orElse: () => {"x": "-9999", "y": "-9999"});
      if (d.containsKey("x")) {
        xDestinoFinal = double.tryParse(d["x"] ?? "") ?? -9999;
        yDestinoFinal = double.tryParse(d["y"] ?? "") ?? -9999;
      }
    }

    for (var destino in _destinos) {
      if (destino["id"] == "VISTA_GENERAL") continue;

      if (destino.containsKey("x") && destino.containsKey("y")) {
        double destX = double.tryParse(destino["x"] ?? "") ?? -9999;
        double destY = double.tryParse(destino["y"] ?? "") ?? -9999;

        if (destX == -9999) continue;

        double distancia = math.sqrt(math.pow(_usuarioX - destX, 2) + math.pow(_usuarioY - destY, 2));

        if (distancia <= radioDeBusqueda) {
          String nombreParaMapa = destino["nombre"]!;
          for (var corto in _destinosCortos) {
            if (corto["geometria"] != null && corto["geometria"]["coordinates"] != null) {
              double cx = (corto["geometria"]["coordinates"][0] as num).toDouble();
              double cy = (corto["geometria"]["coordinates"][1] as num).toDouble();
              if (math.sqrt(math.pow(destX - cx, 2) + math.pow(destY - cy, 2)) < 0.5) {
                nombreParaMapa = corto["nombreDestino"];
                break;
              }
            }
          }

          String coordCentroVisual = _traducirConAjuste(destX, destY)["hotspotPos"]!.replaceAll('m', '').trim();
          if (destino.containsKey("centroX") && destino.containsKey("centroY")) {
            double cX = double.parse(destino["centroX"]!);
            double cY = double.parse(destino["centroY"]!);
            coordCentroVisual = _traducirConAjuste(cX, cY)["hotspotPos"]!.replaceAll('m', '').trim();
          }

          double distAlFinal = math.sqrt(math.pow(xDestinoFinal - destX, 2) + math.pow(yDestinoFinal - destY, 2));
          if (distAlFinal < 2.0 && _idActual != "VISTA_GENERAL") continue;

          String idAula = destino["id"]!;
          aulasCercanas.add("$idAula|$coordCentroVisual|$nombreParaMapa");
        }
      }
    }

    if (aulasCercanas.isNotEmpty) {
      String payload = aulasCercanas.join("#");
      if (payload != _ultimoPayloadPOIs) {
        _unityWidgetController?.postMessage("Jugador", "ActualizarDestinosCercanos", payload);
        _ultimoPayloadPOIs = payload;
      }
    } else {
      if (_ultimoPayloadPOIs != "VACIO") {
        _unityWidgetController?.postMessage("Jugador", "ActualizarDestinosCercanos", "VACIO");
        _ultimoPayloadPOIs = "VACIO";
      }
    }
  }

  // Libera los recursos de hardware y memoria cuando el usuario abandona la pantalla del mapa.
  @override
  void dispose() {
    // Detiene el escaneo continuo de redes Bluetooth y apaga la Red Neuronal
    _escanerBLE?.detenerNavegacion();
    // Cancela la suscripción a los eventos del magnetómetro (Brújula)
    _brujulaSubscription?.cancel();

    super.dispose();
  }
}

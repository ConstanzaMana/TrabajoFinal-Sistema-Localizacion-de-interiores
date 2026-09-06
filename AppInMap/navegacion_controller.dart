import 'dart:math';
import 'package:flutter/foundation.dart';
import 'grid_manager.dart';
import 'ruta_utils.dart';

/**
 * Modulo maneja la logica de desplazamiento del usuario al seguir una ruta.
 * Implementa filtros para mitigar el ruido a las estimaciones de la IA.
 */
class NavegacionController {
  final GridManager _gridManager;

  // Almacena la última posición validada del usuario para calcular vectores de velocidad.
  double? _ultimoXFisico;
  double? _ultimoYFisico;
  List<Nodo> _rutaRealActual = []; //Variables para detectar Desvios
  final double _toleranciaDesvio = 1.0; // Distancia máxima permitida (en metros) de alejamiento respecto a la ruta trazada
  double pesoPenalizacion = 1.5;

  double limiteSnap = 10.0; // Distancia máxima a la que el imán te arrastra al pasillo
  double velocidadMax = 2.0; // Salto máximo permitido en metros por ciclo

  NavegacionController(this._gridManager);

  // Actualiza las coordenadas validadas del usuario en la iteración actual.
  void setUltimaPosicionFisica(double x, double y) {
    _ultimoXFisico = x;
    _ultimoYFisico = y;
  }

  void limpiarMemoriaFisica() {
    _ultimoXFisico = null;
    _ultimoYFisico = null;
  }

  // Sincroniza la matriz de la ruta generada por el algoritmo A*.
  void actualizarRutaReal(List<Nodo> nuevaRuta) {
    _rutaRealActual = nuevaRuta;
  }

  // Traduce las dimensiones matriciales (Filas/Columnas) emitidas por el algoritmo de posicionamiento a coordenadas cartesianas (X, Y)
  Map<String, double> convertirGrillaRedAJson(double filaRed, double columnaRed) {
    double jsonX = 2832.795 + (columnaRed * 1.2652);
    double jsonY = 539.429 - (filaRed * 0.8325);
    return {"x": jsonX, "y": jsonY};
  }

  //Filtro: si la estimación actual representa un desplazamiento físicamente imposible,
  // proyecta la trayectoria utilizando A* y trunca el avance hasta la distancia máxima permitida por la velocidad humana.
  Map<String, double> limitarVelocidadHumana(double rawX, double rawY) {
    if (_ultimoXFisico == null || _ultimoYFisico == null) {
      return {"x": rawX, "y": rawY};
    }

    final datosMapa = _gridManager.exportarDatos();
    final rutaHaciaIA = BuscadorRutas.encontrarRutaAislada({
      'startX': _ultimoXFisico,
      'startY': _ultimoYFisico,
      'endX': rawX,
      'endY': rawY,
      'datosMapa': datosMapa,
    });

    if (rutaHaciaIA.isEmpty) {
      return {"x": _ultimoXFisico!, "y": _ultimoYFisico!};
    }

    final int maxNodos = (velocidadMax / _gridManager.cellSize).floor();
    if (rutaHaciaIA.length > maxNodos) {
      final nodo = rutaHaciaIA[maxNodos];
      return {
        "x": _gridManager.minX + (nodo.x * _gridManager.cellSize) + (_gridManager.cellSize / 2),
        "y": _gridManager.minY + (nodo.y * _gridManager.cellSize) + (_gridManager.cellSize / 2),
      };
    }

    return {"x": rawX, "y": rawY};
  }
  // Filtro de Snap a Pasillo: Fuerza a que cualquier coordenada predicha se desplace hacia
  // la celda navegable más cercana, evitando que el usuario aparezca dentro de muros o aulas.
  Map<String, double> aplicarSnapAPasillo(double jsonX, double jsonY) {
    int c = ((jsonX - _gridManager.minX) / _gridManager.cellSize).floor();
    int r = ((jsonY - _gridManager.minY) / _gridManager.cellSize).floor();

    // Verifica si la coordenada ya se encuentra en zona permitida
    if (c >= 0 && c < _gridManager.cols && r >= 0 && r < _gridManager.rows) {
      if (_gridManager.grid![c][r] == true) {
        return {"x": jsonX, "y": jsonY};
      }
    }

    // Búsqueda radial expansiva para localizar el pasillo óptimo más cercano
    int radioBusqueda = 20;
    double mejorPuntaje = double.infinity;
    int? mejorC;
    int? mejorR;

    for (int rad = 1; rad <= radioBusqueda; rad++) {
      for (int i = c - rad; i <= c + rad; i++) {
        for (int j = r - rad; j <= r + rad; j++) {
          if (i >= 0 && i < _gridManager.cols && j >= 0 && j < _gridManager.rows) {
            if (_gridManager.grid![i][j] == true) {
              double cx = _gridManager.minX + i * _gridManager.cellSize + (_gridManager.cellSize / 2);
              double cy = _gridManager.minY + j * _gridManager.cellSize + (_gridManager.cellSize / 2);

              // Calcula costo basado en Distancia Euclidiana + Penalización de la celda
              double dist = sqrt(pow(jsonX - cx, 2) + pow(jsonY - cy, 2));
              double penalizacion = _gridManager.penaltyGrid![i][j];
              double puntaje = dist + (penalizacion * pesoPenalizacion);


              if (puntaje < mejorPuntaje) {
                mejorPuntaje = puntaje;
                mejorC = i;
                mejorR = j;
              }
            }
          }
        }
      }
    }

    if (mejorC != null && mejorR != null) {
      double nuevoX = _gridManager.minX + mejorC * _gridManager.cellSize + (_gridManager.cellSize / 2);
      double nuevoY = _gridManager.minY + mejorR * _gridManager.cellSize + (_gridManager.cellSize / 2);

      double distOriginal = sqrt(pow(jsonX - nuevoX, 2) + pow(jsonY - nuevoY, 2));
      if (distOriginal > limiteSnap) return {"x": jsonX, "y": jsonY};

      return {"x": nuevoX, "y": nuevoY};
    }

    debugPrint("ANOMALÍA TOPOGRÁFICA: Imposible resolver Snap a pasillo.");
    debugPrint("límites Grid: Cols=${_gridManager.cols}, Rows=${_gridManager.rows}");
    return {"x": jsonX, "y": jsonY};
  }

  // Filtro de Adherencia: Suaviza visualmente el avance atrayendo el pin
  // hacia la línea recta trazada por el algoritmo A*.
  Map<String, double> aplicarSnapARuta(double x, double y) {
    if (_rutaRealActual.isEmpty) return {"x": x, "y": y};

    double distanciaMinima = double.infinity;
    double? snapX, snapY;

    const double umbralSnap = 3.0;

    for (var nodo in _rutaRealActual) {
      double nodoX = _gridManager.minX + (nodo.x * _gridManager.cellSize) + (_gridManager.cellSize / 2);
      double nodoY = _gridManager.minY + (nodo.y * _gridManager.cellSize) + (_gridManager.cellSize / 2);

      double dist = sqrt(pow(x - nodoX, 2) + pow(y - nodoY, 2));
      if (dist < distanciaMinima) {
        distanciaMinima = dist;
        snapX = nodoX;
        snapY = nodoY;
      }
    }

    if (distanciaMinima < umbralSnap && snapX != null && snapY != null) {
      return {"x": snapX, "y": snapY};
    }

    return {"x": x, "y": y};
  }

  // Evalúa la desviación del usuario respecto a la trayectoria principal.
  // Si la distancia supera la [toleranciaDesvio], emite una señal de recálculo.
  bool verificarDesvio(double currentX, double currentY) {
    if (_rutaRealActual.isEmpty) return false;

    double distanciaMinimaAlCamino = double.infinity;
    double minX = _gridManager.minX;
    double minY = _gridManager.minY;
    double cellSize = _gridManager.cellSize;

    for (int i = 0; i < _rutaRealActual.length; i++) {
      var nodo = _rutaRealActual[i];
      double nodoX = minX + (nodo.x * cellSize) + (cellSize / 2);
      double nodoY = minY + (nodo.y * cellSize) + (cellSize / 2);

      double dist = sqrt(pow(currentX - nodoX, 2) + pow(currentY - nodoY, 2));
      if (dist < distanciaMinimaAlCamino) {
        distanciaMinimaAlCamino = dist;
      }
    }

    return distanciaMinimaAlCamino > _toleranciaDesvio;
  }

  // Función auxiliar asíncrona para ejecutar un cálculo A* en situaciones de desvío crítico.
  Future<List<Nodo>> obtenerNuevaRuta(double xOrigen, double yOrigen, String idDestino, List<Map<String, String>> destinos) async {
    final destinoData = destinos.firstWhere((d) => d["id"] == idDestino);
    double dX = double.parse(destinoData["x"]!);
    double dY = double.parse(destinoData["y"]!);

    var datosMapa = _gridManager.exportarDatos();

    return await compute(BuscadorRutas.encontrarRutaAislada, {
      'startX': xOrigen,
      'startY': yOrigen,
      'endX': dX,
      'endY': dY,
      'datosMapa': datosMapa,
    });
  }

}
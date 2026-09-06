import 'dart:math';
/*
Modulo de navegacion y calculo de Rutas (Algoritmo A*)
-Incorpora un filtro direccional (Anti Zig-Zag) que penaliza algorítmicamente los cambios
de vector, forzando trayectorias orgánicas y rectas a lo largo de los pasillos.
-Traduce la solución matemática en instrucciones de navegación paso a paso comprensibles para el usuario.
*/

// Representa un nodo dentro de la grilla del mapa.
// Utilizado por el algoritmo de búsqueda para evaluar los costos de desplazamiento.
class Nodo {
  final int x, y;

  // Parámetros de costo del algoritmo A*
  double g = 0; // Costo exacto desde el punto de inicio hasta este nodo
  double h = 0; // Costo heurístico estimado desde este nodo hasta el destino
  double get f => g + h; // Costo total evaluado
  Nodo? padre; // Referencia al nodo previo para reconstruir el camino final

  // Vectores direccionales para determinar cambios de trayectoria (giros)
  int dirX = 0;
  int dirY = 0;

  Nodo(this.x, this.y);

  @override
  bool operator ==(Object other) => other is Nodo && x == other.x && y == other.y;

  @override
  int get hashCode => Object.hash(x, y);
}

// Enumeración que clasifica el tipo de maniobra requerida en la navegación.
enum TipoGiro { recto, derecha, izquierda, destino }

// Estructura semántica que define un paso dentro de la ruta calculada.
class InstruccionRuta {
  final String texto;
  final double distancia; // Distancia en metros hasta ejecutar la acción
  final TipoGiro tipo;

  InstruccionRuta({required this.texto, required this.distancia, required this.tipo});
}


//Ejecuta Algoritmo de busqueda de rutas
class BuscadorRutas {
  // Diseñado para recibir un mapa de parámetros y ejecutarse en un Isolate (hilo secundario)
  static List<Nodo> encontrarRutaAislada(Map<String, dynamic> datos) {
    // Reconstrucción de la topografía desde el JSON
    List<List<bool>> grid = (datos['datosMapa']['grid'] as List)
        .map((e) => (e as List).cast<bool>())
        .toList();

    List<List<double>> penaltyGrid = (datos['datosMapa']['penaltyGrid'] as List)
        .map((e) => (e as List).map((n) => (n as num).toDouble()).toList())
        .toList();

    double minX = datos['datosMapa']['minX'];
    double minY = datos['datosMapa']['minY'];
    double cellSize = datos['datosMapa']['cellSize'];
    int cols = datos['datosMapa']['cols'];
    int rows = datos['datosMapa']['rows'];

    // Normalización de coordenadas métricas a índices de la grilla
    int startX = ((datos['startX'] - minX) / cellSize).floor();
    int startY = ((datos['startY'] - minY) / cellSize).floor();
    int endX = ((datos['endX'] - minX) / cellSize).floor();
    int endY = ((datos['endY'] - minY) / cellSize).floor();

    // Validación y corrección de nodos origen/destino (Snap to Grid)
    if (!_esValido(grid, startX, startY, cols, rows)) {
      var nuevoInicio = _buscarCaminableCercano(grid, startX, startY, cols, rows);
      if (nuevoInicio != null) {
        startX = nuevoInicio.x;
        startY = nuevoInicio.y;
      } else { return []; }
    }

    if (!_esValido(grid, endX, endY, cols, rows)) {
      var nuevoFin = _buscarCaminableCercano(grid, endX, endY, cols, rows);
      if (nuevoFin != null) {
        endX = nuevoFin.x;
        endY = nuevoFin.y;
      } else { return []; }
    }

    // Inicialización de las estructuras de evaluación A*
    Nodo inicio = Nodo(startX, startY);
    Nodo destino = Nodo(endX, endY);

    List<Nodo> abierta = [inicio];
    Set<Nodo> cerrada = {};
    Map<String, Nodo> abiertaMap = {"${inicio.x},${inicio.y}": inicio};

    // Bucle principal de expansión de nodos
    while (abierta.isNotEmpty) {
      // Prioriza el nodo con el menor costo total (f)
      abierta.sort((a, b) => a.f.compareTo(b.f));
      Nodo actual = abierta.removeAt(0);
      abiertaMap.remove("${actual.x},${actual.y}");

      // Condición de éxito: Destino alcanzado
      if (actual.x == destino.x && actual.y == destino.y) {
        List<Nodo> ruta = [];
        Nodo? temp = actual;
        while (temp != null) {
          ruta.insert(0, temp); // Reconstruye el camino en orden cronológico
          temp = temp.padre;
        }
        return ruta;
      }

      cerrada.add(actual);

      // Expansión a nodos adyacentes
      List<Nodo> vecinos = [
        Nodo(actual.x - 1, actual.y)..dirX = -1..dirY = 0,
        Nodo(actual.x + 1, actual.y)..dirX = 1..dirY = 0,
        Nodo(actual.x, actual.y - 1)..dirX = 0..dirY = -1,
        Nodo(actual.x, actual.y + 1)..dirX = 0..dirY = 1,
      ];

      for (Nodo vecino in vecinos) {
        // Omite nodos fuera de los límites o previamente evaluados
        if (vecino.x < 0 || vecino.x >= cols || vecino.y < 0 || vecino.y >= rows) continue;
        if (cerrada.contains(vecino)) continue;
        if (grid[vecino.x][vecino.y] == false) continue; // Colisión con pared

        double penalizacionPared = penaltyGrid[vecino.x][vecino.y];

        // Penalizacion (Filtro Anti Zig-Zag)
        double costoGiro = 0.0;
        if (actual.padre != null) {
          if (actual.dirX != vecino.dirX || actual.dirY != vecino.dirY) {
            costoGiro = 130.0;
          }
        }
        // Ecuación de costo de desplazamiento (g)
        double nuevoCostoG = actual.g + 3.0 + 1.3 * penalizacionPared + 1.4 * costoGiro;

        Nodo? enAbierta = abiertaMap["${vecino.x},${vecino.y}"];

        // Actualiza el nodo si se encontró un camino más eficiente
        if (enAbierta == null || nuevoCostoG < enAbierta.g) {
          vecino.g = nuevoCostoG;

          // Heurística de Distancia Manhattan
          double distanciaManhattan = ((vecino.x - destino.x).abs() + (vecino.y - destino.y).abs()).toDouble();
          vecino.h = distanciaManhattan;

          vecino.padre = actual;

          if (enAbierta == null) {
            abierta.add(vecino);
            abiertaMap["${vecino.x},${vecino.y}"] = vecino;
          } else {
            enAbierta.g = vecino.g;
            enAbierta.padre = actual;
            enAbierta.dirX = vecino.dirX;
            enAbierta.dirY = vecino.dirY;
          }
        }
      }
    }
    // Retorna arreglo vacío si no existe una solución topológica
    return [];
  }

  /// Verifica que las coordenadas indexadas pertenezcan al espacio navegable libre de colisiones.
  static bool _esValido(List<List<bool>> grid, int x, int y, int cols, int rows) {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return false;
    return grid[x][y];
  }

  /// Ejecuta una búsqueda radial expansiva para encontrar el nodo transitable más cercano
  /// en caso de que el origen o destino caigan dentro de una zona inhabilitada.
  static Nodo? _buscarCaminableCercano(List<List<bool>> grid, int cx, int cy, int cols, int rows) {
    int radioMax = 5;
    for (int r = 1; r <= radioMax; r++) {
      for (int x = cx - r; x <= cx + r; x++) {
        for (int y = cy - r; y <= cy + r; y++) {
          if (_esValido(grid, x, y, cols, rows)) {
            return Nodo(x, y);
          }
        }
      }
    }
    return null;
  }

  // Procesa la ruta nodal y genera instrucciones de navegación semánticas (paso a paso)
  // evaluando matemáticamente los cambios de trayectoria.
  static List<InstruccionRuta> generarInstrucciones(List<Nodo> ruta, double cellSize) {
    if (ruta.length < 2) return [];

    List<InstruccionRuta> instrucciones = [];
    double distanciaAcumulada = 0;

    for (int i = 0; i < ruta.length - 2; i++) {
      Nodo a = ruta[i];
      Nodo b = ruta[i + 1];
      Nodo c = ruta[i + 2];

      // Generación de vectores bidimensionales para evaluar la transición geométrica
      int v1x = b.x - a.x;
      int v1y = b.y - a.y;
      int v2x = c.x - b.x;
      int v2y = c.y - b.y;

      // Producto cruzado (Cross Product)
      // Determina matemáticamente la orientación del giro en un espacio euclidiano.
      int crossProduct = (v1x * v2y) - (v1y * v2x);
      distanciaAcumulada += cellSize;

      if (crossProduct != 0) {
        String giro = crossProduct < 0 ? "la derecha" : "la izquierda";
        TipoGiro tipo = crossProduct < 0 ? TipoGiro.izquierda : TipoGiro.derecha;

        instrucciones.add(InstruccionRuta(
            texto: "En ${distanciaAcumulada.toStringAsFixed(1)}m, dobla a $giro",
            distancia: distanciaAcumulada,
            tipo: tipo));

        distanciaAcumulada = 0;
      }
    }

    // Añade el remanente de distancia hasta alcanzar el último nodo
    distanciaAcumulada += cellSize;
    instrucciones.add(InstruccionRuta(
        texto: "Has llegado a tu destino",
        distancia: distanciaAcumulada,
        tipo: TipoGiro.destino));

    return instrucciones;
  }
}
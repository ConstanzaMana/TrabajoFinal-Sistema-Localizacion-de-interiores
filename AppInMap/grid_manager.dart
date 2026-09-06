import 'dart:math';

/*
Convierte el mapa vectorial en una matriz 2D de celdas virtuales.
Se utiliza para:
- Que el algoritmo A* sepa por dónde se puede caminar (pasillos) y por dónde no (paredes),
-Aplicar penalizaciones para forzar que la ruta vaya por el medio del pasillo.
*/
class GridManager {
  late double minX, maxX, minY, maxY;
  late double cellSize; // Tamaño de cada celda en metros
  late int cols, rows;

  // Matriz principal: true = se puede caminar, false = pared/obstáculo
  List<List<bool>>? _grid;
  // Matriz de costos: número más alto = zona a evitar (cerca de paredes)
  List<List<double>>? _penaltyGrid;
  List<List<bool>>? get grid => _grid;
  List<List<double>>? get penaltyGrid => _penaltyGrid;

  GridManager({required this.cellSize});

  // Recibe la lista de zonas, y prepara las matrices.
  void inicializarDesdeZonas(List<dynamic> zonas) {
    if (zonas.isEmpty) return;

    // Calcula los límites del mapa buscando los puntos más extremos
    minX = double.infinity; maxX = double.negativeInfinity;
    minY = double.infinity; maxY = double.negativeInfinity;

    for (var zona in zonas) {
      if (zona['bloqueado'] == false) {
        var coords = zona['geometria']['coordinates'][0][0];
        for (var punto in coords) {
          double x = punto[0].toDouble();
          double y = punto[1].toDouble();
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Margen de seguridad para que el jugador no quede al borde de la grilla
    minX -= 2; maxX += 2; minY -= 2; maxY += 2;
    cols = ((maxX - minX) / cellSize).ceil();
    rows = ((maxY - minY) / cellSize).ceil();

    _grid = List.generate(cols, (_) => List.filled(rows, false));

    // Pinta de verde (true) solo donde hay pasillos o aulas
    _quemarPasillosEnGrilla(zonas);

    // Calcula las penalizaciones para alejar la línea de las paredes
    _calcularPenalizaciones();
  }

  //Convierte las formas del mapa en cuadraditos booleanos (`true`) dentro de la matriz `_grid`.
  void _quemarPasillosEnGrilla(List<dynamic> zonas) {
    int contadorCeldasCaminables = 0;

    for (var zona in zonas) {
      if (zona['bloqueado'] == false) {
        var polygon = zona['geometria']['coordinates'][0][0];
        double zMinX = double.infinity, zMaxX = double.negativeInfinity;
        double zMinY = double.infinity, zMaxY = double.negativeInfinity;

        for (var p in polygon) {
          if (p[0] < zMinX) zMinX = p[0].toDouble();
          if (p[0] > zMaxX) zMaxX = p[0].toDouble();
          if (p[1] < zMinY) zMinY = p[1].toDouble();
          if (p[1] > zMaxY) zMaxY = p[1].toDouble();
        }

        int startI = ((zMinX - minX) / cellSize).floor().clamp(0, cols - 1);
        int endI = ((zMaxX - minX) / cellSize).ceil().clamp(0, cols - 1);
        int startJ = ((zMinY - minY) / cellSize).floor().clamp(0, rows - 1);
        int endJ = ((zMaxY - minY) / cellSize).ceil().clamp(0, rows - 1);

        for (int i = startI; i <= endI; i++) {
          for (int j = startJ; j <= endJ; j++) {
            if (_grid![i][j]) continue;

            double cellWorldX = minX + (i * cellSize) + (cellSize / 2);
            double cellWorldY = minY + (j * cellSize) + (cellSize / 2);

            if (_pointInPolygon(cellWorldX, cellWorldY, polygon)) {
              _grid![i][j] = true;
              contadorCeldasCaminables++;
            }
          }
        }
      }
    }
  }

  /*Genera un Efecto Repulsivo en las paredes.
  Escanea las celdas cercanas a cada punto caminable; si detecta una pared,
  aumenta exponencialmente el costo de caminar por ahí, haciendo que el centro exacto del pasillo tenga bajo costo.
   */
  void _calcularPenalizaciones() {
    _penaltyGrid = List.generate(cols, (_) => List.filled(rows, 1.0));
    const int rangoEscaneo = 4;

    for (int i = 0; i < cols; i++) {
      for (int j = 0; j < rows; j++) {
        if (!_grid![i][j]) continue;

        double minDist = rangoEscaneo.toDouble();
        bool cercaDePared = false;

        // Busca paredes
        for (int dx = -rangoEscaneo; dx <= rangoEscaneo; dx++) {
          for (int dy = -rangoEscaneo; dy <= rangoEscaneo; dy++) {
            int nx = i + dx;
            int ny = j + dy;

            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows || !_grid![nx][ny]) {
              double dist = sqrt(dx * dx + dy * dy);
              if (dist < minDist) {
                minDist = dist;
                cercaDePared = true;
              }
            }
          }
        }

        if (cercaDePared) {
          // La Penalización sube al acercarse a las paredes
          double factorRepulsion = pow(rangoEscaneo - minDist, 2).toDouble();
          _penaltyGrid![i][j] = 1.0 + (factorRepulsion * 15.0);
        } else {
          _penaltyGrid![i][j] = 1.0; // Zona segura en el centro
        }
      }
    }
  }

  /*
  Verifica si una coordenada (x,y) cae dentro de un polígono usando el algoritmo de Ray-Casting.
  Actúa como "traductor": convierte las zonas geométricas del mapa
  en celdas cuadradas para que el algoritmo A* sepa por dónde caminar.
   */
  bool _pointInPolygon(double x, double y, List<dynamic> poly) {
    bool inside = false;
    for (int i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      double xi = poly[i][0].toDouble(), yi = poly[i][1].toDouble();
      double xj = poly[j][0].toDouble(), yj = poly[j][1].toDouble();

      bool intersect = ((yi > y) != (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Empaqueta las matrices y configuraciones para enviarlas al buscador de rutas A*
  Map<String, dynamic> exportarDatos() {
    return {
      'grid': _grid,
      'penaltyGrid': _penaltyGrid,
      'minX': minX,
      'minY': minY,
      'cellSize': cellSize,
      'cols': cols,
      'rows': rows
    };
  }
}
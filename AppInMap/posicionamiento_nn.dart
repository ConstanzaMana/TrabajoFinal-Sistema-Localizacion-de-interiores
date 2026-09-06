import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:tflite_flutter/tflite_flutter.dart';


/*
    Este archivo contiene la implementación de la Red
    Neuronal Densa (MLP) evaluada durante la fase de laboratorio, estas no fueron utilizadas en la aplicacion final.
    Utilizaba un sistema híbrido:
    1. Arranque en Frío: Utiliza centroide ponderado.
    2. Seguimiento: Utiliza la Red Neuronal, alimentada por señales RSSI y la posición previa para predecir el siguiente paso.
 */
class PosicionamientoNN {
  Interpreter? _interpreter;
  final int cantidadBalizas = 10;
  final double minRssi = -200.0;
  final double maxRssi = 0.0;

  final double minFilaPython = 8.0;
  final double maxFilaPython = 43.0;
  final double minColumnaPython = 5.0;
  final double maxColumnaPython = 55.0;

  // Almacena la predicción del ciclo anterior normalizada [0, 1].
  // Actúa como contexto temporal para el modelo neuronal.
  double _filaAnteriorEscalada = 0.0;
  double _columnaAnteriorEscalada = 0.0;
  bool _tienePosicionPrevia = false;
  double factorAtenuacion = 20.0;

  // Ubicaciones estáticas de los BLE (Fila, Columna)

  final Map<int, List<double>> posicionesBalizas2 = {
    0: [34.0, 14.0], // Minor 1
    1: [42.0, 9.0],  // Minor 2
    2: [31.0, 5.0],  // Minor 3
    3: [17.0, 5.0],  // Minor 4
    4: [17.0, 13.0], // Minor 5
    5: [34.0, 28.0], // Minor 6
    6: [33.0, 43.0], // Minor 7
    7: [18.0, 41.0], // Minor 8
    8: [27.0, 50.0], // Minor 9
    9: [10.0, 46.0], // Minor 10
  };

  final Map<int, List<double>> posicionesBalizas1 = {
    0: [18.0, 41.0], // Minor 1
    1: [33.0, 43.0],  // Minor 2
    2: [27.0, 50.0],  // Minor 3
    3: [10.0, 46.0],  // Minor 4
    4: [34.0, 28.0], // Minor 5
   // 4: [33.0, 30.0],

    5: [34.0, 28.0], // Minor 6
    6: [33.0, 43.0], // Minor 7
    7: [18.0, 41.0], // Minor 8
    8: [27.0, 50.0], // Minor 9
    9: [10.0, 46.0], // Minor 10
  };
  final Map<int, List<double>> posicionesBalizas = {
    0: [34.0, 28.0], // Minor 1
    1: [33.0, 43.0],  // Minor 2
    2: [27.0, 50.0],  // Minor 3
    3: [10.0, 46.0],  // Minor 4
    4: [18.0, 41.0], // Minor 5
    // 4: [33.0, 30.0],

    5: [34.0, 28.0], // Minor 6
    6: [33.0, 43.0], // Minor 7
    7: [18.0, 41.0], // Minor 8
    8: [27.0, 50.0], // Minor 9
    9: [10.0, 46.0], // Minor 10
  };
  // Carga el modelo de pesos
  Future<void> inicializarModelo() async {
    try {
      _interpreter = await Interpreter.fromAsset('assets/modelo_posicionamiento.tflite');
      debugPrint('Modelo de Red Neuronal cargado exitosamente.');
    } catch (e) {
      debugPrint('Error al cargar el modelo TFLite: $e');
    }
  }

  /*Funcion que se uso para pruebas con la red Neuronal.
  Ejecuta el proceso de inferencia para estimar la ubicación actual del usuario.
  Recibe un vector de potencias RSSI y retorna las coordenadas matriciales [Fila, Columna].
   */
  List<double> estimarPosicion(List<double> rssiActualesOrdenados) {
    if (_interpreter == null) return [0.0, 0.0];

    // Fase 1: Arranque en Frío
    // Si no hay contexto temporal, aproxima la posición inicial geométricamente. (Trilateracion)
    if (!_tienePosicionPrevia) {
      _calcularArranqueEnFrio(rssiActualesOrdenados);
    }
    // Fase 2: Preprocesamiento y Extracción de Características
    List<double> inputFeatures = [];
    // Escala las señales de radio al rango [0, 1]
    for (double rssi in rssiActualesOrdenados) {
      inputFeatures.add((rssi - minRssi) / (maxRssi - minRssi));
    }
    // Fase 3: Se añade la ubicación anterior con un hiperparámetro de ponderación empírico (1.4)
    inputFeatures.add(_filaAnteriorEscalada * 1.4);
    inputFeatures.add(_columnaAnteriorEscalada * 1.4);

    // Preparación de los tensores de entrada y salida
    var input = [inputFeatures];
    var output = List.filled(1 * 2, 0.0).reshape([1, 2]);

    // Fase 4: Inferencia Computacional
    try {
      _interpreter!.run(input, output);
    } catch (e) {
      debugPrint('Error en predicción del TFLite: $e');
      return [
        _desescalar(_filaAnteriorEscalada, minFilaPython, maxFilaPython),
        _desescalar(_columnaAnteriorEscalada, minColumnaPython, maxColumnaPython)
      ];
    }

    // Fase 5: Postprocesamiento y Actualización de Estado
    double nuevaFilaEscalada = output[0][0];
    double nuevaColumnaEscalada = output[0][1];

    _filaAnteriorEscalada = nuevaFilaEscalada;
    _columnaAnteriorEscalada = nuevaColumnaEscalada;

    // Transformación inversa para recuperar las unidades topográficas originales
    double filaReal = _desescalar(nuevaFilaEscalada, minFilaPython, maxFilaPython);
    double columnaReal = _desescalar(nuevaColumnaEscalada, minColumnaPython, maxColumnaPython);

    return [filaReal, columnaReal];
  }

  // Función matemática inversa para transformar valores normalizados [0,1]
  // a la escala matricial original del entorno físico.
  double _desescalar(double valorEscalado, double min, double max) {
    return valorEscalado * (max - min) + min;
  }

  void resetearMemoriaEspacial() {
    _tienePosicionPrevia = false;
  }

  // Algoritmo heurístico de aproximación de ubicación inicial. Usa un centroide ponderado
  void _calcularArranqueEnFrio(List<double> rssiActuales) {
    List<Map<String, dynamic>> balizasEscuchadas = [];
    for (int i = 0; i < rssiActuales.length; i++) {
      double rssi = rssiActuales[i];
      if (rssi > -100.0 && rssi < 0.0) {
        balizasEscuchadas.add({
          'rssi': rssi,
          'fila': posicionesBalizas[i]![0],
          'columna': posicionesBalizas[i]![1]
        });
      }
    }

    if (balizasEscuchadas.isEmpty) {
      _filaAnteriorEscalada = 0.5;
      _columnaAnteriorEscalada = 0.5;
      _tienePosicionPrevia = true;
      return;
    }

    // Ordena los vectores de señal de mayor a menor intensidad (Descendente)
    balizasEscuchadas.sort((a, b) => b['rssi'].compareTo(a['rssi']));

    // Selecciona los nodos más fuertes para la trilateración (K=3)
    int topK = balizasEscuchadas.length < 3 ? balizasEscuchadas.length : 3;
    double sumaPesos = 0.0;
    double sumaFilas = 0.0;
    double sumaColumnas = 0.0;

    for (int i = 0; i < topK; i++) {
      var b = balizasEscuchadas[i];

      // Transformación exponencial: Compensa la atenuación logarítmica de la señal BLE en el aire
      // convirtiendo el valor RSSI negativo en un peso estadístico positivo.
      double peso = pow(10, b['rssi'] / 20.0).toDouble();

      sumaPesos += peso;
      sumaFilas += b['fila'] * peso;
      sumaColumnas += b['columna'] * peso;
    }

    // Calcula las coordenadas del centroide ponderado
    double filaCruda = sumaFilas / sumaPesos;
    double columnaCruda = sumaColumnas / sumaPesos;

    // Normaliza las coordenadas calculadas para inyectarlas como contexto en la Red Neuronal
    _filaAnteriorEscalada = (filaCruda - minFilaPython) / (maxFilaPython - minFilaPython);
    _columnaAnteriorEscalada = (columnaCruda - minColumnaPython) / (maxColumnaPython - minColumnaPython);
    _tienePosicionPrevia = true;
  }

  List<double> calcularTrilateracionPura(List<double> rssiActualesOrdenados) {
    List<Map<String, dynamic>> balizasEscuchadas = [];

    for (int i = 0; i < rssiActualesOrdenados.length; i++) {
      double rssi = rssiActualesOrdenados[i];
      if (rssi > -100.0 && rssi < 0.0) {
        balizasEscuchadas.add({
          'rssi': rssi,
          'minor': i,
          'fila': posicionesBalizas[i]![0],
          'columna': posicionesBalizas[i]![1]
        });
      }
    }

    if (balizasEscuchadas.length < 2) return [0.0, 0.0];

    balizasEscuchadas.sort((a, b) => b['rssi'].compareTo(a['rssi']));

    const Set<int> balizasInterferencia = {0, 4};

    int topK = balizasEscuchadas.length < 3 ? balizasEscuchadas.length : 3;
    double sumaPesos = 0.0;
    double sumaFilas = 0.0;
    double sumaColumnas = 0.0;

    for (int i = 0; i < topK; i++) {
      var b = balizasEscuchadas[i];
      int minor = b['minor'];
      double factor = balizasInterferencia.contains(minor)
          ? 0.5 + factorAtenuacion
          : factorAtenuacion;

      double peso = pow(10, b['rssi'] / factor).toDouble();

      sumaPesos += peso;
      sumaFilas += b['fila'] * peso;
      sumaColumnas += b['columna'] * peso;
    }

    double filaCruda = sumaFilas / sumaPesos;
    double columnaCruda = sumaColumnas / sumaPesos;

    return [filaCruda, columnaCruda];
  }

}
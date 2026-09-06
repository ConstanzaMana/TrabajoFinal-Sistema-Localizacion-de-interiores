import 'dart:async';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'posicionamiento_nn.dart';
import 'dart:io';

/**
 * Modulo de adnquisicion y procesamiento de las senales BLE
 * Gestiona el escaneo en tiempo real de los BLE,
 * aplica ventanas de tiempo para la mitigación de ruido mediante el promediado de
 * la fuerza de la señal (RSSI) y alimenta el modelo de Red Neuronal que se uso de prueba para la
 * estimación de coordenadas espaciales.
 */
class EscanerBleNN {
  final PosicionamientoNN redNeuronal = PosicionamientoNN();
  // Vector topológico de características (Features).
  // Define el orden de las balizas (Minors) para garantizar que el
  // vector de entrada coincida exactamente con las columnas del dataset de entrenamiento.
  final List<int> _minorsOrdenados = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Identificador único universal (UUID) de los BLE.
  final String uuidProyecto = "8ec76ea3-6668-48da-9866-75be8bc86f4d";

  // Buffer temporal  para el promedio las de lecturas RSSI.
  // Clave: Minor de la baliza. Valor: Arreglo de lecturas capturadas en el ciclo actual.
  Map<int, List<double>> _bufferLecturas = {};
  Map<int, double> _memoriaRssi = {};
  Map<int, DateTime> _tiempoUltimaLectura = {};

  Timer? _timerProcesamiento;
  StreamSubscription? _scanSubscription;

  // Función invocada tras cada inferencia  para inyectar las coordenadas estimadas en la UI.
  final Function(double nnX, double nnY, double trilaX, double trilaY) onPosicionCalculada;

  EscanerBleNN({required this.onPosicionCalculada}) {
    _limpiarBuffer();
  }

  // Despliega el hardware Bluetooth e inicia el ciclo de inferencia continua.
  Future<void> iniciarNavegacion() async {
    await FlutterBluePlus.startScan(continuousUpdates: true);
  //Comienza el proceso de captura de datos y guarda en el buffer
    _scanSubscription = FlutterBluePlus.scanResults.listen((results) {
      for (ScanResult r in results) {
        if (r.advertisementData.manufacturerData.containsKey(19456)) {
          List<int> bytes = r.advertisementData.manufacturerData[19456]!;

          if (bytes.length >= 21) {
            int posMinor = bytes.length - 3;
            int minorLeido = (bytes[posMinor] << 8) + bytes[posMinor + 1];

            if (_minorsOrdenados.contains(minorLeido)) {
              _bufferLecturas[minorLeido]!.add(r.rssi.toDouble());
            }
          }
        }
      }
    });

    // Disparador de Ventana de Tiempo
    _timerProcesamiento = Timer.periodic(const Duration(milliseconds: 1000), (timer) {
      _procesarVentanaDeTiempo();
    });
  }

  /* Procesa las lecturas de RSSI acumuladas durante el ciclo de escaneo actual (Ventana de Tiempo).
   Promedia las intensidades para suavizar las fluctuaciones físicas de la señal BLE.
   Además, implementa un buffer temporal de 2 segundos que retiene el último valor válido de una baliza
   Inyecta el vector limpio en el modelo algorítmico de estimación espacial.*/
  void _procesarVentanaDeTiempo() {
    List<double> rssiPromediados = [];
    DateTime ahora = DateTime.now();

    for (int minor in _minorsOrdenados) {
      List<double> lecturas = _bufferLecturas[minor]!;

      if (lecturas.isNotEmpty) {
        double suma = lecturas.fold(0, (prev, curr) => prev + curr);
        double promedioActual = suma / lecturas.length;

        _memoriaRssi[minor] = promedioActual;
        _tiempoUltimaLectura[minor] = ahora;
        rssiPromediados.add(promedioActual);

      } else {
        if (_tiempoUltimaLectura.containsKey(minor)) {
          if (ahora.difference(_tiempoUltimaLectura[minor]!).inMilliseconds < 2000) {
            rssiPromediados.add(_memoriaRssi[minor]!);
          } else {
            rssiPromediados.add(-200.0);
          }
        } else {
          rssiPromediados.add(-200.0);
        }
      }
    }

    _limpiarBuffer();

    List<double> posGridTrila = redNeuronal.calcularTrilateracionPura(rssiPromediados);

    if (posGridTrila[0] == 0.0 && posGridTrila[1] == 0.0) {
      onPosicionCalculada(0.0, 0.0, 0.0, 0.0);
      return;
    }

    double columnaPura = posGridTrila[1];
    double filaPura = posGridTrila[0];

    onPosicionCalculada(0.0, 0.0, columnaPura, filaPura);
  }

  void _limpiarBuffer() {
    for (int minor in _minorsOrdenados) {
      _bufferLecturas[minor] = [];
    }
  }

  // Finaliza de manera segura todos los procesos asíncronos y libera el hardware Bluetooth.
  void detenerNavegacion() {
    FlutterBluePlus.stopScan();
    _scanSubscription?.cancel();
    _timerProcesamiento?.cancel();
  }

}
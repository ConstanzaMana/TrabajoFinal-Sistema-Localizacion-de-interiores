// Gestiona los destinos del  mapa.
// Descargar las aulas desde la API y traduce las coordenadas 2D reales
// al sistema de coordenadas 3D que utiliza Unity.

import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class CoordenadasUtils {

  // Conecta con la API para obtener la lista de destinos (aulas).
  static Future<List<Map<String, String>>> cargarYProcesarDestinos() async {
    List<dynamic> datosJson = [];

    try {
      // Conecta a la API y obtiene destinos
      final url = Uri.parse('https://suzanne-nonprincipled-submaniacally.ngrok-free.dev/destinos');
      final response = await http.get(url).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        datosJson = jsonDecode(response.body);
        debugPrint("Destinos cargados desde el servidor con éxito.");
      } else {
        throw Exception("Código de error del servidor: ${response.statusCode}");
      }

    } catch (e) {
      // Si no se puede conectar a la API, usa el json guardado localmente
      debugPrint("Falló la API de destinos ($e). Cargando respaldo local...");
      try {
        String jsonString = await rootBundle.loadString('assets/destinos.json');
        datosJson = jsonDecode(jsonString);
      } catch (errorLocal) {
        debugPrint("Error crítico al cargar el archivo local assets/destinos.json: $errorLocal");
        return [_generarVistaGeneral()];
      }
    }

    // Procesamiento de los datos
    List<Map<String, String>> destinosGenerados = [];
    destinosGenerados.add(_generarVistaGeneral());

    // Recorre cada aula y formatea sus datos
    for (var item in datosJson) {
      if (item['idDestino'] != null && item['geometria'] != null && item['geometria']['coordinates'] != null) {
        String id = item['idDestino'];
        String nombre = item['nombreDestino'] ?? "Aula sin nombre";
        double jX = (item['geometria']['coordinates'][0] as num).toDouble();
        double jY = (item['geometria']['coordinates'][1] as num).toDouble();

        // Formula para convertir coordenadas a las del plano 3D
        var coordsCalculadas = traducirCoordenadasJsonAMapa(jX, jY);

        // Guarda el resultado ya formateado para el mapa 3D
        destinosGenerados.add({
          "id": id,
          "nombre": nombre.trim(),
          "target": coordsCalculadas["cameraTarget"]!,
          "orbit": "0deg 60deg 15m",
          "hotspot": coordsCalculadas["hotspotPos"]!,
          "x": jX.toString(),
          "y": jY.toString()
        });
      }
    }

    return destinosGenerados;
  }

  // Genera un destino virtual por defecto que sirve para alejar la cámara y mostrar el mapa completo (Vista General).
  static Map<String, String> _generarVistaGeneral() {
    return {
      "id": "VISTA_GENERAL",
      "nombre": "Vista General",
      "target": "0m 0m 0m",
      "orbit": "90deg 15deg 150m",
      "hotspot": "",
      "x": "0",
      "y": "0"
    };
  }

  // Aplica factores de escala y offset para convertir una coordenada (X, Y) proveniente del JSON, en coordenadas
  // espaciales (X, Z) compatibles con Unity.
  static Map<String, String> traducirCoordenadasJsonAMapa(double jsonX, double jsonY) {
    const double factorX = 0.9941;
    const double offsetX = -2851.85;
    const double factorY = 0.980;
    const double offsetY = -506.9;

    double mapaX = (jsonX * factorX) + offsetX;
    double mapaY = (jsonY * factorY) + offsetY;
    String xStr = (-mapaX).toStringAsFixed(2);
    String zStr = (-mapaY).toStringAsFixed(2);

    return {
      "cameraTarget": "${xStr}m 2m ${zStr}m",
      "hotspotPos": "${xStr}m 0.02m ${zStr}m",
    };
  }
}

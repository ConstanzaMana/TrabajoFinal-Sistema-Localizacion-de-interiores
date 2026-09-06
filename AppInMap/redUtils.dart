import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
//Clase para obtener datos del servidor, si no se puede conectar con el servidor usa archivo JSON guardado en cache

class redUtils {
  static const String baseUrl = 'https://restful-api-inmap.onrender.com';

  static const Map<String, String> headersTesis = {
    "Content-Type": "application/json",
  };

  // Obtener Zonas del servidor
  static Future<List<dynamic>> obtenerZonasBloqueadas() async {
    try {
      final respuesta = await http
          .get(Uri.parse('$baseUrl/obtenerZonas'), headers: headersTesis)
          .timeout(const Duration(seconds: 45));

      if (respuesta.statusCode == 200) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cache_zonas', respuesta.body);

        List<dynamic> zonas = jsonDecode(respuesta.body);
        debugPrint("Capa de datos: Recibidas ${zonas.length} zonas desde el servidor.");
        return zonas;
      }
      throw Exception("Fallo en respuesta de servidor");
    } catch (e) {
      debugPrint("Estado: Servidor no disponible. Buscando zonas en caché local...");

      try {
        final prefs = await SharedPreferences.getInstance();
        final String? cacheData = prefs.getString('cache_zonas');

        if (cacheData != null) {
          debugPrint("Zonas recuperadas del caché local.");
          return jsonDecode(cacheData);
        }

        debugPrint("Caché vacío. Cargando obtenerZonas.json de los assets...");
        String jsonString = await rootBundle.loadString('assets/obtenerZonas.json');
        return jsonDecode(jsonString);

      } catch (err) {
        debugPrint("Error al cargar zonas: $err");
        return [];
      }
    }
  }

  // Obtener Personal del servidor
  static Future<List<dynamic>> obtenerListaPersonal() async {
    try {
      final respuesta = await http
          .get(Uri.parse('$baseUrl/personal'), headers: headersTesis)
          .timeout(const Duration(seconds: 45));

      if (respuesta.statusCode == 200) {
        // Guarda la última versión
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cache_personal', respuesta.body);

        return jsonDecode(respuesta.body);
      }
      throw Exception("Error del servidor");
    } catch (e) {
      debugPrint("Falló conexión con el servidor. Buscando en caché local...");

      try {
        final prefs = await SharedPreferences.getInstance();
        final String? cacheData = prefs.getString('cache_personal');

        if (cacheData != null) {
          debugPrint("Datos recuperados del caché local.");
          return jsonDecode(cacheData);
        }
        debugPrint("Caché vacío. Cargando personal.json de los assets...");
        String jsonString = await rootBundle.loadString('assets/personal.json');
        return jsonDecode(jsonString);

      } catch (err) {
        debugPrint("Error: No se pudo cargar nada.");
        return [];
      }
    }
  }
  // Obtener Lista de Materias del servidor
  static Future<List<dynamic>> obtenerListaMaterias() async {
    try {
      final respuesta = await http
          .get(Uri.parse('$baseUrl/materias'), headers: headersTesis)
          .timeout(const Duration(seconds: 45));

      if (respuesta.statusCode == 200) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cache_materias', respuesta.body);

        return jsonDecode(respuesta.body);
      }
      throw Exception("Error del servidor");
    } catch (e) {
      debugPrint("Falló conexión. Buscando materias en caché local...");

      try {
        final prefs = await SharedPreferences.getInstance();
        final String? cacheData = prefs.getString('cache_materias');

        if (cacheData != null) {
          debugPrint("Materias recuperadas del caché local.");
          return jsonDecode(cacheData);
        }

        debugPrint("Caché vacío. Cargando materias.json local...");
        String jsonString = await rootBundle.loadString('assets/materias.json');
        return jsonDecode(jsonString);

      } catch (err) {
        debugPrint("Error: No existe el archivo assets/materias.json o falló la carga");
        return [];
      }
    }
  }
  //  Obtener ubicacion de un personal del servidor
  static Future<String?> buscarUbicacionPersonal(String idPersonal, String hora, String dia) async {
    try {
      final url = Uri.parse('$baseUrl/personal/$idPersonal/$hora/$dia');
      final respuesta = await http.get(url, headers: headersTesis).timeout(const Duration(seconds: 45));

      if (respuesta.statusCode == 200) {
        final List<dynamic> data = jsonDecode(respuesta.body);
        if (data.isNotEmpty) {
          var primerResultado = data[0];
          return primerResultado['destino']['idDestino'].toString();
        }
      }
    } catch (e) {
      debugPrint("Error en Personal: $e");
    }
    return null;
  }

  // Obtener Ubicacion de un Materia en un horario y fecha del servidor
  static Future<String?> buscarUbicacionMateria(String codMateria, String hora, String dia) async {
    try {
      final url = Uri.parse('$baseUrl/materia/$codMateria/$hora/$dia');
      final respuesta = await http.get(url, headers: headersTesis).timeout(const Duration(seconds: 45));

      if (respuesta.statusCode == 200) {
        final List<dynamic> data = jsonDecode(respuesta.body);
        if (data.isNotEmpty) {
          var primerResultado = data[0];
          return primerResultado['destino']['idDestino'].toString();
        }
      }
    } catch (e) {
      debugPrint("Error en Materia: $e");
    }
    return null;
  }

  // Obtener Recintos del servidor
  static Future<List<dynamic>> cargarRecintos() async {
    try {
      final respuesta = await http
          .get(Uri.parse('$baseUrl/recintos'), headers: headersTesis)
          .timeout(const Duration(seconds: 45));

      if (respuesta.statusCode == 200) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cache_recintos', respuesta.body);

        List<dynamic> recintos = jsonDecode(respuesta.body);
        debugPrint("Capa de datos: Recibidos ${recintos.length} recintos desde el servidor y guardados en caché.");
        return recintos;
      }
      throw Exception("Fallo en respuesta de servidor al cargar recintos");
    } catch (e) {
      debugPrint("Falló conexión. Buscando recintos en caché local... Motivo: $e");

      try {
        final prefs = await SharedPreferences.getInstance();
        final String? cacheData = prefs.getString('cache_recintos');

        if (cacheData != null) {
          debugPrint("Recintos recuperados del caché local.");
          return jsonDecode(cacheData);
        }

        debugPrint("Caché vacío. Cargando recintos.json local...");
        String jsonString = await rootBundle.loadString('assets/recintos.json');
        return jsonDecode(jsonString);

      } catch (err) {
        debugPrint("Error al cargar el respaldo de recintos: $err");
        return [];
      }
    }
  }
}
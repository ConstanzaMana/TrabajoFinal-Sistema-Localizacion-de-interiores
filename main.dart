import 'package:flutter/material.dart'; //Para mostrar interfaz
import 'package:flutter_blue_plus/flutter_blue_plus.dart'; //Para escanear beacons
import 'package:path_provider/path_provider.dart'; //Guardar archivos
import 'dart:io';
import 'package:csv/csv.dart'; //Para exportar a CSV
import 'package:intl/intl.dart'; //Para formatear fechas
import 'package:permission_handler/permission_handler.dart'; // Para pedir permisos

//APP para registrar datos de Beacons BLE sobre un plano.

void main() {
  //Arranca la app y muestra la pantalla principal BLEDataCollector.
  runApp(MaterialApp(home: BLEDataCollector()));
}
//StatefulWidget porque necesita mantener el estado de la posición seleccionada y las lecturas BLE.
class BLEDataCollector extends StatefulWidget {
  @override
  _BLEDataCollectorState createState() => _BLEDataCollectorState();

}


class _BLEDataCollectorState extends State<BLEDataCollector> {
  int? selectedRow;
  int? selectedCol;
  List<List<dynamic>> lecturas = [
    ['Fila', 'Columna', 'UUID', 'Major', 'Minor', 'MAC', 'RSSI', 'Timestamp']
  ]; //// Donde se guardan los datos escaneados
  String? archivoFinal; //// Ruta del archivo CSV
  late TransformationController _transformationController; // Controla el zoom

  @override
  void initState() {
    super.initState(); //Se ejecuta al iniciar la app.
    solicitarPermisos(); //Pide permisos necesarios.

    //Zoom inicial y desplazamiento
    _transformationController = TransformationController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final scale = 2.0;
      final dx = -100.0;
      final dy = -100.0;
      _transformationController.value = Matrix4.identity()
        ..scale(scale)
        ..translate(dx, dy);
    });
  }


  //Pide permisos de bluetooth, ubicación y almacenamiento, necesarios para escanear y guardar.
  Future<void> solicitarPermisos() async {
    await [
      Permission.bluetooth,
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.location,
      Permission.storage,
    ].request();

    if (await Permission.location.isDenied) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('El permiso de ubicación es necesario para escanear BLE')),
      );
    }
  }

  Future<void> escanearBLE() async {
    //Revisa si el usuario selecciono una posición (fila, columna).
    if (selectedRow == null || selectedCol == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Seleccioná una posición primero')),
      );
      return;
    }
    //Empieza el escaneo de BLE por 2 segundos.
    await FlutterBluePlus.startScan(timeout: Duration(seconds: 2));
    //Escucha los resultados
    FlutterBluePlus.scanResults.listen((results) async {
      //Por cada beacon detectado extrae UUID, Major, Minor del manufacturerData.
      for (var r in results) {
        String mac = r.device.remoteId.str;
        int rssi = r.rssi;
        String timestamp = DateFormat('HH:mm:ss').format(DateTime.now());

        final manufacturerData = r.advertisementData.manufacturerData;

        if (manufacturerData.isNotEmpty) {
          final key = manufacturerData.keys.first;
          final bytes = manufacturerData[key]!;

          if (bytes.length >= 23) {
            final uuid = _parseUUID(bytes.sublist(2, 18));
            final major = (bytes[18] << 8) + bytes[19];
            final minor = (bytes[20] << 8) + bytes[21];

            // Filtrá por UUID de interes y guarda la lectura en "lecturas".
            if (uuid == '8ec76ea3-6668-48da-9866-75be8bc86f4d' || uuid == '4d6fc88b-be75-6698-da48-6866a36ec78e') {
              setState(() {
                lecturas.add([
                  selectedRow,
                  selectedCol,
                  uuid,
                  major,
                  minor,
                  mac,
                  rssi,
                  timestamp,
                ]);
              });
            }
          }

        }
      }
    });


    await Future.delayed(Duration(seconds: 3));
    await FlutterBluePlus.stopScan(); // Detiene el escaneo .
    await guardarCSV(); // Guarda en CSV
  }
  //Convierte bytes crudos en formato UUID legible
  String _parseUUID(List<int> bytes) {
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-'
        '${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-'
        '${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
  }

  //Crea o agrega al archivo lecturas_ble.csv.
  Future<void> guardarCSV() async {
    final fileName = 'lecturas_ble.csv';
    final directory = await getExternalStorageDirectory();
    final path = '${directory!.path}/$fileName';
    final file = File(path);

    final bool existe = await file.exists();

    // Solo convertir nuevas filas si el archivo ya existe
    List<List<dynamic>> datosParaGuardar = existe ? lecturas.sublist(1) : lecturas;

    String csvData = const ListToCsvConverter().convert(datosParaGuardar);

    // Asegura salto de línea al final
    if (!csvData.endsWith('\n')) {
      csvData += '\n';
    }

    await file.writeAsString(csvData, mode: FileMode.append);

    setState(() {
      archivoFinal = path;
    });

    print('Archivo guardado en: $path');

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Archivo actualizado:\n$path')),
    );

    // Limpiar las lecturas para no volver a escribir lo mismo
    lecturas = [lecturas[0]];
  }

  //Estructura visual de la app.
  //Divide la pantalla en dos partes: Izquierda-> Plano con grilla y botón para escanear.
  //                                  Derecha-> Lista de lecturas.
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Captura de RSSI por posición'),
        actions: [
          if (archivoFinal != null)
            IconButton(
              icon: Icon(Icons.download),
              onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Archivo en: $archivoFinal')),
              ),
            ),
        ],
      ),
      body: Row(
        children: [
          // Izquierda: plano + botón + texto (flex 3)
          Flexible(
            flex: 3,
            child: Column(
              children: [
                // Plano con grilla
                SizedBox(
                  width: 800,   // dependen del tamaño de la imagen
                  height: 600,
                  child: buildPlanoConGrilla(),
                ),
                SizedBox(height: 10),

                // Botón y texto de posición seleccionada
                ElevatedButton.icon(
                  icon: Icon(Icons.wifi),
                  label: Text('Escanear Beacons BLE'),
                  onPressed: escanearBLE,
                ),
                SizedBox(height: 10),
                Text(
                  selectedRow != null
                      ? 'Posición seleccionada: ($selectedRow, $selectedCol)'
                      : 'Tocá una celda para elegir posición',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),

          // Separador vertical
          Container(
            width: 1,
            color: Colors.grey[300],
            margin: EdgeInsets.symmetric(vertical: 10),
          ),

          // Derecha: lista de lecturas (flex 1)
          Flexible(
            flex: 1,
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Column(
                children: [
                  Text('Lecturas recientes:', style: TextStyle(fontWeight: FontWeight.bold)),
                  SizedBox(height: 10),
                  Expanded(
                    child: buildListaLecturas(),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }


  Widget buildListaLecturas() {
    return Expanded(
      child: ListView.builder(
        itemCount: lecturas.length - 1,
        itemBuilder: (context, index) {
          final item = lecturas[index + 1];
          return ListTile(
            title: Text('(${item[0]},${item[1]}) - ${item[2]}'),
            subtitle: Text('RSSI: ${item[3]} | ${item[4]}'),
          );
        },
      ),
    );
  }
  //Crea la cuadrícula
  Widget buildPlanoConGrilla() {
    int filas = 50;
    int columnas = 65;
    double anchoPlano = 800; // debe ser igual a la imagen
    double altoPlano = 600;

    double tamanioCeldaX = anchoPlano / columnas;
    double tamanioCeldaY = altoPlano / filas;

    Map<String, int> mapaRSSI = {};
    for (var i = 1; i < lecturas.length; i++) {
      var fila = lecturas[i][0];
      var col = lecturas[i][1];
      var rssi = lecturas[i][3];
      mapaRSSI['$fila,$col'] = rssi;
    }
    //Permitir zoom y desplazamiento. Cada celda es seleccionable.
    return InteractiveViewer(
      transformationController: _transformationController,
      minScale: 0.5,
      maxScale: 5,
      constrained: false,
      child: SizedBox(
        width: anchoPlano,
        height: altoPlano,
        child: Stack(
          children: [
            Positioned.fill(
              child: Image.asset(
                'assets/Plano.png',
                fit: BoxFit.fill, // para que rellene todo el espacio y cuadre con la grilla
              ),
            ),
            Column(
              children: List.generate(filas, (fila) {
                return Row(
                  children: List.generate(columnas, (col) {
                    bool isSelected = selectedRow == fila && selectedCol == col;
                    String clave = '$fila,$col';
                    int? rssi = mapaRSSI[clave];

                    Color? colorFondo;
                    if (isSelected) {
                      colorFondo = Colors.green.withOpacity(0.5); //seleccionada
                    } else if (rssi != null) {
                      if (rssi > -60) {
                        colorFondo = Colors.red.withOpacity(0.4); //Si hay una lectura para esa celda con señal fuerte
                      } else if (rssi > -80) {
                        colorFondo = Colors.orange.withOpacity(0.4); //Si hay una lectura para esa celda con señal media
                      } else {
                        colorFondo = Colors.yellow.withOpacity(0.4); ////Si hay una lectura para esa celda con señal debil
                      }
                    }

                    return GestureDetector(
                      onTap: () {
                        setState(() {
                          selectedRow = fila;
                          selectedCol = col;
                        });
                      },
                      child: Container(
                        width: tamanioCeldaX,
                        height: tamanioCeldaY,
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.black26, width: 0.3),
                          color: colorFondo ?? Colors.transparent,
                        ),
                        child: Center(
                          child: Text('$fila,$col', style: TextStyle(fontSize: 6)),
                        ),
                      ),
                    );
                  }),
                );
              }),
            ),
          ],
        ),
      ),
    );
  }

}


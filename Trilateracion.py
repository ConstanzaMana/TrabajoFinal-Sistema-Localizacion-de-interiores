import pandas as pd
import numpy as np
from Funciones import *

balizas = {
    1: (34, 14),
    2: (42, 9),
    3: (31, 5),
    4: (17, 5),
    5: (15, 15),
    6: (34, 28),
    7: (33, 43),
    8: (18, 41),
    9: (27, 50),
    10: (10, 46)
}

# Datos del plano
filas = 50
columnas = 65
anchoPlano = 78 #810.0 #202
altoPlano = 41 #423.0 #105
     
tamanioCeldaX = anchoPlano / columnas
tamanioCeldaY = altoPlano / filas

# === Cargar puntos desde el archivo txt de los pasillos===
pasillos = []
with open("C:/Users\conim\OneDrive\Documentos\Tesis\pasillos.txt", "r") as f:
    for linea in f:
        x, y = linea.strip().split(',')
        pasillos.append((int(x), int(y)))
        
balizas_coord = convertir_balizas_a_posicion_real(balizas, columnas, filas, anchoPlano, altoPlano)
print("Posicion balizas en coordenadas reales (m)")
for id, (x, y) in balizas_coord.items():
    print(f"Baliza {id}: ({x:.2f}, {y:.2f})")


# === CARGA DE DATOS ===
#archivo_excel = "C:/Users/conim/Downloads/lecturas_ble_coni (2).xlsx"
#hoja = "DatosReducidosConi"
archivo_excel = "C:/Users\conim\Downloads\lecturas_ble_2_modificado.xlsx"
hoja1 = "DatosReducidosConi"
hoja2 = "DatosReducidosCami"

# Cargar cada hoja en un DataFrame
df1 = pd.read_excel(archivo_excel, sheet_name=hoja1)
df2 = pd.read_excel(archivo_excel, sheet_name=hoja2)


# Concatenar los DataFrames (uno debajo del otro)
df= pd.concat([df1, df2], ignore_index=True)


# Limpieza de datos
df = df.dropna(subset=["Fila", "Columna", "AVERAGE de RSSI"])
df["Fila"] = pd.to_numeric(df["Fila"], errors="coerce")
df["Columna"] = pd.to_numeric(df["Columna"], errors="coerce")
df["AVERAGE de RSSI"] = pd.to_numeric(df["AVERAGE de RSSI"], errors="coerce")
df["Minor"] = df["Minor"].astype(int)

# === Procesamiento por posicion ===
posiciones = df.groupby(["Fila", "Columna"])
errores = []
posiciones_reales = []
posiciones_estimadas = []

for (fila, col), grupo in posiciones:
    x_real = fila * tamanioCeldaX
    y_real = col * tamanioCeldaY
   
    rssi_por_baliza = {}
    for _, fila_dato in grupo.iterrows():
        minor = fila_dato['Minor']
        rssi = fila_dato['AVERAGE de RSSI']
        if minor in balizas_coord:
            rssi_por_baliza[minor] = rssi

    # Si hay al menos 3 balizas con RSSI
    if len(rssi_por_baliza) >= 3:
        #Ordeno las balizas para tomar las de mayor RSSI
        balizas_ordenadas = sorted(rssi_por_baliza.items(), key=lambda x: x[1], reverse=True)
        # Tomar las 3 balizas con mejor RSSI
        balizas_usadas = balizas_ordenadas[:3]
        b_ids = [b[0] for b in balizas_usadas]
        rssi_vals = [b[1] for b in balizas_usadas]
        
        d1 = rssi_to_distance(rssi_vals[0])
        d2 = rssi_to_distance(rssi_vals[1])
        d3 = rssi_to_distance(rssi_vals[2])
        
        
        radios = {
            b_ids[0]: d1,
            b_ids[1]: d2,
            b_ids[2]: d3,
        }
        posicion_estimado = estimar_posicion_por_minimos_cuadrados(balizas_coord, radios)
        #Paso resultado a celdas
        columna_estimada = posicion_estimado[0] / tamanioCeldaX
        fila_estimada = posicion_estimado[1] / tamanioCeldaY
        posicion_estimado_celdas=(fila_estimada,columna_estimada)
        #En celdas
        posiciones_reales.append((col, fila))
       
        # Error euclídeo
        #Sin ajuste de pasillo
        posicion_ajustada=posicion_estimado_celdas
        
        #Con ajuste de pasillo
        posicion_ajustada = ajustar_a_pasillo(posicion_estimado_celdas, pasillos)

        posiciones_estimadas.append((posicion_ajustada[1], posicion_ajustada[0]))
        #print(f"Posición Real: ({col:.2f}, {fila:.2f})")
        #print(f"Posición estimada: ({posicion_estimado[0]:.2f}, {posicion_estimado[1]:.2f})")
        #print(f"Posición estimada en plano (fila, columna): ({fila_estimada:.2f}, {columna_estimada:.2f})")
       #Para visualizar
        error = np.sqrt((posicion_ajustada[0] - fila)**2 + (posicion_ajustada[1] - col)**2)
        errores.append(error)




graficar_posiciones_y_balizas(df, balizas, posiciones_reales, posiciones_estimadas)

if errores:
    error_promedio = sum(errores) / len(errores)
    print(f"\n🔎 Error promedio de estimaciones: {error_promedio:.2f}")
    tamanio_promedio = (tamanioCeldaX + tamanioCeldaY) / 2
    error_metros = error * tamanio_promedio
    print(f"\n🔎 Error promedio de estimaciones en m: {error_metros:.2f}")
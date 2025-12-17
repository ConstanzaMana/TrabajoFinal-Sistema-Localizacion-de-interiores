import numpy as np
import matplotlib.pyplot as plt
from scipy.optimize import minimize
# === FUNCIONES ===

def convertir_balizas_a_posicion_real(balizas, columnas, filas, anchoPlano, altoPlano):
    tamanioCeldaX = anchoPlano / columnas
    tamanioCeldaY = altoPlano / filas
    
    balizas_reales = {}
    for id_baliza, (fila, columna) in balizas.items():
        x_real = columna * tamanioCeldaX
        y_real = fila * tamanioCeldaY
        balizas_reales[id_baliza] = (x_real, y_real)
    
    return balizas_reales


def rssi_to_distance(rssi, A=-60, n=3.2): 
    return pow(10, (A - rssi) / (10 * n))

def error_total(pos, balizas, distancias):
    x, y = pos
    error = 0
    for i in balizas:
        x_b, y_b = balizas[i]
        d_estimada = distancias[i]
        d_real = np.sqrt((x - x_b)**2 + (y - y_b)**2)
        error += (d_real - d_estimada) ** 2
    return error

def estimar_posicion_por_minimos_cuadrados(balizas_reales, radios):
    posicion_inicial = (150, 150)
    res = minimize(
        error_total,
        posicion_inicial,
        args=({i: balizas_reales[i] for i in radios.keys()}, radios),
        method='L-BFGS-B'
    )
    return res.x  # (x, y)

#VISUALIZACION
def graficar_posiciones_y_balizas(df, balizas, posiciones_reales, posiciones_estimadas):
    fig, ax = plt.subplots(figsize=(10, 6))

    scatter = ax.scatter(df["Columna"], df["Fila"],
                         c=df["AVERAGE de RSSI"], cmap="viridis",
                         edgecolors='k', s=80, label='Mediciones')

    # Dibujar texto de RSSI en cada punto
    for _, row in df.iterrows():
        ax.text(row["Columna"], row["Fila"], f"{row['AVERAGE de RSSI']:.0f}",
                ha='center', va='center', fontsize=7, color='white')

    # Dibujar balizas
    first_beacon = True
    for i, (fila, columna) in balizas.items():
        if first_beacon:
            ax.plot(columna, fila, marker='*', color='red', markersize=15, label=f"Baliza {i}")
            first_beacon = False
        else:
            ax.plot(columna, fila, marker='*', color='red', markersize=15)
        ax.text(columna + 0.5, fila, f"B{i}", color='red', fontsize=10)

    # Dibujar estimaciones
    first_estimate = True
    for (col_r, fila_r), (col_e, fila_e) in zip(posiciones_reales, posiciones_estimadas):
        if first_estimate:
            ax.plot(col_e, fila_e, 'o', color='blue', markersize=6, label="Estimado")
            first_estimate = False
        else:
            ax.plot(col_e, fila_e, 'o', color='blue', markersize=6)
        ax.plot([col_r, col_e], [fila_r, fila_e], color='gray', linestyle='--', linewidth=1)

    ax.set_title("Ubicaciones Reales y Estimadas con Balizas BLE")
    ax.set_xlabel("Columna")
    ax.set_ylabel("Fila")
    ax.set_xlim(0, df["Columna"].max() + 2)
    ax.set_ylim(df["Fila"].max() + 2, 0)  # Invertir eje Y
    ax.set_aspect("equal")
    ax.grid(True)
    ax.legend(loc="upper right")

    # Barra de colores para RSSI
    cbar = plt.colorbar(scatter)
    cbar.set_label("AVERAGE de RSSI")

    plt.tight_layout()
    plt.show()

    

def ajustar_a_pasillo(posicion, pasillos):

    x_pred, y_pred = posicion
    pasillos = np.array(pasillos)

    # Calcular distancias euclídeas a cada punto válido en pasillos
    distancias = np.sqrt((pasillos[:,0] - x_pred)**2 + (pasillos[:,1] - y_pred)**2)

    # Elegir el punto más cercano
    indice_mas_cercano = np.argmin(distancias)
    return tuple(pasillos[indice_mas_cercano])

using UnityEngine;
using System.Collections.Generic;
using FlutterUnityIntegration;

[System.Serializable] public class ZonaAula { public string id; public string pos; }
[System.Serializable] public class ListaZonas { public ZonaAula[] zonas; }
[System.Serializable] public class ListaPuntosRuta { public string[] puntos; }
[System.Serializable] public class PuntoBloqueado { public string pos; }
[System.Serializable] public class ListaBloqueados { public PuntoBloqueado[] puntos; }

public class ControladorMapa : MonoBehaviour
{
    [Header("Configuración")]
    public GameObject prefabBandera;
    public float velocidad = 6.0f;
    private Vector3 destinoActual;
    private bool modoNavegacion = false;
    private GameObject iconoNavegacion;
    private LineRenderer lineaRuta;
    private GameObject textoFlotanteObj;
    private GameObject banderaDestino;
    private Dictionary<string, GameObject> cartelesPOIs = new Dictionary<string, GameObject>();

    public GameObject puntoRojoIA;

    [Header("Detección Táctil")]
    private Vector2 posInicialToque;
    private float umbralArrastre = 20f;

    [Header("Límites de Cámara")]
    public bool usarLimites = true;
    public float minX = -35f;
    public float maxX = 35f;
    public float minZ = -30f;
    public float maxZ = 30f;

    private float umbralConsumoLinea = 2.5f;
    private bool lineaAnclada = true;

    private float anguloBrujula = 0f;
    public float offsetNorteMapa = 0f;

   private Vector3 direccionMirada = Vector3.forward;

    [Header("Configuración de Obstáculos")]
    public float alturaVisualObstaculos = 5.0f;
    public Vector3 offsetSimulacion = new Vector3(0, 0, 0);
    private Vector3 posInicialJugador;

    [Header("Cosas Visuales")]
    private GameObject pinMarcador;
    private GameObject aulaActivaActual;
    public Transform camaraPrincipal;

    private Vector3 posGeneral, rotGeneral;
    private Vector3 posNavegacion = new Vector3(0f, 18f, -8f);
    private Vector3 rotNavegacion = new Vector3(60f, 0f, 0f);

    private Vector3 posZoom = new Vector3(0f, 30f, -15f);
    private Vector3 rotZoom = new Vector3(55f, 0f, 0f);

    void Start()
    {
        posInicialJugador = transform.position;
        destinoActual = transform.position;

        if (puntoRojoIA != null) puntoRojoIA.SetActive(false);
        if (GetComponent<MeshFilter>() != null) Destroy(GetComponent<MeshFilter>());
        if (GetComponent<MeshRenderer>() != null) GetComponent<MeshRenderer>().enabled = false;

        if (camaraPrincipal != null) {
            posGeneral = camaraPrincipal.localPosition;
            rotGeneral = camaraPrincipal.localEulerAngles;
        }

        ConfigurarLinea();
        Transform hijoCilindro = transform.Find("Cylinder");
        if (hijoCilindro != null) {
            Destroy(hijoCilindro.gameObject);
        }

        iconoNavegacion = new GameObject("FlechaGPS");
        iconoNavegacion.transform.SetParent(this.transform);
        iconoNavegacion.transform.localPosition = new Vector3(0, 0.2f, 0);
        iconoNavegacion.transform.localScale = new Vector3(1.5f, 1.5f, 1.5f);

        GameObject mitadIzq = new GameObject("MitadIzq");
        mitadIzq.transform.SetParent(iconoNavegacion.transform);
        mitadIzq.transform.localPosition = Vector3.zero;
        MeshFilter mfIzq = mitadIzq.AddComponent<MeshFilter>();
        Mesh meshIzq = new Mesh();
        meshIzq.vertices = new Vector3[] {
            new Vector3(0, 0, 1f),
            new Vector3(0, 0, -0.3f),    // Vértice central
            new Vector3(-0.6f, 0, -0.8f) // Punta trasera izquierda
        };
        meshIzq.triangles = new int[] { 0, 1, 2 };
        mfIzq.mesh = meshIzq;

        MeshRenderer mrIzq = mitadIzq.AddComponent<MeshRenderer>();
        mrIzq.material = new Material(Shader.Find("Sprites/Default"));
        mrIzq.material.color = new Color(0.47f, 0.75f, 1.0f, 1.0f); // Celeste claro

        GameObject mitadDer = new GameObject("MitadDer");
        mitadDer.transform.SetParent(iconoNavegacion.transform);
        mitadDer.transform.localPosition = Vector3.zero;
        MeshFilter mfDer = mitadDer.AddComponent<MeshFilter>();
        Mesh meshDer = new Mesh();
        meshDer.vertices = new Vector3[] {
            new Vector3(0, 0, 1f),       // Punta superior
            new Vector3(0.6f, 0, -0.8f), // Punta trasera derecha
            new Vector3(0, 0, -0.3f)     // Vértice central
        };
        meshDer.triangles = new int[] { 0, 1, 2 };
        mfDer.mesh = meshDer;

        MeshRenderer mrDer = mitadDer.AddComponent<MeshRenderer>();
        mrDer.material = new Material(Shader.Find("Sprites/Default"));
        mrDer.material.color = new Color(0.0f, 0.45f, 1.0f, 1.0f); // Azul oscuro

        iconoNavegacion.SetActive(false);

    }

    void ConfigurarLinea() {
        GameObject objetoViejoTop = GameObject.Find("RutaEstiloMaps_Top");
        if (objetoViejoTop != null) Destroy(objetoViejoTop);
        GameObject objetoViejoV2 = GameObject.Find("RutaPlana");
        if (objetoViejoV2 != null) Destroy(objetoViejoV2);

        if (GetComponent<LineRenderer>() != null) Destroy(GetComponent<LineRenderer>());

        GameObject objetoLineaTop = new GameObject("RutaEstiloMaps_Top");
        objetoLineaTop.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
        lineaRuta = objetoLineaTop.AddComponent<LineRenderer>();
        lineaRuta.useWorldSpace = true;
        lineaRuta.alignment = LineAlignment.TransformZ;
        lineaRuta.numCornerVertices = 8;
        lineaRuta.material = new Material(Shader.Find("Sprites/Default"));
        lineaRuta.positionCount = 0;
        lineaRuta.startWidth = 0.3f;
        lineaRuta.endWidth = 0.3f;
        Color colorCamino = new Color(0.0f, 0.1f, 0.95f, 1.0f);
        lineaRuta.startColor = colorCamino;
        lineaRuta.endColor = colorCamino;
    }

    public void DibujarRuta(string json) {
        ListaPuntosRuta l = JsonUtility.FromJson<ListaPuntosRuta>(json);

        if (lineaRuta != null) {
            lineaRuta.positionCount = l.puntos.Length;

            for (int i = 0; i < l.puntos.Length; i++) {
                Vector3 p = ParsearCoordenadas(l.puntos[i]);
                p.y = 6.5f;
                lineaRuta.SetPosition(i, p);
            }

        }

        TrailRenderer rastro = GetComponentInChildren<TrailRenderer>();
        if (rastro != null) {
            rastro.Clear();
        }
    }

    void EliminarPuntoAlcanzado() {
        if (lineaRuta.positionCount <= 1) return;
        Vector3[] puntos = new Vector3[lineaRuta.positionCount - 1];
        for (int i = 0; i < puntos.Length; i++) puntos[i] = lineaRuta.GetPosition(i + 1);
        lineaRuta.positionCount = puntos.Length;
        lineaRuta.SetPositions(puntos);
    }

    public void BorrarRuta(string v) {
        if (lineaRuta != null) lineaRuta.positionCount = 0;
    }
 void Update()
{
    if (transform.position != destinoActual) {
        float distanciaResago = Vector3.Distance(transform.position, destinoActual);
        if (distanciaResago > 2.0f) {
            transform.position = destinoActual;
        } else {
            float velocidadSuave = velocidad * 1.5f;
            transform.position = Vector3.MoveTowards(
                transform.position, destinoActual, Time.deltaTime * velocidadSuave
            );
        }
    }

    foreach (var cartel in cartelesPOIs.Values) {
        if (cartel != null && cartel.activeSelf && camaraPrincipal != null) {
            cartel.transform.rotation = Quaternion.LookRotation(
                cartel.transform.position - camaraPrincipal.position
            );
        }
    }

    if (modoNavegacion && lineaRuta != null && lineaRuta.positionCount > 0) {

        if (lineaAnclada) {
            lineaRuta.SetPosition(0, transform.position);
        }

        if (lineaRuta.positionCount > 1) {
            Vector3 proximoWaypoint = lineaRuta.GetPosition(lineaAnclada ? 1 : 0);
            proximoWaypoint.y = transform.position.y;

            if (Vector3.Distance(transform.position, proximoWaypoint) < umbralConsumoLinea) {
                EliminarPuntoAlcanzado();
            }
        }
    }

    if (textoFlotanteObj != null && textoFlotanteObj.activeSelf && camaraPrincipal != null) {
        textoFlotanteObj.transform.rotation = Quaternion.LookRotation(
            textoFlotanteObj.transform.position - camaraPrincipal.position
        );
    }

    ManejarInputs();
}
public void SetUmbralLinea(string valor) {
    if (float.TryParse(valor, System.Globalization.NumberStyles.Float,
        System.Globalization.CultureInfo.InvariantCulture, out float v)) {
        umbralConsumoLinea = v;
    }
}

public void SetLineaAnclada(string valor) {
    lineaAnclada = valor.Trim().ToLower() == "true";
}


    public void VerRutaCompleta(string vacio)
    {
        if (lineaRuta == null || lineaRuta.positionCount < 2 || camaraPrincipal == null) return;
        modoNavegacion = false;

        Bounds b = new Bounds(lineaRuta.GetPosition(0), Vector3.zero);
        for (int i = 1; i < lineaRuta.positionCount; i++) b.Encapsulate(lineaRuta.GetPosition(i));

        Camera cam = camaraPrincipal.GetComponent<Camera>();
        if (cam == null) return;

        float relacionAspecto = cam.aspect;
        float fovRad = cam.fieldOfView * Mathf.Deg2Rad;

        float distanciaZ = (b.size.z / 2f) / Mathf.Tan(fovRad / 2f);
        float distanciaX = (b.size.x / 2f) / Mathf.Tan(fovRad / 2f) / relacionAspecto;

        float distanciaNecesaria = Mathf.Max(distanciaX, distanciaZ);

        float alturaFinal = distanciaNecesaria * 1.2f;

        alturaFinal = Mathf.Max(35f, alturaFinal);

        float offsetTarjeta = b.size.z * 0.15f;

        camaraPrincipal.SetParent(null);
        camaraPrincipal.position = new Vector3(b.center.x, alturaFinal, b.center.z - offsetTarjeta);
        camaraPrincipal.eulerAngles = new Vector3(85f, 0f, 0f);
    }
    public void CambiarVista(string tipoVista)
    {
        if (camaraPrincipal == null) return;
        if (camaraPrincipal.parent != this.transform) camaraPrincipal.SetParent(this.transform);

        if (tipoVista == "NAVEGACION") {
            modoNavegacion = true;
            camaraPrincipal.localPosition = posNavegacion;
            camaraPrincipal.localEulerAngles = rotNavegacion;
            if (iconoNavegacion != null) iconoNavegacion.SetActive(true);

        } else if (tipoVista == "ZOOM") {
            modoNavegacion = false;
            camaraPrincipal.localPosition = posZoom;
            camaraPrincipal.localEulerAngles = rotZoom;
            if (iconoNavegacion != null) iconoNavegacion.SetActive(true);

        } else { // VISTA GENERAL
            modoNavegacion = false;
            camaraPrincipal.localPosition = posGeneral;
            camaraPrincipal.localEulerAngles = rotGeneral;
            transform.rotation = Quaternion.identity;

            transform.position = posInicialJugador;
            destinoActual = posInicialJugador;

            if (iconoNavegacion != null) iconoNavegacion.SetActive(false);
        }
    }

    public void DibujarObstaculos(string jsonBloqueados)
    {
        ListaBloqueados lista = JsonUtility.FromJson<ListaBloqueados>(jsonBloqueados);
        if (lista == null || lista.puntos == null) return;

        GameObject contenedor = GameObject.Find("ContenedorObstaculos");
        if (contenedor != null) Destroy(contenedor);
        contenedor = new GameObject("ContenedorObstaculos");

        foreach (PuntoBloqueado p in lista.puntos)
        {
            Vector3 posCentro = ParsearCoordenadas(p.pos);
            GameObject obstaculo = GameObject.CreatePrimitive(PrimitiveType.Cube);
            obstaculo.transform.SetParent(contenedor.transform);
            obstaculo.transform.position = new Vector3(posCentro.x, alturaVisualObstaculos, posCentro.z);
	    obstaculo.transform.localScale = new Vector3(0.7f, 0.1f, 0.7f);

            MeshRenderer render = obstaculo.GetComponent<MeshRenderer>();
            render.material = new Material(Shader.Find("Sprites/Default"));
            render.material.color = new Color(1f, 0f, 0f, 0.8f);

            Destroy(obstaculo.GetComponent<Collider>());
        }
    }

    [ContextMenu("Simular Obstaculos")]
    public void SimularObstaculos()
    {
        string x1 = (0 + offsetSimulacion.x).ToString();
        string x2 = (1 + offsetSimulacion.x).ToString();
        string x3 = (2 + offsetSimulacion.x).ToString();
        string z = offsetSimulacion.z.ToString();

        string jsonPrueba = "{\"puntos\": [" +
            "{\"pos\": \"" + x1 + " 0 " + z + "\"}," +
            "{\"pos\": \"" + x2 + " 0 " + z + "\"}," +
            "{\"pos\": \"" + x3 + " 0 " + z + "\"}" +
        "]}";

        DibujarObstaculos(jsonPrueba);
    }

 void ManejarInputs() {
        if (camaraPrincipal == null) return;

        Vector3 camRight = camaraPrincipal.right; camRight.y = 0; camRight.Normalize();
        Vector3 camForward = camaraPrincipal.forward; camForward.y = 0; camForward.Normalize();

        if (Input.touchCount == 2) {
            Touch t1 = Input.GetTouch(0), t2 = Input.GetTouch(1);

            float distAnt = ((t1.position - t1.deltaPosition) - (t2.position - t2.deltaPosition)).magnitude;
            float distAct = (t1.position - t2.position).magnitude;
            camaraPrincipal.Translate(0, 0, (distAct - distAnt) * 0.1f, Space.Self);

            Vector2 direccionAnterior = (t1.position - t1.deltaPosition) - (t2.position - t2.deltaPosition);
            Vector2 direccionActual = t1.position - t2.position;
            float anguloGiro = Vector2.SignedAngle(direccionAnterior, direccionActual);

            if (Mathf.Abs(camaraPrincipal.forward.y) > 0.01f) {
                float distanciaAlSuelo = camaraPrincipal.position.y / Mathf.Abs(camaraPrincipal.forward.y);
                Vector3 pivoteVisual = camaraPrincipal.position + camaraPrincipal.forward * distanciaAlSuelo;
                pivoteVisual.y = 0;

                camaraPrincipal.RotateAround(pivoteVisual, Vector3.up, anguloGiro);
            }

        } else if (Input.touchCount == 1) {
            Touch t = Input.GetTouch(0);

            if (t.phase == TouchPhase.Moved) {
                Vector3 mov = (camRight * -t.deltaPosition.x) + (camForward * -t.deltaPosition.y);
                camaraPrincipal.position += mov * 0.05f;
            }

            if (t.phase == TouchPhase.Ended && t.tapCount == 1) {
                DetectarToqueEnAula(t.position);
            }
        }

        else if (!modoNavegacion) {
            if (Input.GetMouseButton(0)) { // Clic izquierdo: Paneo
                Vector3 mov = (camRight * -Input.GetAxis("Mouse X")) + (camForward * -Input.GetAxis("Mouse Y"));
                camaraPrincipal.position += mov * 0.5f;
            }
            if (Input.GetMouseButton(1)) { // Clic derecho: Rotar
                if (Mathf.Abs(camaraPrincipal.forward.y) > 0.01f) {
                    float distanciaAlSuelo = camaraPrincipal.position.y / Mathf.Abs(camaraPrincipal.forward.y);
                    Vector3 pivoteVisual = camaraPrincipal.position + camaraPrincipal.forward * distanciaAlSuelo;
                    pivoteVisual.y = 0;
                    camaraPrincipal.RotateAround(pivoteVisual, Vector3.up, Input.GetAxis("Mouse X") * 3f);
                }
            }

            float scroll = Input.mouseScrollDelta.y;
            if (Mathf.Abs(scroll) > 0.01f) {
                camaraPrincipal.Translate(0, 0, scroll * 2f, Space.Self);
            }
        }

        if (usarLimites && !modoNavegacion) {
            float fwdY = Mathf.Abs(camaraPrincipal.forward.y);

            if (fwdY > 0.01f) {
                float distanciaSuelo = camaraPrincipal.position.y / fwdY;
                Vector3 puntoDeEnfoque = camaraPrincipal.position + camaraPrincipal.forward * distanciaSuelo;
                puntoDeEnfoque.x = Mathf.Clamp(puntoDeEnfoque.x, minX, maxX);
                puntoDeEnfoque.z = Mathf.Clamp(puntoDeEnfoque.z, minZ, maxZ);
                camaraPrincipal.position = puntoDeEnfoque - camaraPrincipal.forward * distanciaSuelo;
            }
        }
    }

    private void DetectarToqueEnAula(Vector2 p) {
        Ray ray = Camera.main.ScreenPointToRay(p);
        if (Physics.Raycast(ray, out RaycastHit hit)) {
            UnityMessageManager.Instance.SendMessageToFlutter(hit.collider.gameObject.name);
        }
    }


public void MostrarTextoFlotante(string datos) {
        if (datos == "OCULTAR") {
            if (textoFlotanteObj != null) textoFlotanteObj.SetActive(false);
            return;
        }

        string[] partes = datos.Split('|');
        if (partes.Length < 2) return;

        Vector3 pos = ParsearCoordenadas(partes[0]);
        pos.y = 8.5f;

        if (textoFlotanteObj == null) {
            textoFlotanteObj = new GameObject("TextoFlotanteAula");
            TextMesh tm = textoFlotanteObj.AddComponent<TextMesh>();
            tm.characterSize = 0.05f;
            tm.fontSize = 100;
            tm.anchor = TextAnchor.MiddleCenter;
            tm.alignment = TextAlignment.Center;
            tm.color = Color.white;
            tm.fontStyle = FontStyle.Bold;

            GameObject fondo = GameObject.CreatePrimitive(PrimitiveType.Cube);
            fondo.name = "FondoAzul";
            fondo.transform.SetParent(textoFlotanteObj.transform);
            Destroy(fondo.GetComponent<Collider>());
            MeshRenderer mrFondo = fondo.GetComponent<MeshRenderer>();
            mrFondo.material = new Material(Shader.Find("Sprites/Default"));
            mrFondo.material.color = new Color(0.10f, 0.23f, 0.35f, 0.95f); // _cDarkBlue
            fondo.transform.localPosition = new Vector3(0, 0, 0.1f);

            GameObject piquito = GameObject.CreatePrimitive(PrimitiveType.Cube);
            piquito.name = "PiquitoAzul";
            piquito.transform.SetParent(textoFlotanteObj.transform);
            Destroy(piquito.GetComponent<Collider>());
            MeshRenderer mrPiquito = piquito.GetComponent<MeshRenderer>();
            mrPiquito.material = new Material(Shader.Find("Sprites/Default"));
            mrPiquito.material.color = new Color(0.10f, 0.23f, 0.35f, 0.95f); // _cDarkBlue

            piquito.transform.localEulerAngles = new Vector3(0, 0, 45);
            piquito.transform.localScale = new Vector3(0.6f, 0.6f, 0.1f);
        }

        textoFlotanteObj.transform.position = pos;

        string nombreAula = partes[1];
        string textoFormateado = DividirTextoEnLineas(nombreAula, 14);
        textoFlotanteObj.GetComponent<TextMesh>().text = textoFormateado;

        string[] lineas = textoFormateado.Split('\n');
        int maxLetras = 0;
        foreach(string linea in lineas) {
            if(linea.Length > maxLetras) maxLetras = linea.Length;
        }

        float anchoDinamico = (maxLetras * 0.2f) + 1.1f;
        float altoDinamico = 0.8f + ((lineas.Length - 1) * 0.8f);

        Transform fondoTransform = textoFlotanteObj.transform.Find("FondoAzul");
        if (fondoTransform != null) {
            fondoTransform.localScale = new Vector3(anchoDinamico, altoDinamico, 0.1f);
            fondoTransform.localPosition = new Vector3(0, 0, 0.1f);
        }

        Transform piquitoTransform = textoFlotanteObj.transform.Find("PiquitoAzul");
        if (piquitoTransform != null) {
            float posicionPiquitoY = -(altoDinamico / 2f);
            piquitoTransform.localPosition = new Vector3(0, posicionPiquitoY, 0.1f);
        }

        textoFlotanteObj.SetActive(true);

    }

    private string DividirTextoEnLineas(string texto, int maxCaracteres) {
        if (texto.Length <= maxCaracteres) return texto;

        string[] palabras = texto.Split(' ');
        string resultado = "";
        string lineaActual = "";

        foreach (string palabra in palabras) {
            if ((lineaActual + palabra).Length > maxCaracteres) {
                resultado += lineaActual.TrimEnd() + "\n";
                lineaActual = "";
            }
            lineaActual += palabra + " ";
        }
        resultado += lineaActual.TrimEnd();
        return resultado;
    }
    public void MostrarBandera(string c) {
        if (c == "OCULTAR") {
            if (banderaDestino != null) banderaDestino.SetActive(false);
            return;
        }

        if (banderaDestino == null && prefabBandera != null) {
            banderaDestino = Instantiate(prefabBandera);
            banderaDestino.name = "BanderaFinal";
            banderaDestino.transform.localScale = new Vector3(135f, 135f, 135f);
        }

        if (banderaDestino != null) {
            Vector3 pos = ParsearCoordenadas(c);
            pos.y = 6.5f;
            banderaDestino.transform.position = pos;
            Vector3 rotacionDeFabrica = prefabBandera.transform.eulerAngles;
            banderaDestino.transform.rotation = Quaternion.Euler(rotacionDeFabrica.x, rotacionDeFabrica.y + 90f, rotacionDeFabrica.z);

            banderaDestino.SetActive(true);
        }
    }
    private Vector3 ParsearCoordenadas(string coord) {
        string[] p = coord.Replace("m","").Replace("M","").Trim().Split(' ');
        if (p.Length >= 3)
            return new Vector3(
                float.Parse(p[0], System.Globalization.CultureInfo.InvariantCulture),
                float.Parse(p[1], System.Globalization.CultureInfo.InvariantCulture),
                float.Parse(p[2], System.Globalization.CultureInfo.InvariantCulture)
            );
        return transform.position;
    }

    public void CrearZonasInteractivas(string jsonString)
    {
        ListaZonas lista = JsonUtility.FromJson<ListaZonas>(jsonString);
        if (lista == null || lista.zonas == null) return;

        foreach (ZonaAula zona in lista.zonas) {
            Vector3 posCentro = ParsearCoordenadas(zona.pos);
            GameObject cajaInvisible = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cajaInvisible.name = zona.id;
            cajaInvisible.transform.position = new Vector3(posCentro.x, posCentro.y + 1.5f, posCentro.z);
            cajaInvisible.transform.localScale = new Vector3(7f, 5f, 8f);
            cajaInvisible.GetComponent<MeshRenderer>().enabled = false;
        }
    }

    public void FijarVelocidad(string v) { float.TryParse(v, out velocidad); }
public void MoverHacia(string c) {
        Vector3 nuevoDestino = ParsearCoordenadas(c);
        nuevoDestino.y = 6.5f;

        Vector3 dir = (nuevoDestino - transform.position);
        dir.y = 0;
        if (dir.sqrMagnitude > 0.01f) {
            direccionMirada = dir.normalized;
        }

        destinoActual = nuevoDestino;
    }

    public void Teleportar(string c) { transform.position = ParsearCoordenadas(c); transform.position = new Vector3(transform.position.x, 6.5f, transform.position.z); destinoActual = transform.position; }

    public void ResaltarAula(string i) {}
    public void ActualizarBrujula(string anguloStr) {
        if (float.TryParse(anguloStr, out float grados)) {
            float anguloDestino = grados + offsetNorteMapa;

            if (iconoNavegacion != null && iconoNavegacion.activeSelf) {
                Quaternion targetRot = Quaternion.Euler(0, anguloDestino, 0);
                iconoNavegacion.transform.rotation = Quaternion.Slerp(
                    iconoNavegacion.transform.rotation,
                    targetRot,
                    Time.deltaTime * 8f
                );
            }
        }
    }

public void EnfocarDestino(string c)
    {
        if (camaraPrincipal == null) return;
        modoNavegacion = false;
        Vector3 posDestino = ParsearCoordenadas(c);
        camaraPrincipal.SetParent(null);
        camaraPrincipal.position = new Vector3(posDestino.x, 30f, posDestino.z - 15f);
        camaraPrincipal.eulerAngles = new Vector3(55f, 0f, 0f);
    }


   [ContextMenu("Probar Ruta Visual")]
    public void ProbarRutaVisual()
    {
        string jsonPrueba = "{\"puntos\": [" +
            "\"0 0 0\"," +
            "\"5 0 0\"," +
            "\"5 0 5\"" +
        "]}";
        DibujarRuta(jsonPrueba);

        MostrarTextoFlotante("5 0 5|Aula de Prueba");
        MostrarBandera("5 0 5");
        CambiarVista("NAVEGACION");
        transform.position = new Vector3(0, 6.5f, 0);
        destinoActual = transform.position;
    }
public void MostrarPuntoCrudo(string coordenadas)
    {
        if (puntoRojoIA == null) return;
        string[] partes = coordenadas.Split(' ');

        if (partes.Length >= 3)
        {
            float x = float.Parse(partes[0], System.Globalization.CultureInfo.InvariantCulture);
            float y = float.Parse(partes[1], System.Globalization.CultureInfo.InvariantCulture);
            float z = float.Parse(partes[2], System.Globalization.CultureInfo.InvariantCulture);

            puntoRojoIA.transform.position = new Vector3(x, 6.2f, z);
            if (!puntoRojoIA.activeSelf)
            {
                puntoRojoIA.SetActive(true);
            }
        }
    }
public void ActualizarDestinosCercanos(string datos) {
        if (datos == "VACIO" || datos == "OCULTAR") {
            foreach(var c in cartelesPOIs.Values) {
                if (c != null) {
                    c.SetActive(false);
                }
            }
            return;
        }

        HashSet<string> activosAhora = new HashSet<string>();
        string[] pois = datos.Split('#');

        foreach(string p in pois) {
            if (string.IsNullOrEmpty(p)) continue;
            string[] partes = p.Split('|');
            if (partes.Length < 3) continue;

            string id = partes[0];
            Vector3 pos = ParsearCoordenadas(partes[1]);
            pos.y = 8.5f;
            string nombreAula = partes[2];

            activosAhora.Add(id);

            if (!cartelesPOIs.ContainsKey(id) || cartelesPOIs[id] == null) {
                cartelesPOIs[id] = CrearNuevoCartel(id);
            }

            GameObject cartel = cartelesPOIs[id];
            cartel.transform.position = pos;

            string textoFormateado = DividirTextoEnLineas(nombreAula, 14);
            cartel.GetComponent<TextMesh>().text = textoFormateado;

            string[] lineas = textoFormateado.Split('\n');
            int maxLetras = 0;
            foreach(string linea in lineas) {
                if(linea.Length > maxLetras) maxLetras = linea.Length;
            }

            float anchoDinamico = (maxLetras * 0.2f) + 1.1f;
            float altoDinamico = 0.8f + ((lineas.Length - 1) * 0.8f);

            Transform fondoTransform = cartel.transform.Find("FondoAzul");
            if (fondoTransform != null) {
                fondoTransform.localScale = new Vector3(anchoDinamico, altoDinamico, 0.1f);
                fondoTransform.localPosition = new Vector3(0, 0, 0.1f);
            }

            Transform piquitoTransform = cartel.transform.Find("PiquitoAzul");
            if (piquitoTransform != null) {
                float posicionPiquitoY = -(altoDinamico / 2f);
                piquitoTransform.localPosition = new Vector3(0, posicionPiquitoY, 0.1f);
            }

            cartel.SetActive(true);
        }

        foreach(var kvp in cartelesPOIs) {
            if (!activosAhora.Contains(kvp.Key) && kvp.Value != null) {
                kvp.Value.SetActive(false);
            }
        }
    }
    private GameObject CrearNuevoCartel(string nombreObj) {
        GameObject obj = new GameObject("POI_" + nombreObj);
        TextMesh tm = obj.AddComponent<TextMesh>();
        tm.characterSize = 0.05f;
        tm.fontSize = 100;
        tm.anchor = TextAnchor.MiddleCenter;
        tm.alignment = TextAlignment.Center;
        tm.color = Color.white;
        tm.fontStyle = FontStyle.Bold;
        GameObject fondo = GameObject.CreatePrimitive(PrimitiveType.Cube);
        fondo.name = "FondoAzul";
        fondo.transform.SetParent(obj.transform);
        Destroy(fondo.GetComponent<Collider>());
        MeshRenderer mrFondo = fondo.GetComponent<MeshRenderer>();
        mrFondo.material = new Material(Shader.Find("Sprites/Default"));
        mrFondo.material.color = new Color(0.10f, 0.23f, 0.35f, 0.95f);
        fondo.transform.localPosition = new Vector3(0, 0, 0.1f);
        GameObject piquito = GameObject.CreatePrimitive(PrimitiveType.Cube);
        piquito.name = "PiquitoAzul";
        piquito.transform.SetParent(obj.transform);
        Destroy(piquito.GetComponent<Collider>());
        MeshRenderer mrPiquito = piquito.GetComponent<MeshRenderer>();
        mrPiquito.material = new Material(Shader.Find("Sprites/Default"));
        mrPiquito.material.color = new Color(0.10f, 0.23f, 0.35f, 0.95f);

        piquito.transform.localEulerAngles = new Vector3(0, 0, 45);
        piquito.transform.localScale = new Vector3(0.6f, 0.6f, 0.1f);

        return obj;
    }
}
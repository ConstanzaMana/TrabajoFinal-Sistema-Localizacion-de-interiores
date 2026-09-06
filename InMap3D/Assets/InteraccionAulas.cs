using UnityEngine;
using FlutterUnityIntegration; 

public class InteraccionAulas : MonoBehaviour
{
    void Update()
    {
        // Detecta el toque en la pantalla de Android o el clic del mouse
        if (Input.GetMouseButtonDown(0) || (Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began))
        {
            Ray ray;
            if (Input.touchCount > 0)
                ray = Camera.main.ScreenPointToRay(Input.GetTouch(0).position);
            else
                ray = Camera.main.ScreenPointToRay(Input.mousePosition);

            RaycastHit hit;
            if (Physics.Raycast(ray, out hit))
            {
                string nombreObjeto = hit.collider.gameObject.name;
                UnityMessageManager.Instance.SendMessageToFlutter(nombreObjeto);
            }
        }
    }
}
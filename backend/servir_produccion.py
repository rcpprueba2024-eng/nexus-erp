"""Arranca el backend con un servidor de producción (waitress) en vez del
servidor de desarrollo de Django (`manage.py runserver`).

`runserver` es de un solo hilo: mientras genera un reporte Excel/PDF o
procesa la foto de un equipo para UN usuario, deja a TODOS los demás
esperando — con varias personas de la empresa usando el sistema a la vez,
eso se siente como que "se pega". waitress atiende varias peticiones en
paralelo (varios hilos), así que un reporte pesado para Backoffice no
bloquea a Ventas ni a Taller mientras tanto.
"""

from waitress import serve

from config.wsgi import application

if __name__ == "__main__":
    print("NEXUS ERP - Backend (producción) escuchando en el puerto 8000...")
    serve(application, host="0.0.0.0", port=8000, threads=8)

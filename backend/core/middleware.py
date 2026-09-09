import re

_MODULO_RE = re.compile(r"^/api/([a-z_-]+)/")  # incluye "-" por /api/caja-chica/
_METODO_ACCION = {"POST": "CREAR", "PUT": "EDITAR", "PATCH": "EDITAR", "DELETE": "ELIMINAR"}
_CAMPOS_RESUMEN = (
    "numero", "nombre", "username", "titulo", "codigo",
    "empleado_nombre", "cliente_nombre", "tecnico_nombre", "motivo", "equipo", "descripcion",
)


def _resumen_de(data):
    """Intenta sacar algo legible de la respuesta (número de orden, nombre,
    usuario afectado, etc.) para no dejar la bitácora en puros IDs
    numéricos — no todos los serializers usan el mismo nombre de campo para
    "cómo se llama esto", así que se prueban varios en orden."""
    if not isinstance(data, dict):
        return ""
    for campo in _CAMPOS_RESUMEN:
        valor = data.get(campo)
        if valor:
            return str(valor)[:255]
    return ""


def _ip_de(request):
    reenviada = request.META.get("HTTP_X_FORWARDED_FOR")
    if reenviada:
        return reenviada.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class RegistroActividadMiddleware:
    """Registra sola cada creación/edición/eliminación exitosa y cada inicio
    de sesión, para TODA la API — así ningún módulo (ni uno que se agregue
    después) se queda sin bitácora por olvido de instrumentarlo a mano.

    Deliberadamente NO registra lecturas (GET): son la inmensa mayoría del
    tráfico y "ver una lista" no es un movimiento auditable — guardarlas
    inundaría la tabla sin aportarle nada a Gerencia. Tampoco registra
    intentos fallidos (login incorrecto, permiso denegado, error de
    validación): son ruido, no un movimiento que de verdad ocurrió.

    Va DESPUÉS de AuthenticationMiddleware en settings.MIDDLEWARE: para que
    request.user ya venga resuelto por Token/Session auth cuando este
    middleware corre su lógica después de get_response()."""

    RUTA_LOGIN = "/api/auth/login/"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._registrar(request, response)
        except Exception:
            # La bitácora es un efecto secundario — un fallo ahí nunca debe
            # tumbar la respuesta real que el usuario está esperando.
            pass
        return response

    def _registrar(self, request, response):
        path = request.path
        if not path.startswith("/api/"):
            return
        if response.status_code >= 400:
            return  # solo movimientos que sí surtieron efecto

        es_login = path == self.RUTA_LOGIN
        metodo = request.method

        if es_login:
            # En el login el usuario recién se autentica DENTRO de este
            # mismo request (las credenciales van en el body) — no hay un
            # request.user ya resuelto como en el resto de la API, así que
            # toca leer el username de la respuesta que ya armó LoginView.
            from django.contrib.auth.models import User
            data = getattr(response, "data", None) or {}
            username = data.get("username")
            usuario = User.objects.filter(username=username).first() if username else None
            accion = "LOGIN"
        else:
            if metodo not in _METODO_ACCION:
                return
            usuario = getattr(request, "user", None)
            if not usuario or not usuario.is_authenticated:
                return
            accion = _METODO_ACCION[metodo]

        from .models import RegistroActividad

        m = _MODULO_RE.match(path)
        RegistroActividad.objects.create(
            usuario=usuario if usuario and usuario.is_authenticated else None,
            usuario_nombre=usuario.username if usuario else "",
            accion=accion, metodo=metodo, ruta=path,
            modulo=m.group(1) if m else "",
            resumen="" if es_login else _resumen_de(getattr(response, "data", None)),
            codigo_estado=response.status_code, ip=_ip_de(request),
        )

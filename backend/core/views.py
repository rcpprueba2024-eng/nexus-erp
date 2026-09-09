from datetime import timedelta
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.contrib.auth.models import User
from .models import Configuracion, RegistroActividad
from .permissions import AdminOnly, SistemaRcpOnly
from .serializers import UsuarioSerializer, UsuarioCreateSerializer, UsuarioUpdateSerializer, RegistroActividadSerializer
from .choices import IDIOMA_CHOICES, TEMA_CHOICES

HORAS_GRACIA_ELIMINACION_USUARIO = 24


def _user_payload(user):
    perfil = getattr(user, "perfil", None)
    if perfil:
        rol = perfil.rol
        modulos = perfil.modulos_permitidos
        idioma = perfil.idioma
        tema = perfil.tema
        foto = perfil.foto.url if perfil.foto else None
    else:
        rol = "ADMIN" if user.is_superuser else "BACKOFFICE"
        modulos = []
        idioma = "es"
        tema = "auto"
        foto = None
    return {
        "username": user.username,
        "rol": rol,
        "is_superuser": user.is_superuser,
        "nombre": user.first_name or user.username,
        "modulos_permitidos": modulos,
        "idioma": idioma,
        "tema": tema,
        "foto": foto,
        # Único punto de verdad: SistemaRcpOnly.USERNAME_PERMITIDO — así el
        # frontend no tiene que repetir el username exacto para decidir si
        # muestra el enlace a la bitácora.
        "puede_ver_actividad": user.username == SistemaRcpOnly.USERNAME_PERMITIDO,
    }


class LoginView(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        data = _user_payload(user)
        data["token"] = token.key
        return Response(data)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_user_payload(request.user))

    def patch(self, request):
        perfil = getattr(request.user, "perfil", None)
        if perfil:
            idioma = request.data.get("idioma")
            tema = request.data.get("tema")
            cambiado = False
            if idioma and idioma in dict(IDIOMA_CHOICES):
                perfil.idioma = idioma
                cambiado = True
            if tema and tema in dict(TEMA_CHOICES):
                perfil.tema = tema
                cambiado = True
            if cambiado:
                perfil.save()
        return Response(_user_payload(request.user))


def _config_payload(config):
    return {
        "tasa_cambio_usd": str(config.tasa_cambio_usd),
        "impresora_conexion": config.impresora_conexion,
        "impresora_nombre": config.impresora_nombre,
        "impresora_ip": config.impresora_ip,
        "impresora_puerto": config.impresora_puerto,
        "impresora_ancho_papel": config.impresora_ancho_papel,
    }


class ConfiguracionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_config_payload(Configuracion.actual()))

    def patch(self, request):
        if not (request.user.is_superuser or getattr(getattr(request.user, "perfil", None), "rol", None) == "ADMIN"):
            return Response({"detail": "Solo Gerencia puede cambiar la configuración."}, status=403)
        config = Configuracion.actual()
        if "tasa_cambio_usd" in request.data and request.data.get("tasa_cambio_usd"):
            config.tasa_cambio_usd = request.data["tasa_cambio_usd"]
        for campo in ("impresora_conexion", "impresora_nombre", "impresora_ip", "impresora_puerto", "impresora_ancho_papel"):
            if campo in request.data:
                setattr(config, campo, request.data[campo])
        config.save()
        return Response(_config_payload(config))


class UsuarioViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin,
    mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Gestión de usuarios y accesos, exclusiva de Gerencia (rol ADMIN)."""
    queryset = User.objects.filter(perfil__isnull=False).select_related("perfil").order_by("username")
    permission_classes = [AdminOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.action == "create":
            return UsuarioCreateSerializer
        if self.action in ("update", "partial_update"):
            return UsuarioUpdateSerializer
        return UsuarioSerializer

    def list(self, request, *args, **kwargs):
        # Sin acceso a Task Scheduler en este entorno — igual que el
        # abandono de equipos en Taller, la purga de usuarios marcados para
        # eliminar corre perezosamente cada vez que se lista el catálogo.
        limite = timezone.now() - timedelta(hours=HORAS_GRACIA_ELIMINACION_USUARIO)
        User.objects.filter(perfil__eliminacion_solicitada_en__lte=limite).delete()
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def solicitar_eliminacion(self, request, pk=None):
        usuario = self.get_object()
        if usuario.id == request.user.id:
            return Response({"detail": "No podés eliminar tu propia cuenta."}, status=400)
        perfil = usuario.perfil
        if perfil.eliminacion_solicitada_en:
            return Response({"detail": "Este usuario ya está en proceso de eliminación."}, status=409)
        perfil.eliminacion_solicitada_en = timezone.now()
        perfil.save(update_fields=["eliminacion_solicitada_en"])
        usuario.is_active = False
        usuario.save(update_fields=["is_active"])
        return Response(UsuarioSerializer(usuario).data)

    @action(detail=True, methods=["post"])
    def cancelar_eliminacion(self, request, pk=None):
        usuario = self.get_object()
        perfil = usuario.perfil
        if not perfil.eliminacion_solicitada_en:
            return Response({"detail": "Este usuario no está en proceso de eliminación."}, status=400)
        perfil.eliminacion_solicitada_en = None
        perfil.save(update_fields=["eliminacion_solicitada_en"])
        usuario.is_active = True
        usuario.save(update_fields=["is_active"])
        return Response(UsuarioSerializer(usuario).data)


class RegistroActividadPagination(PageNumberPagination):
    # A diferencia del resto de la API (que devuelve todo y pagina en el
    # frontend, viable porque esas tablas son chicas), esta bitácora crece
    # sin techo con el uso diario del sistema — pagina de verdad en el
    # servidor para no mandar miles de filas de una sola vez.
    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = 200


class RegistroActividadViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Bitácora de actividad del sistema — solo lectura, exclusiva del
    usuario SISTEMA.RCP (ver core.permissions.SistemaRcpOnly). Las filas las
    crea sola core.middleware.RegistroActividadMiddleware en cada request
    que modifica algo; acá solo se listan y filtran."""

    queryset = RegistroActividad.objects.select_related("usuario").all()
    serializer_class = RegistroActividadSerializer
    permission_classes = [SistemaRcpOnly]
    pagination_class = RegistroActividadPagination

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        usuario = params.get("usuario")
        if usuario:
            qs = qs.filter(usuario_id=usuario)
        accion = params.get("accion")
        if accion:
            qs = qs.filter(accion=accion)
        modulo = params.get("modulo")
        if modulo:
            qs = qs.filter(modulo=modulo)
        desde = params.get("desde")
        if desde:
            qs = qs.filter(creado_en__date__gte=desde)
        hasta = params.get("hasta")
        if hasta:
            qs = qs.filter(creado_en__date__lte=hasta)
        buscar = params.get("buscar")
        if buscar:
            from django.db.models import Q
            qs = qs.filter(Q(ruta__icontains=buscar) | Q(resumen__icontains=buscar) | Q(usuario_nombre__icontains=buscar))
        return qs

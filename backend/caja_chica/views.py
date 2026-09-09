from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action

from core.permissions import role_permission
from .models import ArqueoCaja
from .serializers import ArqueoCajaSerializer
from .arqueo_excel import arqueo_caja_excel_bytes
from .arqueo_pdf import build_arqueo_caja_pdf_response

# Pedido explícito: Gerencia (ADMIN, bypass automático de role_permission),
# Ventas, Taller y RRHH. No se agregó Backoffice/Pasante a propósito — si
# se necesita después, se agrega acá.
CAJA_CHICA_ROLES = ("VENTAS", "TALLER", "RRHH")


class ArqueoCajaViewSet(viewsets.ModelViewSet):
    queryset = ArqueoCaja.objects.select_related("creado_por", "cerrada_por").all()
    serializer_class = ArqueoCajaSerializer
    permission_classes = [role_permission(*CAJA_CHICA_ROLES, modules="caja_chica")]

    def perform_create(self, serializer):
        # "Abrir caja": sin importar qué más venga en el payload, todo
        # registro nuevo nace ABIERTA — el resto del formulario se llena al
        # cerrar (perform_update, abajo).
        serializer.save(creado_por=self.request.user, estado="ABIERTA")

    def perform_update(self, serializer):
        # Si este guardado es el que cierra la caja (ABIERTA -> CERRADA),
        # se deja constancia de quién cerró y cuándo — puede ser alguien
        # distinto de quien la abrió.
        instance = self.get_object()
        extra = {}
        nuevo_estado = serializer.validated_data.get("estado", instance.estado)
        if nuevo_estado == "CERRADA" and instance.estado != "CERRADA":
            extra["cerrada_por"] = self.request.user
            extra["cerrada_en"] = timezone.now()
        serializer.save(**extra)

    @action(detail=True, methods=["get"])
    def excel(self, request, pk=None):
        from django.http import HttpResponse, JsonResponse

        arqueo = self.get_object()
        if arqueo.estado != "CERRADA":
            return JsonResponse({"detail": "Esta caja todavía está abierta — ciérrala antes de exportarla."}, status=409)
        contenido = arqueo_caja_excel_bytes(arqueo)
        nombre = f"Arqueo_Caja_{arqueo.fecha}"
        response = HttpResponse(
            contenido, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = f'attachment; filename="{nombre}.xlsx"'
        return response

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        from django.http import JsonResponse

        arqueo = self.get_object()
        if arqueo.estado != "CERRADA":
            return JsonResponse({"detail": "Esta caja todavía está abierta — ciérrala antes de exportarla."}, status=409)
        return build_arqueo_caja_pdf_response(arqueo)

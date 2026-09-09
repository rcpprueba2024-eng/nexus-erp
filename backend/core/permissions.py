from rest_framework.permissions import BasePermission


class RolePermission(BasePermission):
    allowed_roles = []
    modules = ()
    nunca = ()

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        perfil = getattr(user, "perfil", None)
        rol = perfil.rol if perfil else None
        if rol == "ADMIN":
            return True
        if perfil and self.modules and rol not in self.nunca:
            # Los apartados que Gerencia otorgó en Configuración de Empresa
            # son la autoridad real: si esta vista declara `modules`, eso
            # manda sobre los roles clásicos (que ya no dan acceso "de
            # regalo" a un módulo que Gerencia desmarcó explícitamente).
            permitidos = perfil.modulos_permitidos or []
            return any(m in permitidos for m in self.modules)
        return rol in self.allowed_roles


def role_permission(*roles, modules=None, nunca=()):
    """Permite acceso si Gerencia otorgó explícitamente alguno de los
    `modules` desde Configuración de Empresa (fuente de verdad real, por
    usuario). Si la vista no declara `modules`, cae al rol clásico.

    `nunca`: roles que JAMÁS pasan por el atajo de `modules`, sin importar
    qué casillas le marque Gerencia a ese usuario en Configuración — es una
    regla de negocio fija (p.ej. Taller/Pasante nunca ven datos de cliente
    ni crean órdenes), no una preferencia configurable."""
    if modules is None:
        modules = ()
    elif isinstance(modules, str):
        modules = (modules,)
    return type("DynamicRolePermission", (RolePermission,), {
        "allowed_roles": list(roles), "modules": tuple(modules), "nunca": tuple(nunca),
    })


class AdminOnly(BasePermission):
    """Estrictamente Gerencia (rol ADMIN o superusuario). No es delegable
    mediante modulos_permitidos: administrar usuarios queda reservado."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        perfil = getattr(user, "perfil", None)
        return bool(perfil and perfil.rol == "ADMIN")


class SistemaRcpOnly(BasePermission):
    """Bitácora de actividad del sistema: pedido explícito de Gerencia — solo
    el usuario SISTEMA.RCP la puede ver, ni siquiera otras cuentas de
    Gerencia (ADMIN/superusuario) tienen acceso, a diferencia de AdminOnly."""

    USERNAME_PERMITIDO = "SISTEMA.RCP"

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.username == self.USERNAME_PERMITIDO)

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Perfil, RegistroActividad
from .choices import ROLES, MODULOS_POR_ROL


class MeSerializer(serializers.Serializer):
    username = serializers.CharField()
    rol = serializers.CharField()
    is_superuser = serializers.BooleanField()
    nombre = serializers.CharField()
    modulos_permitidos = serializers.ListField(child=serializers.CharField())
    idioma = serializers.CharField()
    tema = serializers.CharField()
    foto = serializers.CharField(allow_null=True)


class UsuarioSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(source="first_name")
    rol = serializers.CharField(source="perfil.rol")
    rol_display = serializers.CharField(source="perfil.get_rol_display", read_only=True)
    modulos_permitidos = serializers.ListField(source="perfil.modulos_permitidos", child=serializers.CharField())
    idioma = serializers.CharField(source="perfil.idioma")
    eliminacion_solicitada_en = serializers.DateTimeField(source="perfil.eliminacion_solicitada_en", read_only=True)
    foto = serializers.ImageField(source="perfil.foto", read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "nombre", "rol", "rol_display", "modulos_permitidos", "idioma", "is_active",
            "date_joined", "eliminacion_solicitada_en", "foto",
        ]


class UsuarioCreateSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(source="first_name")
    password = serializers.CharField(write_only=True, min_length=4)
    rol = serializers.ChoiceField(choices=ROLES)
    modulos_permitidos = serializers.ListField(child=serializers.CharField(), required=False)

    class Meta:
        model = User
        fields = ["id", "username", "nombre", "password", "rol", "modulos_permitidos", "is_active"]

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con ese nombre de usuario.")
        return value

    def create(self, validated_data):
        rol = validated_data.pop("rol")
        modulos = validated_data.pop("modulos_permitidos", None)
        password = validated_data.pop("password")
        is_active = validated_data.pop("is_active", True)
        user = User(
            username=validated_data["username"],
            first_name=validated_data.get("first_name", ""),
            is_active=is_active,
        )
        user.set_password(password)
        user.save()
        Perfil.objects.create(
            user=user, rol=rol,
            modulos_permitidos=modulos if modulos else list(MODULOS_POR_ROL.get(rol, [])),
        )
        return user

    def to_representation(self, instance):
        return UsuarioSerializer(instance).data


class RegistroActividadSerializer(serializers.ModelSerializer):
    accion_display = serializers.CharField(source="get_accion_display", read_only=True)

    class Meta:
        model = RegistroActividad
        fields = [
            "id", "usuario", "usuario_nombre", "accion", "accion_display", "metodo", "ruta",
            "modulo", "resumen", "codigo_estado", "ip", "creado_en",
        ]


class UsuarioUpdateSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(source="first_name", required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=4)
    rol = serializers.ChoiceField(choices=ROLES, required=False)
    modulos_permitidos = serializers.ListField(child=serializers.CharField(), required=False)
    foto = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["username", "nombre", "password", "rol", "modulos_permitidos", "is_active", "foto"]

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        rol = validated_data.pop("rol", None)
        modulos = validated_data.pop("modulos_permitidos", None)
        foto = validated_data.pop("foto", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        perfil = instance.perfil
        if rol is not None:
            perfil.rol = rol
        if modulos is not None:
            perfil.modulos_permitidos = modulos
        if foto is not None:
            perfil.foto = foto
        perfil.save()
        return instance

    def to_representation(self, instance):
        return UsuarioSerializer(instance).data

from rest_framework import serializers
from .models import CategoriaProducto, SubcategoriaProducto, Marca, Modelo, Producto, MovimientoInventario, UnidadMedida, BajaProducto


class CategoriaProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaProducto
        fields = "__all__"


class SubcategoriaProductoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)

    class Meta:
        model = SubcategoriaProducto
        fields = "__all__"


class MarcaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Marca
        fields = "__all__"


class ModeloSerializer(serializers.ModelSerializer):
    marca_nombre = serializers.CharField(source="marca.nombre", read_only=True)

    class Meta:
        model = Modelo
        fields = "__all__"


class UnidadMedidaSerializer(serializers.ModelSerializer):
    productos_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = UnidadMedida
        fields = "__all__"


class ProductoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    categoria_tipo = serializers.CharField(source="categoria.tipo", read_only=True)
    subcategoria_nombre = serializers.CharField(source="subcategoria.nombre", read_only=True)
    marca_nombre = serializers.CharField(source="marca.nombre", read_only=True)
    modelo_nombre = serializers.CharField(source="modelo.nombre", read_only=True)
    unidad_medida_nombre = serializers.CharField(source="unidad_medida.nombre", read_only=True)
    unidad_medida_abreviatura = serializers.CharField(source="unidad_medida.abreviatura", read_only=True)
    unidad_permite_fraccion = serializers.BooleanField(source="unidad_medida.permite_fraccion", read_only=True, default=False)

    class Meta:
        model = Producto
        fields = "__all__"


class MovimientoInventarioSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)

    class Meta:
        model = MovimientoInventario
        fields = "__all__"


class BajaProductoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    producto_codigo = serializers.CharField(source="producto.codigo", read_only=True)
    stock_disponible = serializers.DecimalField(source="producto.stock_actual", read_only=True, max_digits=10, decimal_places=3)
    dado_de_baja_por_nombre = serializers.CharField(source="dado_de_baja_por.username", read_only=True, default=None)

    class Meta:
        model = BajaProducto
        fields = "__all__"
        read_only_fields = ["dado_de_baja_por"]

    def validate(self, data):
        producto = data.get("producto")
        cantidad = data.get("cantidad")
        if cantidad is not None and cantidad <= 0:
            raise serializers.ValidationError("La cantidad a dar de baja debe ser mayor a cero.")
        if producto and cantidad is not None and cantidad > producto.stock_actual:
            raise serializers.ValidationError(
                f"No podés dar de baja {cantidad} — el producto solo tiene {producto.stock_actual} en existencia."
            )
        return data

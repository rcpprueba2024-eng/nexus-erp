"""Exporta el arqueo de caja a PDF — el mismo Excel real (con fórmulas,
colores y formato originales) convertido a PDF con Microsoft Excel
instalado en el servidor, igual que se hace para la Cotización a Cliente
(ver compras/pdf_cotizacion_cliente.py)."""
import os
import tempfile
import uuid

from django.http import HttpResponse, JsonResponse

from .arqueo_excel import arqueo_caja_workbook

XL_TYPE_PDF = 0


def build_arqueo_caja_pdf_response(arqueo):
    wb_openpyxl = arqueo_caja_workbook(arqueo)

    nombre_base = f"arqueo_{arqueo.id}_{uuid.uuid4().hex[:8]}"
    tmp_dir = tempfile.gettempdir()
    ruta_xlsx = os.path.join(tmp_dir, f"{nombre_base}.xlsx")
    ruta_pdf = os.path.join(tmp_dir, f"{nombre_base}.pdf")
    wb_openpyxl.save(ruta_xlsx)

    try:
        import win32com.client as win32_client
    except ImportError:
        os.remove(ruta_xlsx)
        return JsonResponse(
            {"detail": "No se pudo generar el PDF: este servidor no tiene Microsoft Excel/pywin32 disponible."},
            status=501,
        )

    import pythoncom

    # CoInitialize: hace falta en CADA hilo que use COM antes de tocar
    # cualquier objeto COM — el hilo real que atiende una petición del
    # servidor Django no lo inicializa solo, y DispatchEx tronaba con
    # "No se ha llamado a CoInitialize." (se confirmó pegándole a este
    # endpoint por HTTP de verdad — ver misma corrección y explicación
    # completa en taller/orden_pdf_excel.py).
    pythoncom.CoInitialize()
    excel = None
    wb_excel = None
    try:
        # DispatchEx (no Dispatch/dynamic.Dispatch): Dispatch se conecta a
        # una instancia de Excel que ya esté abierta en esta máquina si la
        # hay — si alguien tenía Excel abierto con sus propios archivos,
        # este código le habría vuelto invisible su ventana y hasta se la
        # cerraba al terminar (excel.Quit() abajo), perdiendo lo que
        # tuviera sin guardar. DispatchEx siempre crea un proceso de Excel
        # nuevo y separado (confirmado con una prueba real — ver
        # taller/orden_pdf_excel.py).
        excel = win32_client.DispatchEx("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False
        wb_excel = excel.Workbooks.Open(ruta_xlsx, ReadOnly=True, UpdateLinks=0)
        wb_excel.Worksheets(1).ExportAsFixedFormat(XL_TYPE_PDF, ruta_pdf)
    except Exception as exc:
        return JsonResponse({"detail": f"No se pudo generar el PDF del arqueo: {exc}"}, status=500)
    finally:
        if wb_excel is not None:
            wb_excel.Close(False)
        if excel is not None:
            excel.Quit()
        pythoncom.CoUninitialize()
        if os.path.exists(ruta_xlsx):
            os.remove(ruta_xlsx)

    if not os.path.exists(ruta_pdf):
        return JsonResponse({"detail": "No se pudo generar el PDF del arqueo."}, status=500)

    with open(ruta_pdf, "rb") as f:
        contenido = f.read()
    os.remove(ruta_pdf)

    nombre = f"Arqueo_Caja_{arqueo.fecha}"
    response = HttpResponse(contenido, content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="{nombre}.pdf"'
    return response

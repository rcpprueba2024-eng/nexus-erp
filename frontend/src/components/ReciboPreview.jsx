import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'

function ReciboPreview({ factura, onClose }) {
  const { t } = useTranslation(['recibo', 'common'])
  if (!factura) return null

  const simbolo = factura.moneda === 'NIO' ? 'C$' : '$'
  const saldo = Number(factura.saldo_pendiente || 0)
  const vueltoTotal = (factura.pagos || []).reduce((s, p) => s + Number(p.vuelto || 0), 0)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div className="recibo-print">
          <div className="recibo-header">
            <strong>RCP</strong>
            <p>{t('encabezado')}</p>
          </div>
          <hr className="recibo-separador" />
          <div className="recibo-meta">
            <div><span>{t('factura')}</span><span>{factura.numero}</span></div>
            <div><span>{t('fecha')}</span><span>{factura.fecha}</span></div>
            <div><span>{t('cliente')}</span><span>{factura.cliente_nombre}</span></div>
            {factura.vendedor_nombre && <div><span>{t('atendio')}</span><span>{factura.vendedor_nombre}</span></div>}
          </div>
          <hr className="recibo-separador" />

          {(factura.detalles || []).map((d) => (
            <div key={d.id} className="recibo-linea">
              <div>{d.producto_nombre || d.descripcion}</div>
              <div className="recibo-linea-detalle">
                <span>{d.cantidad} x {simbolo}{Number(d.precio_unitario).toLocaleString()}</span>
                <span>{simbolo}{Number(d.subtotal).toLocaleString()}</span>
              </div>
            </div>
          ))}

          <hr className="recibo-separador" />
          <div className="recibo-total-row">
            <span>{t('total')}</span>
            <span>{simbolo}{Number(factura.total).toLocaleString()}</span>
          </div>

          {(factura.pagos || []).length > 0 && (
            <>
              <hr className="recibo-separador" />
              {factura.pagos.map((p) => (
                <div key={p.id} className="recibo-pago-row">
                  <span>{t(`metodo.${p.metodo}`)}</span>
                  <span>{simbolo}{Number(p.monto).toLocaleString()}</span>
                </div>
              ))}
              {vueltoTotal > 0 && (
                <div className="recibo-pago-row">
                  <span>{t('vuelto')}</span>
                  <span>{simbolo}{vueltoTotal.toLocaleString()}</span>
                </div>
              )}
            </>
          )}

          {saldo > 0 && (
            <div className="recibo-badge-credito">{t('saldoPendiente')}: {simbolo}{saldo.toLocaleString()}</div>
          )}

          <hr className="recibo-separador" />
          <div className="recibo-footer">{t('gracias')}</div>
        </div>

        <div className="form-row no-print" style={{ marginTop: 16 }}>
          <button onClick={() => window.print()} style={{ flex: 1 }}><Printer size={15} /> {t('imprimir')}</button>
          <button className="secondary" onClick={onClose}>{t('botones.cerrar', { ns: 'common' })}</button>
        </div>
      </div>
    </div>
  )
}

export default ReciboPreview

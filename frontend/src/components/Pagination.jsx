import { useTranslation } from 'react-i18next'

// Compacta la lista de numeros de pagina con "..." cuando hay muchas, para
// no renderizar cientos de botones con listas grandes (miles de OTs/productos
// historicos). Siempre muestra primera, ultima, y un rango alrededor de la actual.
function paginasVisibles(actual, total) {
  const rango = 2
  const paginas = []
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || (p >= actual - rango && p <= actual + rango)) {
      paginas.push(p)
    } else if (paginas[paginas.length - 1] !== '...') {
      paginas.push('...')
    }
  }
  return paginas
}

// Paginacion generica para listas largas (OTs, productos, etc.): recibe la
// pagina actual, el total de items y el tamaño de pagina, y avisa al padre
// cuando cambia de pagina — el padre sigue siendo el dueño de los datos
// (esto solo calcula que ventana mostrar).
function Pagination({ page, totalItems, pageSize, onPageChange }) {
  const { t } = useTranslation('common')
  const totalPaginas = Math.max(1, Math.ceil(totalItems / pageSize))
  if (totalPaginas <= 1) return null

  const desde = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, totalItems)
  const paginas = paginasVisibles(page, totalPaginas)

  return (
    <div className="pagination">
      <span className="pagination-info">
        {t('paginacion.mostrando', { desde, hasta, total: totalItems })}
      </span>
      <div className="pagination-controls">
        <button
          type="button" className="secondary" disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹ {t('paginacion.anterior')}
        </button>
        {paginas.map((p, i) => (
          p === '...'
            ? <span key={`e${i}`} className="pagination-ellipsis">…</span>
            : (
              <button
                key={p} type="button"
                className={p === page ? 'pagination-page active' : 'pagination-page'}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            )
        ))}
        <button
          type="button" className="secondary" disabled={page === totalPaginas}
          onClick={() => onPageChange(page + 1)}
        >
          {t('paginacion.siguiente')} ›
        </button>
      </div>
    </div>
  )
}

export default Pagination

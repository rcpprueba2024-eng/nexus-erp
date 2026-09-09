const fs = require('fs')
const path = require('path')

const base = path.join(__dirname, 'src', 'i18n', 'locales')

const temas = {
  es: { auto: 'Automático', claro: 'Claro', oscuro: 'Oscuro', medianoche: 'Medianoche', esmeralda: 'Esmeralda', ambar: 'Ámbar' },
  en: { auto: 'Automatic', claro: 'Light', oscuro: 'Dark', medianoche: 'Midnight', esmeralda: 'Emerald', ambar: 'Amber' },
  zh: { auto: '自动', claro: '浅色', oscuro: '深色', medianoche: '午夜', esmeralda: '翡翠绿', ambar: '琥珀' },
  fr: { auto: 'Automatique', claro: 'Clair', oscuro: 'Sombre', medianoche: 'Minuit', esmeralda: 'Émeraude', ambar: 'Ambre' },
}

for (const [lang, valores] of Object.entries(temas)) {
  const filePath = path.join(base, lang, 'configuracion.json')
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  content.apariencia.temas = valores
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8')
}
console.log('temas patched')

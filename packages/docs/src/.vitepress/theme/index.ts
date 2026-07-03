import DefaultTheme from 'vitepress/theme'
import './style.css'
import '@gram/renderer/gram.css'

import GramPlayground from '../../components/playground/GramPlayground.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('GramPlayground', GramPlayground)
  }
}

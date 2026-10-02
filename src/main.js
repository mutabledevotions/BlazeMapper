import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'

const app = mount(App, { target: document.getElementById('app') })

if (import.meta.env.DEV) {
  const store = await import('./state/project.svelte.js')
  const core = {
    model: await import('./core/model.js'),
    units: await import('./core/units.js'),
    geometry: await import('./core/geometry/index.js'),
    layout: await import('./core/layout.js'),
    export: await import('./core/export.js')
  }
  window.pm = { store, core }
}

export default app

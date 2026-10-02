<script>
  import Toolbar from './panels/Toolbar.svelte'
  import StripList from './panels/StripList.svelte'
  import StripProps from './panels/StripProps.svelte'
  import ExportPanel from './panels/ExportPanel.svelte'
  import Canvas from './canvas/Canvas.svelte'
</script>

<div class="app">
  <div class="toolbar-row">
    <Toolbar />
  </div>
  <div class="body">
    <aside class="sidebar left">
      <StripList />
      <StripProps />
    </aside>
    <main class="canvas-area">
      <Canvas />
    </main>
    <aside class="sidebar right">
      <ExportPanel />
    </aside>
  </div>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .sidebar {
    width: 260px;
    flex-shrink: 0;
    background: var(--panel-bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .sidebar.left {
    border-right: 1px solid var(--border);
  }
  .sidebar.right {
    border-left: 1px solid var(--border);
  }
  .canvas-area {
    flex: 1;
    min-width: 0;
  }
</style>

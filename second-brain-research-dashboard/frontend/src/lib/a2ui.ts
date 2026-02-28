/**
 * A2UI - Main Export
 *
 * Exports the A2UI catalog and renderer for easy import throughout the app.
 */

export {
  a2uiCatalog,
  getComponentRenderer,
  isComponentRegistered,
  getRegisteredTypes,
  type A2UIComponent,
  type ComponentRenderer,
} from './a2ui-catalog';

export {
  A2UIRenderer,
  A2UIRendererList,
  A2UIDebugger,
} from '@/components/A2UIRenderer';

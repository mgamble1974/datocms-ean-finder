import { connect } from 'datocms-plugin-sdk';
import { render } from './utils/render';
import ConfigScreen from './entrypoints/ConfigScreen';
import SidebarPanel from './entrypoints/SidebarPanel';
import 'datocms-react-ui/styles.css';

connect({
  renderConfigScreen(ctx) {
    render(<ConfigScreen ctx={ctx} />);
  },

  itemFormSidebarPanels() {
    return [
      {
        id: 'eanLookup',
        label: 'EAN product opzoeken',
        startOpen: true,
      },
    ];
  },

  renderItemFormSidebarPanel(sidebarPanelId, ctx) {
    if (sidebarPanelId === 'eanLookup') {
      render(<SidebarPanel ctx={ctx} />);
    }
  },
});

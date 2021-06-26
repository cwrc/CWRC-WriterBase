import { ContextMenuState, PaletteMode } from '@src/@types/types';

type State = {
  contextMenu: ContextMenuState;
  darkMode: boolean;
  paletteMode: PaletteMode;
  title: string;
};

export const state: State = {
  contextMenu: { show: false },
  darkMode: false,
  paletteMode: 'light',
  title: 'CWRC Writer',
};

import { ContextMenuState, PaletteMode } from '@src/@types/types';
import { Context } from '../';

export const onInitializeOvermind = ({ actions }: Context, overmind: any) => {
  //DARK MODE
  const prefPaletteMode: PaletteMode =
    (localStorage.getItem('paletteMode') as PaletteMode) ?? 'system';
  actions.ui.setPaletteMode(prefPaletteMode);
};

export const setPaletteMode = ({ state, actions }: Context, value: PaletteMode) => {
  state.ui.paletteMode = value;

  const darkMode =
    value === 'system'
      ? !!window.matchMedia('(prefers-color-scheme: dark)')
      : value === 'light'
      ? false
      : true;

  actions.ui.setDarkMode(darkMode);

  localStorage.setItem('paletteMode', value);
};

export const setDarkMode = ({ state }: Context, value: boolean) => {
  state.ui.darkMode = value;
};

export const closeContextMenu = ({ state }: Context) => {
  state.ui.contextMenu = { show: false };
};

export const showContextMenu = ({ state }: Context, value: ContextMenuState) => {
  state.ui.contextMenu = value;
};

export const updateTitle = ({ state }: Context, title: string) => {
  state.ui.title = title;
};

export const resetPreferences = () => {
  localStorage.removeItem('paletteMode');
};

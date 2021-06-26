import { OnInitialize } from 'overmind';
import { PaletteMode } from '@src/@types/types';

export const onInitialize: OnInitialize = ({ actions }) => {
  //DARK MODE
  const prefPaletteMode: PaletteMode =
    (localStorage.getItem('paletteMode') as PaletteMode) ?? 'system';
  actions.ui.setPaletteMode(prefPaletteMode);
};

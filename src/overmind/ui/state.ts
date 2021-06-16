import { ContextMenuState } from '@src/@types/types';

type State = {
  title: string;
  darkMode: boolean;
  contextMenu: ContextMenuState;
};

export const state: State = {
  title: 'CWRC Writer',
  darkMode: false,
  contextMenu: { show: false },
};

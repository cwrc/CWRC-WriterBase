import { ContextMenuState } from '@src/@types/types';
import { Context } from 'overmind';

export const closeContextMenu = ({ state }: Context) => {
  state.ui.contextMenu = { show: false };
};

export const showContextMenu = ({ state }: Context, value: ContextMenuState) => {
  state.ui.contextMenu = value;
};

export const updateTitle = ({ state }: Context, title: string) => {
  state.ui.title = title;
};

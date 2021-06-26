import { Menu } from '@material-ui/core';
import { useApp } from '@src/overmind';
import React, { FC, useEffect, useState } from 'react';
import Collection from './Collection';
import Header from './Header';
import { Item as ItemType } from './types';
import useContextmenu from './useContextmenu';

interface ContextMenuProps {
  writer: any;
}

const ContextMenu: FC<ContextMenuProps> = ({ writer }) => {
  const { state, actions } = useApp();
  const { collectionType, getItems, initialize, MIN_WIDTH, query, tagName, xpath, tagMeta } = useContextmenu(
    writer,
    state.ui.contextMenu
  );
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>();
  const [options, setOptions] = useState<ItemType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [visibleList, setVisibleList] = useState<ItemType[]>(options);

  useEffect(() => {
    if (!state.ui.contextMenu.show) return; //setShow(false);
    if (state.editor.isReadonly) return; //actions.ui.closeContextMenu();

    setShow(true);

    const initialzed = initialize();
    if (!initialzed) return; //setShow(false);

    const loadItems = async () => {
      setIsLoading(true);
      const options = await getItems();
      setIsLoading(false);

      if (!options) return; //setShow(false);

      setOptions(options);
      setVisibleList(options);
    };

    loadItems();
    // setShow(true);

    setMenuPosition({
      top: state.ui.contextMenu.position?.posY ?? 0,
      left: state.ui.contextMenu.position?.posX ?? 0,
    });

    return () => {
      setMenuPosition(undefined);
      setOptions([]);
      setIsLoading(false);
      setVisibleList([]);
      setShow(false);
    };
  }, [state.ui.contextMenu]);

  const handleQuery = (searchQuery: string) => {
    const result = query(options, searchQuery);
    if (!result) return setVisibleList(options);
    setVisibleList(result);
  };

  const handleClose = () => {
    actions.ui.closeContextMenu();
  };

  return (
    <>
      {show && (
        <Menu
          anchorPosition={menuPosition}
          anchorReference="anchorPosition"
          id="contextmenu"
          keepMounted
          MenuListProps={{
            sx: {
              minWidth: MIN_WIDTH,
              py: 0.5,
              borderRadius: 1,
            },
          }}
          onClose={handleClose}
          open={show}
          PaperProps={{ elevation: 4 }}
        >
          <Header tagName={tagName} xpath={xpath} tagMeta={tagMeta}/>

          <Collection
            handleQuery={handleQuery}
            collectionType={collectionType}
            fullLength={options.length}
            isLoading={isLoading}
            list={visibleList}
            minWidth={MIN_WIDTH}
          />
        </Menu>
      )}
    </>
  );
};

export default ContextMenu;

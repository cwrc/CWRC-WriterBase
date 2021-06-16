import { Menu } from '@material-ui/core';
import useWindowSize from '@src/components/useWindowSize';
import React, { FC, useEffect, useState } from 'react';
import Collection from './Collection';
import type { Item as ItemType } from './types';
import useContextmenu from './useContextmenu';

interface NestedMenuProps {
  anchorEl: null | HTMLElement;
  handleClose: () => void;
  handleMouseEnter: () => void;
  childrenItems?: ItemType[];
  collectionType?: string;
  isLoading?: boolean;
}

const NestedMenu: FC<NestedMenuProps> = ({
  anchorEl: anchorEl,
  handleClose,
  handleMouseEnter,
  childrenItems = [],
  collectionType,
  isLoading = false,
}) => {
  const { MIN_WIDTH, query } = useContextmenu();
  const [visibleList, setVisibleList] = useState<ItemType[]>(childrenItems);
  const isOpen = Boolean(Boolean(anchorEl));
  const windowSize = useWindowSize();
  const anchorBoundingClientRect = anchorEl?.getBoundingClientRect();

  useEffect(() => {
    setVisibleList(childrenItems);
    return () => {};
  }, [isLoading]);

  const handleQuery = (searchQuery: string) => {
    const result = query(childrenItems, searchQuery);
    if (!result) return setVisibleList(childrenItems);
    setVisibleList(result);
  };

  const hasSpaceToTheRight = () => {
    if (!anchorBoundingClientRect || !windowSize || !windowSize.width) return true;
    //does mindWidth submenu fits next to the origin?
    return anchorBoundingClientRect.right + MIN_WIDTH < windowSize.width;
  };

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: hasSpaceToTheRight() ? 'right' : 'left',
        }}
        MenuListProps={{
          sx: {
            minWidth: MIN_WIDTH,
            py: 0.5,
            borderRadius: 1,
          },
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleClose}
        open={isOpen}
        PaperProps={{ elevation: 4 }}
        // "pointerEvents: none" to prevent invisible Popover wrapper div to capture mouse events
        style={{ pointerEvents: 'none' }}
        transitionDuration={0}
        transformOrigin={{
          vertical: 'top',
          horizontal: hasSpaceToTheRight() ? 'left' : 'right',
        }}
      >
        <Collection
          handleQuery={handleQuery}
          collectionType={collectionType}
          fullLength={childrenItems.length}
          isLoading={isLoading}
          list={visibleList}
          minWidth={MIN_WIDTH}
        />
      </Menu>
    </>
  );
};

export default NestedMenu;

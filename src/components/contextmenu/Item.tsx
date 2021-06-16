import { Box, CircularProgress, MenuItem, Typography, useTheme } from '@material-ui/core';
import { alpha } from '@material-ui/core/styles';
import ArrowForwardIosIcon from '@material-ui/icons/ArrowForwardIos';
import BlockIcon from '@material-ui/icons/Block';
import { EntityType } from '@src/@types/types';
import { useApp } from '@src/overmind';
import React, { forwardRef, useEffect, useState } from 'react';
import useeUI from '../useUi';
import NestedMenu from './NestedMenu';
import type { Item as ItemType, Type } from './types';

interface itemProps {
  id: string;
  childrenItems?: ItemType[] | (() => Promise<ItemType[]>);
  collectionType?: string;
  description?: string;
  disabled?: boolean;
  displayName?: string;
  icon?: string;
  name?: string | EntityType;
  onClick?: () => void;
  type?: Type;
}

const Item = forwardRef<any, itemProps>(
  (
    {
      disabled = false,
      name,
      displayName,
      collectionType,
      description,
      icon,
      childrenItems,
      onClick,
      type,
    },
    ref
  ) => {
    const theme = useTheme();
    const { actions } = useApp();
    const { getIcon } = useeUI();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [showChildren, setShowChildren] = useState(false);
    const [children, setChildren] = useState<ItemType[]>([]);
    const [isLoadingChildren, setIsLoadingChildren] = useState(false);

    useEffect(() => {
      if (childrenItems && Array.isArray(childrenItems)) setChildren(childrenItems);
      const loadChildren = async () => {
        if (childrenItems && !Array.isArray(childrenItems)) {
          setIsLoadingChildren(true);
          const list = await childrenItems();
          setChildren(list);
          setIsLoadingChildren(false);
        }
      };
      if (childrenItems && !Array.isArray(childrenItems)) loadChildren();
      return () => {};
    }, []);

    const hasChildrenItems = childrenItems ?? false;

    const getEntityIcon = () => {
      if (Object.values(EntityType).includes(name as EntityType)) {
        return getIcon(theme.entity[name as EntityType].icon);
      }
      return getIcon(icon);
    };

    const Icon = type === 'entity' ? getEntityIcon() : getIcon(icon);

    const color = () => {
      if (!name) return 'inherent';
      if (Object.values(EntityType).includes(name as EntityType)) {
        return theme.entity[name as EntityType].color.main;
      }
      return 'inherent';
    };

    const handleMouseEnter = (event: React.MouseEvent<any>) => {
      setAnchorEl(event.currentTarget);
      setShowChildren(true);
    };

    const handleClose = () => {
      setShowChildren(false);
    };

    const handleMouseEnterMenu = () => {
      setShowChildren(true);
    };

    const handleCloseMenu = () => {
      setAnchorEl(null);
      setShowChildren(false);
    };

    const handleClick = () => {
      if (!onClick) return;
      handleCloseMenu();
      actions.ui.closeContextMenu();
      onClick();
    };

    return (
      <>
        <MenuItem
          dense
          disabled={disabled}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleClose}
          sx={{
            mx: 0.5,
            px: 0.75,
            borderRadius: 1,
            '&:hover': {
              color: color(),
              backgroundColor: ({ palette }) =>
                color() === 'inherent' ? 'inherent' : alpha(color(), palette.action.hoverOpacity),
            },
          }}
          ref={ref}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              columnGap: 1,
            }}
          >
            {/* LEFT ICON */}
            {Icon && <Icon sx={{ height: 18, width: 18, color: color() }} />}

            {/* LABEL */}
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2">{displayName}</Typography>
              {description && (
                <Typography color="text.secondary" variant="caption">
                  {description}
                </Typography>
              )}
            </Box>

            {/* RIGHT ICON: PROGRESS / NONE / ARROW  */}
            {hasChildrenItems &&
              (isLoadingChildren ? (
                <CircularProgress size={16} thickness={5} />
              ) : children.length === 0 ? (
                <BlockIcon color="error" sx={{ fontSize: 16 }} />
              ) : (
                <ArrowForwardIosIcon sx={{ fontSize: 12 }} />
              ))}
          </Box>
        </MenuItem>

        {/* CHILDREN */}
        {hasChildrenItems && (children.length > 0 || isLoadingChildren) && showChildren && (
          <NestedMenu
            anchorEl={anchorEl}
            handleClose={handleCloseMenu}
            handleMouseEnter={handleMouseEnterMenu}
            childrenItems={children}
            collectionType={collectionType}
            isLoading={isLoadingChildren}
          />
        )}
      </>
    );
  }
);

export default Item;

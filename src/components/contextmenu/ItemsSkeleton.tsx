import { Box, Skeleton, Stack, Typography } from '@material-ui/core';
import React, { FC } from 'react';

interface ItemsSkeletonProps {
  minWidth?: number;
  skeletonCount?: number;
}

const ItemsSkeleton: FC<ItemsSkeletonProps> = ({
  minWidth = 250,
  skeletonCount = 5,
}) => {
  if (skeletonCount < 1) skeletonCount = 1;
  if (minWidth < 100) skeletonCount = 100;
  const skeletons = Array(skeletonCount).fill(0, 0);

  return (
    <Stack spacing={1}>
      {skeletons.map((_skeleton, index) => (
        <Box key={index} px={1}>
          <Typography variant="body1">
            <Skeleton
              animation="wave"
              variant="text"
              width={25 + (Math.random() * (minWidth - 75))}
            />
          </Typography>
          <Typography variant="caption">
            <Skeleton
              animation="wave"
              variant="text"
              width={50 + (Math.random() * (minWidth - 75))}
            />
          </Typography>
        </Box>
      ))}
    </Stack>
  );
};

export default ItemsSkeleton;

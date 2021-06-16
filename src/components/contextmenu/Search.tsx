import { Box, InputBase } from '@material-ui/core';
import { alpha } from '@material-ui/core/styles';
import SearchIcon from '@material-ui/icons/Search';
import React, { ChangeEvent, FC, KeyboardEvent, useState } from 'react';

interface searchProps {
  handleQuery: (query: string) => void;
}

// Trap focus keys in Context menus
const trap = ['a', 'e', 'i', 'r', 's', 'c'];

const Search: FC<searchProps> = ({ handleQuery }) => {
  const [query, setQuery] = useState('');

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    handleQuery(event.target.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    //avoid trap
    if (trap.includes(event.key.toLocaleLowerCase())) {
      // console.log('trap:', event.key);
      event.preventDefault();
      event.stopPropagation();
      const newValue = `${query}${event.key}`;
      setQuery(newValue);
      handleQuery(newValue);
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        marginTop: ({ spacing }) => spacing(-0.5),
        backgroundColor: ({ palette }) =>
          palette.mode === 'light'
            ? alpha(palette.common.white, 0.02)
            : alpha(palette.common.black, 0.15),
        borderBottom: 2,
        borderColor: ({ palette }) =>
          palette.mode === 'light'
            ? alpha(palette.common.black, 0.02)
            : alpha(palette.common.black, 0.15),
        '&:hover': {
          borderColor: ({ palette }) =>
            query === '' ? alpha(palette.primary.main, 0.5) : palette.primary.main,
        },
        transition: ({ transitions }) => transitions.create('border'),
      }}
    >
      <Box
        sx={{
          padding: ({ spacing }) => spacing(0, 1),
          height: '100%',
          position: 'absolute',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: ({ palette }) => (query === '' ? 'inherit' : palette.primary.main),
          transition: ({ transitions }) => transitions.create('color'),
        }}
      >
        <SearchIcon fontSize="small" />
      </Box>
      <InputBase
        sx={{
          fontSize: '0.875rem',
          color: ({ palette }) => (query === '' ? 'inherit' : palette.primary.main),
          '& .MuiInputBase-input': {
            padding: ({ spacing }) => spacing(0.75, 0.75, 0.75, 0),
            // vertical padding + font size from searchIcon
            paddingLeft: ({ spacing }) => `calc(1em + ${spacing(2)})`,
            width: '100%',
          },
        }}
        placeholder="Search…"
        inputProps={{ 'aria-label': 'search' }}
        value={query}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
    </Box>
  );
};

export default Search;

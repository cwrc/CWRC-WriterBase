import { CssBaseline, ThemeProvider } from '@material-ui/core';
import PropTypes from 'prop-types';
import React, { useEffect } from 'react';
import { useApp } from './overmind';
import theme from './theme';
import Writer from './js/Writer';

const App = ({config}) => {
  const { state } = useApp();

  // const containerRef = useRef(null);
  

  useEffect(() => {
    // console.log(containerRef);
    config.container = 'cwrcWriterContainer';
    const writer = new Writer(config);
    window.writer = writer;

    writer.event('writerInitialized').subscribe(() => {
      writer.showLoadDialog();
    });
    
    return () => {};
  }, []);

  return (
    <ThemeProvider theme={theme(state.ui.darkMode)}>
      <CssBaseline />
      <div id='cwrcWriterContainer' style={{height: '100%', width: '100%'}} />
    </ThemeProvider>
  );
};

App.propTypes = {
    config: PropTypes.object,
};

export default App;

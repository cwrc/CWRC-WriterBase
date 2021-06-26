import '@fontsource/lato/100.css';
import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import React from 'react';
import { render } from 'react-dom';
import App from './App';
import { config } from './overmind';

const overmind = createOvermind(config, {
  devtools: true, // defaults to 'localhost:3031'
  logProxies: true,
});

const init = (config: any) => {
  render(
    <Provider value={overmind}>
      <App config={config} />
    </Provider>,
    document.querySelector(`#${config.container}`)
  );
};

if (module.hot) module.hot.accept();

export default {
  init,
};

import type { Preview } from '@storybook/nextjs';

import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0c0c14' },
        { name: 'light', value: '#f8fafc' },
        { name: 'white', value: '#ffffff' },
      ],
    },
  },
};

export default preview;

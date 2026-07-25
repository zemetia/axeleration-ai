import type { Preview } from '@storybook/nextjs';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';

import '../src/app/globals.css';

const messages = {
  common: {
    loading: 'Loading...',
    error: 'An error occurred',
    retry: 'Try again',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    submit: 'Submit',
    search: 'Search',
    noResults: 'No results found',
    language: 'Language',
  },
  navigation: {
    home: 'Home',
    about: 'About',
    signIn: 'Sign In',
    getStarted: 'Get Started',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },
};

const preview: Preview = {
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        <Story />
      </NextIntlClientProvider>
    ),
  ],
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

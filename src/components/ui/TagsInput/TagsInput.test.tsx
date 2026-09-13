import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TagsInput } from './TagsInput';

describe('TagsInput', () => {
  it('associates the label with the input', () => {
    render(<TagsInput label="Tags" value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Tags' })).toBeInTheDocument();
  });

  it('commits a comma-separated list, lowercased and de-duplicated', async () => {
    const onChange = vi.fn();
    // `TagsInput` is controlled: each comma commits against the `value` it currently holds, so a
    // static `value={[]}` would make every commit start from an empty list and the assertion would
    // only ever see the last tag. The harness feeds the new value back, as every real caller does.
    function Harness() {
      const [tags, setTags] = useState<string[]>([]);
      return (
        <TagsInput
          label="Tags"
          value={tags}
          onChange={(next) => {
            onChange(next);
            setTags(next);
          }}
        />
      );
    }
    render(<Harness />);

    await userEvent.type(screen.getByRole('textbox'), 'Anime, anime, Realistic{enter}');

    expect(onChange).toHaveBeenLastCalledWith(['anime', 'realistic']);
  });

  it('renders each tag as a removable chip', async () => {
    const onChange = vi.fn();
    render(<TagsInput label="Tags" value={['cartoon', 'anime']} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove cartoon' }));

    expect(onChange).toHaveBeenCalledWith(['anime']);
  });

  it('removes the last tag on backspace in an empty input', async () => {
    const onChange = vi.fn();
    render(<TagsInput label="Tags" value={['cartoon', 'anime']} onChange={onChange} />);

    await userEvent.type(screen.getByRole('textbox'), '{backspace}');

    expect(onChange).toHaveBeenCalledWith(['cartoon']);
  });

  it('adds a suggestion on click and hides it once used', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TagsInput label="Tags" value={[]} onChange={onChange} suggestions={['cartoon', 'anime']} />,
    );

    await userEvent.click(screen.getByRole('button', { name: '+ cartoon' }));
    expect(onChange).toHaveBeenCalledWith(['cartoon']);

    rerender(
      <TagsInput
        label="Tags"
        value={['cartoon']}
        onChange={onChange}
        suggestions={['cartoon', 'anime']}
      />,
    );
    expect(screen.queryByRole('button', { name: '+ cartoon' })).not.toBeInTheDocument();
  });

  it('stops accepting tags at maxTags', () => {
    render(<TagsInput label="Tags" value={['cartoon', 'anime']} onChange={vi.fn()} maxTags={2} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('shows the error instead of the hint and marks the input invalid', () => {
    render(
      <TagsInput
        label="Tags"
        value={[]}
        onChange={vi.fn()}
        hint="comma separated"
        error="Too many tags"
      />,
    );

    expect(screen.getByText('Too many tags')).toBeInTheDocument();
    expect(screen.queryByText('comma separated')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });
});

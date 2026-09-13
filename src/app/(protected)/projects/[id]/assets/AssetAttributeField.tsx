'use client';

import { SelectField } from '@/components/ui/SelectField';
import { TagsInput } from '@/components/ui/TagsInput';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { TextInputField } from '@/components/ui/TextInputField';
import type { AssetField } from '@/config/asset-schema';
import type { AssetAttributeValue } from '@/lib/validations';

export interface AssetAttributeFieldProps {
  field: AssetField;
  value: AssetAttributeValue | undefined;
  onChange: (key: string, value: AssetAttributeValue) => void;
}

/** Renders one schema-driven attribute. The `kind` in the config decides the control — nothing else. */
export function AssetAttributeField({ field, value, onChange }: AssetAttributeFieldProps) {
  switch (field.kind) {
    case 'tags':
      return (
        <TagsInput
          id={`attr-${field.key}`}
          label={field.label}
          hint={field.hint}
          placeholder={field.placeholder}
          suggestions={field.suggestions}
          value={Array.isArray(value) ? value : value ? [value] : []}
          onChange={(tags) => onChange(field.key, tags)}
        />
      );

    case 'select':
      return (
        <SelectField
          id={`attr-${field.key}`}
          label={field.label}
          hint={field.hint}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(field.key, event.target.value)}
          options={[
            { value: '', label: 'Not specified' },
            ...(field.options ?? []).map((option) => ({ value: option, label: option })),
          ]}
        />
      );

    case 'textarea':
      return (
        <TextAreaField
          label={field.label}
          hint={field.hint}
          placeholder={field.placeholder}
          rows={field.rows ?? 3}
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => onChange(field.key, next)}
        />
      );

    default:
      return (
        <TextInputField
          label={field.label}
          hint={field.hint}
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => onChange(field.key, next)}
        />
      );
  }
}
AssetAttributeField.displayName = 'AssetAttributeField';

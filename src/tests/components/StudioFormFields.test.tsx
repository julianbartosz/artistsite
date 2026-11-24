import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CategorySelectField, IntegerField, MoneyField } from '@/components/admin/StudioFormFields';

describe('StudioFormFields numeric inputs', () => {
  function IntegerHarness({
    initial = 100,
    min = 0,
    max,
    label = 'Quantity in stock',
  }: {
    initial?: number;
    min?: number;
    max?: number;
    label?: string;
  }) {
    const [value, setValue] = useState<number | ''>(initial);
    return (
      <div>
        <IntegerField label={label} value={value} min={min} max={max} onChange={setValue} />
        <output data-testid="int-value">{value === '' ? '' : String(value)}</output>
      </div>
    );
  }

  function MoneyHarness({ initial = 100 }: { initial?: number }) {
    const [value, setValue] = useState<number | ''>(initial);
    return (
      <div>
        <MoneyField label="Price" value={value} onChange={setValue} />
        <output data-testid="price-value">{value === '' ? '' : String(value)}</output>
      </div>
    );
  }

  it('uses text+numeric inputs and keeps quantity stable on wheel', () => {
    render(<IntegerHarness initial={100} />);
    const input = screen.getByRole('textbox', { name: 'Quantity in stock' });
    fireEvent.focus(input);
    fireEvent.wheel(input, { deltaY: 120 });
    expect(screen.getByTestId('int-value')).toHaveTextContent('100');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputMode', 'numeric');
  });

  it('sanitizes pasted currency/sign noise without allowing negatives', () => {
    render(
      <>
        <IntegerHarness initial={5} />
        <MoneyHarness initial={20} />
      </>,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Quantity in stock' }), {
      target: { value: '-30' },
    });
    expect(screen.getByTestId('int-value')).toHaveTextContent('30');

    fireEvent.change(screen.getByRole('textbox', { name: 'Price' }), {
      target: { value: '$1,250.5' },
    });
    expect(screen.getByTestId('price-value')).toHaveTextContent('1250.5');
  });

  it('clamps to max on blur and never publishes out-of-range parent state while typing', () => {
    render(<IntegerHarness initial={5} min={1} max={10} label="Edition size" />);
    const input = screen.getByRole('textbox', { name: 'Edition size' });

    fireEvent.change(input, { target: { value: '9' } });
    expect(screen.getByTestId('int-value')).toHaveTextContent('9');

    fireEvent.change(input, { target: { value: '99' } });
    // Draft can show 99, but parent must remain <= max until blur commits the clamp.
    expect(Number(screen.getByTestId('int-value').textContent)).toBeLessThanOrEqual(10);

    fireEvent.blur(input);
    expect(input).toHaveValue('10');
    expect(screen.getByTestId('int-value')).toHaveTextContent('10');
  });
});

describe('CategorySelectField creatable dropdown', () => {
  function MediumHarness({ initial = '' }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return (
      <div>
        <CategorySelectField
          label="Medium"
          value={value}
          options={['Acrylic on Canvas', 'Watercolor on Paper']}
          onChange={setValue}
          emptyLabel="Select medium…"
          addOptionLabel="+ Add new medium…"
          customPlaceholder="e.g. Oil on linen"
          customInputAriaLabel="New medium name"
        />
        <output data-testid="medium-value">{value}</output>
      </div>
    );
  }

  it('selects an existing option and keeps an empty placeholder for optional fields', () => {
    render(<MediumHarness />);
    const select = screen.getByRole('combobox', { name: 'Medium' });
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Select medium…' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'Watercolor on Paper' } });
    expect(screen.getByTestId('medium-value')).toHaveTextContent('Watercolor on Paper');
  });

  it('adds a custom medium through the inline add flow', () => {
    render(<MediumHarness />);
    const select = screen.getByRole('combobox', { name: 'Medium' });

    fireEvent.change(select, { target: { value: '__custom__' } });
    const customInput = screen.getByRole('textbox', { name: 'New medium name' });
    fireEvent.change(customInput, { target: { value: 'Oil on linen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByTestId('medium-value')).toHaveTextContent('Oil on linen');
    expect(screen.getByRole('option', { name: 'Oil on linen' })).toBeInTheDocument();
  });
});

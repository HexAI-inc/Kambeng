"use client";

import { Checkbox, DatePicker, Form, Input, Select } from "antd";
import type { CheckboxProps, DatePickerProps, FormItemProps, InputProps, SelectProps } from "antd";
import dayjs from "dayjs";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

type BaseFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = {
  name: TName;
  control: Control<TFieldValues>;
  label: React.ReactNode;
  rules?: Parameters<typeof Controller<TFieldValues>>[0]["rules"];
  formItemProps?: Omit<FormItemProps, "name" | "label" | "rules">;
};

export type AppInputFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = BaseFieldProps<TFieldValues, TName> & {
  inputProps?: InputProps;
};

export function AppInputField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  name,
  control,
  label,
  rules,
  formItemProps,
  inputProps,
}: AppInputFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState }) => (
        <Form.Item
          label={label}
          validateStatus={fieldState.error ? "error" : ""}
          help={fieldState.error?.message}
          {...formItemProps}
        >
          <Input {...inputProps} {...field} value={field.value ?? ""} />
        </Form.Item>
      )}
    />
  );
}

export type AppPasswordFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = BaseFieldProps<TFieldValues, TName> & {
  inputProps?: InputProps;
};

export function AppPasswordField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  name,
  control,
  label,
  rules,
  formItemProps,
  inputProps,
}: AppPasswordFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState }) => (
        <Form.Item
          label={label}
          validateStatus={fieldState.error ? "error" : ""}
          help={fieldState.error?.message}
          {...formItemProps}
        >
          <Input.Password {...inputProps} {...field} value={field.value ?? ""} />
        </Form.Item>
      )}
    />
  );
}

export type AppSelectFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = BaseFieldProps<TFieldValues, TName> & {
  selectProps?: SelectProps;
};

export function AppSelectField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  name,
  control,
  label,
  rules,
  formItemProps,
  selectProps,
}: AppSelectFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState }) => (
        <Form.Item
          label={label}
          validateStatus={fieldState.error ? "error" : ""}
          help={fieldState.error?.message}
          {...formItemProps}
        >
          <Select
            {...selectProps}
            value={field.value}
            onChange={(value) => field.onChange(value)}
            onBlur={field.onBlur}
          />
        </Form.Item>
      )}
    />
  );
}

export type AppCheckboxFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Omit<BaseFieldProps<TFieldValues, TName>, "label"> & {
  label: string;
  checkboxProps?: CheckboxProps;
};

export function AppCheckboxField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  name,
  control,
  label,
  rules,
  formItemProps,
  checkboxProps,
}: AppCheckboxFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState }) => (
        <Form.Item
          validateStatus={fieldState.error ? "error" : ""}
          help={fieldState.error?.message}
          valuePropName="checked"
          {...formItemProps}
        >
          <Checkbox
            {...checkboxProps}
            checked={Boolean(field.value)}
            onChange={(event) => field.onChange(event.target.checked)}
            onBlur={field.onBlur}
          >
            {label}
          </Checkbox>
        </Form.Item>
      )}
    />
  );
}

export type AppDateFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = BaseFieldProps<TFieldValues, TName> & {
  datePickerProps?: DatePickerProps;
};

export function AppDateField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  name,
  control,
  label,
  rules,
  formItemProps,
  datePickerProps,
}: AppDateFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState }) => (
        <Form.Item
          label={label}
          validateStatus={fieldState.error ? "error" : ""}
          help={fieldState.error?.message}
          {...formItemProps}
        >
          <DatePicker
            {...datePickerProps}
            value={field.value ? dayjs(field.value as string) : null}
            onChange={(value) => {
              const normalizedValue = Array.isArray(value) ? value[0] : value;
              field.onChange(normalizedValue ? normalizedValue.toISOString() : undefined);
            }}
            onBlur={field.onBlur}
            style={{ width: "100%", ...(datePickerProps?.style ?? {}) }}
          />
        </Form.Item>
      )}
    />
  );
}

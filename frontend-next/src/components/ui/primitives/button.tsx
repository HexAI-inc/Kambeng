"use client";

import { Button as AntButton } from "antd";
import type { ButtonProps } from "antd";

export type AppButtonProps = ButtonProps;

export function AppButton(props: AppButtonProps) {
  return <AntButton {...props} />;
}

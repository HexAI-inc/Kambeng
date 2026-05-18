"use client";

import { Alert, App as AntApp, Drawer, Modal, Skeleton, Spin } from "antd";
import type { AlertProps } from "antd";

export function AppAlert(props: AlertProps) {
	return <Alert {...props} />;
}
export const AppModal = Modal;
export const AppDrawer = Drawer;
export const AppSpin = Spin;
export const AppSkeleton = Skeleton;

export const AppFeedbackProvider = AntApp;

export function useAppFeedback() {
	return AntApp.useApp();
}

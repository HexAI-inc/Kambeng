"use client";

import { Col, Row, Space, Statistic } from "antd";
import type { SpaceProps } from "antd";

type AppSpaceProps = Omit<SpaceProps, "orientation"> & {
	orientation?: SpaceProps["orientation"];
};

export function AppSpace({ direction, orientation, ...props }: AppSpaceProps) {
	const resolvedOrientation = orientation ?? direction;
	return <Space {...props} orientation={resolvedOrientation} />;
}

export const AppRow = Row;
export const AppCol = Col;
export const AppStatistic = Statistic;

"use client";

import { AppModal } from "@/components/ui";
import styles from "./media-viewer.module.css";

interface MediaViewerProps {
  open: boolean;
  src: string | null;
  title: string;
  description?: string;
  mediaKind?: "image" | "document";
  onClose: () => void;
}

export function MediaViewer({ open, src, title, description, mediaKind = "document", onClose }: MediaViewerProps) {
  const isImage = mediaKind === "image";

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      width="min(96vw, 1100px)"
      title={title}
      mask={{ closable: true }}
      styles={{ body: { padding: 0 } }}
    >
      <div className={styles.viewerShell}>
        {isImage ? (
          <img
            src={src ?? undefined}
            alt={title}
            className={styles.viewerImage}
          />
        ) : (
          <iframe
            title={title}
            src={src ?? undefined}
            className={styles.viewerFrame}
            loading="lazy"
          />
        )}
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
    </AppModal>
  );
}
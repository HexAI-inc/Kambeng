"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useCampaignAliases,
  useCreateCampaignAlias,
  useDeleteCampaignAlias,
} from "@/hooks/use-frontend-data";
import { AppButton, AppCard, AppSpace, AppInput, useAppFeedback } from "@/components/ui";
import styles from "./aliases.module.css";

export default function CampaignAliasesPage() {
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ?  parseInt(params.campaignId, 10) : null;

  const { data: aliases, isLoading } = useCampaignAliases(campaignId || undefined);
  const createAlias = useCreateCampaignAlias();
  const deleteAlias = useDeleteCampaignAlias();
  const { message } = useAppFeedback();

  const [newShortCode, setNewShortCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateAlias = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newShortCode.trim()) {
      message.error("Short code cannot be empty");
      return;
    }

    if (!/^[a-z0-9-]+$/i.test(newShortCode)) {
      message.error("Short code can only contain letters, numbers, and hyphens");
      return;
    }

    if (campaignId === null) {
      message.error("Invalid campaign ID");
      return;
    }

    try {
      setIsCreating(true);
      await createAlias.mutateAsync({
        campaignId,
        shortCode: newShortCode,
      });
      message.success("Alias created successfully");
      setNewShortCode("");
    } catch (error: any) {
      message.error(
        error?.response?.data?.detail || "Failed to create alias",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteAlias = async (aliasId: number) => {
    if (!window.confirm("Delete this short code alias?")) return;

    if (campaignId === null) {
      message.error("Invalid campaign ID");
      return;
    }

    try {
      await deleteAlias.mutateAsync({
        campaignId,
        aliasId,
      });
      message.success("Alias deleted successfully");
    } catch (error) {
      message.error("Failed to delete alias");
    }
  };

  if (campaignId === null) {
    return <div>Invalid campaign ID</div>;
  }

  return (
    <AppSpace direction="vertical" size="large" className={styles.container}>
      <div>
        <h1>Campaign Short Codes</h1>
        <p className={styles.subtitle}>
          Create and manage short URL codes for easy sharing
        </p>
      </div>

      {/* Create Alias Section */}
      <AppCard>
        <form onSubmit={handleCreateAlias}>
          <AppSpace direction="vertical" size="large">
            <div>
              <h3>Create New Short Code</h3>
              <p className={styles.createHint}>
                Short codes make campaign URLs more shareable (e.g., hexai.pro/c/yourcode)
              </p>
            </div>

            <div className={styles.createForm}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Short Code</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.prefix}>hexai.pro/c/</span>
                  <AppInput
                    value={newShortCode}
                    onChange={(e) =>
                      setNewShortCode(
                        e.target.value.toLowerCase().replace(/\s+/g, "-"),
                      )
                    }
                    placeholder="my-campaign"
                    maxLength={50}
                    disabled={isCreating}
                  />
                </div>
                <p className={styles.inputHint}>
                  Only letters, numbers, and hyphens allowed
                </p>
              </div>

              <AppButton
                htmlType="submit"
                type="primary"
                loading={isCreating || createAlias.isPending}
                disabled={!newShortCode.trim()}
              >
                Create Alias
              </AppButton>
            </div>
          </AppSpace>
        </form>
      </AppCard>

      {/* Aliases List */}
      {isLoading ? (
        <AppCard>
          <p>Loading aliases...</p>
        </AppCard>
      ) : aliases && aliases.length > 0 ? (
        <AppCard>
          <AppSpace direction="vertical" size="medium">
            <h3>Active Aliases ({aliases.length})</h3>

            <div className={styles.aliasesList}>
              {aliases.map((alias) => (
                <div key={alias.id} className={styles.aliasItem}>
                  <div className={styles.aliasInfo}>
                    <div className={styles.aliasCode}>
                      <span className={styles.prefix}>hexai.pro/c/</span>
                      <span className={styles.code}>{alias.short_code}</span>
                    </div>
                    <p className={styles.aliasUrl}>{alias.full_url}</p>
                    <p className={styles.created}>
                      Created {new Date(alias.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className={styles.aliasActions}>
                    <AppButton
                      size="small"
                      type="text"
                      onClick={() => {
                        navigator.clipboard.writeText(`hexai.pro/c/${alias.short_code}`);
                        message.success("Copied to clipboard");
                      }}
                    >
                      Copy
                    </AppButton>
                    <AppButton
                      size="small"
                      danger
                      onClick={() => handleDeleteAlias(alias.id)}
                      loading={deleteAlias.isPending}
                    >
                      Delete
                    </AppButton>
                  </div>
                </div>
              ))}
            </div>
          </AppSpace>
        </AppCard>
      ) : (
        <AppCard className={styles.emptyState}>
          <div className={styles.emptyContent}>
            <div className={styles.emptyIcon}>🔗</div>
            <h3>No short codes yet</h3>
            <p>Create your first short code using the form above</p>
          </div>
        </AppCard>
      )}

      {/* Info Section */}
      <AppCard className={styles.infoCard}>
        <AppSpace direction="vertical" size="small">
          <h4>About Short Codes</h4>
          <ul className={styles.infoList}>
            <li>Short codes make campaign URLs easier to share on social media</li>
            <li>Each code must be unique across all campaigns</li>
            <li>You can create multiple short codes for the same campaign</li>
            <li>Deleting a short code will break existing links using that code</li>
          </ul>
        </AppSpace>
      </AppCard>
    </AppSpace>
  );
}

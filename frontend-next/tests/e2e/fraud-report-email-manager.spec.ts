import { expect, test, type Page, type Route } from "@playwright/test";

const adminUsername = process.env.E2E_ADMIN_USERNAME;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

type NotificationEmail = {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function makeEmail(id: number, email: string, isActive: boolean): NotificationEmail {
  const now = new Date().toISOString();
  return { id, email, is_active: isActive, created_at: now, updated_at: now };
}

async function mockFraudEmailApi(page: Page, emails: NotificationEmail[]) {
  await page.route("**/api/backend/admin/fraud-report-notification-emails**", async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(emails),
      });
      return;
    }

    if (method === "POST") {
      const body = request.postDataJSON() as { email: string; is_active?: boolean };
      const created = makeEmail(emails.length + 1, body.email.toLowerCase(), body.is_active ?? true);
      emails.push(created);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }

    if (method === "PATCH") {
      const body = request.postDataJSON() as { email?: string; is_active?: boolean };
      const id = Number(path.split("/").pop());
      const existing = emails.find((entry) => entry.id === id);
      if (!existing) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Notification email not found" }) });
        return;
      }

      if (typeof body.email === "string") {
        existing.email = body.email.toLowerCase();
      }
      if (typeof body.is_active === "boolean") {
        existing.is_active = body.is_active;
      }
      existing.updated_at = new Date().toISOString();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(existing),
      });
      return;
    }

    if (method === "DELETE") {
      const id = Number(path.split("/").pop());
      const index = emails.findIndex((entry) => entry.id === id);
      if (index >= 0) {
        emails.splice(index, 1);
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Notification email deleted" }),
      });
      return;
    }

    await route.fallback();
  });
}

test.describe("admin fraud email manager", () => {
  test.skip(!adminUsername || !adminPassword, "Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to run authenticated smoke tests");

  test("can manage fraud-report notification emails", async ({ page }) => {
    await page.goto("/auth/login");

    await page.locator("#login-username").fill(adminUsername!);
    await page.locator("#login-password").fill(adminPassword!);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/dashboard\//);

    const emails: NotificationEmail[] = [makeEmail(1, "security@example.com", true)];
    await mockFraudEmailApi(page, emails);

    await page.goto("/admin/fraud-report-notification-emails");
    await expect(page.getByText("Fraud Alert Emails")).toBeVisible();
    await expect(page.getByText("security@example.com")).toBeVisible();

    await page.getByPlaceholder("security@example.com").fill("alerts@example.com");
    await page.getByRole("button", { name: "Add email" }).click();
    await expect(page.getByText("alerts@example.com")).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).last().click();
    await expect(page.getByText("Edit recipient")).toBeVisible();
    await page.getByPlaceholder("security@example.com").last().fill("ops@example.com");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("ops@example.com")).toBeVisible();

    await page.getByRole("button", { name: "Disable" }).first().click();
    await expect(page.getByText("Disabled")).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page.getByText("ops@example.com")).toHaveCount(0);

    await expect(page.getByText("Fraud Alert Emails")).toBeVisible();
  });

  test("sidebar link opens the page directly", async ({ page }) => {
    await page.goto("/auth/login");

    await page.locator("#login-username").fill(adminUsername!);
    await page.locator("#login-password").fill(adminPassword!);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/dashboard\//);

    const emails: NotificationEmail[] = [makeEmail(1, "security@example.com", true)];
    await mockFraudEmailApi(page, emails);

    await page.goto("/admin/campaigns");
    await expect(page.getByText("Admin Campaigns")).toBeVisible();

    await page.getByRole("link", { name: "Fraud Emails" }).click();
    await expect(page).toHaveURL(/\/admin\/fraud-report-notification-emails/);
    await expect(page.getByText("Fraud Alert Emails")).toBeVisible();
    await expect(page.getByText("security@example.com")).toBeVisible();
  });
});
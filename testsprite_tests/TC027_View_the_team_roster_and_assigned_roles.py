import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        pw = await async_api.async_playwright().start()
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )
        context = await browser.new_context()
        context.set_default_timeout(15000)
        page = await context.new_page()

        await page.goto("http://localhost:3000/login")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Login
        await page.get_by_role('button', name='Acme Owner admin@acme.com', exact=True).click(timeout=10000)
        await page.locator('[id="submit-login-btn"]').click(timeout=10000)
        await expect(page).to_have_url(re.compile(r"/acme-corp"), timeout=15000)

        # Open Users & Roles
        await page.goto("http://localhost:3000/acme-corp/users")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Verify the roster table is present with at least one member row
        first_row = page.locator("table tbody tr").first
        await expect(first_row).to_be_visible(timeout=15000)

        # Verify the first row has a role badge (OWNER/ADMIN/MEMBER/VIEWER)
        role_cell = first_row.locator("td").nth(1)
        await expect(role_cell).to_be_visible(timeout=15000)
        role_text = await role_cell.inner_text()
        assert any(r in role_text for r in ["OWNER", "ADMIN", "MEMBER", "VIEWER"]), \
            f"Expected role badge, got: {role_text}"

        # Verify the OWNER role is somewhere in the table (admin@acme.com is OWNER)
        owner_row = page.locator("table tbody tr", has_text="OWNER").first
        await expect(owner_row).to_be_visible(timeout=15000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
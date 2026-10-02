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

        # Login as Owner (has access to ledger)
        await page.get_by_role('button', name='Acme Owner admin@acme.com', exact=True).click(timeout=10000)
        await page.locator('[id="submit-login-btn"]').click(timeout=10000)
        await expect(page).to_have_url(re.compile(r"/acme-corp"), timeout=15000)

        # Navigate directly to General Ledger
        await page.goto("http://localhost:3000/acme-corp/finance/ledger")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Verify the ledger page loaded
        await expect(page.locator("h1").first).to_be_visible(timeout=15000)

        # Verify the table header is visible (Type, Date, Description, etc.)
        await expect(page.locator("table thead tr").first).to_be_visible(timeout=15000)

        # Verify at least one ledger entry row is visible
        first_row = page.locator("table tbody tr").first
        await expect(first_row).to_be_visible(timeout=15000)

        # Verify the Entry Type filter select is present
        type_select = page.locator("div:has(> span:has-text('Entry Type:')) select")
        await expect(type_select).to_be_visible(timeout=15000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
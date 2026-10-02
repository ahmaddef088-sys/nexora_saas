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

        # Open Orders
        await page.goto("http://localhost:3000/acme-corp/orders")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Filter by DRAFT status
        status_select = page.locator("main select").first
        await status_select.wait_for(state="visible", timeout=10000)
        await status_select.select_option("DRAFT")

        # Verify all displayed rows are Draft
        rows = page.locator("table tbody tr")
        count = await rows.count()
        if count > 0:
            for i in range(count):
                await expect(rows.nth(i)).to_contain_text("Draft", timeout=5000)

        # Filter by COMPLETED status
        await status_select.select_option("COMPLETED")
        rows = page.locator("table tbody tr")
        count = await rows.count()
        if count > 0:
            for i in range(count):
                await expect(rows.nth(i)).to_contain_text("Completed", timeout=5000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
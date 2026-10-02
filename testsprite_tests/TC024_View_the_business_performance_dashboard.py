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

        # Open Reports & Analytics
        await page.goto("http://localhost:3000/acme-corp/reports")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Verify the reports page loaded
        await expect(page.locator("h1").first).to_be_visible(timeout=15000)

        # Click Sales & Orders tab
        sales_tab = page.get_by_role('button', name='Sales & Orders', exact=True)
        await expect(sales_tab).to_be_visible(timeout=15000)
        await sales_tab.click(timeout=10000)

        # Verify an SVG chart or table is rendered
        await expect(page.locator("svg, table").first).to_be_visible(timeout=15000)

        # Click Executive Overview tab
        exec_tab = page.get_by_role('button', name='Executive Overview', exact=True)
        await expect(exec_tab).to_be_visible(timeout=15000)
        await exec_tab.click(timeout=10000)

        # Verify some chart content is displayed
        await expect(page.locator("svg, table, canvas").first).to_be_visible(timeout=15000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
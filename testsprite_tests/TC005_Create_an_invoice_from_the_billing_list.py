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

        # Open Finance Hub
        await page.goto("http://localhost:3000/acme-corp/finance")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Click Open Invoices link
        invoices_link = page.locator("a[href$='/finance/invoices']").first
        await expect(invoices_link).to_be_visible(timeout=15000)
        await invoices_link.click(timeout=10000)
        await expect(page).to_have_url(re.compile(r"/finance/invoices"), timeout=15000)

        # Open Create Invoice Modal
        await page.locator('[id="create-invoice-btn"]').click(timeout=10000)

        # Select a customer
        customer_select = page.locator("form select").first
        await customer_select.wait_for(state="visible", timeout=10000)
        await customer_select.select_option(index=1)

        # Submit create draft invoice
        await page.get_by_role('button', name='Create Draft Invoice', exact=True).click(timeout=10000)

        # Verify the new invoice appears in the invoice table
        first_row = page.locator("table tbody tr").first
        await expect(first_row).to_be_visible(timeout=15000)
        # Verify it has an invoice number (INV-) and DRAFT status
        await expect(first_row).to_contain_text("INV-", timeout=15000)
        await expect(first_row).to_contain_text("Draft", timeout=15000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
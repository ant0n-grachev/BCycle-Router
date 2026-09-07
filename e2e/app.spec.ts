import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  DESTINATION_COORDINATES,
  loadReadyApp,
  mockAppNetwork,
  ORIGIN_COORDINATES,
  resolveCoordinates,
} from './fixtures';

test('loads cleanly without console errors or a framework overlay', async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !(
        testInfo.project.name === 'mobile-webkit' &&
        message.text() ===
          "Service worker registration failed. TypeError: undefined is not an object (evaluating 'r.fn.waiting')"
      )
    ) {
      browserErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await mockAppNetwork(page);

  await loadReadyApp(page);

  await expect(page).toHaveTitle(/BRouter/i);
  const title = page.getByRole('heading', { level: 1, name: /Madison's BRouter/ });
  const byline = page.getByRole('link', { name: 'by Anton' });
  await expect(title).toBeVisible();
  await expect(byline).toHaveAttribute('href', 'https://anton.grachev.us');
  await expect(byline).toHaveCSS('text-decoration-line', 'none');

  const titleBox = await title.boundingBox();
  const bylineBox = await byline.boundingBox();
  expect(titleBox).not.toBeNull();
  expect(bylineBox).not.toBeNull();
  expect((bylineBox?.y ?? 0) - (titleBox?.y ?? 0)).toBeLessThan((titleBox?.height ?? 0) + 8);
  expect((bylineBox?.x ?? 0) - ((titleBox?.x ?? 0) + (titleBox?.width ?? 0))).toBeLessThan(32);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test('uses concise map, search, and attribution copy', async ({ page }) => {
  await mockAppNetwork(page);
  await loadReadyApp(page);

  await expect(page.getByRole('heading', { name: 'Service Area Map' })).toBeVisible();
  await expect(page.getByText('Type at least 3 characters.', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Based on station locations;', { exact: false })).toHaveCount(0);
  await expect(page.getByLabel('Address search attribution and privacy')).toHaveCount(0);

  await expect(
    page.locator('.app-footer a[href="https://www.openstreetmap.org/copyright"]'),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Show station map' }).click();
  const attribution = page
    .locator('.leaflet-control-attribution')
    .getByRole('link', { name: 'OpenStreetMap' });
  await expect(attribution).toBeVisible();
  await expect(attribution).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
});

test('reveals footer install instructions from the keyboard', async ({ page }) => {
  await mockAppNetwork(page);
  await loadReadyApp(page);

  const disclosure = page.locator('details').filter({ hasText: 'How to install this app' });
  const summary = disclosure.locator('summary');

  await expect(summary).toBeVisible();
  await expect(disclosure).not.toHaveAttribute('open', '');
  await expect(disclosure.getByText('iPhone/iPad:', { exact: true })).toBeHidden();
  await expect(disclosure.getByText('Android:', { exact: true })).toBeHidden();

  await summary.focus();
  await summary.press('Enter');

  await expect(disclosure).toHaveAttribute('open', '');
  await expect(disclosure.getByText('iPhone/iPad:', { exact: true })).toBeVisible();
  await expect(disclosure.getByText('Android:', { exact: true })).toBeVisible();
  await expect(disclosure.locator('.app-install__instructions p')).toHaveText([
    /iPhone\/iPad:.*Safari.*Share.*Add to Home Screen.*Open as Web App.*Add/,
    /Android:.*Chrome.*three-dot menu.*Install app.*Add to Home screen.*prompts/,
  ]);
});

for (const installedMode of ['standalone', 'ios'] as const) {
  test(`hides install instructions in ${installedMode} web-app mode`, async ({ page }) => {
    await page.addInitScript((mode) => {
      if (mode === 'ios') {
        Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
      } else {
        const originalMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = (query) => {
          const result = originalMatchMedia(query);
          if (query.includes('display-mode: standalone')) {
            Object.defineProperty(result, 'matches', { value: true });
          }
          return result;
        };
      }
    }, installedMode);
    await mockAppNetwork(page);
    await loadReadyApp(page);

    await expect(page.locator('.app-footer')).toBeVisible();
    await expect(page.getByText('How to install this app', { exact: true })).toHaveCount(0);
  });
}

test('serves a manifest with a stable root app identity', async ({ page }) => {
  await mockAppNetwork(page);
  await loadReadyApp(page);

  const manifestText = await page.evaluate(async () => {
    const response = await fetch('/manifest.json');
    return response.text();
  });
  const manifest: unknown = JSON.parse(manifestText);

  expect(manifest).toMatchObject({
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f7fb',
    theme_color: '#f4f7fb',
  });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f4f7fb');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(244, 247, 251)');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(244, 247, 251)');
  await expect(page.locator('body')).toHaveCSS('background-image', 'none');
});

test('shows exact bikes/docks counts with distinct availability colors on the map', async ({
  page,
}) => {
  await mockAppNetwork(page);
  await loadReadyApp(page);

  const toggle = page.getByRole('button', { name: 'Show station map' });
  await expect(toggle).toHaveText(/^Show$/);
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Hide station map' })).toHaveText(/^Hide$/);

  const legend = page.getByLabel('Station map legend');
  await expect(legend.getByText('Bikes / docks')).toBeVisible();
  const examples = legend.locator('.station-map__legend-symbol');
  await expect(examples).toHaveText(['2/2', '2/0', '0/2', '0/0']);
  await expect(examples.nth(0)).toHaveCSS('background-color', 'rgb(109, 40, 217)');
  await expect(examples.nth(1)).toHaveCSS('background-color', 'rgb(3, 105, 161)');
  await expect(examples.nth(2)).toHaveCSS('background-color', 'rgb(22, 101, 52)');
  await expect(examples.nth(3)).toHaveCSS('background-color', 'rgb(185, 28, 28)');

  await expect(page.locator('.station-map__marker').filter({ hasText: '2/4' })).toBeVisible();
  await expect(page.locator('.station-map__marker--disabled')).toHaveText('×');
});

test('selects eligible pickup and drop-off stations from the map and synchronizes the trip', async ({
  page,
}) => {
  await mockAppNetwork(page);
  await loadReadyApp(page);
  await resolveCoordinates(page, 'Starting location', ORIGIN_COORDINATES);
  await resolveCoordinates(page, 'Destination', DESTINATION_COORDINATES);

  await page.getByRole('button', { name: 'Show station map' }).click();

  const pickupChoices = page.getByRole('group', { name: 'Pickup station' });
  const dropoffChoices = page.getByRole('group', { name: 'Drop-off station' });
  const routeLinks = page.getByRole('link', { name: /in Google Maps/ });
  const originalBikeUrl = await routeLinks.nth(1).getAttribute('href');

  await page.locator('[title^="West Washington & Bedford:"]').click();
  await page.getByRole('button', { name: 'Choose West Washington & Bedford as pickup' }).click();

  await expect(
    pickupChoices.getByRole('radio', { name: /West Washington & Bedford/ }),
  ).toBeChecked();
  await expect(page.locator('[title^="West Washington & Bedford:"]')).toHaveClass(
    /station-map__marker-container/,
  );
  await expect(
    page.locator('[title^="West Washington & Bedford:"] .station-map__marker'),
  ).toHaveClass(/station-map__marker--selected/);
  await expect(routeLinks.nth(1)).not.toHaveAttribute('href', originalBikeUrl ?? '');

  await page.locator('[title^="Monona Terrace:"]').click();
  await page.getByRole('button', { name: 'Choose Monona Terrace as drop-off' }).click();

  await expect(dropoffChoices.getByRole('radio', { name: /Monona Terrace/ })).toBeChecked();
  await expect(page.locator('[title^="Monona Terrace:"] .station-map__marker')).toHaveClass(
    /station-map__marker--selected/,
  );
  await expect(routeLinks.nth(1)).toHaveAttribute('href', /destination=43\.0762%2C-89\.3867/);
});

test('automatically searches manual origin and lets Enter choose the first result', async ({
  page,
}) => {
  const calls = await mockAppNetwork(page);
  await loadReadyApp(page);
  const input = page.getByRole('combobox', { name: 'Starting location' });

  await input.pressSequentially('Capitol Square');
  expect(calls.geocoding).toBe(0);
  await expect(
    page.getByRole('button', { name: /Search (starting location|destination)/ }),
  ).toHaveCount(0);
  await expect(input).toBeFocused();

  await expect.poll(() => calls.geocoding).toBe(1);
  const request = new URL(calls.geocodingUrls[0] ?? '');
  expect(request.searchParams.get('bbox')).toBeTruthy();
  const firstResult = page.getByRole('option', {
    name: 'Capitol Square, Madison, Wisconsin',
  });
  await expect(firstResult).toBeVisible();

  await input.press('Enter');

  await expect(input).toHaveValue('Capitol Square, Madison, Wisconsin');
  await expect(page.getByRole('group', { name: 'Pickup station' })).toBeVisible();
  expect(calls.geocoding).toBe(1);
});

test('automatically searches destination within the current station service area', async ({
  page,
}) => {
  const calls = await mockAppNetwork(page);
  await loadReadyApp(page);
  const input = page.getByRole('combobox', { name: 'Destination' });

  await input.fill('State Street');
  expect(calls.geocoding).toBe(0);
  await expect(page.getByRole('button', { name: 'Search destination' })).toHaveCount(0);
  await expect(input).toBeFocused();

  await expect.poll(() => calls.geocoding).toBe(1);
  await expect(page.getByRole('option', { name: /Capitol Square/ })).toBeVisible();
  const request = new URL(calls.geocodingUrls[0] ?? '');
  expect(request.searchParams.get('bbox')).toBeTruthy();
});

test('resolves coordinates locally without a Photon request', async ({ page }) => {
  const calls = await mockAppNetwork(page);
  await loadReadyApp(page);

  await resolveCoordinates(page, 'Starting location', ORIGIN_COORDINATES);

  await expect(page.getByRole('combobox', { name: 'Starting location' })).toHaveValue(
    ORIGIN_COORDINATES,
  );
  await expect(page.getByRole('group', { name: 'Pickup station' })).toBeVisible();
  expect(calls.geocoding).toBe(0);
});

test('offers walking directions to the selected pickup without requiring a destination', async ({
  page,
}) => {
  await mockAppNetwork(page);
  await loadReadyApp(page);
  await resolveCoordinates(page, 'Starting location', ORIGIN_COORDINATES);

  const recommendedLink = page.getByRole('link', { name: 'Walk to Capitol Square' });
  await expect(recommendedLink).toBeVisible();
  const recommendedDirections = new URL((await recommendedLink.getAttribute('href')) ?? '');
  expect(recommendedDirections.searchParams.get('origin')).toBe('43.0731,-89.4012');
  expect(recommendedDirections.searchParams.get('destination')).toBe('43.0732,-89.4011');
  expect(recommendedDirections.searchParams.get('travelmode')).toBe('walking');
  expect(recommendedDirections.searchParams.get('api')).toBe('1');
  await expect(page.getByRole('heading', { name: 'Your three-leg itinerary' })).toHaveCount(0);

  await page
    .getByRole('group', { name: 'Pickup station' })
    .getByRole('radio', { name: /West Washington & Bedford/ })
    .check();

  const alternativeLink = page.getByRole('link', { name: 'Walk to West Washington & Bedford' });
  await expect(alternativeLink).toBeVisible();
  await expect(page.getByRole('link', { name: /^Walk to / })).toHaveCount(1);
  const alternativeDirections = new URL((await alternativeLink.getAttribute('href')) ?? '');
  expect(alternativeDirections.searchParams.get('destination')).toBe('43.074,-89.3997');
  expect(alternativeDirections.searchParams.get('travelmode')).toBe('walking');
});

test('defaults to the closest stations, explains alternatives, and recomputes route links', async ({
  page,
}) => {
  await mockAppNetwork(page);
  await loadReadyApp(page);
  await resolveCoordinates(page, 'Starting location', ORIGIN_COORDINATES);
  await resolveCoordinates(page, 'Destination', DESTINATION_COORDINATES);

  const pickupChoices = page.getByRole('group', { name: 'Pickup station' });
  const dropoffChoices = page.getByRole('group', { name: 'Drop-off station' });
  await expect(pickupChoices.locator('.station-choice__badge')).toHaveText([
    'Recommended — closest',
    'Alternative — next closest',
    'Alternative — more bikes',
  ]);
  await expect(dropoffChoices.locator('.station-choice__badge')).toHaveText([
    'Recommended — closest',
    'Alternative — next closest',
    'Alternative — more docks',
  ]);
  await expect(pickupChoices.getByRole('radio', { name: /Capitol Square/ })).toBeChecked();
  await expect(dropoffChoices.getByRole('radio', { name: /East Wilson & MLK/ })).toBeChecked();
  await expect(page.getByRole('heading', { name: 'Your itinerary' })).toBeVisible();
  await expect(page.getByText('Your destination is at the drop-off station.')).toBeVisible();

  const routeLinks = page.getByRole('link', { name: /in Google Maps/ });
  await expect(routeLinks).toHaveCount(2);
  const originalWalkUrl = await routeLinks.nth(0).getAttribute('href');

  const alternative = pickupChoices.getByRole('radio', {
    name: /West Washington & Bedford/,
  });
  await alternative.check();
  await expect(alternative).toBeChecked();
  await expect(routeLinks.nth(0)).not.toHaveAttribute('href', originalWalkUrl ?? '');

  await expect(routeLinks.nth(0)).toHaveAttribute('href', /travelmode=walking/);
  await expect(routeLinks.nth(1)).toHaveAttribute('href', /travelmode=bicycling/);
  await expect(page.getByRole('link', { name: /^Walk to / })).toHaveCount(0);
});

test('reports zero bikes without claiming a seasonal closure', async ({ page }) => {
  await mockAppNetwork(page, { zeroBikes: true });
  await page.goto('/');
  await expect(page.getByText('No rentable bikes are currently reported.')).toBeVisible();

  await resolveCoordinates(page, 'Starting location', ORIGIN_COORDINATES);

  await expect(
    page.getByText('No bikes are currently available at installed rental stations.'),
  ).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/season|seasonal/i);
});

test('keeps the last successful snapshot when an explicit refresh fails', async ({ page }) => {
  const calls = await mockAppNetwork(page, { failStatusAfter: 1 });
  await loadReadyApp(page);
  const refreshedAt = page.getByText(/Last successful refresh:/);
  const originalRefreshText = await refreshedAt.textContent();

  await page.getByRole('button', { name: 'Refresh station data' }).click();

  await expect(
    page.getByText('Refresh failed. Showing the last successful station snapshot.'),
  ).toBeVisible();
  await expect(refreshedAt).toHaveText(originalRefreshText ?? '');
  expect(calls.stationStatus).toBeGreaterThanOrEqual(2);
});

test('uses mocked device geolocation without switching to manual mode', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['geolocation'], {
    origin: 'http://127.0.0.1:4173',
  });
  await context.setGeolocation({ latitude: 43.0731, longitude: -89.4012 });
  await mockAppNetwork(page);
  await loadReadyApp(page);

  await page.getByRole('radio', { name: 'Use my device location' }).check();

  await expect(page.getByText(/Device location received: 43\.07310, -89\.40120/)).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Use my device location' })).toBeChecked();
  await expect(page.getByRole('group', { name: 'Pickup station' })).toBeVisible();

  await resolveCoordinates(page, 'Destination', DESTINATION_COORDINATES);
  await expect(page.getByRole('heading', { name: 'Your itinerary' })).toBeVisible();
  await expect(page.getByText('Your destination is at the drop-off station.')).toBeVisible();
});

test('switches an out-of-area device location to manual origin entry', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['geolocation'], {
    origin: 'http://127.0.0.1:4173',
  });
  await context.setGeolocation({ latitude: 44, longitude: -89 });
  await mockAppNetwork(page);
  await loadReadyApp(page);

  await page.getByRole('radio', { name: 'Use my device location' }).click();

  await expect(page.getByRole('radio', { name: 'Enter a starting location' })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Starting location' })).toBeVisible();
  await expect(
    page.getByText(
      'Your device location is outside the current BCycle service area. Enter a starting location instead.',
    ),
  ).toBeVisible();
});

test('has no serious or critical Axe violations in the planned-trip view', async ({ page }) => {
  await mockAppNetwork(page);
  await loadReadyApp(page);
  await resolveCoordinates(page, 'Starting location', ORIGIN_COORDINATES);
  await resolveCoordinates(page, 'Destination', DESTINATION_COORDINATES);
  const installDisclosure = page.locator('details.app-install');
  await installDisclosure.locator('summary').click();
  await expect(installDisclosure).toHaveAttribute('open', '');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const severeViolations = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );

  expect(severeViolations).toEqual([]);
});

test('loads the app shell offline and does not return HTML for a failed asset request', async ({
  context,
  page,
}, testInfo) => {
  await mockAppNetwork(page);
  await loadReadyApp(page);

  if (testInfo.project.name !== 'mobile-webkit') {
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // The first reload places the page under the generated Workbox service worker.
    await page.reload();
    await page.getByRole('heading', { level: 1, name: /Madison's BRouter/ }).waitFor();
  }

  const failedAsset = await page.evaluate(async () => {
    const response = await fetch('/assets/definitely-missing.js');
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      body: (await response.text()).slice(0, 100).toLowerCase(),
    };
  });
  expect(failedAsset.status).toBe(404);
  expect(failedAsset.contentType ?? '').not.toContain('text/html');
  expect(failedAsset.body).not.toContain('<!doctype html');

  if (testInfo.project.name === 'mobile-webkit') {
    // WebKit reports an internal error when reloading an offline document.
    // Keep the loaded shell mounted and exercise the app's offline signal.
    await page.evaluate(() => {
      Object.defineProperty(Navigator.prototype, 'onLine', {
        configurable: true,
        get: () => false,
      });
      window.dispatchEvent(new Event('offline'));
    });
    await context.setOffline(true);
  } else {
    // Route interception keeps Playwright's navigator.onLine value true even
    // while its network is disconnected, so make that browser signal explicit
    // for the new offline document.
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'onLine', {
        configurable: true,
        get: () => false,
      });
    });
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
  }

  await expect(page.getByRole('heading', { level: 1, name: /Madison's BRouter/ })).toBeVisible();
  await expect(
    page.getByText(
      'You are offline. The app shell is available, but live station planning and address search require a connection.',
    ),
  ).toBeVisible();

  await context.setOffline(false);
});
